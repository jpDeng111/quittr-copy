/* Daily micro-lessons. Content is plain text; visual layouts stay in the client. */
function useDailyLessons(clockNow) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [draftCards, setDraftCards] = useState([]);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  useEffect(() => {
    if (!generating) return;
    setGenerationSeconds(0);
    const timer = window.setInterval(() => setGenerationSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [generating]);
  const [error, setError] = useState('');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  const day = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(clockNow));
  const flightRef = useRef(null);
  const currentDayRef = useRef(day);
  currentDayRef.current = day;
  const mountedRef = useRef(false);
  async function request(path, body, signal) {
    const response = await fetch(`${API_BASE}/api/lessons/${path}`, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timeZone, ...body }), signal
    } : { signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '小课堂暂时无法加载，请重试。');
    return result;
  }
  async function generate(signal, force = false) {
    if (flightRef.current?.day === day) return flightRef.current.promise;
    setGenerating(true);
    setError('');
    setDraftCards([]);
    const isCurrent = () => mountedRef.current && !signal?.aborted && currentDayRef.current === day;
    async function streamLesson() {
      const response = await fetch(`${API_BASE}/api/lessons/daily`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ timeZone, regenerate: force, stream: true }), signal
      });
      if (!response.ok) throw new Error((await response.json()).error || '小课生成失败');
      // Older servers may still return JSON during a rolling update.
      if (!response.headers.get('content-type')?.includes('text/event-stream')) return response.json();
      let result = null;
      await QuittrStream.consumeSSE(response.body, ({ event, data: text }) => {
        const payload = JSON.parse(text);
        if (event === 'error') throw new Error(payload.error);
        if (event === 'done') result = payload;
        if (!isCurrent()) return;
        if (event === 'reset') setDraftCards([]);
        if (event === 'card' && Number.isInteger(payload.index) && payload.index >= 0 && payload.index < 5) {
          setDraftCards((cards) => { const next = [...cards]; next[payload.index] = payload.card; return next; });
        }
      });
      if (!result) throw new Error('小课生成中断');
      return result;
    }
    const pending = streamLesson().then((result) => {
      if (mountedRef.current && !signal?.aborted && currentDayRef.current === day) { setData(result); setError(result.generationError || ''); if (result.generationError) setDraftCards([]); }
      return result;
    }).catch((err) => {
      if (isCurrent() && err.name !== 'AbortError') { setDraftCards([]); setError(err instanceof TypeError ? '无法连接本地服务，请启动项目后重新生成。当前显示的仍是原课程。' : '专属小课暂时没有生成成功，当前显示的仍是原课程，请重试。'); }
      return null;
    }).finally(() => { if (flightRef.current?.promise === pending) flightRef.current = null; if (mountedRef.current && currentDayRef.current === day) setGenerating(false); });
    flightRef.current = { day, promise: pending };
    return pending;
  }
  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    setLoading(true);
    setGenerating(false);
    setGenerationSeconds(0);
    setDraftCards([]);
    request(`daily?timeZone=${encodeURIComponent(timeZone)}`, null, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setData(result); setLoading(false); setError('');
      if (result.lesson.origin !== 'ai') generate(controller.signal);
    }).catch((err) => { if (!controller.signal.aborted) { setError('小课堂暂时无法加载，请检查连接后重试。'); setLoading(false); } });
    return () => { mountedRef.current = false; controller.abort(); };
  }, [day, timeZone]);
  async function complete(lesson, reflection, intention) {
    const result = await request('complete', { id: lesson.id, origin: lesson.origin, reflection, intention });
    setData(result);
    return result;
  }
  return { lesson: data?.lesson, history: data?.history || [], loading, generating, draftCards, generationSeconds, error, generate, regenerate: () => generate(undefined, true), complete };
}

function LessonSpark({ className = '' }) {
  return h('svg', { className: `lesson-spark ${className}`, viewBox: '0 0 32 32', fill: 'none', 'aria-hidden': true },
    h('path', { d: 'M16 2C17.8 11.6 20.4 14.2 30 16C20.4 17.8 17.8 20.4 16 30C14.2 20.4 11.6 17.8 2 16C11.6 14.2 14.2 11.6 16 2Z', fill: 'currentColor' }));
}

