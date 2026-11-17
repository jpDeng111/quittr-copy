const crypto = require('node:crypto');
const { failure } = require('./storage');

function createCommunity(db, { moderatorEmails = [] } = {}) {
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
  const columns = new Set(db.prepare('PRAGMA table_info(community_posts)').all().map(row => row.name));
  for (const [name, definition] of Object.entries({ kind: "TEXT NOT NULL DEFAULT 'experience'", status: "TEXT NOT NULL DEFAULT 'published'", provenance: "TEXT NOT NULL DEFAULT 'personal'", audio_id: 'TEXT', featured: 'INTEGER NOT NULL DEFAULT 0', review_note: "TEXT NOT NULL DEFAULT ''" })) {
    if (!columns.has(name)) db.exec(`ALTER TABLE community_posts ADD COLUMN ${name} ${definition}`);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS community_audio (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS community_saves (post_id TEXT NOT NULL REFERENCES community_posts(id), user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(post_id,user_id));
    CREATE TABLE IF NOT EXISTS community_reports (post_id TEXT NOT NULL REFERENCES community_posts(id), user_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, created_at TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(post_id,user_id));
    CREATE TABLE IF NOT EXISTS community_consumptions (post_id TEXT NOT NULL REFERENCES community_posts(id), user_id TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(post_id,user_id,day,kind));
    CREATE TABLE IF NOT EXISTS community_reviews (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES community_posts(id), moderator_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);`);
  const moderatorSet = new Set(moderatorEmails.map(email => email.trim().toLowerCase()).filter(Boolean));
  const canModerate = id => moderatorSet.has(db.prepare('SELECT email FROM users WHERE id=?').get(id)?.email.toLowerCase());
  const readable = (row, userId) => row && (row.status === 'published' || row.user_id === userId || canModerate(userId));
  const requireModerator = id => { if (!canModerate(id)) throw failure(403, '只有运营审核账号可以执行此操作。'); };
  const author = id => `用户 ${id.slice(0, 6)}`;
  function post(id, userId) {
    const row = db.prepare('SELECT * FROM community_posts WHERE id=?').get(id);
    if (!readable(row, userId)) throw failure(404, '帖子不存在或尚未公开。');
    const comments = db.prepare('SELECT * FROM community_comments WHERE post_id=? ORDER BY created_at').all(id).map(row => ({ id: row.id, author: author(row.user_id), authorAvatar: '🌱', text: row.text, createdAt: row.created_at }));
    return { id: row.id, author: author(row.user_id), authorAvatar: '🌱', title: row.title, body: row.body, createdAt: row.created_at,
      kind: row.kind, status: row.status, provenance: row.provenance, featured: !!row.featured, isOwner: row.user_id === userId, reviewNote: row.user_id === userId ? row.review_note : '',
      audio: row.audio_id ? { id: row.audio_id, url: `/api/community/audio/${row.audio_id}` } : null,
      savedByMe: !!db.prepare('SELECT 1 FROM community_saves WHERE post_id=? AND user_id=?').get(id, userId),
      comments, commentCount: comments.length, views: row.views, streak: 0, timeAgo: `${Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60000))}m ago`,
      likes: db.prepare('SELECT count(*) AS count FROM community_likes WHERE post_id=?').get(id).count,
      likedByMe: !!db.prepare('SELECT 1 FROM community_likes WHERE post_id=? AND user_id=?').get(id, userId) };
  }
  function text(value, max) { if (typeof value !== 'string' || value.length > max) throw failure(400, `内容需在 ${max} 字以内。`); return value.trim(); }
  return {
    list(userId, filter, { kind = '', query = '' } = {}) {
      const order = filter === 'top' ? '(SELECT count(*) FROM community_likes l WHERE l.post_id=p.id) DESC, p.created_at DESC' : 'p.featured DESC, p.created_at DESC';
      const params = [userId];
      let where = "(p.status='published' OR p.user_id=?)";
      if (filter === 'saved') { where += ' AND EXISTS(SELECT 1 FROM community_saves s WHERE s.post_id=p.id AND s.user_id=?)'; params.push(userId); }
      if (kind && ['experience','tutorial','audio'].includes(kind)) { where += ' AND p.kind=?'; params.push(kind); }
      if (query) { where += " AND (p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')"; const search = '%' + String(query).slice(0,100).replace(/[\\%_]/g, ch => '\\' + ch) + '%'; params.push(search,search); }
      return { posts: db.prepare(`SELECT p.id FROM community_posts p WHERE ${where} ORDER BY ${order} LIMIT 100`).all(...params).map(row => post(row.id, userId)), canModerate: canModerate(userId) };
    },
    get(id, userId) { db.prepare('UPDATE community_posts SET views=views+1 WHERE id=?').run(id); return { post: post(id, userId) }; },
    create(userId, body) {
      const title = text(body.title || '', 200), content = text(body.body || '', 5000);
      if (!title && !content) throw failure(400, '帖子不能为空。');
      const kind = ['experience','tutorial','audio'].includes(body.kind) ? body.kind : 'experience';
      if (kind !== 'experience' && body.consent !== true) throw failure(400, '请确认公开内容和分享权限。');
      const audio = kind === 'audio' ? db.prepare('SELECT id FROM community_audio WHERE id=? AND user_id=?').get(String(body.audioId || ''),userId) : null;
      if (kind === 'audio' && !audio) throw failure(400, '请上传你有权分享的音频。');
      const id = crypto.randomUUID(), status = kind === 'experience' ? 'published' : 'pending';
      const provenance = body.provenance === 'ai' ? 'ai' : 'personal';
      db.prepare('INSERT INTO community_posts(id,user_id,title,body,created_at,kind,status,provenance,audio_id) VALUES(?,?,?,?,?,?,?,?,?)').run(id, userId, title || '未命名分享', content, new Date().toISOString(),kind,status,provenance,audio?.id || null);
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
    save(userId, body) {
      const id = String(body.postId || ''); post(id,userId);
      if (db.prepare('SELECT 1 FROM community_saves WHERE post_id=? AND user_id=?').get(id,userId)) db.prepare('DELETE FROM community_saves WHERE post_id=? AND user_id=?').run(id,userId);
      else db.prepare('INSERT INTO community_saves VALUES(?,?)').run(id,userId);
      return { post: post(id,userId) };
    },
    report(userId, body) {
      const id = String(body.postId || ''); post(id,userId); const reason = text(body.reason || '',500);
      if (!reason) throw failure(400,'请填写举报原因。');
      db.prepare('INSERT INTO community_reports VALUES(?,?,?,?,0) ON CONFLICT(post_id,user_id) DO UPDATE SET reason=excluded.reason, resolved=0').run(id,userId,reason,new Date().toISOString());
      return { reported: true };
    },
    queue(userId) {
      requireModerator(userId);
      return { posts: db.prepare("SELECT id FROM community_posts p WHERE status='pending' OR EXISTS(SELECT 1 FROM community_reports r WHERE r.post_id=p.id AND r.resolved=0) ORDER BY created_at LIMIT 100").all().map(row => ({ ...post(row.id,userId), reports: db.prepare('SELECT reason,created_at FROM community_reports WHERE post_id=? AND resolved=0').all(row.id) })) };
    },
    moderate(userId, body) {
      requireModerator(userId); const item = post(String(body.postId || ''),userId);
      if (!['approve','reject','feature','unfeature'].includes(body.action)) throw failure(400,'无效的审核操作。');
      const note = text(body.note || '',500);
      if (body.action === 'reject' && !note) throw failure(400,'请说明下架或未通过的原因。');
      if (['approve','reject'].includes(body.action)) db.prepare('UPDATE community_posts SET status=?,review_note=?,featured=0 WHERE id=?').run(body.action==='approve'?'published':'rejected',note,item.id);
      else { if(item.status!=='published') throw failure(400,'只有公开内容可以加入精选。'); db.prepare('UPDATE community_posts SET featured=? WHERE id=?').run(body.action==='feature'?1:0,item.id); }
      db.prepare('UPDATE community_reports SET resolved=1 WHERE post_id=?').run(item.id);
      db.prepare('INSERT INTO community_reviews VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),item.id,userId,body.action,note,new Date().toISOString());
      return { post: post(item.id,userId) };
    },
    withdraw(userId, body) {
      const item = post(String(body.postId || ''),userId); if(!item.isOwner) throw failure(403,'只能撤回自己的分享。');
      db.prepare("UPDATE community_posts SET status='withdrawn',featured=0 WHERE id=?").run(item.id); return { post: post(item.id,userId) };
    },
    consume(userId, body) {
      const item = post(String(body.postId || ''),userId); if(item.status!=='published') throw failure(400,'内容尚未公开。');
      if (!['read','listen'].includes(body.kind) || body.kind==='listen' && item.kind!=='audio') throw failure(400,'无效的阅读记录。');
      const at=new Date().toISOString();
      db.prepare('INSERT OR IGNORE INTO community_consumptions VALUES(?,?,?,?,?)').run(item.id,userId,at.slice(0,10),body.kind,at); return { recorded:true };
    },
    uploadAudio(userId, body) {
      if(body.consent!==true) throw failure(400,'请确认你有权公开分享此音频。');
      if(typeof body.data!=='string'||body.data.length>12*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)) throw failure(400,'无效的音频内容。');
      const bytes=Buffer.from(body.data,'base64'); if(bytes.length<12||bytes.length>8*1024*1024) throw failure(400,'音频文件应小于 8 MB。');
      const mp3=bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224;
      const wav=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE';
      if(!mp3&&!wav) throw failure(400,'暂时支持 MP3 和 WAV 音频。');
      const quota=db.prepare('SELECT count(*) AS count,coalesce(sum(length(bytes)),0) AS size FROM community_audio WHERE user_id=?').get(userId);
      if(quota.count>=30||quota.size+bytes.length>64*1024*1024) throw failure(400,'音频存储额度已满，请联系运营处理。');
      const id=crypto.randomUUID(); db.prepare('INSERT INTO community_audio VALUES(?,?,?,?,?)').run(id,userId,mp3?'audio/mpeg':'audio/wav',bytes,new Date().toISOString()); return {audioId:id};
    },
    audio(userId, id) {
      const row=db.prepare('SELECT * FROM community_audio WHERE id=?').get(id);
      if(!row || !(row.user_id===userId||canModerate(userId)||db.prepare("SELECT 1 FROM community_posts WHERE audio_id=? AND status='published'").get(id))) throw failure(404,'音频不存在或尚未公开。');
      return {mime:row.mime,bytes:Buffer.from(row.bytes)};
    },
    exportOwn(userId) { return {
      posts: db.prepare('SELECT * FROM community_posts WHERE user_id=?').all(userId),
      comments: db.prepare('SELECT * FROM community_comments WHERE user_id=?').all(userId),
      likes: db.prepare('SELECT post_id FROM community_likes WHERE user_id=?').all(userId),
      saves: db.prepare('SELECT post_id FROM community_saves WHERE user_id=?').all(userId),
      consumption: db.prepare('SELECT * FROM community_consumptions WHERE user_id=?').all(userId)
    }; }
  };
}
module.exports = { createCommunity };
