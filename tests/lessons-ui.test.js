const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createLessonService } = require('../lessons');

function harness() {
  const values = [], refs = [];
  let cursor = 0, refCursor = 0;
  const ctx = vm.createContext({
    console, Intl, Date, React: { Fragment: 'fragment' },
    localStorage: { getItem() { return null; }, setItem() {} },
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial; return [values[i], (next) => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useRef(initial) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: initial }; return refs[i]; },
    useEffect() {}, h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }), Icon() {}, CourseOverviewPage() {}, CommunityShareButton() {}, CheckinReturnButton() {}, lessonShareContent() {}
  });
  vm.runInContext(fs.readFileSync(require.resolve('../public/daily-lessons.js'), 'utf8'), ctx);
  const lesson = createLessonService({ readState: () => ({}), writeState() {}, complete() {}, now: () => new Date('2026-11-03T00:00:00Z') }).get().lesson;
  ctx.props = { daily: { lesson, history: [], generating: false, error: '' }, onBack() {}, onAction() {}, onOpen() {}, onReplace() {} };
  return { ctx, lesson, render(expression) { cursor = 0; refCursor = 0; return vm.runInContext(expression, ctx); } };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of tree.children || []) { const result = find(child, predicate); if (result) return result; }
  return null;
}

test('regenerate remains visible for AI and completed lessons, and disables during generation', async () => {
  const f = harness();
  let requests = 0;
  f.ctx.props.daily.lesson = { ...f.lesson, origin: 'ai', completedAt: '2026-11-03T01:00:00Z' };
  f.ctx.props.daily.regenerate = async () => { requests++; };
  let tree = f.render('DailyClassroomPage(props)');
  let button = find(tree, (n) => n.props['aria-label'] === '重新生成今日课程');
  assert.ok(button);
  assert.equal(button.props.disabled, false);
  await button.props.onClick();
  assert.equal(requests, 1);
  f.ctx.props.daily.generating = true;
  tree = f.render('DailyClassroomPage(props)');
  button = find(tree, (n) => n.props['aria-label'] === '重新生成今日课程');
  assert.equal(button.props.disabled, true);
});

test('reader regeneration replaces the open card deck only after a successful new response', async () => {
  const f = harness();
  let replaced;
  f.ctx.props.lesson = f.lesson;
  f.ctx.props.onReplace = (next) => { replaced = next; };
  const nextLesson = { ...f.lesson, id: `${f.lesson.id}-new`, title: '新的一课' };
  f.ctx.props.daily.regenerate = async () => ({ lesson: nextLesson });
  let tree = f.render('DailyLessonReader(props)');
  await find(tree, (n) => n.props['aria-label'] === '重新生成课程卡片').props.onClick();
  assert.equal(replaced.id, nextLesson.id);
  replaced = undefined;
  f.ctx.props.daily.regenerate = async () => ({ lesson: f.lesson, generationError: '生成失败' });
  tree = f.render('DailyLessonReader(props)');
  await find(tree, (n) => n.props['aria-label'] === '重新生成课程卡片').props.onClick();
  assert.equal(replaced, undefined);
});

test('annotation segmentation preserves literal text and ignores overlapping or invented phrases', () => {
  const f = harness();
  f.ctx.body = '注意当下的感受，尝试一个小小的行动。<script>literal</script>';
  f.ctx.annotations = [
    { text: '当下的感受', style: 'circle' }, { text: '感受', style: 'underline' },
    { text: '一个小小的行动', style: 'highlight' }, { text: '不存在', style: 'highlight' }
  ];
  const parts = f.render('lessonTextSegments(body, annotations)');
  assert.equal(parts.map((part) => part.text).join(''), f.ctx.body);
  assert.deepEqual(Array.from(parts.filter((part) => part.style), (part) => part.style), ['circle', 'highlight']);
  f.ctx.card = { body: f.ctx.body, annotations: f.ctx.annotations };
  const tree = f.render('LessonAnnotatedText({card, animate: false})');
  assert.ok(find(tree, (node) => node.type === 'mark' && node.props.className.includes('ink-circle is-drawn')));
  assert.equal(find(tree, (node) => node.props.dangerouslySetInnerHTML), null);
});

test('live studio exposes ready cards and leaves future cards unavailable', () => {
  const f = harness();
  f.ctx.props.daily.generating = true;
  f.ctx.props.daily.draftCards = [f.lesson.cards[0]];
  const tree = f.render('LessonLiveStudio(props)');
  const nav = find(tree, (node) => node.props['aria-label'] === '已生成的课程卡片');
  assert.equal(nav.children.length, 5);
  assert.equal(nav.children[0].props.disabled, false);
  assert.equal(nav.children[1].props.disabled, true);
  const page = f.render('DailyClassroomPage(props)');
  assert.ok(find(page, (node) => node.type?.name === 'LessonLiveStudio'));
});

test('daily lesson browser transport shows streamed cards and discards interrupted drafts', async () => {
  const { consumeSSE } = require('../public/event-stream');
  for (const interrupted of [false, true]) {
    const f = harness();
    const effects = [];
    f.ctx.useEffect = (effect) => effects.push(effect);
    f.ctx.AbortController = AbortController;
    f.ctx.API_BASE = '';
    f.ctx.QuittrStream = { consumeSSE };
    const previous = { ...f.lesson, origin: 'ai' };
    const next = { ...previous, id: 'new-lesson' };
    let controller;
    const stream = new ReadableStream({ start(value) { controller = value; } });
    f.ctx.fetch = async (_, options) => options?.method === 'POST'
      ? new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
      : Response.json({ lesson: previous, history: [] });
    f.render('useDailyLessons(Date.now())');
    const cleanup = effects.at(-1)();
    await new Promise((resolve) => setImmediate(resolve));
    let daily = f.render('useDailyLessons(Date.now())');
    const pending = daily.regenerate();
    const frame = (event, payload) => controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
    frame('reset', {});
    frame('card', { index: 0, card: f.lesson.cards[0] });
    await new Promise((resolve) => setImmediate(resolve));
    daily = f.render('useDailyLessons(Date.now())');
    assert.equal(daily.draftCards.length, 1);
    assert.equal(daily.generating, true);
    assert.equal(daily.lesson.id, previous.id, 'the saved deck stays active until done');
    if (!interrupted) frame('done', { lesson: next, history: [previous] });
    controller.close();
    await pending;
    daily = f.render('useDailyLessons(Date.now())');
    assert.equal(daily.generating, false);
    assert.equal(daily.lesson.id, interrupted ? previous.id : next.id);
    assert.equal(daily.draftCards.length, interrupted ? 0 : 1);
    assert.equal(Boolean(daily.error), interrupted);
    cleanup();
  }
});

test('a cached AI lesson flagged for topic-policy refresh triggers automatic generation', async () => {
  const f=harness(),effects=[];let posts=0;
  f.ctx.useEffect=effect=>effects.push(effect);f.ctx.AbortController=AbortController;f.ctx.API_BASE='';
  const lesson={...f.lesson,origin:'ai'};
  f.ctx.fetch=async(_,options)=>{if(options?.method==='POST'){posts++;return Response.json({lesson,history:[],needsGeneration:false});}return Response.json({lesson,history:[],needsGeneration:true});};
  f.render('useDailyLessons(Date.now())');const cleanup=effects.at(-1)();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(posts,1);
  assert.equal(f.render('useDailyLessons(Date.now())').generating,false);
  cleanup();
});