function LessonArtwork({ theme = 'tide', compact = false }) {
  return h('div', { className: `lesson-artwork art-${theme}${compact ? ' art-compact' : ''}`, 'aria-hidden': true },
    h('div', { className: 'art-ring orbit-one' }), h('div', { className: 'art-ring orbit-two' }),
    h('div', { className: 'art-moon' }), h('div', { className: 'art-moon-glow' }),
    h('svg', { className: 'art-waves', viewBox: '0 0 600 300', preserveAspectRatio: 'none', fill: 'none' },
      h('path', { d: 'M-30 170C100 55 190 270 330 140S520 100 640 150L640 330H-30Z', fill: 'currentColor', opacity: '.12' }),
      h('path', { d: 'M-30 210C130 90 230 310 380 175S550 160 640 195L640 330H-30Z', fill: 'currentColor', opacity: '.15' }),
      ...[0, 1, 2, 3, 4, 5, 6].map((n) => h('path', { key: n, d: `M-30 ${160 + n * 13}C110 ${30 + n * 20} 215 ${300 + n * 11} 360 ${145 + n * 13}S550 ${120 + n * 20} 640 ${160 + n * 18}`, stroke: 'currentColor', strokeWidth: '1', opacity: .18 - n * .014 }))),
    h(LessonSpark, { className: 'art-star star-one' }), h(LessonSpark, { className: 'art-star star-two' }));
}

// Draw annotations over plain React text; model output is never interpreted as HTML.
function lessonTextSegments(body, annotations = []) {
  const ranges = [];
  for (const item of annotations) {
    if (!item || typeof item.text !== 'string' || !item.text) continue;
    const start = body.indexOf(item.text), end = start + item.text.length;
    if (start < 0 || ranges.some((range) => start < range.end && end > range.start)) continue;
    ranges.push({ start, end, style: ['underline', 'circle', 'highlight'].includes(item.style) ? item.style : 'underline' });
  }
  ranges.sort((a, b) => a.start - b.start);
  const parts = []; let cursor = 0;
  for (const range of ranges) {
    if (cursor < range.start) parts.push({ text: body.slice(cursor, range.start), start: cursor });
    parts.push({ ...range, text: body.slice(range.start, range.end) }); cursor = range.end;
  }
  if (cursor < body.length) parts.push({ text: body.slice(cursor), start: cursor });
  return parts;
}

function LessonAnnotatedText({ card, animate = true }) {
  const [visible, setVisible] = useState(animate ? 0 : card.body.length);
  const [instant, setInstant] = useState(false);
  useEffect(() => {
    if (!animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setVisible(card.body.length); return; }
    setVisible(0); setInstant(false);
    const timer = window.setInterval(() => setVisible((n) => {
      if (n + 3 >= card.body.length) window.clearInterval(timer);
      return Math.min(card.body.length, n + 3);
    }), 36);
    return () => window.clearInterval(timer);
  }, [card.body, animate]);
  const count = instant ? card.body.length : visible;
  return h('div', { className: 'lesson-body-wrap' },
    h('p', { className: `learning-body annotated-body${count < card.body.length ? ' is-writing' : ''}`, 'aria-hidden': true },
      lessonTextSegments(card.body, card.annotations).map((part, index) => {
        const text = part.text.slice(0, Math.max(0, count - part.start));
        if (!text) return null;
        if (!part.style) return h('span', { key: index }, text);
        const drawn = count >= part.end;
        return h('mark', { key: index, className: `lesson-ink ink-${part.style}${drawn ? ' is-drawn' : ''}` }, text,
          h('svg', { viewBox: '0 0 100 32', preserveAspectRatio: 'none', 'aria-hidden': true },
            h('path', { pathLength: 1, d: part.style === 'circle' ? 'M50 3C7 0 0 8 3 19S35 32 65 29S102 23 98 13S78 1 48 4' : part.style === 'highlight' ? 'M3 21Q48 17 97 19' : 'M2 27Q28 24 51 27T98 25' })));
      })),
    h('span', { className: 'lesson-sr-only' }, card.body),
    count < card.body.length && h('button', { className: 'lesson-reveal-all', type: 'button', onClick: () => setInstant(true) }, '直接显示全文 ↗'));
}

