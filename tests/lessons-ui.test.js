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
    useEffect() {}, h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }), Icon() {}, CourseOverviewPage() {}
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
