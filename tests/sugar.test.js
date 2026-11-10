const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initialSugar, addSugarLog, addCraving, checkIn, setPreferences, summary } = require('../sugar');
const { createMeliusService } = require('../melius');
const { createLessonService, lessonDates, buildLessonContext } = require('../lessons');
const now = () => new Date('2026-11-09T08:00:00Z');
const log = { clientId: 'manual-sugar-001', name: '下午的奶茶', scene: 'afternoon', sugarKind: 'unknown' };

test('unknown and total sugar never become added-sugar totals or fabricated daily intake', () => {
  let state = addSugarLog(initialSugar(now()), log, now()).state;
  state = addSugarLog(state, { ...log, clientId: 'manual-sugar-002', name: '包装饮品', sugarKind: 'total', sugarGrams: 20 }, now()).state;
  let result = summary(state, 'Asia/Shanghai', now());
  assert.equal(result.knownAddedCount, 0); assert.equal(result.unknownCount, 1); assert.equal(result.totalOnlyCount, 1);
  assert.equal(result.knownAddedGrams, 0); assert.equal(result.todayLogCount, 2);
  state = addSugarLog(state, { ...log, clientId: 'manual-sugar-003', sugarKind: 'added', sugarGrams: 4.5 }, now()).state;
  result = summary(state, 'Asia/Shanghai', now());
  assert.equal(result.knownAddedGrams, 4.5); assert.equal(result.knownAddedCount, 1);
});

test('retrying a save is idempotent, while reusing its ID for different content conflicts', () => {
  const first = addSugarLog(initialSugar(now()), log, now());
  const second = addSugarLog(first.state, log, new Date('2026-11-10T08:00:00Z'));
  assert.equal(second.entry.id, first.entry.id); assert.equal(second.state.logs.length, 1);
  assert.equal(second.entry.createdAt, first.entry.createdAt);
  assert.throws(() => addSugarLog(first.state, { ...log, name: '不同的记录' }), { status: 409 });
});

test('invalid sugar input and invented craving intensity cannot be persisted', () => {
  for (const value of [NaN, Infinity, -1, 301, '20', null]) assert.throws(() => addSugarLog(initialSugar(), { ...log, sugarKind: 'added', sugarGrams: value }), { status: 400 });
  assert.throws(() => addCraving(initialSugar(), { clientId: 'sugar-urge-001', scene: 'overtime', intensity: 7 }), { status: 400 });
  assert.throws(() => setPreferences(initialSugar(), { goal: 'observe', dailyTargetGrams: 0 }), { status: 400 });
  assert.equal(setPreferences(initialSugar(), { goal: 'observe', dailyTargetGrams: null }).preferences.dailyTargetGrams, null);
});

test('flexible check-ins retain earlier progress and update once per local day', () => {
  let state = checkIn(initialSugar(now()), { choice: 'steady', timeZone: 'Asia/Shanghai' }, now()).state;
  state = checkIn(state, { choice: 'flexible', timeZone: 'Asia/Shanghai' }, now()).state;
  assert.equal(state.checkIns.length, 1); assert.equal(state.checkIns[0].choice, 'flexible');
  state = checkIn(state, { choice: 'reflect', timeZone: 'Asia/Shanghai' }, new Date('2026-11-10T08:00:00Z')).state;
  assert.equal(summary(state, 'Asia/Shanghai', new Date('2026-11-10T08:00:00Z')).activeDays, 2);
  assert.equal(state.checkIns.length, 2); assert.equal(state.relapses, undefined);
});

test('local-day summaries respect timezone boundaries and only include actual recorded days', () => {
  const state = addSugarLog(initialSugar(), log, new Date('2026-11-09T16:30:00Z')).state;
  assert.equal(summary(state, 'Asia/Shanghai', new Date('2026-11-10T01:00:00Z')).todayLogCount, 1);
  assert.equal(summary(state, 'UTC', new Date('2026-11-10T01:00:00Z')).todayLogCount, 0);
  assert.throws(() => summary(state, 'not/a-zone'), { status: 400 });
});

function companion(tool, text, extra = {}) {
  let state = initialSugar(now()), captured;
  const service = createMeliusService({ domain: 'sugar', now, readState: () => structuredClone(state), writeState: next => { state = structuredClone(next); },
    complete: async payload => {
      captured = payload;
      if (!payload.messages.some(message => message.role === 'tool')) return { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: tool, arguments: JSON.stringify({ ...extra, source_quote: text }) } }] } }] };
      return { choices: [{ message: { content: '给自己一点空间，我们可以从一个小选择开始。' } }] };
    }
  });
  return { send: () => service.send({ requestId: 'sugar-chat-message-001', messages: [{ role: 'user', content: text }] }), state: () => state, payload: () => captured };
}

test('sugar companion tools and prompt use the new domain instead of relapse/reset or legacy games', async () => {
  const f = companion('record_sugar', '我刚喝了奶茶，帮我记录。', { name: '奶茶', scene: 'afternoon', sugar_kind: 'unknown' });
  await f.send(); await f.send();
  assert.equal(f.state().logs.length, 1); assert.equal(f.state().logs[0].sugarGrams, null);
  const names = f.payload().tools.map(tool => tool.function.name);
  assert.ok(names.includes('record_sugar')); assert.ok(!names.includes('record_check_in')); assert.ok(!names.includes('open_game'));
  assert.match(f.payload().messages[0].content, /轻甜/); assert.match(f.payload().messages[0].content, /不清零/);
  assert.equal(f.state().relapses, undefined);
});

test('AI cannot turn a hypothetical drink or a guessed gram amount into a saved food log', async () => {
  for (const [text, kind, grams] of [['我想喝奶茶。', 'unknown', undefined], ['我喝了奶茶。', 'added', 30], ['我喝了饮品，标签总糖20克。', 'added', 20]]) {
    const f = companion('record_sugar', text, { name: '饮品', scene: 'afternoon', sugar_kind: kind, sugar_grams: grams });
    await f.send(); assert.equal(f.state().logs.length, 0);
  }
  const f = companion('record_sugar', '我喝了饮品，标签总糖20克。', { name: '饮品', scene: 'afternoon', sugar_kind: 'total', sugar_grams: 20 });
  await f.send(); assert.equal(f.state().logs[0].sugarKind, 'total');
});

test('daily sugar lessons use real food records and have an honest workday starter', () => {
  const state = addSugarLog(initialSugar(), log, new Date('2026-11-08T08:00:00Z')).state;
  const context = buildLessonContext(state, lessonDates(now(), 'Asia/Shanghai'));
  assert.equal(context.hasActivity, true); assert.equal(context.sugarLogs[0].name, '下午的奶茶');
  const lesson = createLessonService({ domain: 'sugar', readState: () => state, writeState() {}, complete() {}, now }).get().lesson;
  assert.match(lesson.title, /下午茶/); assert.match(JSON.stringify(lesson.cards), /正常吃饭/); assert.equal(lesson.origin, 'starter');
});