function LessonLiveStudio({ daily, onOpen, compact = false }) {
  const cards = daily.draftCards || [];
  const [selected, setSelected] = useState(0);
  useEffect(() => { if (!cards.length) setSelected(0); }, [cards.length]);
  const card = cards[selected] || cards[0];
  const current = cards[selected] ? selected : 0;
  const ready = !daily.generating && !daily.error && daily.lesson?.origin === 'ai';
  return h('section', { className: `lesson-studio${compact ? ' studio-compact' : ''}`, 'aria-label': '实时生成的小课堂' },
    h('header', { className: 'studio-header' },
      h('div', { className: 'studio-live-label' }, h('i', { className: daily.generating ? 'is-live' : '' }), daily.generating ? 'MELIUS 正在为你写课' : '今天的小课堂已准备好'),
      h('span', null, `${cards.length} / 5`, h('small', null, ' 张卡片'))),
    h('div', { className: 'studio-layout' },
      h('aside', { className: 'studio-notes' },
        h('span', { className: 'classroom-wordmark' }, 'A LITTLE LESSON, JUST FOR YOU'),
        h('h2', null, `把${daily.lesson?.hasActivity ? daily.lesson.windowDays > 1 ? '最近' : '昨天' : '此刻'}的感受，`, h('br'), '变成今天的', h('em', null, '一点领悟。')),
        h('p', null, ready ? daily.lesson.reason : cards.length ? '先读已经写好的卡片。新的内容正在接着来，值得记住的地方，我会为你轻轻勾画。' : '正在寻找一个适合你的切入点。第一张卡片写好，就会出现在这里。'),
        h('div', { className: 'studio-source' }, h(LessonSpark), daily.lesson?.hasActivity ? `从${daily.lesson.windowLabel || '昨天'}的记录中，为你准备` : '从觉察开始，慢慢认识自己'),
        h('div', { className: 'studio-ink-legend' }, h('span', { className: 'legend-highlight' }, '看见感受'), h('span', { className: 'legend-underline' }, '理解过程'), h('span', { className: 'legend-circle' }, '尝试行动')),
        ready && h('button', { className: 'classroom-primary studio-open', onClick: () => onOpen(daily.lesson) }, '开始今天的小课堂', h('span', null, '↗'))),
      h('div', { className: 'studio-board' },
        card ? h('article', { key: `${current}-${card.body}`, className: `learning-card studio-card learning-${card.kind}` },
          h('div', { className: 'learning-card-top' }, h('span', null, h(LessonSpark), card.label), h('span', null, `0${current + 1} / 05`)),
          h('h1', null, card.title),
          card.kind === 'insight' && h('div', { className: 'learning-visual' }, h(LessonArtwork, { theme: daily.lesson?.theme }), h('span', { className: 'visual-caption' }, 'A MOMENT TO UNDERSTAND YOURSELF')),
          h(LessonAnnotatedText, { card }),
          card.steps.length > 0 && h('ol', { className: 'studio-steps' }, card.steps.map((step, n) => h('li', { key: n }, h('span', null, `0${n + 1}`), step))),
          h('div', { className: 'learning-highlight' }, h('span', null, '✧'), h('p', null, card.highlight)),
          h('div', { className: 'learning-card-signature' }, 'MELIUS', h('span', null, 'a little space to grow'))) :
          h('div', { className: 'studio-paper-wait', role: 'status' }, h('span', { className: 'studio-paper-number' }, '01 / 05'), h(LessonSpark), h('h3', null, '每一个改变，', h('br'), '都从一点理解开始。'), h('p', null, '正在写下属于你的第一张卡片'), h('div', { className: 'studio-wait-lines' }, h('i'), h('i'), h('i')), h('small', null, '为你留一点，慢慢生长的空间。')))),
    h('nav', { className: 'studio-filmstrip', 'aria-label': '已生成的课程卡片' },
      ['换个视角', '看见过程', '一起练习', '自我觉察', '今日行动'].map((label, n) => h('button', {
        key: n, disabled: !cards[n], 'aria-current': n === current ? 'step' : undefined,
        className: `${cards[n] ? 'is-ready' : 'is-pending'}${n === current ? ' is-active' : ''}`, onClick: () => setSelected(n)
      }, h('span', null, `0${n + 1}`), h('strong', null, cards[n]?.label || label), h('small', null, cards[n] ? '已就绪 ↗' : n === cards.length && daily.generating ? '正在写…' : '稍后呈现')))),
    h('p', { className: 'studio-progress-note', role: 'status', 'aria-live': 'polite' }, daily.generating ? cards.length ? `第 ${cards.length} 张已就绪，可以点击阅读。后续卡片正在生成。` : '正在整理你的记录，提炼今天值得关注的一件事…' : '五张卡片，一个新的理解。按自己的节奏慢慢读。'));
}

