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
  return { choices: [{ message: { content: JSON.stringify({ title: '给压力一个出口', subtitle: '先照顾感受，再做选择。', category: '压力与觉察', theme: 'bloom', reason: '昨天你谈到了工作压力，今天一起练习暂停。', takeaway: '我可以先给自己留一点空间。', cards: ['insight', 'pattern', 'practice', 'reflection', 'action'].map((kind) => ({ kind, label: kind, title: '给自己一点空间', body: ['insight', 'pattern'].includes(kind) ? '在戒色过程中，注意当下的感受，面对色情内容的触发，尝试一个小小的行动。' : '注意当下的感受，尝试一个小小的行动。', highlight: '先暂停，再选择。', steps: kind === 'insight' ? [] : ['休息', '喝水', '散步'] })), ...overrides }) } }] };
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
  assert.match(f.service.get().lesson.reason, /还没有昨天与戒色相关的记录/);
  const result = await f.service.generate();
  assert.match(result.lesson.reason, /还没有昨天与戒色相关的记录/);
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
    draft.cards.forEach((card) => { card.body = `全新内容 ${round}，在戒色过程中留意色情内容的触发，照顾今天的感受。`; });
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

test('materials fall back to a wider window when yesterday is empty, and the prompt says so', async () => {
  const f = fixture({ journalEntries: [{ createdAt: '2026-10-28T10:00:00Z', title: '六天前的日记', body: '晚上一个人吃饭，很想找点刺激。' }] }, async (payload) => {
    const sent = JSON.parse(payload.messages[1].content);
    assert.equal(sent.windowDays, 14);
    assert.match(sent.journals[0].title, /六天前的日记/);
    assert.match(payload.messages[0].content, /最近 14 天/);
    assert.doesNotMatch(payload.messages[0].content, /素材窗口：昨天/);
    return generated();
  });
  const result = await f.service.generate();
  assert.equal(result.lesson.hasActivity, true);
  assert.equal(result.lesson.windowDays, 14);
  assert.deepEqual(result.lesson.sources, ['最近 14 天1 条日记']);
});

test('a completed curated lesson becomes a personalized AI lesson without manual regeneration', async () => {
  const f = fixture();
  const starter = f.service.get().lesson;
  f.service.complete({ id: starter.id, origin: 'starter', intention: starter.cards[4].steps[0] });
  assert.equal(f.service.get().lesson.origin, 'starter');
  const result = await f.service.generate();
  assert.equal(result.lesson.origin, 'ai');
  assert.notEqual(result.lesson.id, starter.id);
  assert.equal(result.lesson.completedAt, undefined);
  assert.equal(result.history[0].origin, 'starter');
  assert.equal(result.history[0].intention, starter.cards[4].steps[0]);
  // Once an AI lesson exists for today, loading the app does not call the model again.
  await f.service.generate();
  assert.equal(f.calls(), 1);
});

test('one malformed response is retried before falling back to curated content', async () => {
  let round = 0;
  const f = fixture({}, () => { round += 1; if (round === 1) throw new Error('truncated json'); return generated(); });
  const result = await f.service.generate();
  assert.equal(f.calls(), 2);
  assert.equal(result.lesson.origin, 'ai');
  assert.equal(result.generationError, undefined);
});

test('generated lessons record the model that wrote them', async () => {
  const f = fixture();
  const service = createLessonService({ ...f.options, modelName: 'qwen3.7-plus' });
  const result = await service.generate();
  assert.equal(result.lesson.model, 'qwen3.7-plus');
});

test('closed cards stream before the model finishes, with annotations validated against the body', async () => {
  let release;
  const events = [];
  let state = {};
  const draft = JSON.parse(generated().choices[0].message.content);
  draft.cards[0].annotations = [
    { text: '当下的感受', style: 'circle' },
    { text: '不在正文里的话', style: 'highlight' },
    { text: '一个小小的行动', style: 'highlight' }
  ];
  const text = JSON.stringify(draft);
  const boundary = text.indexOf(',{"kind":"pattern"');
  const service = createLessonService({ readState: () => structuredClone(state), writeState(next) { state = next; },
    streamComplete: async (_, { onDelta }) => {
      // Split at every character, including quotes and nested annotation objects.
      for (const char of text.slice(0, boundary)) onDelta(char);
      await new Promise((resolve) => { release = resolve; });
      for (const char of text.slice(boundary)) onDelta(char);
      return { choices: [{ message: { content: text }, finish_reason: 'stop' }] };
    }
  });
  const pending = service.generate('Asia/Shanghai', { onEvent: (event) => events.push(event) });
  assert.equal(events.filter((event) => event.type === 'card').length, 1);
  assert.equal(state.dailyLessons, undefined, 'partial drafts must not be persisted');
  assert.deepEqual(events[1].card.annotations, [{ text: '当下的感受', style: 'circle' }, { text: '一个小小的行动', style: 'highlight' }]);
  const replay = [];
  const concurrent = service.generate('Asia/Shanghai', { onEvent: (event) => replay.push(event) });
  assert.deepEqual(replay, events, 'reconnecting readers get the same draft');
  release();
  const result = await pending;
  assert.equal((await concurrent).lesson.id, result.lesson.id);
  assert.equal(events.filter((event) => event.type === 'card').length, 5);
  assert.deepEqual(result.lesson.cards[0].annotations, events[1].card.annotations);
});

