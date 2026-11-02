const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLessonService, lessonDates, buildLessonContext } = require('../lessons');
const { createMeliusService } = require('../melius');

function fixture(initial = {}, complete) {
  let state = { startedAt: '2026-01-01T00:00:00Z', ...initial };
  let current = new Date('2026-11-03T04:00:00Z');
  let calls = 0;
  const options = {
    readState: () => structuredClone(state), writeState: (next) => { state = structuredClone(next); }, now: () => current,
    complete: async (payload) => { calls++; return complete ? complete(payload) : generated(); }
  };
  return { service: createLessonService(options), state: () => state, calls: () => calls, advance: (date) => { current = new Date(date); }, options };
}
function generated(overrides = {}) {
  return { choices: [{ message: { content: JSON.stringify({ title: '给压力一个出口', subtitle: '先照顾感受，再做选择。', category: '压力与觉察', theme: 'bloom', reason: '昨天你谈到了工作压力，今天一起练习暂停。', takeaway: '我可以先给自己留一点空间。', cards: ['insight', 'pattern', 'practice', 'reflection', 'action'].map((kind) => ({ kind, label: kind, title: '给自己一点空间', body: '注意当下的感受，尝试一个小小的行动。', highlight: '先暂停，再选择。', steps: kind === 'insight' ? [] : ['休息', '喝水', '散步'] })), ...overrides }) } }] };
}

test('yesterday uses the client calendar across midnight and DST changes', () => {
  assert.equal(lessonDates(new Date('2026-11-02T16:05:00Z'), 'Asia/Shanghai').today, '2026-11-03');
  assert.equal(lessonDates(new Date('2026-11-02T16:05:00Z'), 'Asia/Shanghai').yesterday, '2026-11-02');
  assert.equal(lessonDates(new Date('2026-11-01T08:00:00Z'), 'America/New_York').yesterday, '2026-10-31');
  assert.throws(() => lessonDates(new Date(), 'not/a-zone'), /Invalid timezone/);
});

test('personalization includes yesterday only and preserves explicit clean versus relapse status', () => {
  const context = buildLessonContext({
    meliusTurns: { yesterday: { createdAt: '2026-11-02T15:30:00Z', userText: '昨晚压力很大，但没有破戒。', response: { reply: '先休息一下。' } }, today: { createdAt: '2026-11-02T16:30:00Z', userText: '今天的内容不应进入昨天' } },
    journalEntries: [{ createdAt: '2026-11-02T10:00:00Z', title: '昨天日记', body: '想早睡。' }, { createdAt: '2026-11-03T01:00:00Z', title: '今天日记' }],
    recoveryCheckIns: [{ loggedAt: '2026-11-03T01:00:00Z', occurredAt: '2026-11-02T12:00:00Z', relapsed: false }],
    relapses: ['2026-11-01T04:00:00Z', '2026-11-03T01:00:00Z']
  }, lessonDates(new Date('2026-11-03T04:00:00Z')));
  assert.equal(context.conversations.length, 1);
  assert.equal(context.journals.length, 1);
  assert.equal(context.checkIns[0].relapsed, false);
  assert.equal(context.relapseCount, 0);
});

test('new Melius conversations retain user text once for next-day lessons, including direct actions', async () => {
  const f = fixture();
  const melius = createMeliusService(f.options);
  await melius.send({ requestId: 'lesson-context-001', messages: [{ role: 'user', content: '做做深呼吸' }] });
  assert.equal(f.state().meliusTurns['lesson-context-001'].userText, '做做深呼吸');
});

test('AI generation receives actual context and is deduplicated concurrently and after restart', async () => {
  const f = fixture({ meliusTurns: { one: { createdAt: '2026-11-02T09:00:00Z', userText: '工作压力很大。' } } }, async (payload) => {
    assert.match(payload.messages[1].content, /工作压力很大/);
    assert.equal(payload.response_format.type, 'json_object');
    return generated();
  });
  const [a, b] = await Promise.all([f.service.generate(), f.service.generate()]);
  assert.equal(a.lesson.id, b.lesson.id);
  assert.equal(a.lesson.origin, 'ai');
  assert.equal(f.calls(), 1);
  await createLessonService(f.options).generate();
  assert.equal(f.calls(), 1);
});