function DailyLessonTeaser({ daily, onAction, compact = false }) {
  const lesson = daily.lesson;
  if (!lesson) return h('button', { className: 'daily-teaser teaser-loading', type: 'button', onClick: () => onAction('lessons') },
    h(LessonSpark), h('span', null, h('strong', null, daily.loading ? '正在准备今天的小课堂' : '每日小课堂'), h('small', null, '每天，懂自己一点。')), h(Icon, { name: 'chevron' }));
  return h('button', { className: `daily-teaser${compact ? ' is-compact' : ''}`, type: 'button', onClick: () => onAction('lessons') },
    h('span', { className: 'teaser-art' }, h(LessonArtwork, { theme: lesson.theme, compact: true })),
    h('span', { className: 'teaser-copy' },
      h('span', { className: 'teaser-eyebrow' }, h(LessonSpark), lesson.completedAt ? '今日已学 · 再看一遍' : 'MELIUS · 今日小课堂', !lesson.completedAt && h('i', { className: 'lesson-new-dot' })),
      h('strong', null, lesson.title.replace(/\n/g, '')), h('small', null, daily.generating ? `正在写第 ${Math.min(5, (daily.draftCards?.length || 0) + 1)} 张卡片 · 边生成，边读重点` : `${lesson.duration} · ${lesson.cards.length} 张卡片 · ${lesson.origin === 'ai' ? 'AI 为你生成' : '精选入门'}`)),
    h('span', { className: 'teaser-arrow' }, h(Icon, { name: 'chevron' })));
}

