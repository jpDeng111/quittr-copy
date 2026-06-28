const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ROOT_DIR = __dirname;
const STATIC_DIR = path.join(ROOT_DIR, "public");
const JOBS_ROOT = path.join(ROOT_DIR, "jobs");
const DATA_DIR = path.join(ROOT_DIR, "data");
const QUITTR_STATE_PATH = path.join(DATA_DIR, "quittr-state.json");
const MAX_CHUNK_SECONDS = 240;
const CHUNKS_MANIFEST_NAME = "chunks-manifest.json";
const MODEL_NAME = "qwen3.6-plus";
const MELIUS_MODEL_NAME = process.env.MELIUS_MODEL || "qwen3.7-plus";
const API_BASE_URL = String(
  process.env.DASHSCOPE_BASE_URL || "https://coding.dashscope.aliyuncs.com/v1"
).replace(/\/+$/, "");

loadEnvFile(path.join(ROOT_DIR, ".env"));
fs.mkdirSync(JOBS_ROOT, { recursive: true });
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

    if (req.method === "POST" && url.pathname === "/api/transcribe") {
      return await handleTranscribe(req, res);
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

async function handleTranscribe(req, res) {
  let job = null;

  try {
    const body = await readJson(req);
    const videoUrl = String(body.url || "").trim();
    const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();

    if (!videoUrl) {
      return sendJson(res, 400, { error: "Please provide a video URL." });
    }

    if (!apiKey) {
      return sendJson(res, 500, { error: "Missing DASHSCOPE_API_KEY in .env." });
    }

    assertRequiredCommands(["yt-dlp", "ffmpeg", "ffprobe"]);

    job = createJob(videoUrl);
    fs.mkdirSync(job.dir, { recursive: true });
    fs.mkdirSync(job.chunksDir, { recursive: true });
    fs.mkdirSync(job.resultsDir, { recursive: true });

    res.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });

    const sendEvent = (payload) => {
      if (res.writableEnded || res.destroyed) {
        return;
      }

      try {
        res.write(`${JSON.stringify(payload)}\n`);
      } catch {
        // Keep the background job moving even if the browser connection closes.
      }
    };

    sendEvent({
      type: "status",
      step: "prepare",
      message: `Preparing resumable job ${job.id}...`
    });
    updateCheckpoint(job, {
      id: job.id,
      sourceUrl: videoUrl,
      model: MODEL_NAME,
      chunkSeconds: MAX_CHUNK_SECONDS,
      status: "preparing"
    });

    const existingTranscript = readTextFile(job.transcriptPath);
    if (existingTranscript) {
      sendEvent({
        type: "partial",
        transcript: existingTranscript,
        transcriptPath: job.transcriptPath
      });
    }

    const info = await downloadVideo(videoUrl, job, sendEvent);
    sendEvent({
      type: "status",
      step: "downloaded",
      message: `Downloaded video for: ${info.title}`
    });

    const metadata = {
      id: job.id,
      sourceUrl: videoUrl,
      title: info.title,
      model: MODEL_NAME,
      chunkSeconds: MAX_CHUNK_SECONDS,
      updatedAt: new Date().toISOString(),
      transcriptPath: job.transcriptPath
    };
    writeJsonFile(job.metadataPath, metadata);
    updateCheckpoint(job, {
      ...metadata,
      status: "downloaded",
      sourcePath: info.sourcePath || "",
      normalizedPath: info.videoPath
    });

    const chunks = await splitVideo(info.videoPath, job, sendEvent);
    sendEvent({
      type: "status",
      step: "chunks_ready",
      message: `Prepared ${chunks.length} video chunk(s).`
    });
    updateCheckpoint(job, {
      id: job.id,
      sourceUrl: videoUrl,
      title: info.title,
      model: MODEL_NAME,
      totalChunks: chunks.length,
      completedChunks: countCompletedChunks(job, chunks.length),
      lastCompletedChunk: getLastCompletedChunk(job, chunks.length),
      status: "chunks_ready",
      transcriptPath: job.transcriptPath
    });

    for (let index = 0; index < chunks.length; index += 1) {
      const chunkPath = chunks[index];
      const resultPath = getChunkResultPath(job, index);
      const existingChunkText = readTextFile(resultPath);

      if (existingChunkText) {
        const transcript = rebuildTranscript(job, chunks.length);
        updateCheckpoint(job, {
          id: job.id,
          sourceUrl: videoUrl,
          title: info.title,
          model: MODEL_NAME,
          totalChunks: chunks.length,
          completedChunks: countCompletedChunks(job, chunks.length),
          lastCompletedChunk: getLastCompletedChunk(job, chunks.length),
          status: countCompletedChunks(job, chunks.length) === chunks.length ? "complete" : "transcribing",
          transcriptPath: job.transcriptPath
        });
        sendEvent({
          type: "partial",
          transcript,
          transcriptPath: job.transcriptPath
        });
        sendEvent({
          type: "status",
          step: "resume",
          message: `Skipping completed chunk ${index + 1}/${chunks.length}.`,
          progress: Math.round(((index + 1) / chunks.length) * 100)
        });
        continue;
      }

      sendEvent({
        type: "status",
        step: "transcribing",
        message: `Analyzing video chunk ${index + 1}/${chunks.length}...`,
        progress: Math.round((index / chunks.length) * 100)
      });
      updateCheckpoint(job, {
        id: job.id,
        sourceUrl: videoUrl,
        title: info.title,
        model: MODEL_NAME,
        totalChunks: chunks.length,
        completedChunks: countCompletedChunks(job, chunks.length),
        lastCompletedChunk: getLastCompletedChunk(job, chunks.length),
        currentChunk: index,
        status: "transcribing",
        transcriptPath: job.transcriptPath
      });
      const piece = await transcribeChunk({
        apiKey,
        videoPath: chunkPath
      });

      writeTextFileAtomic(resultPath, piece.trim() ? `${piece.trim()}\n` : "");
      const transcript = rebuildTranscript(job, chunks.length);
      updateCheckpoint(job, {
        id: job.id,
        sourceUrl: videoUrl,
        title: info.title,
        model: MODEL_NAME,
        totalChunks: chunks.length,
        lastCompletedChunk: index,
        completedChunks: countCompletedChunks(job, chunks.length),
        currentChunk: null,
        status: countCompletedChunks(job, chunks.length) === chunks.length ? "complete" : "transcribing",
        transcriptPath: job.transcriptPath
      });

      sendEvent({
        type: "partial",
        transcript,
        transcriptPath: job.transcriptPath
      });
      sendEvent({
        type: "status",
        step: "saved",
        message: `Saved chunk ${index + 1}/${chunks.length} to transcript.txt.`,
        progress: Math.round(((index + 1) / chunks.length) * 100)
      });
    }

    const finalText = readTextFile(job.transcriptPath).trim();
    updateCheckpoint(job, {
      id: job.id,
      sourceUrl: videoUrl,
      title: info.title,
      model: MODEL_NAME,
      totalChunks: chunks.length,
      completedChunks: chunks.length,
      lastCompletedChunk: chunks.length - 1,
      currentChunk: null,
      status: "complete",
      completedAt: new Date().toISOString(),
      transcriptPath: job.transcriptPath
    });
    sendEvent({
      type: "done",
      title: info.title,
      sourceUrl: videoUrl,
      transcript: finalText,
      transcriptPath: job.transcriptPath,
      progress: 100
    });
    res.end();
  } catch (error) {
    const message = getErrorMessage(error);

    if (job?.checkpointPath) {
      const checkpoint = readJsonFile(job.checkpointPath);
      updateCheckpoint(job, {
        ...checkpoint,
        id: job.id,
        status: "failed",
        failedAt: new Date().toISOString(),
        error: message,
        transcriptPath: job.transcriptPath
      });
    }

    if (!res.headersSent) {
      return sendJson(res, 500, { error: message });
    }

    if (!res.writableEnded && !res.destroyed) {
      res.write(`${JSON.stringify({ type: "error", error: message })}\n`);
    }
    res.end();
  }
}