test('draft parser ignores escaped braces and cards keys in strings or nested metadata', () => {
  const { completedDraftCards } = require('../lessons');
  const card = { body: '文字含有 } 和 { 还有 "cards": [ 以及 \\ 引号', steps: [], annotations: [{ text: '文字' }] };
  const prefix = JSON.stringify({ title: '"cards": [', metadata: { cards: [{ fake: true }] } }).slice(0, -1) + ',"cards":[';
  const text = JSON.stringify(card);
  for (let i = 0; i < text.length; i++) assert.deepEqual(completedDraftCards(prefix + text.slice(0, i)), []);
  assert.deepEqual(completedDraftCards(prefix + text + ',{"body":"unfinished'), [card]);
});

test('broken stream clears provisional cards, retries, and never overwrites a saved lesson', async () => {
  let state = {};
  let attempts = 0;
  const first = fixture();
  const lesson = (await first.service.generate()).lesson;
  state = { dailyLessons: { [lesson.id]: lesson } };
  const events = [];
  const draft = JSON.parse(generated({ title: '新的角度' }).choices[0].message.content);
  const service = createLessonService({ ...first.options, readState: () => structuredClone(state), writeState(next) { state = next; },
    streamComplete: async (_, { onDelta }) => {
      attempts++;
      onDelta('{"cards":[' + JSON.stringify(draft.cards[0]) + ',');
      throw new Error('connection interrupted');
    }
  });
  const result = await service.generate('Asia/Shanghai', { force: true, onEvent: (event) => events.push(event) });
  assert.equal(attempts, 2);
  assert.ok(result.generationError);
  assert.equal(result.lesson.id, lesson.id);
  assert.equal(events.at(-1).type, 'reset');
  assert.equal(events.at(-1).failed, true);
  assert.equal(Object.keys(state.dailyLessons).length, 1);
});

test('invalid card claims are rejected before they can appear in the live preview', async () => {
  const events = [];
  const service = createLessonService({ readState: () => ({}), writeState() { throw new Error('must not save'); },
    streamComplete: async (_, { onDelta }) => { onDelta('{"cards":[' + JSON.stringify({ kind: 'insight', title: '不可信内容', body: '研究表明可以治愈', highlight: '不可信', steps: [] }) + ']'); }
  });
  const result = await service.generate('Asia/Shanghai', { onEvent: (event) => events.push(event) });
  assert.ok(result.generationError);
  assert.equal(events.filter((event) => event.type === 'card').length, 0);
});

test('off-topic food records cannot redirect the lesson and an older recovery record is used instead', async () => {
  const f = fixture({
    meliusTurns: { milk: { createdAt: '2026-11-02T09:00:00Z', userText: '最近想戒奶茶和戒糖，今天又喝了奶茶，很有压力。' } },
    journalEntries: [{ createdAt: '2026-11-01T09:00:00Z', title: '戒色时的晚间触发', body: '独处时想点开色情内容，后来把手机放远了。' }]
  }, payload => {
    assert.match(payload.messages[0].content, /QUITTR 戒色应用/);
    assert.match(payload.messages[0].content, /第1张卡片必须明确/);
    assert.match(payload.messages[1].content, /把手机放远/);
    assert.doesNotMatch(payload.messages[1].content, /奶茶|戒糖/);
    assert.equal(JSON.parse(payload.messages[1].content).windowDays,14);
    return generated();
  });
  assert.equal((await f.service.generate()).lesson.origin,'ai');
});

test('only unrelated goals produce an honest recovery starter without inventing pornography history', async () => {
  const f=fixture({meliusTurns:{one:{createdAt:'2026-11-02T09:00:00Z',userText:'我想30天减重，晚上少喝奶茶。'}}},payload=>{
    const context=JSON.parse(payload.messages[1].content);
    assert.equal(context.hasActivity,false);
    assert.deepEqual(context.conversations,[]);
    assert.match(payload.messages[0].content,/不能写成用户确实看过/);
    return generated();
  });
  const starter=f.service.get().lesson;
  assert.equal(starter.hasActivity,false);
  assert.match(starter.title,/色情内容/);
  const result=await f.service.generate();
  assert.match(result.lesson.reason,/还没有昨天与戒色相关的记录/);
});