function DailyClassroomPage({ daily, onOpen, onAction, chapters, activeChapterIdx, setActiveChapterIdx }) {
  const [tabName, setTabName] = useState('today');
  const lesson = daily.lesson;
  const date = lesson?.date || new Date().toLocaleDateString('en-CA');
  const dateLabel = `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8, 10))} 日`;
  const collection = [...(lesson?.completedAt ? [lesson] : []), ...daily.history];
  const totalRead = daily.history.filter((item) => item.completedAt).length + (lesson?.completedAt ? 1 : 0);
  return h('section', { className: 'classroom-page' },
    h('header', { className: 'classroom-header' },
      h('button', { className: 'classroom-back', onClick: () => onAction('course back'), 'aria-label': '返回资料库' }, h(Icon, { name: 'chevron-left' })),
      h('div', null, h('span', { className: 'classroom-wordmark' }, 'THE DAILY CLASSROOM'), h('h1', null, '每天，懂自己一点。')),
      h('span', { className: 'classroom-signature' }, h(LessonSpark), 'with Melius')),
    h('div', { className: 'classroom-tabs', role: 'tablist', 'aria-label': '课程分类' },
      h('button', { role: 'tab', 'aria-selected': tabName === 'today', onClick: () => setTabName('today'), className: tabName === 'today' ? 'is-active' : '' }, '为你推荐', h('span', null, 'FOR YOU')),
      h('button', { role: 'tab', 'aria-selected': tabName === 'courses', onClick: () => setTabName('courses'), className: tabName === 'courses' ? 'is-active' : '' }, '系统课程', h('span', null, 'EXPLORE'))),
    tabName === 'courses' ? h('div', { className: 'classroom-curriculum', role: 'tabpanel' }, h(CourseOverviewPage, { chapters, activeChapterIdx, setActiveChapterIdx, onAction })) :
    h('div', { role: 'tabpanel' },
      h('div', { className: 'classroom-section-label' }, h('span', null, h('i'), 'TODAY’S LITTLE DISCOVERY'), h('span', null, dateLabel)),
      !lesson ? h('div', { className: 'classroom-empty', role: 'status' }, h(LessonSpark), h('h2', null, daily.loading ? '正在整理今天的灵感…' : '小课堂暂时无法加载'), h('p', null, '一点新理解，一次小改变。'), !daily.loading && h('button', { className: 'classroom-primary', onClick: () => daily.regenerate() }, '重新加载')) :
      daily.generating || daily.draftCards?.length ? h(LessonLiveStudio, { daily, onOpen }) : h('div', { className: 'classroom-grid' },
        h('article', { className: `classroom-cover cover-${lesson.theme}` },
          h(LessonArtwork, { theme: lesson.theme }),
          h('div', { className: 'cover-top' }, h('span', { className: 'cover-pill' }, h(LessonSpark), lesson.origin === 'ai' ? '为你生成' : '精选小课'), h('span', { className: 'cover-issue' }, 'DAILY / ', date.replaceAll('-', '.'))),
          h('div', { className: 'cover-copy' }, h('span', { className: 'cover-category' }, lesson.category), h('h2', null, lesson.title), h('p', null, lesson.subtitle)),
          h('div', { className: 'cover-bottom' }, h('div', { className: 'cover-meta' }, h('span', null, h(Icon, { name: 'hourglass' }), lesson.duration), h('span', null, '▤', ` ${lesson.cards.length} 张卡片`)),
            h('button', { className: 'cover-start', type: 'button', onClick: () => onOpen(lesson) }, lesson.completedAt ? '再读一次' : '打开今天的小课堂', h('span', null, '↗')))),
        h('aside', { className: 'classroom-aside' },
          h('section', { className: 'lesson-context-panel' }, h('div', { className: 'context-heading' }, h('span', { className: 'melius-avatar' }, h(LessonSpark)), h('span', null, h('strong', null, '为什么是这一课'), h('small', null, 'A NOTE FROM MELIUS'))),
            h('p', { className: 'context-note' }, lesson.reason),
            h('div', { className: 'context-sources' }, lesson.sources.length ? lesson.sources.map((source) => h('span', { key: source }, h(Icon, { name: 'check-circle' }), source)) : h('span', null, h(Icon, { name: 'folder' }), '从一节觉察入门课开始')),
            h('p', { className: 'context-footnote' }, lesson.hasActivity ? `从${lesson.windowLabel || '昨天'}的记录出发，只关注今天的一小步。` : '今天和 Melius 聊聊，让明天的课程更贴近你。')),
          h('section', { className: 'lesson-roadmap' }, h('h3', null, '小小一课，带走一点改变'),
            ['一个新的理解', '一个随时可做的练习', '一个属于今天的小行动'].map((text, index) => h('div', { key: text }, h('span', null, `0${index + 1}`), h('p', null, text))),
            h('div', { className: 'roadmap-caption' }, '不用一次改变所有。今天，一点就好。')))),
      h('div', { className: `lesson-generation-status${daily.generating ? ' is-generating' : ''}`, role: 'status', 'aria-live': 'polite' },
        h(LessonSpark), h('span', null, daily.generating ? `正在为你写课 · ${daily.draftCards?.length || 0} / 5 张已就绪 · ${daily.generationSeconds || 0}s` : daily.error || (lesson?.origin === 'ai' ? `AI 已更新${lesson.generatedAt ? ' · ' + new Date(lesson.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''} · 结合你的记录生成` : '这是精选入门课。专属课程会结合你的实际记录生成。')),
        h('button', { type: 'button', disabled: daily.generating, onClick: () => daily.regenerate(), 'aria-label': '重新生成今日课程' }, daily.generating ? '生成中…' : '重新生成', ' ↻')),
      h('section', { className: 'lesson-collection' }, h('header', null, h('div', null, h('span', { className: 'classroom-wordmark' }, 'YOUR GROWING COLLECTION'), h('h2', null, '把每一次理解，慢慢收藏。')), h('span', { className: 'collection-count' }, `近期 ${totalRead} 节已读`)),
        collection.length ? h('div', { className: 'lesson-history-grid' }, collection.map((item) => h('button', { key: item.id, className: `lesson-history-item history-${item.theme}`, onClick: () => onOpen(item) }, h(LessonArtwork, { theme: item.theme, compact: true }), h('span', { className: 'history-date' }, item.date.slice(5).replace('-', ' / ')), h('strong', null, item.title), h('small', null, item.completedAt ? '✓ 已读 · 再次回顾' : `${item.duration} · 打开小课堂`)))) :
        h('div', { className: 'lesson-collection-empty' }, h('span', { className: 'collection-book' }, '▤'), h('div', null, h('strong', null, '你的第一节小课，就从今天开始。'), h('p', null, '每天一节，读过的内容会留在这里，随时回来看看。')), h('span', { className: 'collection-seed' }, '✧')))));
}