async function downloadVideo(videoUrl, job, sendEvent) {
  const existingMetadata = readJsonFile(job.metadataPath);
  let existingSourcePath = findFirstFile(job.dir, /^source\.(mp4|mkv|webm|mov|m4v)$/i);

  if (fs.existsSync(job.normalizedPath) && await isValidMediaFile(job.normalizedPath)) {
    sendEvent({
      type: "status",
      step: "resume",
      message: "Found existing normalized video, skipping download."
    });
    return {
      title: existingMetadata.title || await fetchVideoTitle(videoUrl),
      sourcePath: existingSourcePath,
      videoPath: job.normalizedPath
    };
  }

  if (fs.existsSync(job.normalizedPath)) {
    sendEvent({
      type: "status",
      step: "resume",
      message: "Found incomplete normalized video, rebuilding it."
    });
    removeFileIfExists(job.normalizedPath);
  }

  if (existingSourcePath && !await isValidMediaFile(existingSourcePath)) {
    sendEvent({
      type: "status",
      step: "resume",
      message: "Found incomplete source video, downloading it again."
    });
    removeFileIfExists(existingSourcePath);
    existingSourcePath = "";
  }

  let sourcePath = existingSourcePath;
  const outputTemplate = path.join(job.dir, "source.%(ext)s");

  if (!sourcePath) {
    sendEvent({
      type: "status",
      step: "download",
      message: "Downloading video with yt-dlp..."
    });

    await runCommand("yt-dlp", [
      "--no-playlist",
      "--merge-output-format",
      "mp4",
      "--output",
      outputTemplate,
      videoUrl
    ], {
      cwd: job.dir
    });

    sourcePath = findFirstFile(job.dir, /^source\.(mp4|mkv|webm|mov|m4v)$/i);
    if (sourcePath && !await isValidMediaFile(sourcePath)) {
      removeFileIfExists(sourcePath);
      sourcePath = "";
    }
  } else {
    sendEvent({
      type: "status",
      step: "resume",
      message: "Found existing source video, skipping download."
    });
  }

  if (!sourcePath) {
    throw new Error("Could not find downloaded video file.");
  }

  sendEvent({
    type: "status",
    step: "normalize",
    message: "Normalizing video with ffmpeg..."
  });

  const normalizedTmpPath = path.join(job.dir, `normalized.tmp-${process.pid}-${Date.now()}.mp4`);
  removeFileIfExists(normalizedTmpPath);
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-vf",
    "scale='min(1280,iw)':-2",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    normalizedTmpPath
  ], {
    cwd: job.dir
  });

  if (!await isValidMediaFile(normalizedTmpPath)) {
    removeFileIfExists(normalizedTmpPath);
    throw new Error("Video normalization completed but the output file is not readable.");
  }

  fs.renameSync(normalizedTmpPath, job.normalizedPath);
  const title = existingMetadata.title || await fetchVideoTitle(videoUrl);
  return {
    title,
    sourcePath,
    videoPath: job.normalizedPath
  };
}

