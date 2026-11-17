// Aggregate product feedback only. Never emit dialogue, notes, task text or emails.
function productMetrics(states, { now = new Date(), consumptions = [] } = {}) {
  const localToday=state=>new Intl.DateTimeFormat('en-CA',{timeZone:state.checkInTimeZone||'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const shift=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const users=states.map(({userId,state})=>{const today=localToday(state),since=shift(today,-6);const entries=Object.values(state.dailyCheckIns||{}).filter(e=>e.date<=today).sort((a,b)=>a.date.localeCompare(b.date));return{userId,today,since,entries,days:new Set(entries.map(e=>e.date))};});
  const retention=n=>{let eligible=0,returned=0;for(const user of users){const first=user.entries[0]?.date;if(!first||shift(first,n)>=user.today)continue;eligible++;if(user.days.has(shift(first,n)))returned++;}return{eligibleUsers:eligible,returnedUsers:returned,rate:eligible?Math.round(returned/eligible*1000)/1000:null};};
  const mature=consumptions.filter(item=>new Date(item.created_at).getTime()<=now.getTime()-86400000);
  const consumedUsers=new Set(mature.map(item=>item.user_id)),converted=new Set();
  for(const item of mature){const user=users.find(u=>u.userId===item.user_id),time=new Date(item.created_at).getTime();if(user?.entries.some(entry=>{const at=new Date(entry.createdAt).getTime();return at>=time&&at<=time+86400000;}))converted.add(item.user_id);}
  return{asOf:now.toISOString(),dateBasis:'按各账号固定打卡时区统计；D1/D7仅纳入目标本地日已完整结束的队列',registeredUsers:users.length,usersWithCheckin:users.filter(user=>user.days.size).length,checkedInToday:users.filter(user=>user.days.has(user.today)).length,weeklyCheckinUsers:users.filter(user=>[...user.days].some(day=>day>=user.since)).length,weeklyThreeDayUsers:users.filter(user=>[...user.days].filter(day=>day>=user.since).length>=3).length,firstCheckinRetention:{day1:retention(1),day7:retention(7)},contentThenCheckin24h:{matureConsumers:consumedUsers.size,convertedUsers:converted.size,rate:consumedUsers.size?Math.round(converted.size/consumedUsers.size*1000)/1000:null,interpretation:'关联而非因果，不代表内容造成了打卡提升'}};
}
module.exports={productMetrics};
