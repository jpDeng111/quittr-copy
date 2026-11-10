// Disposable browser QA server. No real data, credentials or model calls.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quittr-mobile-qa-'));
process.env.QUITTR_DATA_DIR = directory;
process.env.DASHSCOPE_API_KEY = 'fixture-only-key';
process.env.DASHSCOPE_BASE_URL = 'http://127.0.0.1:9';
process.env.PUBLIC_ORIGIN = '';
const { server, store } = require('../../server');
const { hashPassword } = require('../../auth');
(async () => {
  const now = new Date().toISOString();
  store.db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run('mobile-fixture', 'mobile@example.invalid', await hashPassword('fixture-mobile-2026'), now);
  store.write('mobile-fixture', { startedAt: now, relapses: [], preferences: {},
    journalEntries: [{ id: 'fixture-journal', title: '记录每一天的小小进步', body: '这是临时数据库里的界面验证记录。', createdAt: now }],
    meliusTurns: { 'fixture-turn-001': { createdAt: now, userText: '希望今晚早点休息。', response: { reply: '我们可以从一件小事开始：睡前留出十分钟，放下手机，给自己一点安静的空间。', actions: [] } } }
  });
  server.listen(3002, '127.0.0.1', () => console.log('Mobile QA ready on http://localhost:3002'));
})();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => { store.close(); fs.rmSync(directory, { recursive: true }); process.exit(0); }));
