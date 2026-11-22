/* The same composition and seekable timeline run in Quittr and HyperFrames. */
(function (root) {
  const compositionId = 'quittr-daily-film';
  const labels = { context: '开场', insight: '理解', pattern: '识别触发', practice: '跟着练习', reflection: '自我觉察', action: '今日行动' };

  function shortText(value, max) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    const chars = Array.from(text);
    if (chars.length <= max) return text;
    const excerpt = chars.slice(0, max).join('');
    const stop = Math.max(excerpt.lastIndexOf('。'), excerpt.lastIndexOf('！'), excerpt.lastIndexOf('？'));
    return stop > max / 2 ? excerpt.slice(0, stop + 1) : excerpt + '…';
  }

  function buildFilm(lesson) {
    const scenes = [{
      kind: 'context',
      title: shortText(lesson.title, 38),
      caption: shortText(lesson.reason || lesson.subtitle, 100),
      focus: '',
      steps: []
    }, ...lesson.cards.map(card => {
      const caption = shortText(card.filmCaption || card.body, 110);
      const focus = (card.annotations || []).find(item => item.text && caption.includes(item.text))?.text || '';
      return {
        kind: Object.hasOwn(labels, card.kind) ? card.kind : 'insight',
        title: shortText(card.title, 38),
        caption,
        focus,
        takeaway: shortText(card.highlight, 34),
        steps: ['pattern', 'practice'].includes(card.kind) ? card.steps.slice(0, 3).map(step => shortText(step, 17)) : []
      };
    })];
    let offset = 0;
    for (const scene of scenes) {
      scene.start = offset;
      const title = /[。！？!?]$/.test(scene.title) ? scene.title : scene.title.replace(/[，、；：]$/, '') + '。';
      scene.narration = [title, scene.caption].filter(Boolean).join(' ');
      scene.duration = Math.max(6, Math.ceil(Array.from(scene.narration).length / 7) + 2);
      scene.label = labels[scene.kind];
      offset += scene.duration;
    }
    return { scenes, duration: offset };
  }

  const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  function captionMarkup(scene) {
    const at = scene.focus ? scene.caption.indexOf(scene.focus) : -1;
    if (at < 0) return escape(scene.caption);
    const end = at + scene.focus.length;
    return escape(scene.caption.slice(0, at)) + '<mark class="film-ink">' + escape(scene.focus) + '</mark>' + escape(scene.caption.slice(end));
  }

  function illustration(scene) {
    if (scene.steps.length) {
      return '<ol class="film-diagram">' + scene.steps.map((step, index) =>
        '<li data-enter><span>' + (index + 1) + '</span><strong>' + escape(step) + '</strong></li>'
      ).join('') + '</ol>';
    }
    return '<div class="film-motif" data-enter data-layout-ignore aria-hidden="true"><i></i><i></i><i></i><b></b><em></em></div>';
  }

  function filmMarkup(film) {
    const scenes = film.scenes.map((scene, index) =>
      '<section id="quittr-film-shot-' + index + '" class="clip film-scene film-' + escape(scene.kind) + '" data-start="' + scene.start + '" data-duration="' + (scene.duration + (index < film.scenes.length - 1 ? 0.4 : 0)) + '" data-track-index="' + (index % 2) + '">' +
        '<div class="film-scene-content">' +
          '<div class="film-copy"><p class="film-scene-label" data-enter>' + escape(scene.label) + '</p>' +
          '<h2 data-enter>' + escape(scene.title) + '</h2>' +
          '<p class="film-caption" data-enter>' + captionMarkup(scene) + '</p></div>' +
          illustration(scene) +
          (scene.takeaway ? '<p class="film-takeaway" data-enter><i aria-hidden="true"></i>' + escape(scene.takeaway) + '</p>' : '') +
        '</div></section>'
    ).join('');
    // All variable copy is escaped above; model data never supplies HTML, selectors or timing commands.
    return '<div class="lesson-film-stage" data-composition-id="' + compositionId + '" data-start="0" data-duration="' + film.duration + '" data-width="1200" data-height="800" aria-hidden="true">' + scenes + '<div class="film-stage-progress" data-layout-ignore></div></div>';
  }

  function createTimeline(stage, gsap, { reducedMotion = false } = {}) {
    const timeline = gsap.timeline({ paused: true });
    const shots = Array.from(stage.querySelectorAll('.film-scene'));
    const eases = ['power2.out', 'power3.out', 'sine.out'];
    shots.forEach((shot, index) => {
      const start = Number(shot.dataset.start);
      const duration = Number(shot.dataset.duration);
      const shift = reducedMotion ? 0 : 18;
      const fade = reducedMotion ? 0 : 0.4;
      // Overlap adjacent clips while the next sheet rises over the outgoing scene.
      if (index > 0) {
        timeline.fromTo(shot, { opacity: 0, y: shift }, { opacity: 1, y: 0, duration: fade, ease: 'sine.inOut', immediateRender: false }, start);
        timeline.set(shots[index - 1], { opacity: 0 }, start + fade);
      }
      const elements = Array.from(shot.querySelectorAll('[data-enter]'));
      if (index > 0 && !reducedMotion) {
        elements.forEach((element, position) => {
          timeline.from(element, {
            opacity: 0, y: 10 + (position % 3) * 9, duration: 0.54,
            ease: eases[position % eases.length], immediateRender: false
          }, start + 0.26 + position * 0.14);
        });
      }
      const ink = shot.querySelector('.film-ink');
      if (ink) timeline.fromTo(ink, { '--ink-width': '0%' }, { '--ink-width': '100%', duration: reducedMotion ? 0 : 0.65, ease: 'power2.inOut', immediateRender: false }, start + 1.25);
      const motif = shot.querySelector('.film-motif b');
      if (motif && !reducedMotion) timeline.to(motif, { xPercent: 13, yPercent: -12, rotation: 9, duration, ease: 'sine.inOut' }, start);
      const bar = shot.querySelector('.film-takeaway i');
      if (bar) timeline.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: reducedMotion ? 0 : 0.52, ease: 'power2.out', immediateRender: false }, start + 1.4);
    });
    // A visible progress edge gives the in-app player a continuous seek target.
    const progress = stage.querySelector('.film-stage-progress');
    timeline.fromTo(progress, { scaleX: 0 }, { scaleX: 1, duration: Number(stage.dataset.duration), ease: 'none' }, 0);
    return timeline;
  }

  const api = { compositionId, buildFilm, filmMarkup, createTimeline };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuittrLessonFilm = api;
})(globalThis);