test('no history is represented honestly even if the model invents a recommendation reason', async () => {
  const f = fixture();
  assert.equal(f.service.get().lesson.hasActivity, false);
  assert.match(f.service.get().lesson.reason, /还没有昨天的记录/);
  const result = await f.service.generate();
  assert.match(result.lesson.reason, /还没有昨天的记录/);
  assert.deepEqual(result.lesson.sources, []);
});

test('failed or malformed AI output stays a curated lesson and can be retried', async () => {
  let failed = true;
  const f = fixture({}, () => { if (failed) throw new Error('provider unavailable'); return generated(); });
  const result = await f.service.generate();
  assert.equal(result.lesson.origin, 'starter');
  assert.ok(result.generationError);
  assert.equal(f.state().dailyLessons, undefined);
  failed = false;
  assert.equal((await f.service.generate()).lesson.origin, 'ai');
  const bad = fixture({}, () => generated({ cards: [] }));
  assert.equal((await bad.service.generate()).lesson.origin, 'starter');
});

test('finishing persists validated choices, preserves recovery data, and survives the next day', async () => {
  const f = fixture({ relapses: ['2026-10-01T00:00:00Z'], reasons: ['家人'] });
  const { lesson } = await f.service.generate();
  f.service.complete({ id: lesson.id, reflection: '休息', intention: '喝水' });
  const timestamp = f.service.get().lesson.completedAt;
  assert.equal(f.service.get().lesson.reflection, '休息');
  assert.equal(f.service.get().lesson.intention, '喝水');
  assert.deepEqual(f.state().reasons, ['家人']);
  assert.deepEqual(f.state().relapses, ['2026-10-01T00:00:00Z']);
  f.service.complete({ id: lesson.id, reflection: 'forged choice', intention: '<script>' });
  assert.equal(f.service.get().lesson.completedAt, timestamp);
  assert.equal(f.service.get().lesson.intention, '喝水');
  f.advance('2026-11-04T04:00:00Z');
  assert.equal(f.service.get().history[0].id, lesson.id);
  assert.equal(f.service.get().lesson.completedAt, undefined);
  assert.notEqual(f.service.get().lesson.id, lesson.id);
  assert.throws(() => f.service.complete({ id: 'unknown-lesson' }), /Lesson not found/);
});

test('finishing a curated lesson during generation does not erase completion or unrelated concurrent records', async () => {
  let resolve;
  const f = fixture({}, () => new Promise((r) => { resolve = r; }));
  const pending = f.service.generate();
  const starter = f.service.get().lesson;
  f.service.complete({ id: starter.id, reflection: starter.cards[3].steps[0], intention: starter.cards[4].steps[0] });
  const completedAt = f.service.get().lesson.completedAt;
  const state = f.state(); state.reasons = ['刚刚保存的新动力'];
  resolve(generated());
  await pending;
  assert.equal(f.service.get().lesson.completedAt, completedAt);
  assert.deepEqual(f.state().reasons, ['刚刚保存的新动力']);
});


test('unsupported clinical claims are rejected instead of presented as personalized facts', async () => {
  const f = fixture({}, () => generated({ takeaway: '研究表明多巴胺神经回路已经修复。' }));
  const result = await f.service.generate();
  assert.equal(result.lesson.origin, 'starter');
  assert.ok(result.generationError);
  assert.equal(f.state().dailyLessons, undefined);
});

test('a lesson read as curated retains its actual choices if AI finishes before completion', async () => {
  const f = fixture();
  const starter = f.service.get().lesson;
  await f.service.generate();
  assert.equal(f.service.get().lesson.origin, 'ai');
  f.service.complete({ id: starter.id, origin: starter.origin, reflection: starter.cards[3].steps[0], intention: starter.cards[4].steps[0] });
  assert.equal(f.service.get().lesson.origin, 'starter');
  assert.equal(f.service.get().lesson.intention, starter.cards[4].steps[0]);
});

