const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync, backup } = require('node:sqlite');
const { createStore } = require('../storage');
const { hashPassword } = require('../auth');
const { dataDir } = require('./config');

async function main() {
  const [action, email, source] = process.argv.slice(2);
  const filename = path.join(dataDir, 'quittr.sqlite');
  if (!fs.existsSync(filename)) throw new Error('数据库尚未创建，请先运行 npm start 并注册账号。');
  if (action === 'backup') {
    const directory = path.join(dataDir, 'backups');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const target = path.join(directory, `quittr-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}.sqlite`);
    const db = new DatabaseSync(filename, { readOnly: true });
    try { await backup(db, target); fs.chmodSync(target, 0o600); console.log(`备份完成：${target}`); }
    finally { db.close(); }
    return;
  }
  const store = createStore(filename);
  try {
    if (action === 'users') {
      console.table(store.db.prepare('SELECT email,created_at FROM users ORDER BY created_at').all()); return;
    }
    if (['reset-password', 'import-legacy'].includes(action)) {
      const user = store.db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').trim().toLowerCase());
      if (!user) throw new Error('账号不存在。请指定已注册邮箱。');
      if (action === 'reset-password') {
        const password = crypto.randomBytes(18).toString('base64url');
        const hash = await hashPassword(password);
        store.db.exec('BEGIN IMMEDIATE');
        try {
          store.db.prepare('UPDATE users SET password_hash=?,password_changed_at=? WHERE id=?').run(hash, new Date().toISOString(), user.id);
          store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
          store.db.prepare('DELETE FROM auth_attempts WHERE key=?').run(`account:${crypto.createHash('sha256').update(user.email).digest('hex')}`);
          store.db.exec('COMMIT');
        } catch (error) { store.db.exec('ROLLBACK'); throw error; }
        console.log(`已重置 ${user.email} 的密码并注销所有登录。\n临时密码：${password}\n请私下告知用户，并要求登录后立即修改。`);
      } else {
        if (!source) throw new Error('需要明确指定原 JSON 文件路径。请先停止服务再导入。');
        const existing = store.read(user.id);
        if (existing.journalEntries.length || Object.keys(existing.meliusTurns).length || existing.relapses?.length || existing.urges?.length || existing.pledges?.length || existing.reasons?.length || Object.keys(existing.preferences || {}).length || existing.dailyLessons || existing.blocker) throw new Error('目标账号已有记录，拒绝覆盖。请使用刚注册且尚未操作的新账号。');
        const legacy = JSON.parse(fs.readFileSync(path.resolve(source), 'utf8'));
        if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy) || !legacy.startedAt) throw new Error('不是有效的旧版 Quittr 数据文件。');
        delete legacy.community;
        store.write(user.id, legacy);
        console.log(`已导入到 ${user.email}。原文件保留；旧版浏览器缓存不在该文件内。`);
      }
      return;
    }
    throw new Error('用法：npm run admin -- users | reset-password <邮箱> | import-legacy <邮箱> <JSON路径>；备份：npm run backup');
  } finally { store.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
