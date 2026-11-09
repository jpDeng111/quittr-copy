const { DatabaseSync } = require('node:sqlite');
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs');
const path = require('node:path');

const scope = new AsyncLocalStorage();
const current = () => scope.getStore();
const failure = (status, message) => Object.assign(new Error(message), { status });

function createStore(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  fs.chmodSync(filename, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL, password_changed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS user_state (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL,
      data TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id, id)
    );
    CREATE TABLE IF NOT EXISTS chat_turns (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL,
      data TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id, id)
    );
    CREATE INDEX IF NOT EXISTS journals_history ON journal_entries(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS turns_history ON chat_turns(user_id, created_at DESC);
    PRAGMA user_version=1;`);
  const queues = new Map();
  function read(userId) {
    db.prepare('INSERT OR IGNORE INTO user_state VALUES (?, ?, ?)').run(userId, JSON.stringify({ startedAt: new Date().toISOString(), relapses: [], preferences: {} }), new Date().toISOString());
    const row = db.prepare('SELECT data FROM user_state WHERE user_id = ?').get(userId);
    const data = row ? JSON.parse(row.data) : { startedAt: new Date().toISOString(), relapses: [], preferences: {} };
    return { ...data,
      journalEntries: db.prepare('SELECT data FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC').all(userId).map(row => JSON.parse(row.data)),
      meliusTurns: Object.fromEntries(db.prepare('SELECT id, data FROM chat_turns WHERE user_id = ? ORDER BY created_at').all(userId).map(row => [row.id, JSON.parse(row.data)])) };
  }
  function write(userId, state) {
    const { journalEntries = [], meliusTurns = {}, ...data } = state;
    const previous = current()?.user.id === userId ? current().state : null;
    const previousJournals = new Map((previous?.journalEntries || []).map(entry => [entry.id, JSON.stringify(entry)]));
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`INSERT INTO user_state VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`)
        .run(userId, JSON.stringify(data), new Date().toISOString());
      const journal = db.prepare(`INSERT INTO journal_entries VALUES (?, ?, ?, ?) ON CONFLICT(user_id,id) DO UPDATE SET data=excluded.data`);
      for (const entry of journalEntries) {
        const encoded = JSON.stringify(entry);
        if (previousJournals.get(entry.id) !== encoded) journal.run(userId, entry.id, encoded, entry.createdAt);
      }
      const turn = db.prepare(`INSERT INTO chat_turns VALUES (?, ?, ?, ?) ON CONFLICT(user_id,id) DO UPDATE SET data=excluded.data`);
      for (const [id, value] of Object.entries(meliusTurns)) {
        const encoded = JSON.stringify(value);
        if (JSON.stringify(previous?.meliusTurns?.[id]) !== encoded) turn.run(userId, id, encoded, value.createdAt);
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return { db, read, write,
    // The lock covers asynchronous AI calls too. Different accounts remain concurrent.
    // Run one Node process per database; SQLite transactions protect each durable save.
    async run(user, handler) {
      const previous = queues.get(user.id) || Promise.resolve();
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      queues.set(user.id, gate);
      await previous;
      try { return await scope.run({ user, state: read(user.id) }, handler); }
      finally { release(); if (queues.get(user.id) === gate) queues.delete(user.id); }
    },
    close() { db.close(); }
  };
}

function chatHistory(state, { before, limit = 50 } = {}) {
  const turns = Object.entries(state.meliusTurns || {}).sort((a, b) => b[1].createdAt.localeCompare(a[1].createdAt) || b[0].localeCompare(a[0]));
  const offset = before ? turns.findIndex(([id]) => id === before) + 1 : 0;
  if (before && offset === 0) throw failure(400, '无效的历史记录游标。');
  const page = turns.slice(offset, offset + Math.min(100, Math.max(1, Number(limit) || 50)));
  return { messages: page.slice().reverse().flatMap(([id, turn]) => [
    { id, role: 'user', text: turn.userText || '', createdAt: turn.createdAt, status: turn.response ? 'answered' : 'failed',
      context: turn.context || [{ role: 'user', text: turn.userText || '' }], error: turn.response ? '' : '上次回复未完成，可以重试。' },
    ...(turn.response ? [{ id: `${id}-reply`, role: 'assistant', text: turn.response.reply, actions: turn.response.actions || [], status: 'complete', createdAt: turn.createdAt }] : [])
  ]), nextCursor: offset + page.length < turns.length ? page.at(-1)[0] : null };
}
module.exports = { createStore, current, failure, chatHistory };
