const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createMeliusService } = require("../melius");

const fixedTime = new Date("2026-10-25T08:00:00Z");
const reply = { choices: [{ message: { content: "我在这里，记录已整理。" } }] };
function call(name, args) { return { choices: [{ message: { content: "", tool_calls: [{ id: "tool-1", type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] }; }
function fixture(sequence, initial = {}) {
  let state = { startedAt: "2026-01-01T00:00:00Z", relapses: [], reasons: ["原有动力"], ...initial };
  let calls = 0;
  const options = {
    readState: () => structuredClone(state), writeState: (next) => { state = structuredClone(next); }, now: () => fixedTime,
    complete: async (payload) => { const next = sequence[calls++]; if (next instanceof Error) throw next; if (typeof next === "function") return next(payload); if (!next) throw new Error("Unexpected completion call"); return next; }
  };
  return { service: createMeliusService(options), options, state: () => state, calls: () => calls };
}
function request(text, requestId = "message-test-001") { return { requestId, messages: [{ role: "user", content: text }] }; }

test("motivation appends to existing reasons and creates an attributed journal entry", async () => {
  const text = "我的动力是把时间留给家人。";
  const f = fixture([call("save_motivation", { reasons: ["把时间留给家人"], source_quote: text }), reply]);
  const result = await f.service.send(request(text));
  assert.deepEqual(f.state().reasons, ["原有动力", "把时间留给家人"]);
  assert.equal(f.state().journalEntries[0].category, "motivation");
  assert.equal(f.state().journalEntries[0].sourceQuote, text);
  assert.equal(result.actions[0].route, "reasons");
});

test("actual relapse stores feelings and trigger and updates statistics", async () => {
  const text = "刚才我破戒了，现在很后悔，触发因素是熬夜。";
  const f = fixture([call("record_check_in", { status: "relapsed", feelings: "后悔", trigger: "熬夜", source_quote: text }), reply]);
  await f.service.send(request(text));
  assert.equal(f.state().relapses.length, 1);
  assert.equal(f.state().journalEntries[0].category, "post_relapse");
  assert.equal(f.state().recoveryCheckIns[0].feelings, "后悔");
  assert.equal(f.state().recoveryCheckIns[0].trigger, "熬夜");
});

for (const text of ["我没有破戒", "今天差点破戒了", "如果我破戒了该怎么办？", "I'm afraid I might relapse", "I almost relapsed"]) {
  test(`ambiguous or negated relapse does not change data: ${text}`, async () => {
    const f = fixture([call("record_check_in", { status: "relapsed", source_quote: text }), (payload) => {
      assert.equal(JSON.parse(payload.messages.at(-1).content).status, "not_saved"); return reply;
    }]);
    const result = await f.service.send(request(text));
    assert.equal(f.state().relapses.length, 0);
    assert.equal(f.state().journalEntries, undefined);
    assert.equal(result.actions.length, 0);
  });
}

test("explicit staying-clean check-in does not reset streak", async () => {
  const text = "我今天没有破戒，坚持住了。";
  const f = fixture([call("record_check_in", { status: "clean", feelings: "", source_quote: text }), reply]);
  await f.service.send(request(text));
  assert.equal(f.state().relapses.length, 0);
  assert.equal(f.state().recoveryCheckIns[0].relapsed, false);
});

test("follow-up to a recent manual Reset does not append another relapse", async () => {
  const text = "我刚才破戒了，感觉很累。";
  const f = fixture([call("record_check_in", { status: "relapsed", source_quote: text }), reply], { relapses: ["2026-10-25T07:58:00Z"] });
  await f.service.send(request(text));
  assert.equal(f.state().relapses.length, 1);
  assert.equal(f.state().recoveryCheckIns[0].relapseAt, "2026-10-25T07:58:00Z");
});

test("old event without a known time is not treated as just happening", async () => {
  const text = "昨天破戒了。";
  const f = fixture([call("record_check_in", { status: "relapsed", source_quote: text }), reply]);
  await f.service.send(request(text));
  assert.equal(f.state().relapses.length, 0);
});

test("an explicitly different relapse is not merged with a recent one", async () => {
  const text = "我刚才又破戒了。";
  const f = fixture([call("record_check_in", { status: "relapsed", source_quote: text }), reply], { relapses: ["2026-10-25T07:58:00Z"] });
  await f.service.send(request(text));
  assert.equal(f.state().relapses.length, 2);
});

test("invented evidence cannot create a journal entry", async () => {
  const f = fixture([call("save_journal", { title: "错误", body: "不该记录", source_quote: "我很难过" }), reply]);
  await f.service.send(request("你好"));
  assert.equal(f.state().journalEntries, undefined);
});

test("a valid game action returns an executable game ID without adding personal records", async () => {
  const f = fixture([call("open_game", { game_id: "memory" }), reply]);
  const result = await f.service.send(request("打开记忆小游戏"));
  assert.equal(result.actions[0].gameId, "memory");
  assert.equal(result.actions[0].autoOpen, true);
  assert.equal(f.state().journalEntries, undefined);
});

test("unknown game IDs do not execute", async () => {
  const f = fixture([call("open_game", { game_id: "external-script" }), reply]);
  assert.equal((await f.service.send(request("打开游戏"))).actions.length, 0);
});

test("concurrent sends with the same ID share one request and one save", async () => {
  const text = "我今天很累，想把手机放下。";
  const f = fixture([call("save_journal", { title: "休息一下", body: text, source_quote: text }), reply]);
  const [a, b] = await Promise.all([f.service.send(request(text)), f.service.send(request(text))]);
  assert.deepEqual(a, b);
  assert.equal(f.calls(), 2);
  assert.equal(f.state().journalEntries.length, 1);
});

test("retry after a save but failed answer is durable and does not save again", async () => {
  const text = "刚才我破戒了，现在很后悔。";
  const action = call("record_check_in", { status: "relapsed", feelings: "后悔", source_quote: text });
  const f = fixture([action, new Error("Network timeout"), action, reply]);
  await assert.rejects(f.service.send(request(text)), /Network timeout/);
  assert.equal(f.state().relapses.length, 1);
  assert.equal(f.service.savedActions("message-test-001").length, 1);
  const restarted = createMeliusService(f.options);
  const result = await restarted.send(request(text));
  assert.ok(result.reply);
  assert.equal(f.state().relapses.length, 1);
  assert.equal(f.state().journalEntries.length, 1);
  assert.equal(f.state().recoveryCheckIns.length, 1);
  const again = await createMeliusService(f.options).send(request(text));
  assert.deepEqual(again, result);
  assert.equal(f.calls(), 4);
});

test("a reused ID with different text is rejected instead of repeating actions", async () => {
  const f = fixture([reply]);
  await f.service.send(request("你好"));
  await assert.rejects(f.service.send(request("另一条消息")), { status: 409 });
});

test("request must end with a user message", async () => {
  const f = fixture([]);
  await assert.rejects(f.service.send({ requestId: "test-1234", messages: [] }), { status: 400 });
});

for (const text of ["做做深呼吸", "我想做深呼吸", "带我做一次呼吸练习", "打开呼吸练习", "请做一下深呼吸吧"]) {
  test(`direct breathing request opens the built-in exercise immediately: ${text}`, async () => {
    const f = fixture([]);
    const result = await f.service.send(request(text));
    assert.equal(result.actions[0].gameId, "breath");
    assert.equal(result.actions[0].title, "深呼吸练习");
    assert.equal(result.actions[0].status, "ready");
    assert.equal(result.actions[0].autoOpen, true);
    assert.doesNotMatch(result.reply, /已打开|已开始/);
    assert.equal(f.calls(), 0);
    assert.equal(f.state().journalEntries, undefined);
    assert.deepEqual(await f.service.send(request(text)), result);
  });
}

test("a correction after a breathing request resolves to the existing app exercise", async () => {
  const f = fixture([]);
  const result = await f.service.send({ requestId: "correction-001", messages: [
    { role: "user", content: "做做深呼吸" },
    { role: "assistant", content: "好的，我们一起来做几次深呼吸。" },
    { role: "user", content: "软件内应该是有深呼吸的功能" }
  ] });
  assert.equal(result.actions[0].gameId, "breath");
  assert.equal(f.calls(), 0);
});

for (const text of ["不想做深呼吸", "软件内有深呼吸的功能吗？", "深呼吸有什么作用", "刚才做了深呼吸", "如果想做深呼吸呢？", "他说‘做做深呼吸’", "软件内应该是有深呼吸的功能"]) {
  test(`breathing mention is not automatically treated as a command: ${text}`, async () => {
    const f = fixture([reply]);
    const result = await f.service.send(request(text));
    assert.equal(result.actions.length, 0);
    assert.equal(f.calls(), 1);
  });
}

test("contextual language can use the dedicated breathing capability", async () => {
  const f = fixture([call("start_breathing", {}), (payload) => {
    const result = JSON.parse(payload.messages.at(-1).content);
    assert.equal(result.status, "ready");
    assert.equal(result.gameId, "breath");
    return { choices: [{ message: { content: "一起进入呼吸练习吧。" } }] };
  }]);
  const result = await f.service.send(request("带我用应用里的练习调整一下呼吸"));
  assert.equal(result.actions[0].gameId, "breath");
  assert.equal(f.state().journalEntries, undefined);
});
