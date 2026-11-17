const crypto=require('node:crypto');
const {dateKey}=require('./plans');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
function checkinSnapshot(state,timeZone='Asia/Shanghai',now=new Date()){
  const zone=state.checkInTimeZone||timeZone;
  try{new Intl.DateTimeFormat('en',{timeZone:zone}).format(now);}catch{throw fail('无效的时区。');}
  const today=dateKey(now,zone),entries=Object.values(state.dailyCheckIns||{}).filter(item=>item.date<=today).sort((a,b)=>b.date.localeCompare(a.date));
  const shift=(day,offset)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
  const days=new Set(entries.map(item=>item.date));
  let run=days.has(today)?today:shift(today,-1),streak=0;
  while(days.has(run)){streak++;run=shift(run,-1);}
  let best=0,current=0,previous=null;
  for(const item of [...entries].reverse()){current=previous&&shift(previous,1)===item.date?current+1:1;best=Math.max(best,current);previous=item.date;}
  const week=Array.from({length:7},(_,i)=>{const date=shift(today,i-6),entry=entries.find(item=>item.date===date);return{date,checked:!!entry,energy:entry?.energy??null};});
  const weekCount=week.filter(item=>item.checked).length;
  const lessonCount=Object.values(state.dailyLessons||{}).filter(item=>item.completedAt&&dateKey(new Date(item.completedAt),zone)===today).length;
  const taskCount=Object.values(state.plans||{}).flatMap(plan=>plan.tasks).filter(task=>task.completedAt&&dateKey(new Date(task.completedAt),zone)===today).length;
  return {today,timeZone:zone,entry:entries.find(item=>item.date===today)||null,totalDays:days.size,currentStreak:streak,bestStreak:best,week,weekCount,todayActivities:{lessons:lessonCount,tasks:taskCount},recent:entries.slice(0,30)};
}
function recordDailyCheckin(state,body,{now=new Date(),source={}}={}){
  const snapshot=checkinSnapshot(state,body.timeZone,now);
  const previous=snapshot.entry;
  const energy=body.energy===undefined?(previous?.energy??null):body.energy;
  if(energy!==null&&(!Number.isInteger(energy)||energy<1||energy>5))throw fail('精力评分应为1–5。');
  const mood=body.mood===undefined?(previous?.mood||''):clean(body.mood,30);if(!['','平静','有些累','有冲动','压力较大','轻松'].includes(mood))throw fail('请选择有效的状态。');
  const entry={...previous,id:previous?.id||crypto.randomUUID(),date:snapshot.today,timeZone:snapshot.timeZone,energy,mood,action:body.action===undefined?(previous?.action||''):clean(body.action,180),note:body.note===undefined?(previous?.note||''):clean(body.note,500),createdAt:previous?.createdAt||now.toISOString(),updatedAt:now.toISOString(),...source};
  const next={...state,checkInTimeZone:snapshot.timeZone,dailyCheckIns:{...state.dailyCheckIns,[entry.date]:entry},updatedAt:now.toISOString()};
  return {state:next,data:checkinSnapshot(next,snapshot.timeZone,now),isNew:!previous};
}
function createCheckinService({readState,writeState,now=()=>new Date()}){return{get(timeZone){return checkinSnapshot(readState(),timeZone,now());},record(body){const result=recordDailyCheckin(readState(),body,{now:now()});writeState(result.state);return{...result.data,isNew:result.isNew};}};}
module.exports={checkinSnapshot,recordDailyCheckin,createCheckinService};
