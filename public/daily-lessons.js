/* Daily micro-lessons. Content is plain text; visual layouts stay in the client. */
function useDailyLessons(clockNow) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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
    const pending = request('daily', { regenerate: force }, signal).then((result) => {
      if (mountedRef.current && !signal?.aborted && currentDayRef.current === day) { setData(result); setError(result.generationError || ''); }
      return result;
    }).catch((err) => {
      if (mountedRef.current && currentDayRef.current === day && err.name !== 'AbortError') setError(err instanceof TypeError ? '无法连接本地服务，请启动项目后重新生成。当前显示的仍是原课程。' : '专属小课暂时没有生成成功，当前显示的仍是原课程，请重试。');
      return null;
    }).finally(() => { if (flightRef.current?.promise === pending) flightRef.current = null; if (mountedRef.current && currentDayRef.current === day) setGenerating(false); });
    flightRef.current = { day, promise: pending };
    return pending;
  }
  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    setLoading(true);
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
  return { lesson: data?.lesson, history: data?.history || [], loading, generating, generationSeconds, error, generate, regenerate: () => generate(undefined, true), complete };
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

function DailyLessonTeaser({ daily, onAction, compact = false }) {
  const lesson = daily.lesson;
  if (!lesson) return h('button', { className: 'daily-teaser teaser-loading', type: 'button', onClick: () => onAction('lessons') },
    h(LessonSpark), h('span', null, h('strong', null, daily.loading ? '正在准备今天的小课堂' : '每日小课堂'), h('small', null, '每天，懂自己一点。')), h(Icon, { name: 'chevron' }));
  return h('button', { className: `daily-teaser${compact ? ' is-compact' : ''}`, type: 'button', onClick: () => onAction('lessons') },
    h('span', { className: 'teaser-art' }, h(LessonArtwork, { theme: lesson.theme, compact: true })),
    h('span', { className: 'teaser-copy' },
      h('span', { className: 'teaser-eyebrow' }, h(LessonSpark), lesson.completedAt ? '今日已学 · 再看一遍' : 'MELIUS · 今日小课堂', !lesson.completedAt && h('i', { className: 'lesson-new-dot' })),
      h('strong', null, lesson.title.replace(/\n/g, '')), h('small', null, daily.generating ? '正在为你准备专属内容…' : `${lesson.duration} · ${lesson.cards.length} 张卡片 · ${lesson.origin === 'ai' ? (lesson.model ? `${lesson.model} 生成` : 'AI 为你生成') : '精选入门'}`)),
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
      h('div', { className: 'classroom-grid' },
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
        h(LessonSpark), h('span', null, daily.generating ? `AI 正在编写新的 5 张课程卡片 · ${daily.generationSeconds || 0}s` : daily.error || (lesson?.origin === 'ai' ? `AI 已更新${lesson.generatedAt ? ' · ' + new Date(lesson.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''} · 结合你的记录生成` : '这是精选入门课。专属课程会结合你的实际记录生成。')),
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
    h('header', { className: 'reader-topbar' }, h('button', { className: 'classroom-back', onClick: onBack, 'aria-label': '返回每日小课堂' }, h(Icon, { name: 'chevron-left' })), h('span', null, h(LessonSpark), 'MELIUS 小课堂'), h('span', { className: 'reader-top-meta' }, lesson.duration, ' · ', lesson.origin === 'ai' ? (lesson.model || 'AI 为你生成') : '精选入门'), h('button', { className: 'reader-regenerate', type: 'button', disabled: daily.generating || saving, onClick: regenerate, 'aria-label': '重新生成课程卡片' }, daily.generating ? '正在生成…' : '换一节 ↻')),
    daily.generating && h('p', { className: 'reader-generation-notice', role: 'status' }, `AI 正在重新编写卡片 · ${daily.generationSeconds || 0}s，当前内容可以继续阅读…`),
    daily.error && h('p', { className: 'reader-save-error', role: 'alert' }, daily.error),
    finished ? h('div', { className: 'reader-completion' }, h('div', { className: 'completion-orbit' }, h(Icon, { name: 'check-circle' })), h('span', { className: 'classroom-wordmark' }, 'A LITTLE WISER, A LITTLE KINDER'), h('h1', null, '今天的你，\n又多懂自己一点。'), h('p', null, '不必急着做到完美。愿这一点理解，陪你走进今天。'),
      h('div', { className: 'completion-takeaway' }, h('span', null, '把这句话带走'), h('blockquote', null, lesson.takeaway), intention && h('div', null, h(Icon, { name: 'check-circle' }), '今天的小行动：', intention)),
      h('button', { className: 'classroom-primary', onClick: onBack }, '收好今天的理解', h('span', null, '↗')),
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
            h('p', { className: 'learning-body' }, card.body),
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
