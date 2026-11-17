const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makePlan, progressPlan, summarizePlan, createPlanService, zonedInstant } = require('../plans');
const { createMeliusService } = require('../melius');
const now = () => new Date('2026-11-17T04:00:00Z');
function args(extra = {}) { return { title: '30天散步计划', goal: '每天给自己一点活动时间', start_date: '2026-11-18', duration_days: 30, activities: [{ title: '轻松散步', detail: '按舒适的节奏走20分钟', start_day: 1, interval_days: 1, occurrences: 30, time: '19:00', duration_minutes: 20 }], ...extra }; }
function fixture(initial = {}) { let state = structuredClone(initial); const options = { readState: () => structuredClone(state), writeState: value => { state = structuredClone(value); }, now }; return { options, state: () => state, service: createPlanService(options) }; }
const toolCall = (name, values) => ({ id: name + Math.random(), type: 'function', function: { name, arguments: JSON.stringify(values) } });

test('a 30-day plan has stable distinct occurrences and local calendar times', () => {
  const plan = makePlan(args(), { now: now(), timeZone: 'Asia/Shanghai' });
  assert.equal(plan.tasks.length, 30);
  assert.equal(new Set(plan.tasks.map(task => task.id)).size, 30);
  assert.equal(plan.tasks[0].scheduledAt, '2026-11-18T11:00:00.000Z');
  assert.equal(plan.tasks.at(-1).scheduledAt, '2026-12-17T11:00:00.000Z');
  assert.equal(summarizePlan(plan).progress, 0);
  assert.equal(zonedInstant('2026-11-01','09:00','America/New_York'), '2026-11-01T14:00:00.000Z');
  assert.throws(() => zonedInstant('2026-03-08','02:30','America/New_York'), /夏令时/);
});
test('plan validation rejects invalid dates, times, overlong schedules and arbitrary progress', () => {
  for (const override of [{start_date:'2026-02-30'}, {start_date:'2020-01-01'}, {duration_days:91}, {activities:[]}]) assert.throws(() => makePlan(args(override), {now:now()}));
  const bad = args(); bad.activities[0].time = '25:00'; assert.throws(() => makePlan(bad, {now:now()}));
  const tooMany = args(); tooMany.activities = Array(7).fill(tooMany.activities[0]); assert.throws(() => makePlan(tooMany, {now:now()}), /180/);
  const plan = makePlan(args(), {now:now()});
  for (const value of [-1,101,NaN,40.5,'100']) assert.throws(() => progressPlan(plan,plan.tasks[0].id,value));
});
test('partial progress, completion and reopening survive service recreation without affecting recovery', () => {
  const plan = makePlan(args(), {now:now()}); const f = fixture({plans:{[plan.id]:plan},reasons:['保留动力'],relapses:[]});
  const first = plan.tasks[0];
  assert.equal(f.service.progress({planId:plan.id,taskId:first.id,progress:50}).plan.tasks[0].progress, 50);
  const done = f.service.progress({planId:plan.id,taskId:first.id,progress:100}).plan;
  assert.equal(done.completedCount,1); assert.ok(done.tasks[0].completedAt);
  const reopened = createPlanService(f.options).progress({planId:plan.id,taskId:first.id,progress:25}).plan;
  assert.equal(reopened.tasks[0].completedAt,null); assert.equal(reopened.tasks[0].progress,25);
  assert.deepEqual(f.state().reasons,['保留动力']); assert.deepEqual(f.state().relapses,[]);
  assert.throws(() => f.service.get('another-account-plan'), {status:404});
  assert.throws(() => f.service.progress({planId:plan.id,taskId:first.id,progress:100,expectedUpdatedAt:'stale'}), {status:409});
});
test('conversation creates a persistent plan once, streams its card and exposes exact task IDs for follow-up', async () => {
  const f = fixture(); let calls=0; const events=[];
  const text='帮我从明天起安排30天，每晚19点轻松散步20分钟。';
  const service=createMeliusService({...f.options, complete:async payload => {
    calls++;
    if(calls===1) return {choices:[{message:{tool_calls:[toolCall('create_plan',{...args(),source_quote:text})]}}]};
    return {choices:[{message:{content:'已保存计划，点击卡片选择系统同步。'}}]};
  }});
  const request={requestId:'plan-message-001',messages:[{role:'user',content:text}],onEvent:event=>events.push(event)};
  const result=await service.send(request); await service.send(request);
  assert.equal(Object.keys(f.state().plans).length,1); assert.equal(calls,2);
  assert.equal(result.actions[0].type,'task_plan'); assert.ok(events.some(event=>event.type==='card'&&event.card.plan.tasks.length===30));
  const plan=result.actions[0].plan;
  let next=0;
  const progress=createMeliusService({...f.options,complete:async payload=>{
    next++;
    if(next===1){ assert.match(payload.messages[0].content,new RegExp(plan.tasks[0].id)); return {choices:[{message:{tool_calls:[toolCall('update_task_progress',{task_id:plan.tasks[0].id,progress:50,source_quote:'今天散步做完了一半'}),toolCall('update_task_progress',{task_id:plan.tasks[1].id,progress:25,source_quote:'第二项完成25%'})]}}]}; }
    return {choices:[{message:{content:'已更新进度。'}}]};
  }});
  await progress.send({requestId:'plan-progress-001',messages:[{role:'user',content:'今天散步做完了一半，第二项完成25%。'}]});
  assert.deepEqual(f.state().plans[plan.id].tasks.slice(0,2).map(task=>task.progress),[50,25]);
});
test('a future intention and negated completion cannot be recorded as completed', async () => {
  for(const text of ['我打算明天完成散步','我还没完成散步']){
    const plan=makePlan(args(),{now:now()});const f=fixture({plans:{[plan.id]:plan}});let calls=0;
    const service=createMeliusService({...f.options,complete:async()=> ++calls===1 ? {choices:[{message:{tool_calls:[toolCall('update_task_progress',{task_id:plan.tasks[0].id,progress:100,source_quote:text})]}}]} : {choices:[{message:{content:'等你做完再告诉我。'}}]}});
    const result=await service.send({requestId:'plan-negative-001',messages:[{role:'user',content:text}]});
    assert.equal(result.actions.length,0);assert.equal(f.state().plans[plan.id].tasks[0].progress,0);
  }
});