function DailyLessonFilm({ lesson, onRead, children }) {
  const [session] = useState(() => {
    const film = QuittrLessonFilm.buildFilm(lesson);
    return { film, markup: { __html: QuittrLessonFilm.filmMarkup(film) } };
  });
  const { film } = session;
  const timelineRef = useRef(null);
  const audioRef = useRef(null);
  const transport = useRef({ mode: 'paused', request: 0 });
  const mountRef = useRef(null);
  const timeRef = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [sound, setSound] = useState(true);
  const [voiceError, setVoiceError] = useState(false);
  const [ready, setReady] = useState(false);
  const current = film.scenes.findLastIndex(scene => time >= scene.start);
  const ended = time >= film.duration;
  const audioURL = '/api/lessons/film-audio?' + new URLSearchParams({
    id: lesson.id, origin: lesson.origin, timeZone: lesson.timeZone
  });

  function pause() {
    transport.current.request++;
    transport.current.mode = 'paused';
    audioRef.current?.pause();
    timelineRef.current?.pause();
    setPlaying(false);
    setBuffering(false);
  }

  useEffect(() => {
    const stage = mountRef.current.querySelector('.lesson-film-stage');
    if (!window.gsap || !stage) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timeline = QuittrLessonFilm.createTimeline(stage, window.gsap, { reducedMotion: media.matches });
    const audio = audioRef.current;
    const reportTime = value => {
      const next = Math.floor(value * 10) / 10;
      if (next !== timeRef.current) {
        timeRef.current = next;
        setTime(next);
      }
    };
    const syncAudio = () => {
      if (transport.current.mode !== 'audio' || audio.paused) return;
      timeline.seek(Math.min(audio.currentTime, film.duration));
      reportTime(timeline.time());
    };
    timeline.eventCallback('onUpdate', () => reportTime(timeline.time()));
    timeline.eventCallback('onComplete', () => {
      timeRef.current = film.duration;
      setTime(film.duration);
      pause();
    });
    timelineRef.current = timeline;
    window.gsap.ticker.add(syncAudio);
    const pauseIfHidden = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', pauseIfHidden);
    setReady(true);
    return () => {
      document.removeEventListener('visibilitychange', pauseIfHidden);
      transport.current.request++;
      transport.current.mode = 'paused';
      audio.pause();
      window.gsap.ticker.remove(syncAudio);
      timeline.kill();
      timelineRef.current = null;
    };
  }, [film]);

  function seek(next) {
    timelineRef.current?.seek(next);
    if (transport.current.mode === 'audio') audioRef.current.currentTime = next;
    timeRef.current = next;
    setTime(next);
    if (next >= film.duration) pause();
  }

  function useCaptions() {
    if (transport.current.mode !== 'audio') return;
    transport.current.mode = 'silent';
    setVoiceError(true);
    setBuffering(false);
    timelineRef.current?.play();
  }

  async function play(withSound) {
    const timeline = timelineRef.current;
    if (!timeline) return;
    if (timeRef.current >= film.duration) seek(0);
    setPlaying(true);
    if (!withSound) {
      transport.current.mode = 'silent';
      timeline.play();
      return;
    }
    timeline.pause();
    const audio = audioRef.current;
    const request = ++transport.current.request;
    transport.current.mode = 'audio';
    setBuffering(true);
    try {
      audio.currentTime = timeRef.current;
      await audio.play();
      if (transport.current.request === request) setBuffering(false);
    } catch {
      if (transport.current.request === request) useCaptions();
    }
  }

  function toggleSound() {
    const enabled = !sound || voiceError;
    setSound(enabled);
    if (voiceError) {
      setVoiceError(false);
      audioRef.current.load();
    }
    if (playing) {
      pause();
      play(enabled);
    }
  }

  const formatTime = value => Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
  return h('section', { className: 'lesson-film', 'aria-label': '今日戒色课堂动画' },
    h('header', { className: 'film-player-heading' },
      h('div', null, h('h2', null, '今日课堂动画'), h('p', null, '中文旁白和字幕 · ', lesson.origin === 'ai' && lesson.hasActivity ? '根据近期记录生成' : '戒色入门')),
      h('button', { type: 'button', className: 'film-read-link', onClick: () => onRead(lesson) }, '读卡片 ↗')),
    h('div', { className: 'film-screen', ref: mountRef },
      h('div', { className: 'film-composition', dangerouslySetInnerHTML: session.markup })),
    h('audio', { ref: audioRef, src: audioURL, preload: 'none', onError: useCaptions,
      onPause: () => {
        if (transport.current.mode === 'audio' && audioRef.current.paused && !audioRef.current.ended) pause();
      },
      onEnded: () => { if (transport.current.mode === 'audio') seek(film.duration); } }),
    h('div', { className: 'film-controls' },
      h('button', { type: 'button', className: 'film-play', onClick: () => playing ? pause() : play(sound && !voiceError), disabled: !ready, 'aria-label': playing ? '暂停动画' : ended ? '重播动画' : '播放动画' },
        h('span', { 'aria-hidden': true }, playing ? 'Ⅱ' : ended ? '↻' : '▶'), h('span', null, playing ? '暂停' : ended ? '重播' : '播放')),
      h('input', { type: 'range', min: 0, max: film.duration, step: 0.1, value: time, disabled: !ready, onChange: event => seek(Number(event.target.value)), 'aria-label': '动画播放进度', 'aria-valuetext': formatTime(time) + ' / ' + formatTime(film.duration) }),
      h('output', { 'aria-hidden': true }, formatTime(time), ' / ', formatTime(film.duration)),
      h('button', { type: 'button', className: 'film-sound', onClick: toggleSound, 'aria-pressed': sound && !voiceError },
        voiceError ? '重试旁白' : sound ? '旁白开' : '旁白关')),
    buffering && h('p', { className: 'film-audio-status', role: 'status' }, '正在准备中文旁白…'),
    voiceError && h('p', { className: 'film-audio-status', role: 'status' }, '旁白暂时无法播放，字幕仍可观看。'),
    h('nav', { className: 'film-chapters', 'aria-label': '动画分镜' },
      film.scenes.map((scene, index) => h('button', { key: scene.kind, type: 'button', disabled: !ready, onClick: () => seek(scene.start + Math.min(1.6, scene.duration / 2)), 'aria-current': index === current ? 'step' : undefined }, scene.label))),
    h('details', { className: 'film-transcript' }, h('summary', null, '查看动画字幕'),
      h('ol', null, film.scenes.map(scene => h('li', { key: scene.kind }, h('strong', null, scene.title), h('p', null, scene.caption), scene.steps.length > 0 && h('p', null, scene.steps.join(' → ')))))),
    ended && h('div', { className: 'film-follow-up' }, h('p', null, lesson.takeaway), children));
}
