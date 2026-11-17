/* Trackable plans and the iOS bridge. Native writes happen only from explicit controls. */
function planSummary(plan) {
  return { progress: Math.round(plan.tasks.reduce((sum, task) => sum + task.progress, 0) / Math.max(1, plan.tasks.length)), complete: plan.tasks.filter(task => task.progress === 100).length };
}
function planTaskDate(task, timeZone) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(task.scheduledAt));
}
function planNote(plan) {
  return [plan.title, plan.goal, `${plan.startDate} 起 · ${plan.durationDays} 天 · ${plan.timeZone}`, '', ...plan.tasks.map(task => `${task.progress === 100 ? '☑' : '☐'} ${planTaskDate(task, plan.timeZone)} ${task.title} · ${task.durationMinutes} 分钟 · ${task.progress}%\n${task.detail}`)].join('\n');
}
function planICS(plan) {
  const escape = text => String(text).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Quittr//Melius Plans//ZH', 'CALSCALE:GREGORIAN'];
  for (const task of plan.tasks.filter(task => task.progress < 100)) lines.push('BEGIN:VEVENT', `UID:${task.id}@quittr`, `DTSTAMP:${stamp(plan.createdAt)}`, `DTSTART:${stamp(task.scheduledAt)}`, `DTEND:${stamp(new Date(new Date(task.scheduledAt).getTime() + task.durationMinutes * 60000))}`, `SUMMARY:${escape(task.title)}`, `DESCRIPTION:${escape(plan.title + '\n' + task.detail)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escape(task.title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  lines.push('END:VCALENDAR');
  // RFC 5545 folds at 75 UTF-8 octets, not 75 JavaScript characters.
  return lines.map(line => { const chunks = []; let part = '', bytes = 0; for (const char of line) { const size = new TextEncoder().encode(char).length; if (bytes + size > 75) { chunks.push(part); part = ' '; bytes = 1; } part += char; bytes += size; } chunks.push(part); return chunks.join('\r\n'); }).join('\r\n') + '\r\n';
}
function nativePlanPayload(plan, tasks = plan.tasks) {
  return { id: plan.id, title: plan.title, goal: plan.goal, timeZone: plan.timeZone, tasks: tasks.map(({id,title,detail,scheduledAt,durationMinutes,progress}) => ({id,title,detail,scheduledAt,durationMinutes,progress})) };
}
async function callPlannerNative(action, plan, tasks) {
  const handler = window.webkit?.messageHandlers?.quittrPlanner;
  if (!handler) throw new Error('请在更新后的 iOS App 中同步；网页版可以导出日历或复制备忘录。');
  const accountId = window.QUITTR_ACCOUNT?.user.id;
  if (!accountId) throw new Error('请先登录。');
  const result = await handler.postMessage({ action, accountId, plan: nativePlanPayload(plan, tasks) });
  if (window.QUITTR_ACCOUNT?.user.id !== accountId) throw new Error('账号已切换，请重新打开计划。');
  if (result.error) throw new Error(result.error);
  return result;
}
function announcePlanUpdate(plan) { window.dispatchEvent(new CustomEvent('quittr-plan-updated', { detail: { plan } })); }

function MeliusPlanCard({ action, initialPlan }) {
  const [plan, setPlan] = useState(initialPlan || action.plan);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const native = !!window.webkit?.messageHandlers?.quittrPlanner;
  const summary = planSummary(plan);
  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    accountRequest(`/api/plans/${encodeURIComponent(plan.id)}`).then(result => { if (active) setPlan(result.plan); }).catch(() => { if (active) setError('暂时无法刷新计划，显示上次保存的内容。'); });
    const updated = event => { if (event.detail.plan.id === plan.id) setPlan(event.detail.plan); };
    window.addEventListener('quittr-plan-updated', updated);
    return () => { active = false; mountedRef.current = false; window.removeEventListener('quittr-plan-updated', updated); };
  }, [plan.id]);
  const ordered = [...plan.tasks].sort((a,b) => (a.progress === 100) - (b.progress === 100) || a.scheduledAt.localeCompare(b.scheduledAt));
  const shown = expanded ? ordered : ordered.slice(0, 3);
  async function work(label, operation) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(label); setError(''); setNotice('');
    try { const message = await operation(); if (mountedRef.current) setNotice(message || ''); }
    catch (err) { if (mountedRef.current) setError(err.message || '操作未完成，请重试。'); }
    finally { busyRef.current = false; if (mountedRef.current) setBusy(''); }
  }
  function update(task, progress) {
    return work(task.id, async () => {
      const result = await accountRequest('/api/plans/progress', { planId: plan.id, taskId: task.id, progress, expectedUpdatedAt: task.updatedAt });
      setPlan(result.plan); announcePlanUpdate(result.plan);
      if (native) {
        try { await callPlannerNative('progress', result.plan, [result.plan.tasks.find(item => item.id === task.id)]); }
        catch { return '进度已保存；系统提醒事项未更新，可稍后重新同步。'; }
      }
      return progress === 100 ? '这一小步，已经完成。' : `已记录 ${progress}% 的进度。`;
    });
  }
  function sync(destination) {
    return work(destination, async () => {
      // Always export the latest persisted plan, including progress changed in another card.
      const { plan: current } = await accountRequest(`/api/plans/${encodeURIComponent(plan.id)}`);
      setPlan(current);
      if (native) {
        const result = await callPlannerNative(destination, current, destination === 'notes' ? current.tasks : current.tasks.filter(task => task.progress < 100));
        if (destination === 'notes') return result.shared ? result.notes ? '已保存到备忘录。' : '内容已通过系统分享。' : '已取消分享。';
        return `已同步 ${result.count} 项到${destination === 'calendar' ? '日历' : '提醒事项'}。重复同步会更新已有项目。`;
      }
      if (destination === 'calendar') {
        const blob = new Blob([planICS(current)], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = 'melius-plan.ics'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        return '日历文件已导出，请打开文件并确认导入。重复导入可能产生重复日程。';
      }
      await navigator.clipboard.writeText(planNote(current));
      return '已复制计划，可以粘贴到备忘录。';
    });
  }
  function readCompleted() {
    return work('read', async () => {
      const { plan: current } = await accountRequest(`/api/plans/${encodeURIComponent(plan.id)}`);
      const result = await callPlannerNative('readProgress', current);
      let latest = current, count = 0;
      for (const id of result.completedIds || []) {
        const task = latest.tasks.find(task => task.id === id);
        if (!task || task.progress === 100) continue;
        latest = (await accountRequest('/api/plans/progress', { planId: plan.id, taskId: id, progress: 100, expectedUpdatedAt: task.updatedAt })).plan;
        setPlan(latest); announcePlanUpdate(latest); count++;
      }
      setPlan(latest); return count ? `已带回 ${count} 项完成记录。` : '已检查，暂无新的完成记录。';
    });
  }
  return h('article', { className: 'melius-plan-card', 'aria-label': plan.title },
    h('header', { className: 'plan-card-heading' }, h('span', { className: 'plan-card-symbol' }, '↗'), h('div', null, h('small', null, 'A LITTLE EVERY DAY'), h('h3', null, plan.title)), h('span', { className: 'plan-duration' }, plan.durationDays, h('small', null, '天'))),
    h('p', { className: 'plan-goal' }, plan.goal),
    h('div', { className: 'plan-progress-label' }, h('span', null, '每一小步，都算数'), h('strong', null, `${summary.progress}%`)),
    h('div', { className: 'plan-progress-track', role: 'progressbar', 'aria-label': '计划总进度', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': summary.progress }, h('i', { style: { width: `${summary.progress}%` } })),
    h('p', { className: 'plan-progress-caption' }, `${summary.complete} / ${plan.tasks.length} 项完成 · ${plan.startDate} 起 · ${plan.timeZone}`),
    h('div', { className: 'plan-task-list' }, shown.map(task => h('div', { key: task.id, className: `plan-task${task.progress === 100 ? ' is-complete' : ''}` },
      h('button', { type: 'button', className: 'plan-task-check', disabled: !!busy, 'aria-label': `${task.progress === 100 ? '重新开启' : '完成'}：${task.title}，${planTaskDate(task, plan.timeZone)}`, onClick: () => update(task, task.progress === 100 ? 0 : 100) }, task.progress === 100 ? '✓' : ''),
      h('div', { className: 'plan-task-copy' }, h('strong', null, task.title), h('small', null, `${planTaskDate(task, plan.timeZone)} · ${task.durationMinutes} 分钟`), h('p', null, task.detail),
        h('div', { className: 'plan-task-progress', role: 'group', 'aria-label': `${task.title}的完成程度` }, [0,25,50,75,100].map(value => h('button', { key: value, type: 'button', disabled: !!busy, 'aria-pressed': task.progress === value, onClick: () => update(task, value) }, value === 100 ? '完成' : `${value}%`))),
        ![0,25,50,75,100].includes(task.progress) && h('small', null, `当前完成 ${task.progress}%`))))),
    plan.tasks.length > 3 && h('button', { className: 'plan-expand', type: 'button', onClick: () => setExpanded(value => !value), 'aria-expanded': expanded }, expanded ? '收起任务 ↑' : `查看全部 ${plan.tasks.length} 项任务 ↓`),
    h('div', { className: 'plan-sync-heading' }, h('button', { type: 'button', className: 'plan-sync-toggle', onClick: () => setSyncOpen(value => !value), 'aria-expanded': syncOpen }, '让系统也提醒我', h('span', null, syncOpen ? '−' : '+'))),
    syncOpen && h('div', { className: 'plan-sync-panel' }, h('p', null, `将同步 ${plan.tasks.filter(task => task.progress < 100).length} 项未完成活动。时间按 ${plan.timeZone} 安排。`),
      h('div', { className: 'plan-sync-buttons' }, native && h('button', { type: 'button', disabled: !!busy, onClick: () => sync('reminders') }, '同步提醒事项 ↗'), h('button', { type: 'button', disabled: !!busy, onClick: () => sync('calendar') }, native ? '同步到日历 ↗' : '导出日历 ↗'), h('button', { type: 'button', disabled: !!busy, onClick: () => sync('notes') }, native ? '保存到备忘录 ↗' : '复制到备忘录')),
      native && h('button', { type: 'button', className: 'plan-read-completed', disabled: !!busy, onClick: readCompleted }, '读取提醒事项中的完成记录 ↻'),
      h('small', null, native ? '首次同步时，iOS 会询问权限。备忘录通过系统分享保存。' : '在 iOS App 中可以直接同步提醒事项与日历。')),
    busy && h('p', { className: 'plan-feedback', role: 'status' }, '正在处理…'), notice && h('p', { className: 'plan-feedback', role: 'status' }, notice), error && h('p', { className: 'plan-error', role: 'alert' }, error));
}

function MeliusPlansPanel({ onSuggest }) {
  const [open, setOpen] = useState(false), [plans, setPlans] = useState([]), [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = () => accountRequest('/api/plans').then(result => { if (active) { setPlans(result.plans); setError(''); } }).catch(() => { if (active) setError('计划暂时无法加载，请关闭后重试。'); });
    load(); window.addEventListener('quittr-plan-updated', load);
    return () => { active = false; window.removeEventListener('quittr-plan-updated', load); };
  }, [open]);
  return h('div', { className: 'melius-plan-shelf' }, h('button', { type: 'button', className: 'plan-shelf-toggle', 'aria-expanded': open, onClick: () => setOpen(value => !value) }, h('span', null, '↗ 我的计划'), h('small', null, open ? '收起 −' : '安排、提醒与进度 +')),
    open && h('section', { className: 'plan-shelf-content', 'aria-label': '我的计划' }, error && h('p', { role: 'alert' }, error), plans.length ? plans.map(plan => h(MeliusPlanCard, { key: plan.id, initialPlan: plan })) : h('div', { className: 'plan-shelf-empty' }, h('p', null, '从一个小目标开始，让 Melius 帮你拆成每天的行动。'), h('button', { type: 'button', onClick: () => onSuggest('我想制定一个30天的活动计划，请先问我需要了解的信息。') }, '一起制定计划 ↗'))));
}
