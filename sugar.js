const crypto = require('node:crypto');
const { failure } = require('./storage');
const SCENES = ['morning', 'afternoon', 'meeting', 'overtime', 'social', 'other'];
const GOALS = ['drink_swap', 'pause', 'portion', 'observe'];
const text = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function dateKey(date, timeZone = 'Asia/Shanghai') {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
  catch { throw failure(400, '请选择有效时区。'); }
}
function initialSugar(now = new Date()) {
  return { product: 'sugar', version: 1, startedAt: now.toISOString(), logs: [], cravings: [], checkIns: [], reasons: [], preferences: { goal: 'drink_swap', dailyTargetGrams: null } };
}
function identity(body, payload) {
  if (!/^[\w-]{8,128}$/.test(body.clientId || '')) throw failure(400, '记录标识无效，请重新打开表单。');
  return { clientId: body.clientId, fingerprint: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
}
function append(state, field, body, payload, now) {
  const id = identity(body, payload);
  const previous = (state[field] || []).find(entry => entry.clientId === id.clientId);
  if (previous) {
    if (previous.fingerprint !== id.fingerprint) throw failure(409, '这条记录标识已用于其他内容，请重新打开表单。');
    return { state, entry: previous };
  }
  const entry = { ...payload, ...id, id: crypto.randomUUID(), createdAt: now.toISOString() };
  return { state: { ...state, [field]: [entry, ...(state[field] || [])] }, entry };
}
function addSugarLog(state, body, now = new Date()) {
  const name = text(body.name, 100);
  if (!name) throw failure(400, '请写下食物或饮品名称。');
  if (!SCENES.includes(body.scene)) throw failure(400, '请选择记录场景。');
  if (!['added', 'total', 'unknown'].includes(body.sugarKind)) throw failure(400, '请选择糖量来源。');
  const sugarGrams = body.sugarKind === 'unknown' ? null : body.sugarGrams;
  if (body.sugarKind !== 'unknown' && (typeof sugarGrams !== 'number' || !Number.isFinite(sugarGrams) || sugarGrams < 0 || sugarGrams > 300)) throw failure(400, '糖量需为 0–300 克；不清楚时请选择未知。');
  return append(state, 'logs', body, { name, scene: body.scene, sugarKind: body.sugarKind, sugarGrams, note: text(body.note), portion: text(body.portion, 80) }, now);
}
function addCraving(state, body, now = new Date()) {
  if (!SCENES.includes(body.scene) || !Number.isInteger(body.intensity) || body.intensity < 1 || body.intensity > 5) throw failure(400, '请选择场景和 1–5 级渴望强度。');
  return append(state, 'cravings', body, { scene: body.scene, intensity: body.intensity, feeling: text(body.feeling, 100), note: text(body.note), nextStep: text(body.nextStep, 100) }, now);
}
function checkIn(state, body, now = new Date()) {
  const timeZone = body.timeZone || 'Asia/Shanghai';
  const date = dateKey(now, timeZone);
  if (!['steady', 'flexible', 'reflect'].includes(body.choice)) throw failure(400, '请选择今天的状态。');
  const entry = { id: `${date}:${timeZone}`, date, timeZone, choice: body.choice, note: text(body.note), createdAt: now.toISOString() };
  return { state: { ...state, checkIns: [entry, ...(state.checkIns || []).filter(old => old.id !== entry.id)] }, entry };
}
function setPreferences(state, body) {
  if (!GOALS.includes(body.goal)) throw failure(400, '请选择一个可执行的减糖目标。');
  const target = body.dailyTargetGrams;
  if (target !== null && (!Number.isFinite(target) || target < 10 || target > 100)) throw failure(400, '个人参考值需为 10–100 克，或选择不设糖量目标。');
  return { ...state, preferences: { ...state.preferences, goal: body.goal, dailyTargetGrams: target } };
}
function summary(state, timeZone = 'Asia/Shanghai', now = new Date()) {
  const today = dateKey(now, timeZone);
  const logs = state.logs || [];
  const todays = logs.filter(entry => dateKey(new Date(entry.createdAt), timeZone) === today);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 6 + index);
    const key = date.toISOString().slice(0, 10);
    const entries = logs.filter(entry => dateKey(new Date(entry.createdAt), timeZone) === key);
    return { date: key, count: entries.length, addedGrams: entries.filter(entry => entry.sugarKind === 'added').reduce((sum, entry) => sum + entry.sugarGrams, 0), unknownCount: entries.filter(entry => entry.sugarKind === 'unknown').length };
  });
  return { today, timeZone, preferences: state.preferences || initialSugar().preferences, logs, cravings: state.cravings || [], checkIns: state.checkIns || [], days,
    todayLogCount: todays.length, knownAddedCount: todays.filter(entry => entry.sugarKind === 'added').length,
    knownAddedGrams: Math.round(todays.filter(entry => entry.sugarKind === 'added').reduce((sum, entry) => sum + entry.sugarGrams, 0) * 10) / 10,
    unknownCount: todays.filter(entry => entry.sugarKind === 'unknown').length, totalOnlyCount: todays.filter(entry => entry.sugarKind === 'total').length,
    checkIn: (state.checkIns || []).find(entry => entry.id === `${today}:${timeZone}`) || null,
    activeDays: new Set([...(state.checkIns || []).map(entry => entry.date), ...logs.map(entry => dateKey(new Date(entry.createdAt), timeZone))]).size };
}
module.exports = { initialSugar, addSugarLog, addCraving, checkIn, setPreferences, summary, dateKey };
