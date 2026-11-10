const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

function uiHarness(overrides = {}) {
  const values = [], refs = [];
  let cursor = 0, refCursor = 0, persisted = null;
  const ctx = vm.createContext({
    console, crypto: webcrypto, AbortController,
    window: { setTimeout, clearTimeout, setInterval, clearInterval, ...overrides.window },
    sessionStorage: { getItem: () => persisted, setItem: (_, value) => { persisted = value; } },
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial; return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }]; },
    useRef(initial) { const index = refCursor++; if (!(index in refs)) refs[index] = { current: initial }; return refs[index]; },
    useEffect() {},
    h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    Icon: () => null,
    getClientErrorMessage: (error) => error.message,
    sendMeliusMessage: overrides.sendMeliusMessage || (async () => ({ reply: "回复成功", actions: [] }))
  });
  vm.runInContext(fs.readFileSync(require.resolve("../public/melius-chat.js"), "utf8"), ctx);
  return {
    ctx, values, refs,
    render(expression) { cursor = 0; refCursor = 0; return vm.runInContext(expression, ctx); },
    persist(value) { persisted = JSON.stringify(value); }
  };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return null;
  if (predicate(tree)) return tree;
  for (const child of tree.children || []) { const result = find(child, predicate); if (result) return result; }
  return null;
}

test("failed send is retained; retry reuses ID and exact context without duplicating the user bubble", async () => {
  const calls = [];
  const harness = uiHarness({ sendMeliusMessage: async (context, id) => {
    calls.push({ context: structuredClone(context), id });
    if (calls.length === 1) throw new Error("Network unavailable");
    return { reply: "恢复成功", actions: [] };
  } });
  let chat = harness.render("useMeliusConversation(async () => {})");
  await chat.send("打开记忆小游戏");
  chat = harness.render("useMeliusConversation(async () => {})");
  assert.equal(chat.messages[0].status, "failed");
  const id = chat.messages[0].id;
  await chat.send("", id);
  chat = harness.render("useMeliusConversation(async () => {})");
  assert.equal(chat.messages.filter((message) => message.role === "user").length, 1);
  assert.equal(chat.messages[0].status, "answered");
  assert.equal(chat.messages[1].text, "恢复成功");
  assert.deepEqual(calls[0], calls[1]);
});

test("an interrupted pending message becomes retryable after a reload", () => {
  const harness = uiHarness();
  harness.persist([{ id: "pending-123", role: "user", text: "你好", status: "pending", context: [{ role: "user", text: "你好" }] }]);
  const restored = harness.render("loadMeliusConversation()");
  assert.equal(restored[0].status, "failed");
  assert.match(restored[0].error, /重新发送/);
  assert.equal(restored[0].id, "pending-123");
});

test("speech recognition fills editable text without automatically sending a message", () => {
  let recognition, sent = false;
  class FakeRecognition {
    constructor() { recognition = this; }
    start() {}
    stop() { this.onend?.(); }
    abort() {}
  }
  const harness = uiHarness({ window: { SpeechRecognition: FakeRecognition } });
  harness.ctx.chatProps = { chat: { messages: [], isSending: false, send: () => { sent = true; } }, onAction: () => {}, onBack: () => {} };
  let tree = harness.render("MeliusChatPage(chatProps)");
  find(tree, (node) => node.type === "textarea").props.onChange({ target: { value: "我的感受：" } });
  tree = harness.render("MeliusChatPage(chatProps)");
  find(tree, (node) => node.props["aria-label"] === "Voice input").props.onClick();
  assert.equal(recognition.lang, "zh-CN");
  assert.equal(recognition.interimResults, true);
  recognition.onresult({ results: [[{ transcript: "今天感觉轻松了一点" }]] });
  recognition.stop();
  tree = harness.render("MeliusChatPage(chatProps)");
  assert.equal(find(tree, (node) => node.type === "textarea").props.value, "我的感受： 今天感觉轻松了一点");
  assert.equal(sent, false);
});

test("unsupported speech recognition shows a usable fallback", () => {
  const harness = uiHarness();
  harness.ctx.chatProps = { chat: { messages: [], isSending: false }, onAction: () => {}, onBack: () => {} };
  let tree = harness.render("MeliusChatPage(chatProps)");
  find(tree, (node) => node.props["aria-label"] === "Voice input").props.onClick();
  tree = harness.render("MeliusChatPage(chatProps)");
  const status = find(tree, (node) => node.props.className === "voice-notice");
  assert.match(status.children.join(""), /不支持语音识别/);
});

test("breathing action navigates to the exercise after sending", async () => {
  const harness = uiHarness();
  const routes = [];
  harness.ctx.chatProps = { chat: { messages: [], isSending: false, send: async () => ({ reply: "一起练习吧", actions: [{ type: "game", gameId: "breath", autoOpen: true }] }) }, onAction: (route) => routes.push(route), onBack() {} };
  let tree = harness.render("MeliusChatPage(chatProps)");
  find(tree, (node) => node.type === "textarea").props.onChange({ target: { value: "做做深呼吸" } });
  tree = harness.render("MeliusChatPage(chatProps)");
  await find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.deepEqual(routes, ["melius game breath"]);
});

