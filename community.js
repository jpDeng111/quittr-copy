const crypto = require('node:crypto');
const { failure } = require('./storage');

function createCommunity(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS community_comments (
    id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS community_likes (
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(post_id,user_id)
  );
  CREATE INDEX IF NOT EXISTS community_history ON community_posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS community_comments_post ON community_comments(post_id,created_at);`);
  if (!db.prepare('PRAGMA table_info(community_posts)').all().some(column => column.name === 'product')) db.exec("ALTER TABLE community_posts ADD COLUMN product TEXT NOT NULL DEFAULT 'legacy'");
  const author = id => `用户 ${id.slice(0, 6)}`;
  function post(id, userId) {
    const row = db.prepare("SELECT * FROM community_posts WHERE id=? AND product='sugar'").get(id);
    if (!row) throw failure(404, '帖子不存在。');
    const comments = db.prepare('SELECT * FROM community_comments WHERE post_id=? ORDER BY created_at').all(id).map(row => ({ id: row.id, author: author(row.user_id), authorAvatar: '🌱', text: row.text, createdAt: row.created_at }));
    return { id: row.id, author: author(row.user_id), authorAvatar: '🌱', title: row.title, body: row.body, createdAt: row.created_at,
      comments, commentCount: comments.length, views: row.views, streak: 0, timeAgo: `${Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60000))}m ago`,
      likes: db.prepare('SELECT count(*) AS count FROM community_likes WHERE post_id=?').get(id).count,
      likedByMe: !!db.prepare('SELECT 1 FROM community_likes WHERE post_id=? AND user_id=?').get(id, userId) };
  }
  function text(value, max) { if (typeof value !== 'string' || value.length > max) throw failure(400, `内容需在 ${max} 字以内。`); return value.trim(); }
  return {
    list(userId, filter) {
      const order = filter === 'top' ? '(SELECT count(*) FROM community_likes l WHERE l.post_id=p.id) DESC, p.created_at DESC' : 'p.created_at DESC';
      return { posts: db.prepare(`SELECT p.id FROM community_posts p WHERE p.product='sugar' ORDER BY ${order} LIMIT 100`).all().map(row => post(row.id, userId)) };
    },
    get(id, userId) { db.prepare("UPDATE community_posts SET views=views+1 WHERE id=? AND product='sugar'").run(id); return { post: post(id, userId) }; },
    create(userId, body) {
      const title = text(body.title || '', 200), content = text(body.body || '', 5000);
      if (!title && !content) throw failure(400, '帖子不能为空。');
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO community_posts(id,user_id,title,body,created_at,product) VALUES(?,?,?,?,?,'sugar')").run(id, userId, title || '工作日的一点分享', content, new Date().toISOString());
      return { post: post(id, userId) };
    },
    comment(userId, body) {
      const content = text(body.text || '', 2000);
      if (!content) throw failure(400, '评论不能为空。');
      post(String(body.postId || ''), userId);
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO community_comments VALUES(?,?,?,?,?)').run(id, body.postId, userId, content, new Date().toISOString());
      const updated = post(body.postId, userId);
      return { post: updated, comment: updated.comments.find(comment => comment.id === id) };
    },
    like(userId, body) {
      const id = String(body.postId || ''); post(id, userId);
      if (db.prepare('SELECT 1 FROM community_likes WHERE post_id=? AND user_id=?').get(id, userId)) db.prepare('DELETE FROM community_likes WHERE post_id=? AND user_id=?').run(id, userId);
      else db.prepare('INSERT INTO community_likes VALUES(?,?)').run(id, userId);
      return { post: post(id, userId) };
    },
    exportOwn(userId) { return {
      posts: db.prepare('SELECT * FROM community_posts WHERE user_id=?').all(userId),
      comments: db.prepare('SELECT * FROM community_comments WHERE user_id=?').all(userId),
      likes: db.prepare('SELECT post_id FROM community_likes WHERE user_id=?').all(userId)
    }; }
  };
}
module.exports = { createCommunity };
