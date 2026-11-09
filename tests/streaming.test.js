const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { consumeSSE, readCompletionStream } = require('../public/event-stream');
const { createMeliusService } = require('../melius');
const encode = new TextEncoder();
const frame = (data) => `data: ${JSON.stringify(data)}\r\n\r\n`;
const delta = (content) => ({ choices: [{ index: 0, delta: { content } }] });
const finish = (reason = 'stop') => ({ choices: [{ index: 0, delta: {}, finish_reason: reason }] });
function body(text, stride = 1) {
  const bytes = encode.encode(text);
  return new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += stride) controller.enqueue(bytes.slice(i, i + stride)); controller.close(); } });
}

test('SSE decodes fragmented UTF-8, CRLF, comments, multiline data and an unterminated last event', async () => {
  const events = [];
  await consumeSSE(body(': heartbeat\r\nevent: delta\r\ndata: 你好\r\ndata: 世界\r\n\r\nevent: done\ndata: 完成'), (event) => events.push(event));
  assert.deepEqual(events, [{ event: 'delta', data: '你好\n世界' }, { event: 'done', data: '完成' }]);
});

test('model tokens arrive before the stream ends instead of waiting for an assembled response', async () => {
  let controller;
  const stream = new ReadableStream({ start(value) { controller = value; } });
  let firstDelta;
  const first = new Promise((resolve) => { firstDelta = resolve; });
  let settled = false;
  const pending = readCompletionStream(stream, firstDelta).then((result) => { settled = true; return result; });
  controller.enqueue(encode.encode(frame(delta('我在这里'))));
  assert.equal(await first, '我在这里');
  assert.equal(settled, false);
  controller.enqueue(encode.encode(frame(delta('，一起慢慢来。')) + frame(finish()) + 'data: [DONE]\n\n'));
  controller.close();
  assert.equal((await pending).choices[0].message.content, '我在这里，一起慢慢来。');
});

test('fragmented tool calls are assembled separately and never exposed as text deltas', async () => {
  const tokens = [];
  const text = frame({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'save_journal', arguments: '{"title":' } }] } }] })
    + frame({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"反思"}' } }] } }] }) + frame(finish('tool_calls'));
  const result = await readCompletionStream(body(text, 7), (token) => tokens.push(token));
  assert.deepEqual(tokens, []);
  assert.deepEqual(result.choices[0].message.tool_calls, [{ id: 'call-1', type: 'function', function: { name: 'save_journal', arguments: '{"title":"反思"}' } }]);
});

test('truncated, broken and provider-error streams fail rather than completing partial messages', async () => {
  await assert.rejects(readCompletionStream(body(frame(delta('未完成')))), /未完成/);
  await assert.rejects(readCompletionStream(body(frame(delta('未完成')) + frame(finish('length')))), /未完成/);
  await assert.rejects(readCompletionStream(body(frame({ error: { message: 'provider unavailable' } }))), /provider unavailable/);
});

function fixture(streamComplete) {
  let state = { startedAt: '2026-01-01T00:00:00Z', reasons: [], relapses: [] };
  const options = { readState: () => structuredClone(state), writeState: (next) => { state = structuredClone(next); }, complete: async () => { throw new Error('should stream'); }, streamComplete };
  return { service: createMeliusService(options), state: () => state, options };
}
const request = { requestId: 'stream-message-001', messages: [{ role: 'user', content: '我想把时间留给家人，这是我的动力。' }] };

test('streaming preserves tool evidence, clears pre-tool text, and saves retry results once', async () => {
  let calls = 0;
  const f = fixture(async (_, { onDelta }) => {
    calls++;
    if (calls === 1) {
      onDelta('我来整理一下');
      return { choices: [{ message: { content: '我来整理一下', tool_calls: [{ id: 'tool1', function: { name: 'save_motivation', arguments: JSON.stringify({ reasons: ['把时间留给家人'], source_quote: request.messages[0].content }) } }] } }] };
    }
    onDelta('已保存，'); onDelta('我们一步步来。');
    return { choices: [{ message: { content: '已保存，我们一步步来。' } }] };
  });
  const events = [];
  const result = await f.service.send({ ...request, onEvent: (event) => events.push(event) });
  assert.deepEqual(events.map((event) => event.type), ['delta', 'reset', 'delta', 'delta']);
  assert.equal(result.actions[0].type, 'motivation');
  assert.equal(f.state().journalEntries.length, 1);
  assert.equal(f.state().meliusTurns[request.requestId].response.reply, result.reply);
  const cached = await createMeliusService(f.options).send({ ...request, onEvent() {} });
  assert.equal(cached.reply, result.reply);
  assert.equal(calls, 2);
  assert.equal(f.state().journalEntries.length, 1);
});

test('a reconnect gets earlier deltas and shares the active request without executing tools twice', async () => {
  let finishReply;
  let called = 0;
  const f = fixture(async (_, { onDelta }) => {
    called++; onDelta('你好');
    await new Promise((resolve) => { finishReply = resolve; });
    onDelta('，我在。');
    return { choices: [{ message: { content: '你好，我在。' } }] };
  });
  const a = [], b = [];
  const first = f.service.send({ ...request, onEvent: (event) => a.push(event) });
  const second = f.service.send({ ...request, onEvent: (event) => b.push(event) });
  assert.equal(b[0].text, '你好');
  finishReply();
  const [one, two] = await Promise.all([first, second]);
  assert.equal(one.reply, two.reply); assert.equal(called, 1); assert.deepEqual(a, b);
});

test('the browser transport consumes deltas and requires a final done event', async () => {
  const app = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
  const source = app.slice(app.indexOf('async function sendMeliusMessage('), app.indexOf('function getClientErrorMessage('));
  let requestBody;
  const ctx = vm.createContext({ QuittrStream: { consumeSSE }, MELIUS_CHAT_ENDPOINT: '/api/melius/chat', fetch: async (_, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(body('event: delta\ndata: {"text":"你好"}\n\nevent: done\ndata: {"reply":"你好","actions":[]}\n\n'), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  vm.runInContext(source, ctx);
  const deltas = [];
  const result = await ctx.sendMeliusMessage([], 'test-stream', undefined, (event) => deltas.push(event.text));
  assert.equal(requestBody.stream, true); assert.deepEqual(deltas, ['你好']); assert.equal(result.reply, '你好');
  ctx.fetch = async () => new Response(body('event: delta\ndata: {"text":"只到一半"}\n\n'), { headers: { 'Content-Type': 'text/event-stream' } });
  await assert.rejects(ctx.sendMeliusMessage([], 'test-stream'), /中断/);
});