test("breathing cards identify the exercise and provide a working entry", () => {
  const harness = uiHarness();
  const routes = [];
  harness.ctx.cardProps = { action: { type: "game", gameId: "breath", title: "Breath Hold" }, onAction: (route) => routes.push(route) };
  const tree = harness.render("ChatActionCard(cardProps)");
  assert.equal(find(tree, (node) => node.type === "strong").children[0], "深呼吸练习");
  const button = find(tree, (node) => node.type === "button");
  assert.equal(button.children[0], "进入呼吸练习");
  button.props.onClick();
  assert.deepEqual(routes, ["melius game breath"]);
});

test("assistant emphasis is rendered safely without literal markers or HTML execution", () => {
  const harness = uiHarness();
  const parts = harness.render('renderChatText("**吸气** <script>alert(1)</script>")');
  assert.equal(parts[1].type, "strong");
  assert.equal(parts[1].children[0], "吸气");
  assert.equal(parts[2], " <script>alert(1)</script>");
});

test('partial streaming text updates a single bubble before completion and finalizes without duplication', async () => {
  let deliver, finish;
  const harness = uiHarness({ sendMeliusMessage: async (_, __, ___, onEvent) => {
    deliver = onEvent;
    return new Promise((resolve) => { finish = resolve; });
  } });
  let chat = harness.render('useMeliusConversation(async () => {})');
  const pending = chat.send('你好');
  deliver({ type: 'delta', text: '我在' });
  chat = harness.render('useMeliusConversation(async () => {})');
  assert.equal(chat.messages[1].text, '我在');
  assert.equal(chat.messages[1].status, 'streaming');
  assert.equal(chat.isSending, true);
  deliver({ type: 'delta', text: '这里。' });
  finish({ reply: '我在这里。', actions: [] });
  await pending;
  chat = harness.render('useMeliusConversation(async () => {})');
  assert.equal(chat.messages.length, 2);
  assert.equal(chat.messages[1].text, '我在这里。');
  assert.equal(chat.messages[1].status, 'complete');
  assert.equal(chat.messages[0].status, 'answered');
});

test('an interrupted stream preserves partial text but excludes it from later conversation context', async () => {
  let calls = 0, nextContext;
  const harness = uiHarness({ sendMeliusMessage: async (context, _, __, onEvent) => {
    if (++calls === 1) { onEvent({ type: 'delta', text: '这段还没说完' }); throw new Error('网络中断'); }
    nextContext = context; return { reply: '完整回复', actions: [] };
  } });
  let chat = harness.render('useMeliusConversation(async () => {})');
  await chat.send('第一句');
  chat = harness.render('useMeliusConversation(async () => {})');
  assert.equal(chat.messages[1].status, 'interrupted');
  assert.equal(chat.messages[1].text, '这段还没说完');
  await chat.send('第二句');
  assert.equal(nextContext.length, 1);
  assert.equal(nextContext[0].text, '第二句');
});

test('a streamed card appears immediately and survives the next text-round reset', async () => {
  let deliver, finish;
  const harness = uiHarness({ sendMeliusMessage: async (_, __, ___, onEvent) => { deliver = onEvent; return new Promise((resolve) => { finish = resolve; }); } });
  let chat = harness.render('useMeliusConversation(async () => {})');
  const pending = chat.send('给我一张行动卡');
  const card = { id: 'card-001', type: 'content_card', title: '今天的一小步' };
  deliver({ type: 'card', card });
  deliver({ type: 'reset' });
  chat = harness.render('useMeliusConversation(async () => {})');
  assert.equal(chat.messages[1].actions[0].id, card.id);
  assert.equal(chat.isSending, true);
  deliver({ type: 'delta', text: '先挑一件试试。' });
  finish({ reply: '先挑一件试试。', actions: [card] });
  await pending;
  chat = harness.render('useMeliusConversation(async () => {})');
  assert.equal(chat.messages.length, 2);
  assert.equal(chat.messages[1].actions.length, 1);
});

test('artifact steps select locally, discussion prefills a prompt, and copying uses actual card content', async () => {
  let copied, discussed;
  const harness = uiHarness();
  harness.ctx.navigator = { clipboard: { writeText: async (text) => { copied = text; } } };
  harness.ctx.artifactProps = { card: { id: 'card-1', kind: 'plan', title: '今天的小计划', body: '只做一件小事。', items: [{ title: '休息', body: '起身喝水。' }, { title: '收尾', body: '写下下一步。' }], takeaway: '一点点也很好。' }, onDiscuss: (card) => { discussed = card.title; } };
  let tree = harness.render('MeliusArtifactCard(artifactProps)');
  find(tree, (node) => node.props.className === 'artifact-item').props.onClick();
  tree = harness.render('MeliusArtifactCard(artifactProps)');
  assert.equal(find(tree, (node) => node.props.className === 'artifact-item is-chosen').props['aria-pressed'], true);
  find(tree, (node) => node.props['aria-label'] === '继续聊「今天的小计划」').props.onClick();
  assert.equal(discussed, '今天的小计划');
  await find(tree, (node) => node.props['aria-label'] === '复制卡片').props.onClick();
  assert.match(copied, /今天的小计划/);
  assert.match(copied, /1. 休息：起身喝水。/);
  tree = harness.render('MeliusArtifactCard(artifactProps)');
  assert.equal(find(tree, (node) => node.props['aria-label'] === '复制卡片').children[0], '已复制');
});
