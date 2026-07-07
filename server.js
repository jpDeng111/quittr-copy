const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = __dirname;
const STATIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const QUITTR_STATE_PATH = path.join(DATA_DIR, "quittr-state.json");
const MELIUS_MODEL_NAME = process.env.MELIUS_MODEL || "qwen3.7-plus";
const API_BASE_URL = String(
  process.env.DASHSCOPE_BASE_URL || "https://coding.dashscope.aliyuncs.com/v1"
).replace(/\/+$/, "");

loadEnvFile(path.join(ROOT_DIR, ".env"));
fs.mkdirSync(DATA_DIR, { recursive: true });
const PORT = Number(process.env.PORT || 3000);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

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

    if (req.method === "GET" && url.pathname === "/styles.css") {
      return serveFile(res, path.join(STATIC_DIR, "styles.css"), "text/css; charset=utf-8");
    }

    if (req.method === "POST" && url.pathname === "/api/melius/chat") {
      return await handleMeliusChat(req, res);
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

    if (req.method === "GET" && url.pathname === "/api/blocker/state") {
      return sendJson(res, 200, getBlockerState());
    }

    if (req.method === "POST" && url.pathname === "/api/blocker/protection") {
      return await handleBlockerProtection(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/blocker/tier1") {
      return await handleBlockerTier1(req, res);
    }

    if (req.method === "GET" && url.pathname === "/api/blocker/websites") {
      return sendJson(res, 200, { websites: getBlockerWebsites() });
    }

    if (req.method === "POST" && url.pathname === "/api/blocker/websites") {
      return await handleBlockerAddWebsite(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/blocker/websites/remove") {
      return await handleBlockerRemoveWebsite(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/blocker/tier2") {
      return await handleBlockerTier2(req, res);
    }

    if (req.method === "GET" && url.pathname === "/api/blocker/apps") {
      return sendJson(res, 200, { apps: getBlockerApps() });
    }

    if (req.method === "POST" && url.pathname === "/api/blocker/apps") {
      return await handleBlockerAddApp(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/blocker/apps/remove") {
      return await handleBlockerRemoveApp(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/blocker/tier3") {
      return await handleBlockerTier3(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/blocker/tier3/unlock") {
      return await handleBlockerTier3Unlock(req, res);
    }

    if (req.method === "GET" && url.pathname === "/api/blocker/screentime") {
      return sendJson(res, 200, getBlockerScreenTime());
    }

    if (req.method === "GET" && url.pathname === "/api/community/posts") {
      return sendJson(res, 200, getCommunityPosts(url.searchParams.get("filter")));
    }

    if (req.method === "POST" && url.pathname === "/api/community/posts") {
      return await handleCommunityCreatePost(req, res);
    }

    if (req.method === "GET" && url.pathname === "/api/community/post") {
      return sendJson(res, 200, getCommunityPost(url.searchParams.get("id")));
    }

    if (req.method === "POST" && url.pathname === "/api/community/comment") {
      return await handleCommunityComment(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/community/like") {
      return await handleCommunityLike(req, res);
    }

    sendJson(res, 404, { error: "Not Found" });
  } catch (error) {
    sendJson(res, 500, { error: getErrorMessage(error) });
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

async function handleMeliusChat(req, res) {
  const body = await readJson(req);
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const safeMessages = messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({
      role: message.role,
      content: String(message.text || message.content || "").slice(0, 3000)
    }))
    .filter((message) => message.content.trim())
    .slice(-12);

  if (!apiKey) {
    return sendJson(res, 500, { error: "Missing DASHSCOPE_API_KEY in .env." });
  }

  if (safeMessages.length === 0) {
    return sendJson(res, 400, { error: "Message is empty." });
  }

  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MELIUS_MODEL_NAME,
      messages: [
        {
          role: "system",
          content: [
            "You are Melius, a calm and practical nofap/reboot recovery assistant.",
            "Help users reduce sexual urges, prevent relapse, process shame without judgment, and build healthier routines.",
            "Use short, warm, direct responses. Ask one useful question when needed.",
            "When the user is having an urge, prioritize grounding, delay tactics, environment change, and a concrete next 10-minute action.",
            "Do not provide erotic content, pornographic details, or anything that intensifies arousal.",
            "If the user mentions self-harm, coercion, abuse, or immediate danger, encourage contacting local emergency help or a trusted person right away.",
            "Match the user's language."
          ].join(" ")
        },
        ...safeMessages
      ],
      temperature: 0.7
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.message || data.code || response.statusText;
    return sendJson(res, response.status, { error: `Melius request failed: ${detail}` });
  }

  const reply = extractTextFromDashScope(data);
  sendJson(res, 200, {
    model: MELIUS_MODEL_NAME,
    reply: reply || "I am here with you. Tell me what feels strongest right now."
  });
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
  if (!fs.existsSync(QUITTR_STATE_PATH)) {
    const seeded = createDefaultQuittrState();
    writeQuittrState(seeded);
    return seeded;
  }

  const state = readJsonFile(QUITTR_STATE_PATH);
  if (!state.startedAt) {
    const seeded = createDefaultQuittrState();
    writeQuittrState(seeded);
    return seeded;
  }

  return state;
}

function writeQuittrState(state) {
  writeJsonFile(QUITTR_STATE_PATH, {
    ...state,
    updatedAt: state.updatedAt || new Date().toISOString()
  });
}

function createDefaultQuittrState(now = new Date()) {
  const day = DAY_MS;
  return {
    startedAt: new Date(now.getTime() - 34 * day).toISOString(),
    relapses: [31, 30, 27, 19, 12, 7].map((daysAgo) => new Date(now.getTime() - daysAgo * day).toISOString()),
    updatedAt: now.toISOString()
  };
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

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function writeJsonFile(filePath, payload) {
  writeTextFileAtomic(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeTextFileAtomic(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, text, "utf8");
  fs.renameSync(tmpPath, filePath);
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
  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("Invalid JSON request body."));
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

const DEFAULT_ADULT_DOMAINS = [
  "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "redtube.com",
  "youporn.com", "tube8.com", "spankbang.com", "brazzers.com", "onlyfans.com",
  "chaturbate.com", "stripchat.com", "cam4.com", "livejasmin.com", "bongacams.com",
  "eporner.com", "tnaflix.com", "beeg.com", "daftsex.com", "xmoviesforyou.com"
];

const AVAILABLE_APPS = [
  { id: "safari", name: "Safari", category: "Browser" },
  { id: "chrome", name: "Chrome", category: "Browser" },
  { id: "youtube", name: "YouTube", category: "Entertainment" },
  { id: "instagram", name: "Instagram", category: "Social" },
  { id: "tiktok", name: "TikTok", category: "Social" },
  { id: "x", name: "X (Twitter)", category: "Social" },
  { id: "reddit", name: "Reddit", category: "Social" },
  { id: "snapchat", name: "Snapchat", category: "Social" },
  { id: "facebook", name: "Facebook", category: "Social" },
  { id: "twitch", name: "Twitch", category: "Entertainment" },
  { id: "netflix", name: "Netflix", category: "Entertainment" },
  { id: "discord", name: "Discord", category: "Communication" },
  { id: "telegram", name: "Telegram", category: "Communication" },
  { id: "whatsapp", name: "WhatsApp", category: "Communication" }
];

function createDefaultBlockerState(now = new Date()) {
  return {
    protectionEnabled: false,
    tier1: {
      enabled: false,
      presetDomains: DEFAULT_ADULT_DOMAINS.slice(),
      customWebsites: []
    },
    tier2: {
      enabled: false,
      screenTimeIntegration: false,
      apps: []
    },
    tier3: {
      enabled: false,
      lockedAt: null,
      passcodeHash: null
    },
    screenTime: {
      todayMinutes: 0,
      pickups: 0,
      updatedAt: now.toISOString()
    },
    updatedAt: now.toISOString()
  };
}

function getBlockerState() {
  const state = readQuittrState();
  if (!state.blocker || !state.blocker.tier1) {
    const blocker = createDefaultBlockerState();
    writeQuittrState({ ...state, blocker, updatedAt: new Date().toISOString() });
    return blocker;
  }
  return state.blocker;
}

function writeBlockerState(blocker) {
  const state = readQuittrState();
  const updatedAt = new Date().toISOString();
  blocker.updatedAt = updatedAt;
  writeQuittrState({ ...state, blocker, updatedAt });
  return blocker;
}

function getBlockerWebsites() {
  const blocker = getBlockerState();
  const preset = (blocker.tier1.presetDomains || []).map((domain) => ({ domain, preset: true }));
  const custom = (blocker.tier1.customWebsites || []).map((domain) => ({ domain, preset: false }));
  return [...preset, ...custom];
}

function getBlockerApps() {
  const blocker = getBlockerState();
  return blocker.tier2.apps || [];
}

function getBlockerScreenTime() {
  const blocker = getBlockerState();
  return blocker.screenTime || { todayMinutes: 0, pickups: 0 };
}

function normalizeDomain(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.+$/, "");
}

function hashPasscode(passcode) {
  return crypto.createHash("sha256").update(String(passcode || "")).digest("hex");
}

async function handleBlockerProtection(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const blocker = getBlockerState();
  const enabled = Boolean(body.enabled);
  blocker.protectionEnabled = enabled;
  if (enabled && !blocker.tier1.enabled) {
    blocker.tier1.enabled = true;
  }
  if (!enabled) {
    if (blocker.tier3.enabled) {
      return sendJson(res, 403, { error: "Permanent lock is active. Protection cannot be turned off." });
    }
    blocker.tier1.enabled = false;
    blocker.tier2.enabled = false;
  }
  const updated = writeBlockerState(blocker);
  sendJson(res, 200, updated);
}

async function handleBlockerTier1(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const blocker = getBlockerState();
  blocker.tier1.enabled = Boolean(body.enabled);
  if (blocker.tier1.enabled) {
    blocker.protectionEnabled = true;
  } else if (!blocker.tier2.enabled) {
    blocker.protectionEnabled = false;
  }
  const updated = writeBlockerState(blocker);
  sendJson(res, 200, updated);
}

async function handleBlockerAddWebsite(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const domain = normalizeDomain(body.website || body.domain);
  if (!domain || !domain.includes(".")) {
    return sendJson(res, 400, { error: "Please enter a valid website domain." });
  }
  const blocker = getBlockerState();
  const presetDomains = blocker.tier1.presetDomains || [];
  const customWebsites = blocker.tier1.customWebsites || [];
  if (presetDomains.includes(domain) || customWebsites.includes(domain)) {
    return sendJson(res, 409, { error: "This website is already blocked." });
  }
  customWebsites.push(domain);
  blocker.tier1.customWebsites = customWebsites;
  const updated = writeBlockerState(blocker);
  sendJson(res, 200, { websites: getBlockerWebsites(), blocker: updated });
}

async function handleBlockerRemoveWebsite(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const domain = normalizeDomain(body.website || body.domain);
  const blocker = getBlockerState();
  blocker.tier1.customWebsites = (blocker.tier1.customWebsites || []).filter((item) => item !== domain);
  const updated = writeBlockerState(blocker);
  sendJson(res, 200, { websites: getBlockerWebsites(), blocker: updated });
}

async function handleBlockerTier2(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const blocker = getBlockerState();
  blocker.tier2.enabled = Boolean(body.enabled);
  if (blocker.tier2.enabled) {
    blocker.tier2.screenTimeIntegration = true;
    if (!blocker.tier1.enabled) {
      blocker.tier1.enabled = true;
      blocker.protectionEnabled = true;
    }
  }
  const updated = writeBlockerState(blocker);
  sendJson(res, 200, updated);
}

async function handleBlockerAddApp(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const appId = String(body.appId || body.id || "").trim();
  const appDef = AVAILABLE_APPS.find((app) => app.id === appId);
  if (!appDef) {
    return sendJson(res, 400, { error: "Unknown app." });
  }
  const blocker = getBlockerState();
  const apps = blocker.tier2.apps || [];
  if (apps.some((app) => app.id === appId)) {
    return sendJson(res, 409, { error: "This app is already blocked." });
  }
  apps.push({ id: appDef.id, name: appDef.name, category: appDef.category, blockedAt: new Date().toISOString() });
  blocker.tier2.apps = apps;
  const updated = writeBlockerState(blocker);
  sendJson(res, 200, { apps: getBlockerApps(), blocker: updated });
}

async function handleBlockerRemoveApp(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const appId = String(body.appId || body.id || "").trim();
  const blocker = getBlockerState();
  if (blocker.tier3.enabled) {
    return sendJson(res, 403, { error: "Permanent lock is active. Apps cannot be removed." });
  }
  blocker.tier2.apps = (blocker.tier2.apps || []).filter((app) => app.id !== appId);
  const updated = writeBlockerState(blocker);
  sendJson(res, 200, { apps: getBlockerApps(), blocker: updated });
}

async function handleBlockerTier3(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const passcode = String(body.passcode || "").trim();
  if (passcode.length < 4) {
    return sendJson(res, 400, { error: "Passcode must be at least 4 digits." });
  }
  const blocker = getBlockerState();
  if ((blocker.tier2.apps || []).length === 0) {
    return sendJson(res, 400, { error: "Add at least one app to block before enabling permanent lock." });
  }
  blocker.tier3.enabled = true;
  blocker.tier3.lockedAt = new Date().toISOString();
  blocker.tier3.passcodeHash = hashPasscode(passcode);
  blocker.tier2.enabled = true;
  blocker.tier1.enabled = true;
  blocker.protectionEnabled = true;
  const updated = writeBlockerState(blocker);
  sendJson(res, 200, updated);
}

async function handleBlockerTier3Unlock(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const passcode = String(body.passcode || "").trim();
  const blocker = getBlockerState();
  if (!blocker.tier3.enabled) {
    return sendJson(res, 400, { error: "Permanent lock is not active." });
  }
  if (hashPasscode(passcode) !== blocker.tier3.passcodeHash) {
    return sendJson(res, 403, { error: "Incorrect passcode. The permanent lock remains in place." });
  }
  blocker.tier3.enabled = false;
  blocker.tier3.lockedAt = null;
  blocker.tier3.passcodeHash = null;
  const updated = writeBlockerState(blocker);
  sendJson(res, 200, updated);
}

const COMMUNITY_AVATARS = ["🐶", "🐱", "🦊", "🐻", "🐼", "🦁", "🐯", "🐨", "🐸", "🐵", "🦉", "hawk"];

function createDefaultCommunityState(now = new Date()) {
  const weekAgo = new Date(now.getTime() - 28 * DAY_MS);
  const posts = [
    {
      id: crypto.randomUUID(),
      author: "Constant Lie",
      authorAvatar: "🦊",
      streak: 0,
      title: "Constant Lie",
      body: "I do good for a week or so and then lie to myself that one time won't hurt. But it always does. How do you stop the self-deception?",
      createdAt: new Date(now.getTime() - 28 * DAY_MS).toISOString(),
      comments: [],
      likes: 2,
      likedByMe: false,
      views: 44
    },
    {
      id: crypto.randomUUID(),
      author: "Nathan",
      authorAvatar: "🐶",
      streak: 14,
      title: "Peace",
      body: "Guys... I am so stoked right now. Two weeks clean and I finally feel like myself again. The fog is lifting. If you're struggling right now, keep going. It gets better.",
      createdAt: new Date(now.getTime() - 21 * DAY_MS).toISOString(),
      comments: [
        { id: crypto.randomUUID(), author: "Ian Rent", authorAvatar: "🐻", text: "This is inspiring man, keep it up!", createdAt: new Date(now.getTime() - 20 * DAY_MS).toISOString() }
      ],
      likes: 9,
      likedByMe: false,
      views: 47
    },
    {
      id: crypto.randomUUID(),
      author: "Ian Rent",
      authorAvatar: "🐻",
      streak: 0,
      title: "I keep doing it",
      body: "I've been doing it at least once a day and it's pissing me off but it's a habit now. How do I stop?",
      createdAt: new Date(now.getTime() - 14 * DAY_MS).toISOString(),
      comments: [],
      likes: 0,
      likedByMe: false,
      views: 52
    },
    {
      id: crypto.randomUUID(),
      author: "Rigoberto Reyes",
      authorAvatar: "🦁",
      streak: 3,
      title: "I'm struggling",
      body: "I'm having a very hard time with this. Every night it's the same battle. Any tips for getting through the late night urges?",
      createdAt: new Date(now.getTime() - 10 * DAY_MS).toISOString(),
      comments: [
        { id: crypto.randomUUID(), author: "Kempa", authorAvatar: "🐼", text: "Cold showers at night helped me a lot. Stay strong brother.", createdAt: new Date(now.getTime() - 9 * DAY_MS).toISOString() }
      ],
      likes: 1,
      likedByMe: false,
      views: 60
    },
    {
      id: crypto.randomUUID(),
      author: "Kempa",
      authorAvatar: "🐼",
      streak: 0,
      title: "Need a sex therapist hotline",
      body: "I can't stop guys I need help. Does anyone know a hotline or resource I can call? I feel like I can't do this alone anymore.",
      createdAt: new Date(now.getTime() - 7 * DAY_MS).toISOString(),
      comments: [],
      likes: 0,
      likedByMe: false,
      views: 55
    },
    {
      id: crypto.randomUUID(),
      author: "Zeke",
      authorAvatar: "🐯",
      streak: 15,
      title: "Day 15",
      body: "No porn, but I can't stop jerking off. How do I stop? The porn is gone but the habit is still there. Any advice?",
      createdAt: new Date(now.getTime() - 3 * DAY_MS).toISOString(),
      comments: [],
      likes: 0,
      likedByMe: false,
      views: 86
    },
    {
      id: crypto.randomUUID(),
      author: "Anonymous",
      authorAvatar: "🦉",
      streak: 7,
      title: "Don't go on Reddit or X",
      body: "Seriously, those platforms are full of triggers. Deleted both apps and my urges dropped significantly. Highly recommend.",
      createdAt: new Date(now.getTime() - 1 * DAY_MS).toISOString(),
      comments: [],
      likes: 5,
      likedByMe: false,
      views: 32
    }
  ];
  return { posts, updatedAt: now.toISOString() };
}

function getCommunityState() {
  const state = readQuittrState();
  if (!state.community || !Array.isArray(state.community.posts)) {
    const community = createDefaultCommunityState();
    writeQuittrState({ ...state, community, updatedAt: new Date().toISOString() });
    return community;
  }
  return state.community;
}

function writeCommunityState(community) {
  const state = readQuittrState();
  const updatedAt = new Date().toISOString();
  community.updatedAt = updatedAt;
  writeQuittrState({ ...state, community, updatedAt });
  return community;
}

function formatTimeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);
  if (weeks >= 1) return `${weeks}w ago`;
  if (days >= 1) return `${days}d ago`;
  if (hours >= 1) return `${hours}h ago`;
  if (minutes >= 1) return `${minutes}m ago`;
  return "just now";
}

function formatPost(post) {
  return {
    ...post,
    timeAgo: formatTimeAgo(post.createdAt),
    commentCount: (post.comments || []).length
  };
}

function getCommunityPosts(filter) {
  const community = getCommunityState();
  let posts = (community.posts || []).slice();
  if (filter === "top") {
    posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } else {
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return { posts: posts.map(formatPost) };
}

function getCommunityPost(id) {
  const community = getCommunityState();
  const post = (community.posts || []).find((p) => p.id === id);
  if (!post) {
    return { error: "Post not found" };
  }
  post.views = (post.views || 0) + 1;
  writeCommunityState(community);
  return { post: formatPost(post) };
}

async function handleCommunityCreatePost(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const title = String(body.title || "").trim();
  const postBody = String(body.body || "").trim();
  if (!title && !postBody) {
    return sendJson(res, 400, { error: "Post cannot be empty." });
  }
  const community = getCommunityState();
  const avatar = COMMUNITY_AVATARS[Math.floor(Math.random() * COMMUNITY_AVATARS.length)];
  const post = {
    id: crypto.randomUUID(),
    author: "You",
    authorAvatar: avatar,
    streak: 0,
    title: title || "Untitled",
    body: postBody,
    createdAt: new Date().toISOString(),
    comments: [],
    likes: 0,
    likedByMe: false,
    views: 0
  };
  community.posts = [post, ...(community.posts || [])];
  writeCommunityState(community);
  sendJson(res, 200, { post: formatPost(post) });
}

async function handleCommunityComment(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const postId = String(body.postId || "").trim();
  const text = String(body.text || "").trim();
  if (!text) {
    return sendJson(res, 400, { error: "Comment cannot be empty." });
  }
  const community = getCommunityState();
  const post = (community.posts || []).find((p) => p.id === postId);
  if (!post) {
    return sendJson(res, 404, { error: "Post not found." });
  }
  const avatar = COMMUNITY_AVATARS[Math.floor(Math.random() * COMMUNITY_AVATARS.length)];
  const comment = {
    id: crypto.randomUUID(),
    author: "You",
    authorAvatar: avatar,
    text,
    createdAt: new Date().toISOString()
  };
  post.comments = [comment, ...(post.comments || [])];
  writeCommunityState(community);
  sendJson(res, 200, { post: formatPost(post), comment });
}

async function handleCommunityLike(req, res) {
  const body = await readJson(req).catch(() => ({}));
  const postId = String(body.postId || "").trim();
  const community = getCommunityState();
  const post = (community.posts || []).find((p) => p.id === postId);
  if (!post) {
    return sendJson(res, 404, { error: "Post not found." });
  }
  post.likedByMe = !post.likedByMe;
  post.likes = Math.max(0, (post.likes || 0) + (post.likedByMe ? 1 : -1));
  writeCommunityState(community);
  sendJson(res, 200, { post: formatPost(post) });
}
