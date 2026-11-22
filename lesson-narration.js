const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { buildFilm } = require('./public/lesson-film');
const { synthesizeOmni } = require('./lesson-omni');

const run = promisify(execFile);
const sampleRate = 24000;
const byteRate = sampleRate * 2;

function readPcm(wav) {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid narration audio');
  let validFormat = false;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const name = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > wav.length) break;
    if (name === 'fmt ' && size >= 16) {
      validFormat = wav.readUInt16LE(start) === 1 && wav.readUInt16LE(start + 2) === 1 &&
        wav.readUInt32LE(start + 4) === sampleRate && wav.readUInt16LE(start + 14) === 16;
    }
    if (name === 'data' && validFormat && size > 0 && size % 2 === 0) return wav.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  throw new Error('Unsupported narration audio format');
}

function assembleNarration(cues, clips) {
  const total = cues.reduce((sum, cue) => sum + cue.duration, 0);
  const dataSize = total * byteRate;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // Mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);

  const lead = 0.7;
  const tail = 0.3;
  for (const [index, cue] of cues.entries()) {
    const available = cue.duration - lead - tail;
    const pcm = clips[index];
    const offset = 44 + Math.round((cue.start + lead) * sampleRate) * 2;
    const samples = pcm.length / 2;
    const limit = Math.round(available * sampleRate);
    if (samples <= limit) {
      pcm.copy(wav, offset);
      continue;
    }
    // A long reading still needs to finish inside its own scene.
    const step = (samples - 1) / (limit - 1);
    for (let i = 0; i < limit; i++) {
      const position = i * step;
      const index = Math.floor(position);
      const first = pcm.readInt16LE(index * 2);
      const second = pcm.readInt16LE(Math.min(index + 1, samples - 1) * 2);
      wav.writeInt16LE(Math.round(first + (second - first) * (position - index)), offset + i * 2);
    }
  }
  return wav;
}

async function synthesize(cues) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quittr-voice-'));
  try {
    const input = path.join(dir, 'line.txt');
    const output = path.join(dir, 'line.wav');
    const clips = [];
    for (const cue of cues) {
      await fs.writeFile(input, cue.narration.replace(/[\[\]\x00-\x1f\x7f]/g, ' '), { mode: 0o600 });
      const available = cue.duration - 1;
      let rate = 210;
      for (let attempt = 0; attempt < 3; attempt++) {
        await run('/usr/bin/say', ['-v', 'Tingting', '-r', String(rate), '--data-format=LEI16@24000', '-f', input, '-o', output], { timeout: 12000 });
        const pcm = readPcm(await fs.readFile(output));
        const seconds = pcm.length / byteRate;
        if (seconds <= available || attempt === 2) {
          clips.push(pcm);
          break;
        }
        rate = Math.round(rate * seconds / available * 1.06);
      }
    }
    return assembleNarration(cues, clips);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function createLessonNarrator({
  platform = process.platform,
  apiKey = process.env.LESSON_TTS_API_KEY?.trim(),
  workspace = process.env.LESSON_TTS_WORKSPACE?.trim() || '',
  voice = process.env.LESSON_TTS_VOICE?.trim() || 'Tina',
  connect = (url, options) => new WebSocket(url, options),
  render = apiKey ? async cues => assembleNarration(cues,
    await synthesizeOmni(cues, { apiKey, workspace, voice, sampleRate, connect })) : synthesize
} = {}) {
  const cache = new Map();
  let active = 0;
  return function narrate(lesson, accountId) {
    if (!apiKey && platform !== 'darwin') throw Object.assign(new Error('此服务器暂未启用中文旁白。'), { status: 503 });
    const { scenes } = buildFilm(lesson);
    const cues = scenes.map(({ narration, start, duration }) => ({ narration, start, duration }));
    const key = createHash('sha256').update(JSON.stringify([accountId, cues])).digest('hex');
    if (cache.has(key)) {
      const hit = cache.get(key);
      cache.delete(key);
      cache.set(key, hit);
      return hit.promise;
    }
    if (active >= 2) throw Object.assign(new Error('旁白正在准备，请稍后重试。'), { status: 503 });
    active++;
    const entry = { ready: false };
    entry.promise = Promise.resolve().then(() => render(cues)).then(audio => {
      entry.ready = true;
      for (const [cacheKey, item] of cache) {
        if (cache.size <= 10) break;
        if (item.ready) cache.delete(cacheKey);
      }
      return audio;
    }, error => {
      cache.delete(key);
      throw Object.assign(new Error('暂时无法生成中文旁白。', { cause: error }), { status: 503 });
    }).finally(() => { active--; });
    cache.set(key, entry);
    return entry.promise;
  };
}

module.exports = { createLessonNarrator, synthesize };
