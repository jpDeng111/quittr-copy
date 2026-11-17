const crypto = require('node:crypto');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function validZone(timeZone) { try { new Intl.DateTimeFormat('en', { timeZone }).format(); return timeZone; } catch { throw fail('无效的时区。'); } }
function dateKey(date, timeZone) { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function addDays(date, days) { const value = new Date(date + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
function zonedInstant(date, time, timeZone) {
  const target = Date.parse(`${date}T${time}:00Z`);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const localValue = (instant) => { const p = Object.fromEntries(formatter.formatToParts(instant).map(({type,value}) => [type,value])); return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`); };
  let result = target;
  for (let i = 0; i < 4; i++) result += target - localValue(new Date(result));
  if (localValue(new Date(result)) !== target) throw fail('这个提醒时间遇到了夏令时跳时，请换一个时间。');
  return new Date(result).toISOString();
}
function makePlan(args, { now = new Date(), timeZone = 'Asia/Shanghai', source = {} } = {}) {
  validZone(timeZone);
  const title = clean(args.title, 80), goal = clean(args.goal, 300), startDate = clean(args.start_date, 10);
  const durationDays = args.duration_days;
  if (!title || !goal || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(startDate + 'T12:00:00Z')) || new Date(startDate + 'T12:00:00Z').toISOString().slice(0,10) !== startDate) throw fail('计划需要标题、目标和有效的开始日期。');
  const today = dateKey(now, timeZone);
  if (startDate < today || startDate > addDays(today, 365)) throw fail('开始日期需要在今天至未来一年内。');
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 90) throw fail('计划周期应为 1–90 天。');
  if (!Array.isArray(args.activities) || args.activities.length < 1 || args.activities.length > 12) throw fail('请安排 1–12 类具体活动。');
  const id = crypto.randomUUID(), timestamp = now.toISOString(), tasks = [];
  const activities = args.activities.map((item, index) => {
    const title = clean(item.title, 80), detail = clean(item.detail, 500), time = clean(item.time, 5);
    const { start_day: startDay, interval_days: intervalDays, occurrences, duration_minutes: durationMinutes } = item;
    if (!title || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || ![startDay, intervalDays, occurrences, durationMinutes].every(Number.isInteger) || startDay < 1 || intervalDays < 1 || occurrences < 1 || occurrences > 90 || durationMinutes < 5 || durationMinutes > 180 || startDay + (occurrences - 1) * intervalDays > durationDays) throw fail('活动的日期、次数、提醒时间或时长无效。');
    const activity = { id: `${id}-a${index}`, title, detail, time, startDay, intervalDays, occurrences, durationMinutes };
    for (let n = 0; n < occurrences; n++) {
      if (tasks.length >= 180) throw fail('一份计划最多安排 180 次任务，请减少提醒频率。');
      const day = startDay - 1 + n * intervalDays;
      const scheduledAt = zonedInstant(addDays(startDate, day), time, timeZone);
      tasks.push({ id: `${id}-a${index}-n${n}`, activityId: activity.id, title, detail, scheduledAt, durationMinutes, progress: 0, updatedAt: timestamp });
    }
    return activity;
  });
  tasks.sort((a,b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
  return { id, title, goal, startDate, durationDays, timeZone, activities, tasks, createdAt: timestamp, updatedAt: timestamp, ...source };
}
function progressPlan(plan, taskId, progress, now = new Date()) {
  if (!plan || !plan.tasks.some(task => task.id === taskId)) throw fail('没有找到这项任务。', 404);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw fail('完成程度应为 0–100 的整数。');
  if (plan.tasks.find(task => task.id === taskId).progress === progress) return plan;
  const timestamp = now.toISOString();
  return { ...plan, updatedAt: timestamp, tasks: plan.tasks.map(task => task.id === taskId ? { ...task, progress, updatedAt: timestamp, completedAt: progress === 100 ? timestamp : null } : task) };
}
function summarizePlan(plan) {
  return { ...plan, progress: Math.round(plan.tasks.reduce((sum,task) => sum + task.progress, 0) / plan.tasks.length), completedCount: plan.tasks.filter(task => task.progress === 100).length };
}
function createPlanService({ readState, writeState, now = () => new Date() }) {
  const find = id => { const plan = readState().plans?.[id]; if (!plan) throw fail('没有找到这份计划。', 404); return plan; };
  return {
    list() { return { plans: Object.values(readState().plans || {}).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,30).map(summarizePlan) }; },
    get(id) { return { plan: summarizePlan(find(id)) }; },
    progress({ planId, taskId, progress, expectedUpdatedAt }) {
      const plan = find(planId), task = plan.tasks.find(task => task.id === taskId);
      if (expectedUpdatedAt && task?.updatedAt !== expectedUpdatedAt) throw fail('任务进度已更新，请刷新后再试。', 409);
      const next = progressPlan(plan, taskId, progress, now());
      const state = readState();
      writeState({ ...state, plans: { ...state.plans, [next.id]: next }, updatedAt: now().toISOString() });
      return { plan: summarizePlan(next) };
    }
  };
}
module.exports = { makePlan, progressPlan, summarizePlan, createPlanService, dateKey, zonedInstant };