async function splitVideo(videoPath, job, sendEvent) {
  const durationSeconds = await getMediaDuration(videoPath);
  if (durationSeconds <= MAX_CHUNK_SECONDS) {
    writeChunksManifest(job, {
      totalChunks: 1,
      chunkSeconds: MAX_CHUNK_SECONDS,
      durationSeconds,
      chunks: [path.basename(videoPath)],
      singleFile: true
    });
    return [videoPath];
  }

  const reusableChunks = await getReusableChunks(job, durationSeconds);
  if (reusableChunks.length > 0) {
    sendEvent({
      type: "status",
      step: "resume",
      message: `Found ${reusableChunks.length} complete video chunk(s), skipping split.`
    });
    return reusableChunks;
  }

  if (getExistingChunks(job).length > 0) {
    sendEvent({
      type: "status",
      step: "resume",
      message: "Found incomplete video chunks, rebuilding the chunk set."
    });
  }

  sendEvent({
    type: "status",
    step: "split",
    message: `Video is ${Math.ceil(durationSeconds)}s long, splitting into ${MAX_CHUNK_SECONDS}s chunks...`
  });

  updateCheckpoint(job, {
    status: "splitting",
    durationSeconds,
    expectedChunks: Math.ceil(durationSeconds / MAX_CHUNK_SECONDS),
    chunkSeconds: MAX_CHUNK_SECONDS
  });

  const tempChunksDir = path.join(job.dir, `chunks.tmp-${process.pid}-${Date.now()}`);
  fs.mkdirSync(tempChunksDir, { recursive: true });

  try {
    const chunkPattern = path.join(tempChunksDir, "chunk-%03d.mp4");
    await runCommand("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-f",
      "segment",
      "-segment_time",
      String(MAX_CHUNK_SECONDS),
      "-reset_timestamps",
      "1",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "30",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      chunkPattern
    ], {
      cwd: job.dir
    });

    const chunkFiles = listChunkFiles(tempChunksDir);

    if (chunkFiles.length === 0) {
      throw new Error("Video splitting completed but no chunk files were produced.");
    }

    for (const chunkFile of chunkFiles) {
      if (!await isValidMediaFile(chunkFile)) {
        throw new Error(`Video splitting produced an unreadable chunk: ${path.basename(chunkFile)}`);
      }
    }

    cleanChunkFiles(job);
    fs.mkdirSync(job.chunksDir, { recursive: true });
    for (const chunkFile of chunkFiles) {
      fs.renameSync(chunkFile, path.join(job.chunksDir, path.basename(chunkFile)));
    }

    const finalChunks = getExistingChunks(job);
    writeChunksManifest(job, {
      totalChunks: finalChunks.length,
      chunkSeconds: MAX_CHUNK_SECONDS,
      durationSeconds,
      chunks: finalChunks.map((chunkPath) => path.basename(chunkPath)),
      singleFile: false
    });

    return finalChunks;
  } finally {
    fs.rmSync(tempChunksDir, { recursive: true, force: true });
  }
}

