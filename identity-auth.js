const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { failure } = require('./storage');

const randomToken = () => randomBytes(32).toString('base64url');
const proofOf = value => createHash('sha256').update(value).digest('base64url');
const isToken = value => typeof value === 'string' && /^[\w-]{43}$/.test(value);
const nativeReturn = 'com.quittr.selfhosted.auth://complete';

function createIdentityAuth(db, { providers, origin, session, limit, allowRegistration, signIn }) {
  const { oauth, sms } = providers;
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_identities (
      provider TEXT NOT NULL, subject TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY(provider, subject), UNIQUE(user_id, provider)
    );
    CREATE TABLE IF NOT EXISTS login_flows (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, expires_at INTEGER NOT NULL
    );`);
  const availability = { apple: !!oauth.apple, google: !!oauth.google, sms: !!sms };
  function save(kind, data, minutes) {
    const id = randomToken();
    db.prepare('DELETE FROM login_flows WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO login_flows VALUES (?, ?, ?, ?)').run(proofOf(id), kind, JSON.stringify(data), Date.now() + minutes * 60000);
    return id;
  }
  function find(kind, id, remove = false) {
    if (!isToken(id)) return null;
    const statement = remove ? 'DELETE FROM login_flows WHERE id=? AND kind=? AND expires_at>? RETURNING data' :
      'SELECT data FROM login_flows WHERE id=? AND kind=? AND expires_at>?';
    const row = db.prepare(statement).get(proofOf(id), kind, Date.now());
    return row ? JSON.parse(row.data) : null;
  }
  function ipLimit(req, key, maximum, minutes) {
    limit(`identity:${key}:${req.clientIp || req.socket.remoteAddress}`, maximum, minutes);
  }
  function verifyLink(req, userId) {
    if (userId && session(req).id !== userId) throw failure(409, '账号已切换，请重新关联。');
  }
  function finish(req, res, { provider, subject, email, userId }) {
    verifyLink(req, userId);
    let user;
    db.exec('BEGIN IMMEDIATE');
    try {
      const identity = db.prepare(`SELECT users.* FROM login_identities JOIN users ON users.id=login_identities.user_id
        WHERE provider=? AND subject=?`).get(provider, subject);
      if (identity) {
        if (userId && identity.id !== userId) throw failure(409, '该登录方式已关联其他 Quittr 账号。');
        user = identity;
      } else if (userId) {
        user = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
        if (db.prepare('SELECT 1 FROM login_identities WHERE user_id=? AND provider=?').get(userId, provider)) {
          throw failure(409, '此账号已关联同类登录方式。');
        }
      } else {
        if (email && db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) {
          throw failure(409, '该邮箱已有 Quittr 账号。请先进入原账号，再在「登录方式」中关联。');
        }
        if (!allowRegistration) throw failure(403, '目前未开放注册，请联系管理员。');
        const id = randomUUID();
        user = { id, email: email || `identity:${id}`, password_hash: '', created_at: new Date().toISOString() };
        db.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)').run(id, user.email, '', user.created_at);
      }
      if (!identity) db.prepare('INSERT INTO login_identities VALUES (?,?,?)').run(provider, subject, user.id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return signIn(req, res, user, !!userId);
  }
  function methods(userId) {
    return db.prepare('SELECT provider, subject FROM login_identities WHERE user_id=? ORDER BY provider').all(userId)
      .map(({ provider, subject }) => ({ provider, ...(provider === 'sms' ? { last4: subject.slice(-4) } : {}) }));
  }
  async function handle(action, req, res, body) {
    if (action === 'oauth/start') {
      const { provider, challenge, native, link } = body;
      if (provider !== 'apple' && provider !== 'google') throw failure(400, '未知的登录方式。');
      const login = oauth[provider];
      if (!login) throw failure(503, '此登录方式尚未开通。');
      if (!isToken(challenge)) throw failure(400, '请重新发起登录。');
      ipLimit(req, 'oauth', 30, 15);
      const nonce = randomToken();
      const pkceVerifier = randomToken();
      const state = save(provider, {
        nonce, pkce_verifier: pkceVerifier, challenge, native: native === true,
        userId: link === true ? session(req).id : null
      }, 10);
      return { url: login.url({ state, nonce, pkce: proofOf(pkceVerifier) }) };
    }
    if (action === 'oauth/finish') {
      const { ticket, verifier } = body;
      ipLimit(req, 'finish', 30, 15);
      const proof = find('ticket', ticket);
      if (!proof || !isToken(verifier) || proof.challenge !== proofOf(verifier)) throw failure(400, '登录请求已失效，请重新登录。');
      verifyLink(req, proof.userId);
      if (!find('ticket', ticket, true)) throw failure(400, '登录请求已使用，请重新登录。');
      return finish(req, res, proof);
    }
    if (!sms) throw failure(503, '短信登录尚未开通。');
    if (action === 'sms/start') {
      const phone = typeof body.phone === 'string' ? body.phone.trim().replace(/[\s()-]/g, '') : '';
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw failure(400, '请输入带区号的有效手机号。');
      const userId = body.link === true ? session(req).id : null;
      ipLimit(req, 'sms-send', 10, 15);
      limit(`identity:sms-send:${proofOf(phone)}`, 1, 1);
      limit(`identity:sms-quota:${proofOf(phone)}`, 4, 15);
      const reference = await sms.start(phone);
      return { requestId: save('sms', { reference, phone, userId }, 10), retryAfter: 60 };
    }
    if (action === 'sms/verify') {
      ipLimit(req, 'sms-verify', 30, 15);
      const { requestId, code } = body;
      const flow = find('sms', requestId);
      if (!flow || typeof code !== 'string' || !/^\d{4,10}$/.test(code)) throw failure(400, '验证码无效或已过期。');
      verifyLink(req, flow.userId);
      limit(`identity:sms-check:${proofOf(requestId)}`, 5, 10);
      if (!await sms.verify(flow.reference, flow.phone, code) || !find('sms', requestId, true)) {
        throw failure(401, '验证码不正确或已过期。');
      }
      return finish(req, res, { provider: 'sms', subject: flow.phone, userId: flow.userId });
    }
    throw failure(404, '接口不存在。');
  }
  async function callback(provider, params) {
    const login = oauth[provider];
    const flow = login && find(provider, params.get('state'), true);
    if (!flow) throw failure(400, '登录请求已失效，请返回 Quittr 重新登录。');
    const url = new URL(flow.native ? nativeReturn : origin);
    const values = new URLSearchParams();
    try {
      const code = params.get('code');
      if (!code || code.length > 4096 || params.has('error')) throw Error('Authorization declined');
      const identity = await login.exchange(code, flow);
      const ticket = save('ticket', { ...identity, provider, userId: flow.userId, challenge: flow.challenge }, 2);
      values.set('ticket', ticket);
    } catch {
      values.set('loginFailed', '1');
    }
    if (flow.native) url.search = values;
    else url.hash = values;
    return url.href;
  }
  return { availability, methods, handle, callback };
}

module.exports = { createIdentityAuth };