test('off-topic generated output and generic habit courses are rejected rather than relabeled', async () => {
  for(const overrides of [
    {title:'戒糖小课堂'},
    {reason:'昨天你提到想少喝奶茶，所以推荐这一课。'},
    {cards:JSON.parse(generated().choices[0].message.content).cards.map(card=>({...card,body:'学习识别习惯，暂停一下，选择一个替代动作。'}))}
  ]){
    const f=fixture({},()=>generated(overrides));
    const result=await f.service.generate();
    assert.equal(result.lesson.origin,'starter');
    assert.match(result.lesson.title,/色情内容/);
    assert.ok(result.generationError);
    assert.equal(f.calls(),2);
    assert.equal(f.state().dailyLessons,undefined);
  }
});

test('a milk-tea card is blocked before streaming, then retry streams only the recovery deck', async () => {
  let state={},round=0;
  const events=[],good=generated();
  const service=createLessonService({readState:()=>structuredClone(state),writeState:value=>{state=value;},now:()=>new Date('2026-11-03T04:00:00Z'),
    streamComplete:async(_, {onDelta})=>{
      round++;
      if(round===1){onDelta('{"cards":['+JSON.stringify({kind:'insight',title:'戒奶茶',body:'喝奶茶前先暂停',highlight:'少喝糖',steps:[]})+',');throw new Error('should reject first card');}
      onDelta(good.choices[0].message.content);return good;
    }
  });
  const result=await service.generate('Asia/Shanghai',{onEvent:event=>events.push(event)});
  assert.equal(result.lesson.origin,'ai');
  assert.equal(events.filter(event=>event.type==='card').length,5);
  assert.doesNotMatch(JSON.stringify(events),/奶茶/);
});

test('cached off-topic lessons regenerate automatically under a new identity without deleting completion records', async () => {
  const oldBase=fixture().service.get().lesson;
  const old={...oldBase,origin:'ai',focusVersion:undefined,title:'戒奶茶，给自己一点时间',completedAt:'2026-11-03T01:00:00Z',intention:'少喝奶茶'};
  const f=fixture({dailyLessons:{[old.id]:old}});
  const preview=f.service.get();
  assert.equal(preview.needsGeneration,true);
  assert.equal(preview.lesson.origin,'starter');
  assert.doesNotMatch(JSON.stringify(preview),/奶茶/);
  const result=await f.service.generate();
  assert.equal(result.lesson.origin,'ai');
  assert.notEqual(result.lesson.id,old.id);
  assert.equal(result.needsGeneration,false);
  assert.deepEqual(f.state().dailyLessons[old.id],old);
  await createLessonService(f.options).generate();
  assert.equal(f.calls(),1);
});

test('a valid old recovery lesson refreshes its content policy while preserving readable history', async () => {
  const f=fixture();
  const first=(await f.service.generate()).lesson;
  const upgrade=fixture({dailyLessons:{[first.id]:{...first,focusVersion:undefined}}});
  assert.equal(upgrade.service.get().lesson.id,first.id);
  assert.equal(upgrade.service.get().needsGeneration,true);
  const result=await upgrade.service.generate();
  assert.notEqual(result.lesson.id,first.id);
  assert.equal(result.history[0].id,first.id);
  assert.equal(result.needsGeneration,false);
});

test('adding recovery labels to generic cards cannot bypass the lesson focus check', async () => {
  const draft=JSON.parse(generated().choices[0].message.content);
  draft.cards=draft.cards.map(card=>({...card,label:'戒色课',body:'照顾感受，选择生活里一个小动作。',annotations:[{text:'色情内容',style:'underline'}]}));
  const f=fixture({},()=>({choices:[{message:{content:JSON.stringify(draft)}}]}));
  assert.equal((await f.service.generate()).lesson.origin,'starter');
  assert.equal(f.state().dailyLessons,undefined);
});

test('failed refresh of an off-topic cache stays on the recovery starter and retains the old completion', async () => {
  const old={...fixture().service.get().lesson,origin:'ai',title:'奶茶戒断练习',completedAt:'2026-11-03T01:00:00Z'};
  const f=fixture({dailyLessons:{[old.id]:old}},()=>{throw new Error('provider unavailable');});
  const result=await f.service.generate();
  assert.equal(result.lesson.origin,'starter');
  assert.equal(result.needsGeneration,true);
  assert.ok(result.generationError);
  assert.doesNotMatch(JSON.stringify(result),/奶茶/);
  assert.equal(f.state().dailyLessons[old.id].completedAt,old.completedAt);
});
