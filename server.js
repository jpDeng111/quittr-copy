const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createMeliusService } = require("./melius");
const { createLessonService } = require("./lessons");
const { readCompletionStream } = require("./public/event-stream");
const { createStore, current, failure, chatHistory } = require("./storage");
const { createAuth, publicUser } = require("./auth");
const { createCommunity } = require("./community");
const { initialSugar, addSugarLog, addCraving, checkIn, setPreferences, summary, dateKey } = require('./sugar');

const ROOT_DIR = __dirname;
loadEnvFile(path.join(ROOT_DIR, ".env"));
const STATIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = process.env.QUITTR_DATA_DIR || path.join(ROOT_DIR, "data");
const MELIUS_MODEL_NAME = process.env.MELIUS_MODEL || "qwen3.7-plus";
// 课程使用同一套 coding plan 凭据，但模型与超时独立可配。
const LESSON_MODEL_NAME = process.env.LESSON_MODEL || MELIUS_MODEL_NAME;
const LESSON_TIMEOUT_MS = Number(process.env.LESSON_TIMEOUT_MS || 60000);
const API_BASE_URL = String(
  process.env.DASHSCOPE_BASE_URL || "https://coding.dashscope.aliyuncs.com/v1"
).replace(/\/+$/, "");

fs.mkdirSync(DATA_DIR, { recursive: true });
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).origin : "";
const store = createStore(path.join(DATA_DIR, "quittr.sqlite"));
const auth = createAuth(store, { secure: PUBLIC_ORIGIN.startsWith("https://"), allowRegistration: process.env.ALLOW_REGISTRATION !== "false" });
const community = createCommunity(store.db);
function requestServices() {
  const context = current();
  if (!context) throw failure(401, "请先登录。");
  if (context.services) return context.services;
  context.services = { melius: createMeliusService({ domain: 'sugar', readState: readSugarState, writeState: writeSugarState, complete: requestMeliusCompletion, streamComplete: (payload, { onDelta }) => requestMeliusCompletion({ ...payload, stream: true }, { onDelta, timeoutMs: 60000 }) }),
    lessons: createLessonService({
      domain: 'sugar', readState: readSugarState, writeState: writeSugarState,
      complete: payload => requestMeliusCompletion(payload, { model: LESSON_MODEL_NAME, timeoutMs: LESSON_TIMEOUT_MS }),
      modelName: LESSON_MODEL_NAME,
      onError: (error, attempt) => console.warn(`[lesson] generation attempt ${attempt + 1} failed: ${error.message}`)
    }) };
  return context.services;
}
const melius = new Proxy({}, { get: (_, method) => (...args) => requestServices().melius[method](...args) });
const lessons = new Proxy({}, { get: (_, method) => (...args) => requestServices().lessons[method](...args) });

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader("Cache-Control", "no-store");
  if (PUBLIC_ORIGIN.startsWith("https://")) res.setHeader("Strict-Transport-Security", "max-age=31536000");
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "POST" && url.pathname.startsWith("/api/")) {
      const expected = PUBLIC_ORIGIN || `http://${req.headers.host}`;
      if (req.headers.origin ? req.headers.origin !== expected : req.headers["x-quittr-request"] !== "1") throw failure(403, "请求来源无效，请从应用页面操作。");
      if (req.headers["sec-fetch-site"] === "cross-site") throw failure(403, "请求来源无效。");
      if (!String(req.headers["content-type"] || "").startsWith("application/json")) throw failure(415, "请使用 JSON 请求。");
      req.jsonBody = await readJson(req);
    }
    const address = req.socket.remoteAddress || "";
    const isLoopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
    req.clientIp = process.env.TRUST_PROXY === "true" && isLoopback ? String(req.headers["x-forwarded-for"] || address).split(",")[0].trim() : address;
    if (req.method === "GET" && url.pathname === "/healthz") {
      store.db.prepare("SELECT 1").get();
      return sendJson(res, 200, { status: "ok" });
    }
    if (url.pathname.startsWith("/api/auth/")) {
      const action = url.pathname.slice("/api/auth/".length);
      if (req.method !== (action === "session" ? "GET" : "POST")) return sendJson(res, 405, { error: "Method Not Allowed" });
      return sendJson(res, 200, await auth.handle(action, req, res, req.jsonBody));
    }
    if (url.pathname.startsWith("/api/")) {
      const user = auth.session(req);
      if (req.headers["x-quittr-account"] && req.headers["x-quittr-account"] !== user.id) throw failure(401, "账号已切换，请重新登录后操作。");
      if (req.method === "POST") {
        auth.limitUser(user.id, "writes", 120, 1);
        if (url.pathname === "/api/melius/chat") auth.limitUser(user.id, "chat", 12, 1);
        if (url.pathname === "/api/lessons/daily") auth.limitUser(user.id, "lessons", 6, 10);
      }
      return await store.run(user, () => handleRequest(req, res));
    }
    await handleRequest(req, res);
  } catch (error) {
    if (res.headersSent) { if (!res.writableEnded) res.end(); return; }
    if (!error.status) console.error("Request failed:", error.message);
    sendJson(res, error.status || 500, { error: error.status ? error.message : "服务器暂时无法完成请求，请稍后重试。" });
  }
});

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/blocker/') || url.pathname === '/api/quittr/relapses') return sendJson(res, 410, { error: '此功能已随轻甜减糖版停用。旧数据仍保留，可在个人数据导出中查看。' });
    const mobileAssets = {
      '/mobile.css': ['mobile.css', 'text/css; charset=utf-8'],
      '/mobile.js': ['mobile.js', 'application/javascript; charset=utf-8'],
      '/sw.js': ['sw.js', 'application/javascript; charset=utf-8'],
      '/offline.html': ['offline.html', 'text/html; charset=utf-8'],
      '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'],
      '/icons/icon.svg': ['icons/icon.svg', 'image/svg+xml'],
      '/icons/icon-192.png': ['icons/icon-192.png', 'image/png'],
      '/icons/icon-512.png': ['icons/icon-512.png', 'image/png'],
      '/icons/apple-touch-icon.png': ['icons/apple-touch-icon.png', 'image/png']
    };
    if (req.method === 'GET' && mobileAssets[url.pathname]) {
      const [filename, contentType] = mobileAssets[url.pathname];
      return serveFile(res, path.join(STATIC_DIR, filename), contentType);
    }

    if (req.method === "OPTIONS") {
      setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return serveFile(res, path.join(STATIC_DIR, "index.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/app.js") {
      return serveFile(res, path.join(STATIC_DIR, "app.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/auth-client.js") {
      return serveFile(res, path.join(STATIC_DIR, "auth-client.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/api/account/bootstrap") {
      const state = readSugarState();
      return sendJson(res, 200, { user: publicUser(current().user), preferences: readQuittrState().preferences || {}, chat: chatHistory(state) });
    }
    if (req.method === "GET" && url.pathname === "/api/melius/history") {
      return sendJson(res, 200, chatHistory(readSugarState(), { before: url.searchParams.get("before"), limit: url.searchParams.get("limit") }));
    }
    if (req.method === 'GET' && url.pathname === '/api/sugar/state') return sendJson(res, 200, summary(readSugarState(), url.searchParams.get('timeZone') || 'Asia/Shanghai'));
    if (req.method === 'GET' && url.pathname === '/api/sugar/journal') return sendJson(res, 200, { entries: readSugarState().journalEntries });
    if (req.method === 'POST' && url.pathname === '/api/sugar/journal') {
      const body = await readJson(req);
      const state = readSugarState();
      const content = String(body.body || '').trim().slice(0, 5000);
      if (!content) return sendJson(res, 400, { error: '写下一点感受再保存吧。' });
      if (!/^[\w-]{8,128}$/.test(body.clientId || '')) return sendJson(res, 400, { error: '记录标识无效。' });
      const previous = state.journalEntries.find(entry => entry.clientId === body.clientId);
      const title = String(body.title || '').trim().slice(0, 100) || '工作日的一小页';
      if (previous && (previous.body !== content || previous.title !== title)) return sendJson(res, 409, { error: '记录标识已使用，请重新打开表单。' });
      const entry = previous || { id: crypto.randomUUID(), clientId: body.clientId, title, body: content, category: 'reflection', createdAt: new Date().toISOString() };
      if (!previous) writeSugarState({ ...state, journalEntries: [entry, ...state.journalEntries] });
      return sendJson(res, 200, { entry });
    }
    if (req.method === 'POST' && ['/api/sugar/logs', '/api/sugar/cravings', '/api/sugar/check-in', '/api/sugar/preferences'].includes(url.pathname)) {
      const body = await readJson(req);
      const timeZone = body.timeZone || 'Asia/Shanghai';
      dateKey(new Date(), timeZone);
      const state = readSugarState();
      let next, entry;
      if (url.pathname.endsWith('/preferences')) next = setPreferences(state, body);
      else {
        const result = url.pathname.endsWith('/logs') ? addSugarLog(state, body) : url.pathname.endsWith('/cravings') ? addCraving(state, body) : checkIn(state, body);
        next = result.state; entry = result.entry;
      }
      writeSugarState(next);
      return sendJson(res, 200, { entry, summary: summary(next, timeZone) });
    }
    if (req.method === "GET" && url.pathname === "/api/account/export") {
      res.setHeader("Content-Disposition", 'attachment; filename="quittr-data.json"');
      return sendJson(res, 200, { user: publicUser(current().user), exportedAt: new Date().toISOString(), data: { ...readQuittrState(), community: community.exportOwn(current().user.id) } });
    }
    if (req.method === "POST" && url.pathname === "/api/account/progress") {
      const body = await readJson(req);
      const state = readQuittrState();
      const preferences = { ...state.preferences };
      if (body.kind === "course" && typeof body.id === "string" && /^[\w-]{1,100}$/.test(body.id)) {
        preferences.completedLessonIds = [...new Set([...(preferences.completedLessonIds || []), body.id])];
      } else if (body.kind === "game" && ["memory", "find", "words", "stroop", "math", "breath"].includes(body.id) && Number.isInteger(body.level) && body.level >= 1 && body.level <= 5) {
        preferences.gameLevels = { ...preferences.gameLevels, [body.id]: Math.max(preferences.gameLevels?.[body.id] || 1, body.level) };
      } else return sendJson(res, 400, { error: "无效的进度数据。" });
      writeQuittrState({ ...state, preferences });
      return sendJson(res, 200, { preferences });
    }

    if (req.method === "GET" && url.pathname === "/event-stream.js") {
      return serveFile(res, path.join(STATIC_DIR, "event-stream.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/melius-chat.js") {
      return serveFile(res, path.join(STATIC_DIR, "melius-chat.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/daily-lessons.js") {
      return serveFile(res, path.join(STATIC_DIR, "daily-lessons.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/styles.css") {
      return serveFile(res, path.join(STATIC_DIR, "styles.css"), "text/css; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/vendor/react.js") {
      return serveFile(res, path.join(STATIC_DIR, "vendor", "react.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/vendor/react-dom.js") {
      return serveFile(res, path.join(STATIC_DIR, "vendor", "react-dom.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "POST" && url.pathname === "/api/melius/chat") {
      return await handleMeliusChat(req, res);
    }

    if (req.method === "GET" && url.pathname === "/api/lessons/daily") {
      return sendJson(res, 200, lessons.get(url.searchParams.get("timeZone") || "Asia/Shanghai"));
    }

    if (req.method === "POST" && url.pathname === "/api/lessons/daily") {
      const body = await readJson(req);
      return sendJson(res, 200, await lessons.generate(body.timeZone || "Asia/Shanghai", { force: body.regenerate === true }));
    }

    if (req.method === "POST" && url.pathname === "/api/lessons/complete") {
      return sendJson(res, 200, lessons.complete(await readJson(req)));
    }

    if (req.method === "GET" && url.pathname === "/api/quittr/analytics") {
      return sendJson(res, 200, buildQuittrAnalytics());
    }

    if (req.method === "POST" && url.pathname === "/api/quittr/relapses") {
      return await handleQuittrRelapse(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/quittr/urges") {
      return await handleQuittrUrge(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/quittr/pledges") {
      const body = await readJson(req);
      const timeZone = typeof body.timeZone === "string" ? body.timeZone : "Asia/Shanghai";
      let date;
      try { date = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()); }
      catch { return sendJson(res, 400, { error: "无效的时区。" }); }
      const state = readQuittrState();
      const pledges = state.pledges || [];
      if (!pledges.some(item => item.date === date && item.timeZone === timeZone)) {
        pledges.push({ id: crypto.randomUUID(), date, timeZone, createdAt: new Date().toISOString() });
        writeQuittrState({ ...state, pledges });
      }
      return sendJson(res, 200, { pledges });
    }

    if (req.method === "GET" && url.pathname === "/api/quittr/journal") {
      return sendJson(res, 200, { entries: getJournalEntries() });
    }

    if (req.method === "POST" && url.pathname === "/api/quittr/journal") {
      return await handleQuittrJournalEntry(req, res);
    }

    if (req.method === "GET" && url.pathname === "/api/quittr/reasons") {
      return sendJson(res, 200, { reasons: getQuittrReasons() });
    }

    if (req.method === "POST" && url.pathname === "/api/quittr/reasons") {
      return await handleQuittrReasons(req, res);
    }

    if (req.method === "GET" && url.pathname === "/api/community/posts") {
      return sendJson(res, 200, community.list(current().user.id, url.searchParams.get("filter")));
    }

    if (req.method === "POST" && url.pathname === "/api/community/posts") {
      return sendJson(res, 200, community.create(current().user.id, await readJson(req)));
    }

    if (req.method === "GET" && url.pathname === "/api/community/post") {
      return sendJson(res, 200, community.get(url.searchParams.get("id"), current().user.id));
    }

    if (req.method === "POST" && url.pathname === "/api/community/comment") {
      return sendJson(res, 200, community.comment(current().user.id, await readJson(req)));
    }

    if (req.method === "POST" && url.pathname === "/api/community/like") {
      return sendJson(res, 200, community.like(current().user.id, await readJson(req)));
    }

    sendJson(res, 404, { error: "Not Found" });
  } catch (error) {
    throw error;
  }
}

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log(`Quittr running on ${HOST}:${PORT}; database: ${path.join(DATA_DIR, "quittr.sqlite")}`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
    server.close(() => { store.close(); process.exit(0); });
    const timer = setTimeout(() => process.exit(1), 30000); timer.unref();
  });
}
module.exports = { server, store };

async function requestMeliusCompletion(payload, { model = MELIUS_MODEL_NAME, timeoutMs = 25000, onDelta } = {}) {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  if (!apiKey) throw new Error("Missing DASHSCOPE_API_KEY in .env.");
  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, enable_thinking: false, ...payload })
  });
  if (response.ok && payload.stream) return readCompletionStream(response.body, onDelta);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error?.message || data.message || data.code || response.statusText;
    throw new Error(`Melius request failed: ${String(detail).replaceAll(apiKey, "[redacted]")}`);
  }
  return data;
}

async function handleMeliusChat(req, res) {
  const body = await readJson(req);
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((message) => message && ["user", "assistant"].includes(message.role))
    .map((message) => ({ role: message.role, content: String(message.text || message.content || "").slice(0, 3000) }))
    .filter((message) => message.content.trim()).slice(-12);
  const requestId = typeof body.requestId === "string" ? body.requestId : crypto.randomUUID();
  if (body.stream === true) {
    setCorsHeaders(res);
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    const emit = (event, data) => { if (!res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
    const heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(": keepalive\n\n"); }, 12000);
    res.once("close", () => clearInterval(heartbeat));
    try {
      const result = await melius.send({ requestId, messages, onEvent: ({ type, ...data }) => emit(type, data) });
      emit("done", { ...result, model: MELIUS_MODEL_NAME });
    } catch (error) {
      const timedOut = ["TimeoutError", "AbortError"].includes(error.name);
      emit("error", { error: timedOut ? "回复等待超时，请重新发送。已完成的记录不会重复保存。" : error.message, requestId, actions: melius.savedActions(requestId) });
    } finally { clearInterval(heartbeat); if (!res.destroyed) res.end(); }
    return;
  }
  try {
    const result = await melius.send({ requestId, messages });
    sendJson(res, 200, { ...result, model: MELIUS_MODEL_NAME });
  } catch (error) {
    const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
    sendJson(res, error.status || (timedOut ? 504 : 502), {
      error: timedOut ? "回复等待超时，请重新发送。已完成的记录不会重复保存。" : error.message,
      requestId, actions: melius.savedActions(requestId)
    });
  }
}

async function handleQuittrRelapse(req, res) {
  await readJson(req).catch(() => ({}));
  const state = readQuittrState();
  const relapsedAt = new Date().toISOString();
  const relapses = Array.isArray(state.relapses) ? state.relapses : [];

  writeQuittrState({
    ...state,
    relapses: [...relapses, relapsedAt],
    updatedAt: relapsedAt
  });

  sendJson(res, 200, buildQuittrAnalytics());
}

async function handleQuittrUrge(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const state = readQuittrState();
  const loggedAt = new Date().toISOString();
  const urges = Array.isArray(state.urges) ? state.urges : [];
  const urge = {
    id: crypto.randomUUID(),
    loggedAt,
    intensity: String(body.intensity || "Unknown"),
    intensityValue: clampNumber(body.intensityValue, 0, 100),
    context: String(body.context || "Unknown"),
    alone: typeof body.alone === "boolean" ? body.alone : null,
    response: String(body.response || "Not set")
  };

  writeQuittrState({
    ...state,
    urges: [...urges, urge],
    updatedAt: loggedAt
  });

  sendJson(res, 200, { urge, analytics: buildQuittrAnalytics() });
}

async function handleQuittrJournalEntry(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const state = readQuittrState();
  const createdAt = new Date().toISOString();
  const title = String(body.title || "").trim();
  const entryBody = String(body.body || "").trim();

  if (!title && !entryBody) {
    return sendJson(res, 400, { error: "Journal entry is empty." });
  }

  const journalEntries = Array.isArray(state.journalEntries) ? state.journalEntries : [];
  const entry = {
    id: crypto.randomUUID(),
    title: title || "Untitled",
    body: entryBody,
    createdAt
  };

  writeQuittrState({
    ...state,
    journalEntries: [entry, ...journalEntries],
    updatedAt: createdAt
  });

  sendJson(res, 200, { entry, entries: getJournalEntries() });
}

function getJournalEntries() {
  const state = readQuittrState();
  const journalEntries = Array.isArray(state.journalEntries) ? state.journalEntries : [];
  return journalEntries
    .filter((entry) => entry && (entry.title || entry.body))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function handleQuittrReasons(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const state = readQuittrState();
  const reasons = Array.isArray(body.reasons)
    ? body.reasons.map((reason) => String(reason || "").trim()).filter(Boolean)
    : [];
  const updatedAt = new Date().toISOString();

  writeQuittrState({
    ...state,
    reasons,
    updatedAt
  });

  sendJson(res, 200, { reasons });
}

function getQuittrReasons() {
  const state = readQuittrState();
  return Array.isArray(state.reasons)
    ? state.reasons.map((reason) => String(reason || "").trim()).filter(Boolean)
    : [];
}

function buildQuittrAnalytics(now = new Date()) {
  const state = readQuittrState();
  const startedAt = parseDate(state.startedAt) || new Date(now.getTime() - 13 * DAY_MS);
  const relapses = normalizeRelapses(state.relapses, startedAt, now);
  const streaks = buildStreaks(startedAt, relapses, now);
  const completedStreaks = streaks.filter((streak) => streak.relapseAt);
  const currentStreak = streaks[streaks.length - 1] || {
    startAt: startedAt.toISOString(),
    endAt: now.toISOString(),
    days: 0,
    relapseAt: null,
    current: true
  };
  const allDurations = streaks.map((streak) => streak.days);
  const bestStreak = Math.max(0, ...allDurations);
  const avgStreak = allDurations.length
    ? allDurations.reduce((sum, value) => sum + value, 0) / allDurations.length
    : 0;
  const currentDays = currentStreak.days;
  const rankPercent = estimateRankPercent(currentDays, bestStreak, relapses.length);
  const encouragement = getQuittrEncouragement(currentDays);

  return {
    startedAt: startedAt.toISOString(),
    generatedAt: now.toISOString(),
    currentStreakStartAt: currentStreak.startAt,
    currentStreakMs: Math.max(0, now.getTime() - new Date(currentStreak.startAt).getTime()),
    currentStreakDays: roundDays(currentDays),
    currentStreakLabel: formatDaysLabel(currentDays),
    currentStreakClockLabel: formatDurationLabel(Math.max(0, now.getTime() - new Date(currentStreak.startAt).getTime())),
    soberGoalDays: 90,
    soberGoalRemainingLabel: formatGoalRemainingLabel(currentDays, 90),
    relapses: relapses.map((date) => date.toISOString()),
    urges: Array.isArray(state.urges) ? state.urges : [],
    journalEntries: getJournalEntries(),
    reasons: getQuittrReasons(),
    streaks: streaks.map((streak, index) => ({
      id: index + 1,
      startAt: streak.startAt,
      endAt: streak.endAt,
      relapseAt: streak.relapseAt,
      days: roundDays(streak.days),
      label: formatCompactDays(streak.days),
      current: streak.current
    })),
    progressPoints: buildProgressPoints(completedStreaks, currentStreak),
    stats: {
      bestStreakDays: roundDays(bestStreak),
      bestStreakLabel: formatCompactDays(bestStreak),
      avgStreakDays: roundDays(avgStreak),
      avgStreakLabel: formatCompactDays(avgStreak),
      relapseCount: relapses.length,
      rankPercent,
      karma: Math.max(1, Math.round(currentDays + bestStreak / 2))
    },
    encouragement
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function readQuittrState() {
  if (!current()) throw failure(401, "请先登录。");
  return structuredClone(current().state);
}

// Keep the previous product's records intact, without feeding them into the
// sugar companion, lessons or timeline. Tables and account IDs stay unchanged.
function readSugarState() {
  const state = readQuittrState();
  if (!state.sugar) { state.sugar = initialSugar(); writeQuittrState(state); }
  const turns = Object.entries(state.meliusTurns || {}).filter(([id]) => id.startsWith('sugar_')).map(([id, turn]) => [id.slice(6), turn]);
  return { ...initialSugar(), ...state.sugar, journalEntries: (state.journalEntries || []).filter(entry => entry.product === 'sugar'), meliusTurns: Object.fromEntries(turns) };
}
function writeSugarState(next) {
  const state = readQuittrState();
  const { journalEntries = [], meliusTurns = {}, ...sugar } = next;
  const turns = Object.fromEntries(Object.entries(meliusTurns).map(([id, turn]) => [`sugar_${id}`, { ...turn, product: 'sugar' }]));
  writeQuittrState({ ...state, sugar, journalEntries: [...(state.journalEntries || []).filter(entry => entry.product !== 'sugar'), ...journalEntries.map(entry => ({ ...entry, product: 'sugar' }))], meliusTurns: { ...state.meliusTurns, ...turns } });
}

function writeQuittrState(state) {
  const context = current();
  if (!context) throw failure(401, "请先登录。");
  store.write(context.user.id, state);
  context.state = structuredClone(state);
}

function normalizeRelapses(relapses, startedAt, now) {
  if (!Array.isArray(relapses)) {
    return [];
  }

  const unique = new Set();
  for (const item of relapses) {
    const date = parseDate(item);
    if (!date || date <= startedAt || date > now) {
      continue;
    }
    unique.add(date.toISOString());
  }

  return [...unique].sort().map((item) => new Date(item));
}

function buildStreaks(startedAt, relapses, now) {
  const streaks = [];
  let cursor = startedAt;

  for (const relapse of relapses) {
    streaks.push(createStreak(cursor, relapse, relapse, false));
    cursor = relapse;
  }

  streaks.push(createStreak(cursor, now, null, true));
  return streaks;
}

function createStreak(start, end, relapseAt, current) {
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    relapseAt: relapseAt ? relapseAt.toISOString() : null,
    days: Math.max(0, (end.getTime() - start.getTime()) / DAY_MS),
    current
  };
}

function buildProgressPoints(completedStreaks, currentStreak) {
  const points = completedStreaks.map((streak, index) => ({
    id: index + 1,
    days: roundDays(streak.days),
    type: "relapse",
    label: formatCompactDays(streak.days),
    at: streak.relapseAt
  }));

  points.push({
    id: points.length + 1,
    days: roundDays(currentStreak.days),
    type: "progress",
    label: formatCompactDays(currentStreak.days),
    at: currentStreak.endAt
  });

  return points;
}

function estimateRankPercent(currentDays, bestStreak, relapseCount) {
  const score = currentDays * 6 + bestStreak * 4 - relapseCount * 5;
  if (score >= 90) return 10;
  if (score >= 60) return 25;
  if (score >= 34) return 40;
  if (score >= 16) return 55;
  return 72;
}

function getQuittrEncouragement(days) {
  const stageDays = roundDays(days);

  if (stageDays < 2) {
    return {
      title: "First Steps Count",
      body: "Your brain is already responding to the decision. Keep the next hour simple and protect your focus."
    };
  }

  if (stageDays < 7) {
    return {
      title: "Momentum Is Building",
      body: "You may notice clearer energy and a little more control over urges. Small choices are starting to stack up."
    };
  }

  if (stageDays < 14) {
    return {
      title: "One Week Strong!",
      body: "A full week is a major milestone. Your brain is beginning to heal. You might notice improved focus and energy. This is just the beginning."
    };
  }

  return {
    title: "Deeper Reset",
    body: "Your discipline is becoming part of your identity. Expect steadier confidence, better attention, and more space between urges and action."
  };
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function roundDays(value) {
  return Math.round(value * 10) / 10;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function formatDaysLabel(days) {
  const roundedDays = roundDays(days);

  if (roundedDays < 1) {
    const hours = Math.max(0, Math.round(days * 24));
    return `${hours}h`;
  }
  return `${Math.round(roundedDays)}d`;
}

function formatCompactDays(days) {
  if (days < 1) {
    return `${Math.max(0, Math.round(days * 24))}h`;
  }
  return `${Math.round(days)}d`;
}

function formatDurationLabel(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / (60 * 1000)));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatGoalRemainingLabel(currentDays, goalDays) {
  const remainingDays = Math.max(0, goalDays - currentDays);
  if (remainingDays === 0) {
    return "0d";
  }
  if (remainingDays < 1) {
    const remainingHours = Math.ceil(remainingDays * 24);
    return `${remainingHours}h`;
  }
  return `${Math.ceil(remainingDays)}d`;
}

function extractTextFromDashScope(data) {
  const candidates = [];

  if (typeof data?.output?.text === "string") {
    candidates.push(data.output.text);
  }

  const choices = data?.choices || data?.output?.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (typeof choice?.message?.content === "string") {
        candidates.push(choice.message.content);
      }

      if (Array.isArray(choice?.message?.content)) {
        for (const item of choice.message.content) {
          if (typeof item?.text === "string") {
            candidates.push(item.text);
          }
        }
      }
    }
  }

  return candidates.map((item) => item.trim()).find(Boolean) || "";
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath, contentType) {
  const content = fs.readFileSync(filePath);
  setCorsHeaders(res);
  res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
  res.end(content);
}

function setCorsHeaders(res) {
  res.setHeader("Vary", "Origin");
}

function readJson(req) {
  if (req.jsonBody !== undefined) return Promise.resolve(req.jsonBody);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 128 * 1024) { reject(failure(413, "请求内容过大。")); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const body = raw ? JSON.parse(raw) : {};
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid object");
        resolve(body);
      } catch (error) {
        reject(failure(400, "请求 JSON 格式无效。"));
      }
    });
    req.on("error", reject);
  });
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