test('manual regeneration calls AI again, changes the whole lesson identity, and preserves completed history', async () => {
  let round = 0;
  const f = fixture({}, (payload) => {
    round++;
    if (round === 2) assert.equal(JSON.parse(payload.messages[1].content).previousLesson.title, '课程 1');
    const data = generated({ title: `课程 ${round}` });
    const draft = JSON.parse(data.choices[0].message.content);
    draft.cards.forEach((card) => { card.body = `全新内容 ${round}，一起留意今天的感受。`; });
    data.choices[0].message.content = JSON.stringify(draft);
    return data;
  });
  const first = (await f.service.generate()).lesson;
  f.service.complete({ id: first.id, intention: '喝水' });
  const second = (await f.service.generate('Asia/Shanghai', { force: true })).lesson;
  assert.equal(f.calls(), 2);
  assert.notEqual(second.id, first.id);
  assert.equal(second.title, '课程 2');
  assert.equal(second.completedAt, undefined);
  assert.ok(second.cards.every((card) => /全新内容 2/.test(card.body)));
  assert.equal(f.service.get().history[0].intention, '喝水');
  assert.ok(f.service.get().history[0].completedAt);
  const restored = await createLessonService(f.options).generate();
  assert.equal(restored.lesson.id, second.id);
  assert.equal(f.calls(), 2);
});

test('a completed curated lesson can be regenerated into an AI lesson', async () => {
  const f = fixture();
  const starter = f.service.get().lesson;
  f.service.complete({ id: starter.id, origin: 'starter', intention: starter.cards[4].steps[0] });
  const result = await f.service.generate('Asia/Shanghai', { force: true });
  assert.equal(result.lesson.origin, 'ai');
  assert.notEqual(result.lesson.id, starter.id);
  assert.equal(result.lesson.completedAt, undefined);
  assert.equal(result.history[0].origin, 'starter');
  assert.equal(result.history[0].intention, starter.cards[4].steps[0]);
});

test('concurrent manual regeneration shares one new AI call', async () => {
  let resolve;
  let round = 0;
  const f = fixture({}, () => ++round === 1 ? generated() : new Promise((r) => { resolve = r; }));
  await f.service.generate();
  const a = f.service.generate('Asia/Shanghai', { force: true });
  const b = f.service.generate('Asia/Shanghai', { force: true });
  resolve(generated({ title: '另一种照顾自己的方式' }));
  const [first, second] = await Promise.all([a, b]);
  assert.equal(first.lesson.id, second.lesson.id);
  assert.equal(f.calls(), 2);
});

test('regeneration errors and identical content keep the previous lesson and its reading state', async () => {
  let fail = false;
  const f = fixture({}, () => { if (fail) throw new Error('network error'); return generated(); });
  const first = (await f.service.generate()).lesson;
  const duplicate = await f.service.generate('Asia/Shanghai', { force: true });
  assert.match(duplicate.generationError, /上一课相同/);
  assert.equal(duplicate.lesson.id, first.id);
  fail = true;
  const failed = await f.service.generate('Asia/Shanghai', { force: true });
  assert.match(failed.generationError, /原来的课程/);
  assert.equal(failed.lesson.id, first.id);
  assert.equal(failed.history.length, 0);
});

test('a reader can complete the old revision after a newer lesson was generated', async () => {
  let round = 0;
  const f = fixture({}, () => generated({ title: `课程 ${++round}` }));
  const first = (await f.service.generate()).lesson;
  const second = (await f.service.generate('Asia/Shanghai', { force: true })).lesson;
  f.service.complete({ id: first.id, intention: '喝水' });
  assert.equal(f.service.get().lesson.id, second.id);
  assert.equal(f.service.get().lesson.completedAt, undefined);
  assert.equal(f.service.get().history[0].intention, '喝水');
});