async function transcribeChunk({ apiKey, videoPath }) {
  const videoBase64 = fs.readFileSync(videoPath).toString("base64");
  const body = {
    model: MODEL_NAME,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "video_url",
            video_url: {
              url: `data:video/mp4;base64,${videoBase64}`
            },
            fps: 2
          },
          {
            type: "text",
            text: [
              "请尽量提取这段视频中的口播、对白、旁白与字幕内容，整理为连续文字。",
              "如果有明显听不清或模型无法确认的部分，请用[不清晰]标记。",
              "不要做摘要，优先输出尽可能完整的逐段文字内容。"
            ].join("")
          }
        ]
      }
    ]
  };

  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.message || data.code || response.statusText;
    throw new Error(`DashScope request failed: ${detail}`);
  }

  const text = extractTextFromDashScope(data);
  if (!text) {
    throw new Error("DashScope returned no transcript text.");
  }

  return text;
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

function createJob(videoUrl) {
  const id = crypto.createHash("sha256").update(videoUrl).digest("hex").slice(0, 16);
  const dir = path.join(JOBS_ROOT, id);
  return {
    id,
    dir,
    chunksDir: path.join(dir, "chunks"),
    resultsDir: path.join(dir, "results"),
    chunksManifestPath: path.join(dir, CHUNKS_MANIFEST_NAME),
    metadataPath: path.join(dir, "metadata.json"),
    checkpointPath: path.join(dir, "checkpoint.json"),
    normalizedPath: path.join(dir, "normalized.mp4"),
    transcriptPath: path.join(dir, "transcript.txt")
  };
}

function getExistingChunks(job) {
  return listChunkFiles(job.chunksDir);
}

function listChunkFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory)
    .filter((name) => /^chunk-\d{3}\.mp4$/i.test(name))
    .sort()
    .map((name) => path.join(directory, name));
}

