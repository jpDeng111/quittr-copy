const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { failure } = require('./storage');
const scrypt = promisify(crypto.scrypt);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const publicUser = user => ({ id: user.id, email: user.email, createdAt: user.created_at });
const emailOf = value => String(value || '').trim().toLowerCase();

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  const [, salt, expected] = encoded.split(':');
  const actual = await scrypt(String(password), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw failure(400, '请使用 12–128 位密码。');
}
function createAuth(store, { secure = false, allowRegistration = true } = {}) {
  const { db } = store;
  const cookieName = secure ? '__Host-quittr-session' : 'quittr-session';
  // Same cost on unknown accounts, so login does not cheaply reveal registrations.
  const dummyHash = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
  function tokenOf(req) {
    const pair = String(req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`));
    return pair ? pair.slice(cookieName.length + 1) : '';
  }
  function cookie(res, token = '') {
    res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 2592000 : 0}${secure ? '; Secure' : ''}`);
  }
  function issue(user, res) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(digest(token), user.id, Date.now() + 2592000000, Date.now());
    cookie(res, token);
  }
  function session(req) {
    const token = tokenOf(req);
    if (!/^[a-f0-9]{64}$/.test(token)) throw failure(401, '登录已过期，请重新登录。');
    const user = db.prepare(`SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?`).get(digest(token), Date.now());
    if (!user) throw failure(401, '登录已过期，请重新登录。');
    return user;
  }
  function limit(key, maximum, minutes) {
    const now = Date.now();
    db.prepare('DELETE FROM auth_attempts WHERE expires_at <= ?').run(now);
    db.prepare(`INSERT INTO auth_attempts VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count=count+1`).run(key, now + minutes * 60000);
    if (db.prepare('SELECT count FROM auth_attempts WHERE key=?').get(key).count > maximum) throw failure(429, '尝试过于频繁，请稍后重试。');
  }
  async function handle(action, req, res, body = {}) {
    if (action === 'session') {
      try { return { user: publicUser(session(req)), registrationOpen: allowRegistration }; }
      catch (error) { if (error.status === 401) return { user: null, registrationOpen: allowRegistration }; throw error; }
    }
    const email = emailOf(body.email);
    if (['login', 'register', 'password'].includes(action)) limit(`ip:${req.clientIp || req.socket.remoteAddress}`, 30, 15);
    if (['login', 'register'].includes(action)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw failure(400, '请输入有效的邮箱。');
      limit(`account:${digest(email)}`, 12, 15);
    }
    if (action === 'register') {
      if (!allowRegistration) throw failure(403, '目前未开放注册，请联系管理员。');
      validatePassword(body.password);
      const passwordHash = await hashPassword(body.password);
      const user = { id: crypto.randomUUID(), email, password_hash: passwordHash, created_at: new Date().toISOString() };
      try { db.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)').run(user.id, email, passwordHash, user.created_at); }
      catch (error) { if (error.code?.includes('CONSTRAINT') || error.message.includes('UNIQUE')) throw failure(409, '该邮箱无法注册，请尝试登录或联系管理员。'); throw error; }
      issue(user, res); return { user: publicUser(user) };
    }
    if (action === 'login') {
      if (typeof body.password !== 'string' || body.password.length > 128) throw failure(400, '邮箱或密码不正确。');
      const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
      const valid = await verifyPassword(body.password, user?.password_hash || dummyHash);
      if (!user || !valid) throw failure(401, '邮箱或密码不正确。');
      if (db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id)?.password_hash !== user.password_hash) throw failure(401, '密码已变更，请重新登录。');
      db.prepare('DELETE FROM auth_attempts WHERE key=?').run(`account:${digest(email)}`);
      // Replace this browser's previous session on successful login.
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(tokenOf(req)));
      issue(user, res); return { user: publicUser(user) };
    }
    if (action === 'logout') {
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(tokenOf(req)));
      cookie(res); return { user: null };
    }
    if (action === 'password') {
      const user = session(req);
      validatePassword(body.password);
      if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128 || !await verifyPassword(body.currentPassword, user.password_hash)) throw failure(401, '当前密码不正确。');
      const hash = await hashPassword(body.password);
      if (db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id)?.password_hash !== user.password_hash) throw failure(401, '密码已变更，请重新登录。');
      // Password changes invalidate all old sessions, including other devices.
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE users SET password_hash=?,password_changed_at=? WHERE id=?').run(hash, new Date().toISOString(), user.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      issue(user, res); return { message: '密码已更新，其他设备已退出登录。' };
    }
    throw failure(404, '接口不存在。');
  }
  return { session, handle, limitUser: (userId, action, maximum, minutes) => limit(`user:${userId}:${action}`, maximum, minutes) };
}
module.exports = { createAuth, publicUser, hashPassword, validatePassword };