function DailyLessonReader({ lesson, daily, onBack, onAction, onReplace }) {
  const progressKey = `quittr-daily-reading-${lesson.id}`;
  const [index, setIndex] = useState(() => { try { return Math.min(4, Math.max(0, Number(localStorage.getItem(progressKey)) || 0)); } catch { return 0; } });
  const [reflection, setReflection] = useState(lesson.reflection || '');
  const [intention, setIntention] = useState(lesson.intention || '');
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [seconds, setSeconds] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const startXRef = useRef(null);
  const panelRef = useRef(null);
  const card = lesson.cards[index];
  const move = (next) => setIndex(Math.max(0, Math.min(lesson.cards.length - 1, next)));
  useEffect(() => {
    try { localStorage.setItem(progressKey, String(index)); } catch {}
    panelRef.current?.focus({ preventScroll: true });
  }, [index]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest('input,textarea,select') || finished) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); move(index + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(index - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, finished]);
  useEffect(() => {
    if (!timerRunning || seconds === null || seconds <= 0 || index !== 2) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds, index, timerRunning]);
  async function regenerate() {
    const result = await daily.regenerate();
    if (result && !result.generationError && result.lesson.id !== lesson.id) onReplace(result.lesson);
  }
  async function finish() {
    if (saving) return;
    setSaving(true); setSaveError('');
    try { await daily.complete(lesson, reflection, intention); setFinished(true); }
    catch { setSaveError('学习记录没有保存成功，请再试一次。'); }
    finally { setSaving(false); }
  }
  return h('section', { className: 'daily-reader' },
    h('header', { className: 'reader-topbar' }, h('button', { className: 'classroom-back', onClick: onBack, 'aria-label': '返回每日小课堂' }, h(Icon, { name: 'chevron-left' })), h('span', null, h(LessonSpark), 'MELIUS 小课堂'), h('span', { className: 'reader-top-meta' }, lesson.duration, ' · ', lesson.origin === 'ai' ? 'AI 为你生成' : '精选入门'), h('button', { className: 'reader-regenerate', type: 'button', disabled: daily.generating || saving, onClick: regenerate, 'aria-label': '重新生成课程卡片' }, daily.generating ? '正在生成…' : '换一节 ↻')),
    daily.generating && h(LessonLiveStudio, { daily, onOpen: onReplace, compact: true }),
    daily.error && h('p', { className: 'reader-save-error', role: 'alert' }, daily.error),
    finished ? h('div', { className: 'reader-completion' }, h('div', { className: 'completion-orbit' }, h(Icon, { name: 'check-circle' })), h('span', { className: 'classroom-wordmark' }, 'A LITTLE WISER, A LITTLE KINDER'), h('h1', null, '今天的你，\n又多懂自己一点。'), h('p', null, '不必急着做到完美。愿这一点理解，陪你走进今天。'),
      h('div', { className: 'completion-takeaway' }, h('span', null, '把这句话带走'), h('blockquote', null, lesson.takeaway), intention && h('div', null, h(Icon, { name: 'check-circle' }), '今天的小行动：', intention)),
      h('button', { className: 'classroom-primary', onClick: onBack }, '收好今天的理解', h('span', null, '↗')),
      h(CheckinReturnButton, { label: '读完了，去打卡记录今天的领悟 ↗' }),
      h(CommunityShareButton, { content: lessonShareContent(lesson), label: '把这节小课分享给社区 ↗' }),
      h('button', { className: 'reader-text-button', onClick: () => onAction('melius') }, '和 Melius 聊聊我的感受 →')) :
    h(React.Fragment, null,
      h('div', { className: 'reader-progress', 'aria-label': `阅读进度，第 ${index + 1} 张，共 ${lesson.cards.length} 张` }, lesson.cards.map((item, n) => h('button', { key: n, className: n <= index ? 'is-read' : '', onClick: () => move(n), 'aria-label': `第 ${n + 1} 张：${item.label}`, 'aria-current': n === index ? 'step' : undefined }))),
      h('div', { className: 'reader-layout' },
        h('aside', { className: 'reader-outline' }, h('span', { className: 'classroom-wordmark' }, 'TODAY’S LESSON'), h('h2', null, lesson.title), h('p', null, lesson.subtitle),
          h('nav', { 'aria-label': '小课堂目录' }, lesson.cards.map((item, n) => h('button', { key: n, onClick: () => move(n), className: n === index ? 'is-active' : '' }, h('span', null, `0${n + 1}`), item.label))),
          h('span', { className: 'reader-outline-note' }, '每次，一小步。')),
        h('div', { className: 'reader-main' },
          h('article', { key: index, ref: panelRef, tabIndex: -1, className: `learning-card learning-${card.kind} theme-${lesson.theme}`, 'aria-label': card.label,
            onTouchStart: (event) => { startXRef.current = event.target.closest('button') ? null : event.touches[0].clientX; },
            onTouchEnd: (event) => { if (startXRef.current === null) return; const dx = event.changedTouches[0].clientX - startXRef.current; if (Math.abs(dx) > 65) move(index + (dx < 0 ? 1 : -1)); startXRef.current = null; } },
            h('div', { className: 'learning-card-top' }, h('span', null, h(LessonSpark), card.label), h('span', null, `0${index + 1} / 0${lesson.cards.length}`)),
            h('h1', null, card.title),
            card.kind === 'insight' ? h('div', { className: 'learning-visual' }, h(LessonArtwork, { theme: lesson.theme }), h('span', { className: 'visual-caption' }, 'NOTICE. PAUSE. CHOOSE.')) : null,
            h(LessonAnnotatedText, { key: `${lesson.id}-${index}`, card }),
            card.kind === 'pattern' ? h('div', { className: 'learning-pattern' }, card.steps.map((step, n) => h(React.Fragment, { key: n }, h('div', null, h('span', null, `0${n + 1}`), h('strong', null, step)), n < card.steps.length - 1 && h('span', { className: 'pattern-arrow' }, '→')))) : null,
            card.kind === 'practice' ? h(React.Fragment, null, h('ol', { className: 'learning-steps' }, card.steps.map((step, n) => h('li', { key: n }, h('span', null, `0${n + 1}`), step))),
              h('button', { className: `practice-timer${timerRunning && seconds > 0 ? ' is-running' : ''}`, onClick: () => { if (timerRunning && seconds > 0) setTimerRunning(false); else { if (seconds === null || seconds === 0) setSeconds(60); setTimerRunning(true); } } }, h('span', { className: 'timer-orb' }), seconds === 0 ? '练习结束 · 谢谢你陪了自己一分钟' : seconds !== null ? timerRunning ? `跟随自己的节奏 · ${seconds}s  /  点击暂停` : `练习已暂停 · 剩余 ${seconds}s  /  继续` : '给自己一分钟 · 开始练习')) : null,
            ['reflection', 'action'].includes(card.kind) ? h('div', { className: 'learning-choices', role: 'group', 'aria-label': card.kind === 'reflection' ? '选择你的感受' : '选择今天的小行动' }, card.steps.map((step) => {
              const selected = (card.kind === 'reflection' ? reflection : intention) === step;
              return h('button', { key: step, 'aria-pressed': selected, className: selected ? 'is-selected' : '', onClick: () => card.kind === 'reflection' ? setReflection(selected ? '' : step) : setIntention(selected ? '' : step) }, h('span', { className: 'choice-circle' }, selected ? '✓' : ''), step);
            }), h('small', null, '选一个贴近你的，也可以直接继续。')) : null,
            h('div', { className: 'learning-highlight' }, h('span', null, '✧'), h('p', null, card.highlight)),
            h('div', { className: 'learning-card-signature' }, 'QUITTR', h('span', null, 'a little space to grow'))),
          h('div', { className: 'reader-controls' }, h('button', { className: 'reader-previous', disabled: index === 0, onClick: () => move(index - 1) }, '←', h('span', null, '上一张')), h('span', { className: 'reader-counter', 'aria-live': 'polite' }, String(index + 1).padStart(2, '0'), h('i', null, ' / 05')),
            h('button', { className: 'reader-next', disabled: saving, onClick: index === 4 ? finish : () => move(index + 1) }, saving ? '正在保存…' : index === 4 ? '完成今天的小课' : '继续', h('span', null, index === 4 ? '✓' : '→'))),
          saveError && h('p', { className: 'reader-save-error', role: 'alert' }, saveError),
          h('p', { className: 'reader-bottom-note' }, '左右滑动或使用方向键翻页 · 只需读完，不必完美')))));
}
