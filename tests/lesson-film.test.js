const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLessonService } = require('../lessons');
const { buildFilm, filmMarkup } = require('../public/lesson-film');

const starter = () => createLessonService({ readState: () => ({}) }).get().lesson;

test('personalized course captions and steps become timed scenes without carrying raw records into HTML', async () => {
  const at = '2026-11-21T13:00:00Z';
  const raw = '独处时想看色情内容，后来把手机放到门外。仅作素材的对话原文';
  let state = { meliusTurns: { one: { createdAt: at, userText: raw } } };
  const service = createLessonService({
    now: () => new Date('2026-11-22T03:00:00Z'),
    readState: () => state,
    writeState: next => { state = next; },
    complete: async payload => {
      assert.equal(JSON.parse(payload.messages[1].content).conversations[0].user, raw);
      const draft = starter();
      draft.reason = '用独处时把手机放远的尝试，看看怎样应对色情内容触发。';
      draft.cards[0].filmCaption = '一个念头出现，不代表你已经失守。先区分注意到念头与真的打开页面';
      draft.cards[1].filmCaption = '你上周连续三天完成了新的学习目标。';
      return { choices: [{ message: { content: JSON.stringify(draft) } }] };
    }
  });
  const { lesson } = await service.generate();
  const film = buildFilm(lesson);
  assert.equal(film.scenes.length, 6);
  assert.match(film.scenes[0].caption, /把手机放远/);
  assert.equal(film.scenes[1].caption, lesson.cards[0].filmCaption);
  assert.equal(film.scenes[1].focus, '一个念头出现');
  assert.equal(lesson.cards[1].filmCaption, undefined);
  assert.deepEqual(film.scenes[2].steps, lesson.cards[1].steps);
  assert.equal(film.scenes.at(-1).start + film.scenes.at(-1).duration, film.duration);
  assert.doesNotMatch(filmMarkup(film), /仅作素材的对话原文|连续三天/);
});

test('film composition renders legacy decks and escapes model-authored text', () => {
  const lesson = starter();
  lesson.title = '<script>alert(1)</script>';
  lesson.cards[0].body = '一个念头出现，<img src=x onerror=alert(1)>。';
  const html = filmMarkup(buildFilm(lesson));
  assert.match(html, /data-composition-id="quittr-daily-film"/);
  assert.match(html, /<mark class="film-ink">一个念头出现<\/mark>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script|<img/);
});

test('narration cache is private to each account and deduplicates media range requests', async () => {
  const { createLessonNarrator } = require('../lesson-narration');
  let calls = 0;
  const narrate = createLessonNarrator({ platform: 'darwin', render: async cues => {
    assert.match(cues[0].narration, /色情内容/);
    return Buffer.from(String(++calls));
  } });
  const lesson = starter();
  const [first, replay] = await Promise.all([narrate(lesson, 'a'), narrate(lesson, 'a')]);
  assert.equal(replay, first);
  assert.notEqual(await narrate(lesson, 'b'), first);
  assert.equal(calls, 2);
});

test('Omni Flash Realtime streams Tina narration, retries changed wording, and fits each scene', async () => {
  const { createLessonNarrator } = require('../lesson-narration');
  const lesson = starter();
  const film = buildFilm(lesson);
  const sampleRate = 24000;
  const clip = Buffer.alloc(film.scenes[0].duration * sampleRate * 2, 1);
  const attempts = new Map();
  const narrate = createLessonNarrator({
    platform: 'linux',
    apiKey: 'test-key',
    workspace: 'test-workspace',
    voice: 'Tina',
    connect: (url, options) => {
      assert.equal(url, 'wss://test-workspace.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime?model=qwen3.8-omni-flash-realtime');
      assert.equal(options.headers.Authorization, 'Bearer test-key');
      const socket = new EventTarget();
      const emit = (type, fields = {}) => socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type, ...fields }) }));
      let text;
      socket.close = () => socket.dispatchEvent(new Event('close'));
      socket.send = payload => {
        const message = JSON.parse(payload);
        if (message.type === 'session.update') {
          assert.equal(message.session.audio.output.voice, 'Tina');
          assert.equal(message.session.audio.output.format.sample_rate, sampleRate);
          assert.equal(message.session.turn_detection, null);
          queueMicrotask(() => emit('session.updated'));
        } else if (message.type === 'conversation.item.create') {
          const input = message.item.content[0].text;
          text = film.scenes.find(scene => input.endsWith('「' + scene.narration + '」'))?.narration;
          assert.ok(text);
          attempts.set(text, (attempts.get(text) || 0) + 1);
        } else if (message.type === 'response.create') {
          const changed = text === film.scenes[0].narration && attempts.get(text) === 1;
          queueMicrotask(() => {
            emit('response.audio.delta', { delta: clip.toString('base64') });
            emit('response.audio_transcript.done', { transcript: changed ? '额外的问候。' + text : text + '。' });
            emit('response.done', { response: { status: 'completed' } });
          });
        }
      };
      queueMicrotask(() => emit('session.created'));
      return socket;
    }
  });
  const audio = await narrate(lesson, 'test-account');
  const sampleAt = time => audio.readInt16LE(44 + Math.round(time * sampleRate) * 2);
  assert.equal(attempts.size, film.scenes.length);
  assert.equal(attempts.get(film.scenes[0].narration), 2);
  assert.equal(audio.readUInt32LE(24), sampleRate);
  assert.equal(audio.length, 44 + film.duration * sampleRate * 2);
  assert.equal(sampleAt(0), 0);
  assert.equal(sampleAt(0.7), 257);
  assert.equal(sampleAt(film.scenes[0].duration - 0.31), 257);
  assert.equal(sampleAt(film.scenes[0].duration - 0.29), 0);
});
