const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { buildFilm } = require('./public/lesson-film');

const run = promisify(execFile);
const sampleRate = 22050;
const voice = 'Tingting';
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

async function synthesize(cues) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quittr-voice-'));
  try {
    const input = path.join(dir, 'line.txt');
    const output = path.join(dir, 'line.wav');
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
    for (const cue of cues) {
      const lead = 0.7;
      const available = cue.duration - lead - 0.3;
      const text = cue.narration.replace(/[\[\]\x00-\x1f\x7f]/g, ' ');
      await fs.writeFile(input, text, { mode: 0o600 });
      let rate = 210;
      for (let attempt = 0; attempt < 3; attempt++) {
        await run('/usr/bin/say', ['-v', voice, '-r', String(rate), '--data-format=LEI16@22050', '-f', input, '-o', output], { timeout: 12000 });
        const pcm = readPcm(await fs.readFile(output));
        const seconds = pcm.length / byteRate;
        if (seconds <= available) {
          pcm.copy(wav, 44 + Math.round((cue.start + lead) * sampleRate) * 2);
          break;
        }
        if (attempt === 2) throw new Error('Narration exceeds its scene');
        rate = Math.round(rate * seconds / available * 1.06);
      }
    }
    return wav;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function createLessonNarrator({ platform = process.platform, render = synthesize } = {}) {
  const cache = new Map();
  let active = 0;
  return function narrate(lesson, accountId) {
    if (platform !== 'darwin') throw Object.assign(new Error('此服务器暂未启用中文旁白。'), { status: 503 });
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
    }, () => {
      cache.delete(key);
      throw Object.assign(new Error('暂时无法生成中文旁白。'), { status: 503 });
    }).finally(() => { active--; });
    cache.set(key, entry);
    return entry.promise;
  };
}

module.exports = { createLessonNarrator, synthesize };