async function getReusableChunks(job, durationSeconds) {
  const manifest = readJsonFile(job.chunksManifestPath);
  const manifestDuration = Number(manifest.durationSeconds);
  if (
    manifest.chunkSeconds !== MAX_CHUNK_SECONDS ||
    !Number.isFinite(manifestDuration) ||
    Math.abs(manifestDuration - durationSeconds) > 1 ||
    !Array.isArray(manifest.chunks) ||
    manifest.chunks.length === 0 ||
    manifest.totalChunks !== manifest.chunks.length
  ) {
    return [];
  }

  const chunks = manifest.chunks.map((name) => path.join(job.chunksDir, path.basename(name)));
  if (chunks.some((chunkPath) => !fs.existsSync(chunkPath))) {
    return [];
  }

  for (const chunkPath of chunks) {
    if (!await isValidMediaFile(chunkPath)) {
      return [];
    }
  }

  return chunks;
}

function writeChunksManifest(job, payload) {
  writeJsonFile(job.chunksManifestPath, {
    ...payload,
    updatedAt: new Date().toISOString()
  });
}

function cleanChunkFiles(job) {
  fs.mkdirSync(job.chunksDir, { recursive: true });
  for (const chunkPath of getExistingChunks(job)) {
    removeFileIfExists(chunkPath);
  }
  removeFileIfExists(job.chunksManifestPath);
}

function getChunkResultPath(job, index) {
  return path.join(job.resultsDir, `chunk-${String(index).padStart(3, "0")}.txt`);
}

function rebuildTranscript(job, totalChunks) {
  const parts = [];

  for (let index = 0; index < totalChunks; index += 1) {
    const text = readTextFile(getChunkResultPath(job, index)).trim();
    if (!text) {
      continue;
    }

    parts.push(`## Chunk ${index + 1}\n\n${text}`);
  }

  const transcript = parts.join("\n\n").trim();
  writeTextFileAtomic(job.transcriptPath, transcript ? `${transcript}\n` : "");
  return transcript;
}

function countCompletedChunks(job, totalChunks) {
  let count = 0;
  for (let index = 0; index < totalChunks; index += 1) {
    if (readTextFile(getChunkResultPath(job, index)).trim()) {
      count += 1;
    }
  }
  return count;
}

function getLastCompletedChunk(job, totalChunks) {
  for (let index = totalChunks - 1; index >= 0; index -= 1) {
    if (readTextFile(getChunkResultPath(job, index)).trim()) {
      return index;
    }
  }
  return null;
}

function readTextFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
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

function updateCheckpoint(job, patch) {
  const current = readJsonFile(job.checkpointPath);
  writeJsonFile(job.checkpointPath, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

function writeTextFileAtomic(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, text, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function removeFileIfExists(filePath) {
  fs.rmSync(filePath, { force: true });
}

async function isValidMediaFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    const duration = await getMediaDuration(filePath);
    return Number.isFinite(duration) && duration > 0;
  } catch {
    return false;
  }
}

async function fetchVideoTitle(videoUrl) {
  try {
    const output = await runCommand("yt-dlp", [
      "--print",
      "%(title)s",
      "--no-playlist",
      videoUrl
    ]);
    return output.trim() || "Untitled Video";
  } catch {
    return "Untitled Video";
  }
}

async function getMediaDuration(mediaPath) {
  const output = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    mediaPath
  ]);

  const duration = Number(output.trim());
  if (!Number.isFinite(duration)) {
    throw new Error("Could not determine media duration.");
  }

  return duration;
}

function assertRequiredCommands(commands) {
  for (const command of commands) {
    if (!findCommandInPath(command)) {
      throw new Error(`Missing required command: ${command}. Please install it first.`);
    }
  }
}

function findCommandInPath(command) {
  const pathValue = process.env.PATH || "";
  for (const directory of pathValue.split(path.delimiter)) {
    const fullPath = path.join(directory, command);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return "";
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT_DIR,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`${command} failed to start: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      const message = stderr.trim() || stdout.trim() || `${command} exited with code ${code}`;
      reject(new Error(message));
    });
  });
}

function findFirstFile(directory, pattern) {
  const names = fs.readdirSync(directory);
  const match = names.find((name) => pattern.test(name));
  return match ? path.join(directory, match) : "";
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
