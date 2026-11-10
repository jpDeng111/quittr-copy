const { createElement: h, useEffect, useState, useRef } = React;
const { createRoot } = ReactDOM;
const API_BASE = '';
const MELIUS_CHAT_ENDPOINT = '/api/melius/chat';
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
const SCENES = { morning: '早间咖啡', afternoon: '下午茶时间', meeting: '会议间隙', overtime: '加班之后', social: '聚餐分享', other: '生活里的其他时刻' };
const GOALS = { drink_swap: ['换一杯饮品', '点单时看看不额外加糖的选择'], pause: ['点单前停一分钟', '先分清是饿了、累了，还是想享用'], portion: ['分享一份喜欢的甜', '选择适合自己的份量，慢慢享用'], observe: ['先看见自己的习惯', '只记录，不急着做改变'] };
const CHECK_INS = { steady: '做了一个小调整', flexible: '有意识地享用了甜', reflect: '今天先看见自己' };
const NAV = [['today','sun','今日'],['records','journal','记录'],['chat','sparkles','陪伴'],['learn','book','小课'],['profile','profile','我的']];
const niceDate = date => new Date(date).toLocaleString('zh-CN', { timeZone: TIME_ZONE, month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
const localDay = date => new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));

function Icon({ name }) {
  const paths = {
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
    journal: 'M5 3h12a2 2 0 0 1 2 2v16H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Zm1 14h13M8 7h7M8 11h5',
    book: 'M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 1Zm0 0v16',
    sparkles: 'm12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z',
    profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 22v-2a8 8 0 0 1 16 0v2',
    plus: 'M12 5v14M5 12h14', 'chevron-left': 'm15 5-7 7 7 7', chevron: 'm9 5 7 7-7 7',
    close: 'm6 6 12 12M6 18 18 6', check: 'm4 12 5 5L20 6', 'check-circle': 'm7 12 3 3 7-7M21 12a9 9 0 1 1-5-8',
    cup: 'M5 8h12v7a6 6 0 0 1-12 0V8Zm12 1h2a3 3 0 0 1 0 6h-2M8 2v2m5-2v2',
    wind: 'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 17h6',
    send: 'm3 3 18 9-18 9 4-9-4-9Zm4 9h14', microphone: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-3 6v1a6 6 0 0 0 12 0v-1M12 18v4m-4 0h8',
    stop: 'M6 6h12v12H6Z', undo: 'M4 8h10a6 6 0 1 1-5 10M4 8l4-4M4 8l4 4', heart: 'M12 21S2 15 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 7-10 13-10 13Z',
    community: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7a4 4 0 0 1 0 8m3 4a4 4 0 0 1 2 4',
    clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z'
  };
  return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[name] || paths.sparkles}));
}
function App() {
  const [page,setPage] = useState('today');
  const [recordTab,setRecordTab] = useState('food');
  const [data,setData] = useState(null);
  const [journals,setJournals] = useState([]);
  const [error,setError] = useState('');
  const [dialog,setDialog] = useState(null);
  const [toast,setToast] = useState('');
  const [clock,setClock] = useState(Date.now());
  const daily = useDailyLessons(clock);
  const chat = useMeliusConversation(async actions => { if(actions.some(action => ['sugar','sugar_craving','journal','motivation'].includes(action.type))) await refresh(); });
  useEffect(()=>{ document.documentElement.dataset.page=page==='chat'?'melius':page; window.scrollTo(0,0); return()=>{delete document.documentElement.dataset.page;}; },[page]);
  useEffect(()=>{ refresh(); const timer=setInterval(()=>setClock(Date.now()),60000); return()=>clearInterval(timer); },[]);
  const day = localDay(clock);
  const dayRef = useRef(day);
  useEffect(()=>{ if(dayRef.current!==day){dayRef.current=day;refresh();} },[day]);
  useEffect(()=>{ if(!toast)return; const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer); },[toast]);
  useEffect(()=>{ document.body.classList.toggle('modal-open',!!dialog);return()=>document.body.classList.remove('modal-open'); },[dialog]);
  async function refresh() {
    try {
      const [next, journal] = await Promise.all([accountRequest(`/api/sugar/state?timeZone=${encodeURIComponent(TIME_ZONE)}`),accountRequest('/api/sugar/journal')]);
      setData(next);setJournals(journal.entries);setError('');
    } catch(err){setError(err.message);}
  }
  async function save(path,body) {
    const result=await accountRequest(path,{...body,timeZone:TIME_ZONE});
    if(result.summary)setData(result.summary);
    await refresh().catch(()=>{});setToast('已保存，今天的每一步都算数。');
    return result;
  }
  function action(route) {
    if(route.includes('breath')) {setDialog('breathe');return;}
    if(route==='journal'||route==='records'||route==='analytics'||route==='reasons'){setRecordTab(route==='journal'||route==='reasons'?'journal':route==='analytics'?'craving':'food');setPage('records');return;}
    if(route==='new entry'){setDialog('journal');return;}
    setPage('today');
  }
  const name=({today:'把今天，过得轻一点。',records:'每一次看见，都有意义。',chat:'和小轻聊一会儿',learn:'给忙碌生活的一点留白',profile:'按照自己的节奏来',community:'一起，做一点小改变'})[page];
  return h('main',{className:`app-shell sugar-shell ${page==='chat'?'chat-shell':''}`},
    page!=='chat'&&h('header',{className:'product-header'},h('a',{href:'/',className:'wordmark','aria-label':'轻甜首页'},h('span',{className:'brand-symbol'},'◒'),h('span',null,'轻甜',h('small',null,'LESS SUGAR, MORE LIFE'))),h('button',{className:'avatar-button',onClick:()=>setPage('profile'),'aria-label':'我的账号'},h(Icon,{name:'profile'}))),
    page!=='chat'&&h('section',{className:'page-heading'},h('p',{className:'eyebrow'},new Intl.DateTimeFormat('zh-CN',{timeZone:TIME_ZONE,month:'long',day:'numeric',weekday:'long'}).format(new Date(clock)),' / A LITTLE EVERYDAY'),h('h1',null,name)),
    error&&h('div',{className:'notice error-notice',role:'alert'},error,h('button',{onClick:refresh},'重试')),
    !data&&!error&&h('div',{className:'loading-state',role:'status'},'正在打开你的工作日记录…'),
    data&&page==='today'&&h(SugarToday,{data,daily,onDialog:setDialog,onPage:setPage}),
    data&&page==='records'&&h(SugarRecords,{data,journals,onDialog:setDialog,tab:recordTab,onTab:setRecordTab}),
    page==='chat'&&h(MeliusChatPage,{chat,onAction:action,onBack:()=>setPage('today')}),
    page==='learn'&&h(SugarLearning,{daily,onDialog:setDialog}),
    data&&page==='profile'&&h(React.Fragment,null,h(GoalSettings,{data,onSave:save}),h(AccountPanel,{analytics:{currentStreakLabel:`${data.activeDays} 天`},journalCount:journals.length})),
    page==='community'&&h(SugarCommunity),
    h('nav',{className:'bottom-nav','aria-label':'主导航'},NAV.map(([id,icon,label])=>h('button',{key:id,className:`nav-button ${page===id?'is-active':''}`,onClick:()=>setPage(id),'aria-label':label,'aria-current':page===id?'page':undefined},h(Icon,{name:icon}),h('span',{className:'nav-label'},label)))),
    dialog&&h(SugarDialog,{kind:dialog,checkIn:data?.checkIn,onClose:()=>setDialog(null),onSave:save}),
    toast&&h('div',{className:'toast',role:'status'},toast)
  );
}
function SugarToday({data,daily,onDialog,onPage}) {
  const goal=GOALS[data.preferences.goal]||GOALS.drink_swap;
  return h(React.Fragment,null,
    h('section',{className:'today-hero'},h('div',{className:'hero-copy'},h('span',{className:'pill'},'TODAY, AT YOUR OWN PACE'),h('h2',null,'少一点惯性，',h('br'),'多一点自己的选择。'),h('p',null,'不必告别所有甜。先从工作日里，',h('br'),'一个愿意尝试的小改变开始。'),h('button',{className:'primary-button',onClick:()=>onDialog('log')},h(Icon,{name:'plus'}),'记下这份甜')),h('div',{className:'tea-illustration','aria-hidden':true},h('div',{className:'tea-orbit'}),h('span',{className:'tea-leaf leaf-one'}),h('span',{className:'tea-leaf leaf-two'}),h('div',{className:'tea-cup'},h('span',{className:'tea-liquid'})),h('div',{className:'tea-saucer'}),h('span',{className:'tea-caption'},'make room for a little pause'))),
    h('div',{className:'section-title'},h('h2',null,'今天的小记'),h('button',{className:'text-button',onClick:()=>onPage('records')},'看记录 ↗')),
    h('section',{className:'daily-stats'},h('article',null,h('span',null,'已记录的添加糖'),h('strong',null,data.knownAddedCount?`${data.knownAddedGrams}`:'—',h('small',null,data.knownAddedCount?' g':'')),h('p',null,data.knownAddedCount?`${data.knownAddedCount} 条有明确添加糖量的记录`:'还没有明确的添加糖量')),h('article',null,h('span',null,'留意到的饮食时刻'),h('strong',null,data.todayLogCount,h('small',null,' 次')),h('p',null,`${data.unknownCount} 条糖量未知 · ${data.totalOnlyCount} 条仅有总糖`))),
    h('p',{className:'data-note'},'只汇总你明确填写的添加糖，不把标签总糖混入。记录不完整时，数值不是全天摄入量。',data.preferences.dailyTargetGrams!==null?` 你的个人参考值：${data.preferences.dailyTargetGrams} g / 天。`:''),
    h('section',{className:'goal-card'},h('span',{className:'line-icon'},h(Icon,{name:'sun'})),h('div',null,h('small',null,'我的工作日小目标'),h('h3',null,goal[0]),h('p',null,goal[1])),h('button',{className:'round-button',onClick:()=>onPage('profile'),'aria-label':'调整小目标'},h(Icon,{name:'chevron'}))),
    h('div',{className:'support-grid'},h('button',{className:'support-card sage',onClick:()=>onDialog('craving')},h(Icon,{name:'wind'}),h('strong',null,'现在有点想吃甜'),h('span',null,'花一分钟，看看自己需要什么'),h('small',null,'留一个暂停 →')),h('button',{className:'support-card cream',onClick:()=>onPage('chat')},h(Icon,{name:'sparkles'}),h('strong',null,'找小轻聊一聊'),h('span',null,'点单纠结、工作压力，都可以说'),h('small',null,'有个陪伴 →'))),
    h('section',{className:'checkin-card'},h('div',{className:'section-title'},h('h2',null,'今天，你想怎样记住它？'),h('span',{className:'tag'},data.checkIn?'已回顾':'不打分 · 不清零')),h('p',null,data.checkIn?CHECK_INS[data.checkIn.choice]:'做了调整、享用了甜，或者只是多了解自己一点，都值得被记录。'),h('button',{className:'secondary-button',onClick:()=>onDialog('check-in')},data.checkIn?'更新今天的回顾':'给今天留一句话',h(Icon,{name:'chevron'}))),
    h('section',{className:'lesson-teaser'},h('span',{className:'eyebrow'},'THREE MINUTES FOR YOURSELF'),h('div',null,h('div',null,h('h2',null,daily.lesson?.title?.replace(/\n/g,'')||'点单前，给自己一分钟。'),h('p',null,daily.generating?'正在准备专属小课…':'3 分钟 · 理解一个习惯，带走一个行动')),h('button',{className:'round-button',onClick:()=>onPage('learn'),'aria-label':'打开今日小课'},h(Icon,{name:'chevron'})))),
    h('button',{className:'community-invite',onClick:()=>onPage('community')},h(Icon,{name:'community'}),h('span',null,h('strong',null,'工作日的同路人'),h('small',null,'分享一个真实的小改变，不比较谁更自律。')),h(Icon,{name:'chevron'})),
    h('footer',{className:'product-footnote'},'少一点糖，不必少一点生活。')
  );
}
function SugarRecords({data,journals,onDialog,tab,onTab}) {
  const max=Math.max(1,...data.days.map(day=>day.count));
  const list=tab==='food'?data.logs:tab==='craving'?data.cravings:journals;
  return h(React.Fragment,null,
    h('section',{className:'week-card'},h('div',{className:'section-title'},h('h2',null,'最近七天，有在留意'),h('span',null,'饮食记录次数')),h('div',{className:'week-chart',role:'img','aria-label':data.days.map(day=>`${day.date} ${day.count}次记录`).join('；')},data.days.map(day=>h('div',{key:day.date,className:'week-day'},h('span',null,day.count),h('div',{className:'week-bar',style:{height:`${Math.max(4,day.count/max*76)}px`,opacity:day.count?1:.2}}),h('small',null,day.date.slice(5).replace('-','/'))))),h('p',{className:'data-note'},'空白只是没有记录，不代表零摄入。每次记录都让下一次选择更清楚。')),
    h('div',{className:'section-title'},h('h2',null,'你的工作日时间线'),h('button',{className:'text-button',onClick:()=>onDialog(tab==='journal'?'journal':tab==='craving'?'craving':'log')},'+ 新记录')),
    h('div',{className:'segmented',role:'tablist','aria-label':'记录类型'},[['food','饮食小记'],['craving','想吃甜的时刻'],['journal','心情日记']].map(([id,label])=>h('button',{key:id,role:'tab','aria-selected':tab===id,className:tab===id?'active':'',onClick:()=>onTab(id)},label))),
    list.length?list.map(entry=>h('article',{className:'timeline-entry',key:entry.id},h('span',{className:'entry-icon'},h(Icon,{name:tab==='food'?'cup':tab==='craving'?'wind':'journal'})),h('div',null,h('small',null,niceDate(entry.createdAt),' · ',SCENES[entry.scene]||'给自己的记录'),h('h3',null,entry.name||entry.title||(entry.feeling?'此刻的感受：'+entry.feeling:'留意到想吃甜的时刻')),h('p',null,tab==='food'?(entry.sugarKind==='unknown'?'糖量未知，先把这一刻记下来。':`${entry.sugarGrams} g ${entry.sugarKind==='added'?'添加糖':'标签总糖（不计入添加糖汇总）'}`):entry.body||entry.note||'没有补充文字'),entry.note&&tab==='food'&&h('p',null,entry.note),tab==='craving'&&h('span',{className:'tag'},`当时的渴望 ${entry.intensity}/5`)))):h('div',{className:'empty-state'},h(Icon,{name:'journal'}),h('h3',null,'这里，慢慢长出你的日常。'),h('p',null,'不必补一份完美的记录。从今天的一杯饮品、一句话开始。'),h('button',{className:'secondary-button',onClick:()=>onDialog(tab==='journal'?'journal':tab==='craving'?'craving':'log')},'留下一条记录')),
    data.checkIns.length>0&&h('section',{className:'checkin-history'},h('h3',null,'留给每天的一句话'),data.checkIns.slice(0,7).map(entry=>h('p',{key:entry.id},h('span',null,entry.date.slice(5),' · ',CHECK_INS[entry.choice]),entry.note&&h('small',null,entry.note))))
  );
}
function SugarDialog({kind,checkIn,onClose,onSave}) {
  const [name,setName]=useState(''),[scene,setScene]=useState('afternoon'),[sugarKind,setSugarKind]=useState('unknown'),[grams,setGrams]=useState('');
  const [note,setNote]=useState(kind==='check-in'?checkIn?.note||'':''),[intensity,setIntensity]=useState(3),[choice,setChoice]=useState(checkIn?.choice||'steady'),[feeling,setFeeling]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const requestId=useRef(crypto.randomUUID()),busyRef=useRef(false),startFocus=useRef(null);
  useEffect(()=>{const old=document.activeElement;startFocus.current?.focus();const key=e=>{if(e.key==='Escape'&&!busyRef.current)onClose();if(e.key==='Tab'){const buttons=Array.from(document.querySelector('.sugar-dialog').querySelectorAll('button:not(:disabled),input,textarea,select,a[href]'));const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);old?.focus();};},[]);
  if(kind==='breathe')return h(BreathingPause,{onClose});
  const title=({log:'记下这份甜',craving:'先陪自己一分钟',journal:'工作日的一小页','check-in':'今天，已经很好了'})[kind];
  async function submit(e){e.preventDefault();if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try{
    const path=kind==='log'?'logs':kind==='craving'?'cravings':kind==='journal'?'journal':'check-in';
    const body=kind==='log'?{name,scene,sugarKind,sugarGrams:sugarKind==='unknown'?null:Number(grams),note}:kind==='craving'?{scene,intensity,feeling,note}:kind==='journal'?{title:name,body:note}:{choice,note};
    await onSave('/api/sugar/'+path,{...body,clientId:requestId.current});onClose();
  }catch(err){setError(err.message);}finally{busyRef.current=false;setBusy(false);}}
  return h('div',{className:'dialog-backdrop',onClick:e=>{if(e.target===e.currentTarget&&!busyRef.current)onClose();}},h('section',{className:'sugar-dialog',role:'dialog','aria-modal':true,'aria-labelledby':'dialog-title'},h('header',null,h('div',null,h('span',{className:'eyebrow'},'A MOMENT, JUST FOR YOU'),h('h2',{id:'dialog-title'},title)),h('button',{ref:startFocus,className:'round-button',onClick:onClose,disabled:busy,'aria-label':'关闭'},h(Icon,{name:'close'}))),
    h('form',{onSubmit:submit},
      kind==='log'&&h(React.Fragment,null,h('p',{className:'muted'},'不判断好坏，也不需要把糖量猜准确。'),h('div',{className:'preset-row'},['奶茶','甜咖啡','分享的蛋糕','会议小零食'].map(value=>h('button',{type:'button',key:value,onClick:()=>setName(value)},value))),h('label',null,'食物或饮品',h('input',{value:name,onChange:e=>setName(e.target.value),required:true,maxLength:100,placeholder:'例如：一杯下午的拿铁'}))),
      kind==='journal'&&h('label',null,'给这一页起个名字（可选）',h('input',{value:name,onChange:e=>setName(e.target.value),maxLength:100,placeholder:'例如：忙碌之后，我需要的不是责备'})),
      ['log','craving'].includes(kind)&&h('label',null,'发生在什么时刻',h('select',{value:scene,onChange:e=>setScene(e.target.value)},Object.entries(SCENES).map(([id,label])=>h('option',{key:id,value:id},label)))),
      kind==='log'&&h(React.Fragment,null,h('label',null,'糖量的依据',h('select',{value:sugarKind,onChange:e=>{setSugarKind(e.target.value);setGrams('');}},h('option',{value:'unknown'},'不知道，先不填'),h('option',{value:'added'},'我有明确的添加糖数据'),h('option',{value:'total'},'包装上只有总糖数据'))),sugarKind!=='unknown'&&h('label',null,`${sugarKind==='added'?'添加糖':'标签总糖'}（这次份量，克）`,h('input',{type:'number',inputMode:'decimal',min:0,max:300,step:.1,required:true,value:grams,onChange:e=>setGrams(e.target.value),placeholder:'请按标签或明确来源填写'})),h('p',{className:'field-note'},'总糖不等于添加糖。没有明确数据就留空；不会根据奶茶甜度或杯型自动估算。')),
      kind==='craving'&&h(React.Fragment,null,h('p',{className:'muted'},'想吃甜不等于做错了。留意当时的需要，就多一个选择。'),h('fieldset',null,h('legend',null,'现在想吃甜的程度'),h('div',{className:'intensity-options'},[1,2,3,4,5].map(value=>h('button',{type:'button',key:value,className:intensity===value?'chosen':'','aria-pressed':intensity===value,onClick:()=>setIntensity(value)},value))),h('small',null,'1 = 一点点 · 5 = 很强烈')),h('label',null,'此刻的感受（可选）',h('input',{value:feeling,onChange:e=>setFeeling(e.target.value),maxLength:100,placeholder:'例如：累、饿，或只是很想享用'}))),
      kind==='check-in'&&h('div',{className:'checkin-options'},Object.entries(CHECK_INS).map(([id,label])=>h('button',{type:'button',key:id,className:choice===id?'chosen':'','aria-pressed':choice===id,onClick:()=>setChoice(id)},h(Icon,{name:choice===id?'check':'sun'}),label))),
      h('label',null,kind==='journal'?'写下一点感受':'想留给自己的一句话（可选）',h('textarea',{value:note,onChange:e=>setNote(e.target.value),required:kind==='journal',maxLength:kind==='journal'?5000:500,rows:3,placeholder:'此刻的需要、一个小选择，或者一句对自己的照顾。'})),
      error&&h('p',{className:'form-error',role:'alert'},error),h('button',{className:'primary-button full-width',type:'submit',disabled:busy},busy?'正在保存…':'保存这一刻'),kind==='craving'&&h('p',{className:'field-note'},'保存只记录你当下的感受，不会自动记录摄入或打卡。')
    )));
}
function BreathingPause({onClose}){
  const [seconds,setSeconds]=useState(0),[running,setRunning]=useState(false),closeRef=useRef(null);
  useEffect(()=>{closeRef.current?.focus();},[]);
  useEffect(()=>{if(!running)return;const timer=setInterval(()=>setSeconds(old=>{if(old>=59){setRunning(false);return 60;}return old+1;}),1000);return()=>clearInterval(timer);},[running]);
  return h('div',{className:'dialog-backdrop'},h('section',{className:'sugar-dialog breathing-dialog',role:'dialog','aria-modal':true,'aria-label':'一分钟呼吸暂停'},h('button',{ref:closeRef,className:'round-button close-breath',onClick:onClose,'aria-label':'关闭'},h(Icon,{name:'close'})),h('span',{className:'eyebrow'},'A LITTLE SPACE'),h('h2',null,'先不用解决，陪自己呼吸。'),h('p',null,'保持舒服、自然的节奏。随时可以停下来。'),h('div',{className:`breath-orb ${running?'running':''}`},h('span',null,seconds===60?'谢谢自己':running?(seconds%8<4?'轻轻吸气':'缓缓呼气'):'停一小会儿'),h('small',null,`${seconds} / 60 秒`)),h('button',{className:'primary-button full-width',onClick:()=>{setSeconds(0);setRunning(true);},disabled:running},seconds===60?'再陪自己一分钟':running?'跟随自己的节奏':'开始一分钟'),h('button',{className:'text-button',onClick:onClose},'带着这份平静回去')));
}
function GoalSettings({data,onSave}){
  const [goal,setGoal]=useState(data.preferences.goal),[target,setTarget]=useState(data.preferences.dailyTargetGrams??''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  async function submit(e){e.preventDefault();setBusy(true);setNotice('');try{await onSave('/api/sugar/preferences',{goal,dailyTargetGrams:target===''?null:Number(target)});setNotice('目标已更新。按自己的节奏，随时可以调整。');}catch(err){setNotice(err.message);}finally{setBusy(false);}}
  return h('section',{className:'goal-settings'},h('span',{className:'eyebrow'},'SMALL, POSSIBLE, YOURS'),h('h2',null,'给自己一个可执行的小目标'),h('form',{onSubmit:submit},h('div',{className:'goal-options'},Object.entries(GOALS).map(([id,[title,description]])=>h('button',{type:'button',key:id,className:goal===id?'chosen':'','aria-pressed':goal===id,onClick:()=>setGoal(id)},h('strong',null,title),h('small',null,description)))),h('label',null,'个人添加糖参考值（可选，克 / 天）',h('input',{type:'number',inputMode:'decimal',min:10,max:100,step:1,value:target,onChange:e=>setTarget(e.target.value),placeholder:'不设置也可以使用'})),h('p',{className:'field-note'},'这是你自己设置的参考值，不是医疗建议。未知记录与标签总糖都不会被算入。'),h('button',{className:'secondary-button full-width',disabled:busy},busy?'保存中…':'保存我的小目标'),notice&&h('p',{role:'status',className:'field-note'},notice)));
}
function SugarLearning({daily,onDialog}){
  const [index,setIndex]=useState(-1),[reflection,setReflection]=useState(''),[intention,setIntention]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const lesson=daily.lesson,card=lesson?.cards[index];
  useEffect(()=>{setIndex(-1);setReflection('');setIntention('');setNotice('');},[lesson?.id]);
  async function finish(){setBusy(true);try{await daily.complete(lesson,reflection,intention);setNotice('小课已读完。选中的行动只是尝试意向，不会记成已经做到。');setIndex(-1);}catch(err){setNotice(err.message);}finally{setBusy(false);}}
  return h('section',{className:'sugar-learning'},h('div',{className:'section-title'},h('span',{className:'tag'},lesson?.origin==='ai'?'专属小课':'精选入门'),h('button',{className:'text-button',disabled:daily.generating,onClick:()=>daily.regenerate()},daily.generating?'正在准备…':'换一节 ↻')),
    daily.error&&h('p',{className:'notice',role:'status'},daily.error),notice&&h('p',{className:'notice',role:'status'},notice),
    !lesson?h('p',null,'正在打开小课…'):index<0?h('article',{className:'lesson-cover'},h('span',{className:'eyebrow'},'LESS SUGAR · A LITTLE MORE SPACE'),h('div',{className:'lesson-flower','aria-hidden':true},'✳'),h('h2',null,lesson.title),h('p',null,lesson.subtitle),h('small',null,lesson.reason),h('button',{className:'primary-button',onClick:()=>setIndex(0)},lesson.completedAt?'再读一遍':'给自己三分钟',h(Icon,{name:'chevron'}))):h('article',{className:'learning-card'},h('div',{className:'reader-progress'},lesson.cards.map((item,i)=>h('span',{key:i,className:i<=index?'done':''}))),h('span',{className:'eyebrow'},card.label),h('h2',null,card.title),h('p',null,card.body),h('blockquote',null,card.highlight),card.steps?.length>0&&h('div',{className:'learning-steps'},card.steps.map(step=>index>=3?h('button',{key:step,className:(index===3?reflection:intention)===step?'chosen':'',onClick:()=>index===3?setReflection(step):setIntention(step)},step):h('p',{key:step},h(Icon,{name:'check'}),step))),h('div',{className:'lesson-navigation'},h('button',{className:'text-button',onClick:()=>setIndex(index-1)},'← 上一页'),h('button',{className:'primary-button',disabled:busy,onClick:()=>index===4?finish():setIndex(index+1)},busy?'保存中…':index===4?'带走一个小选择':'继续 →'))),
    h('div',{className:'knowledge-grid'},h('article',null,h('span',{className:'eyebrow'},'先分清，再选择'),h('h3',null,'添加糖 ≠ 标签总糖'),h('p',null,'标签总糖可能包含食物本身的糖。没有明确的添加糖数据时，不要把总糖直接当作添加糖。'),h('a',{href:'https://www.nhs.uk/live-well/eat-well/food-types/how-does-sugar-in-our-diet-affect-our-health/',target:'_blank',rel:'noopener noreferrer'},'来源：NHS · Sugar: the facts ↗')),h('article',null,h('span',{className:'eyebrow'},'留住正常的饮食'),h('h3',null,'不需要告别正餐和完整水果'),h('p',null,'轻甜关注添加糖的日常选择，不鼓励戒掉碳水或完整水果。蜂蜜、糖浆和果汁中的游离糖也不等于完整水果中的糖。'),h('a',{href:'https://www.who.int/news-room/detail/04-03-2015-who-calls-on-countries-to-reduce-sugars-intake-among-adults-and-children',target:'_blank',rel:'noopener noreferrer'},'来源：WHO · Sugars intake ↗'))),
    h('button',{className:'community-invite',onClick:()=>onDialog('breathe')},h(Icon,{name:'wind'}),h('span',null,h('strong',null,'忙碌里的呼吸暂停'),h('small',null,'不追求表现，只留一分钟给自己。')),h(Icon,{name:'chevron'}))
  );
}
function SugarCommunity(){
  const [posts,setPosts]=useState([]),[body,setBody]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  async function load(){try{setPosts((await accountRequest('/api/community/posts')).posts);}catch(err){setNotice(err.message);}}
  useEffect(()=>{load();},[]);
  async function publish(e){e.preventDefault();if(busy)return;setBusy(true);try{await accountRequest('/api/community/posts',{title:'今天的一个小改变',body});setBody('');await load();}catch(err){setNotice(err.message);}finally{setBusy(false);}}
  return h('section',{className:'sugar-community'},h('form',{className:'community-composer',onSubmit:publish},h('label',null,'分享一个工作日的小选择',h('textarea',{value:body,onChange:e=>setBody(e.target.value),maxLength:5000,required:true,rows:3,placeholder:'例如：今天和同事分享了一份喜欢的蛋糕。'})),h('p',{className:'field-note'},'发布后其他登录用户可见。私人日记和对话不会自动发布到这里。'),h('button',{className:'primary-button',disabled:busy},busy?'发布中…':'发布到同路人')),notice&&h('p',{role:'alert',className:'notice'},notice),posts.length?posts.map(post=>h('article',{className:'community-post',key:post.id},h('small',null,post.author,' · ',niceDate(post.createdAt)),h('h3',null,post.title),h('p',null,post.body),h('button',{className:'text-button',onClick:async()=>{try{await accountRequest('/api/community/like',{postId:post.id});await load();}catch(err){setNotice(err.message);}}},post.likedByMe?'♥':'♡',' ',post.likes,' 份支持'),h('details',null,h('summary',null,`${post.commentCount} 条回应`),post.comments.map(comment=>h('p',{key:comment.id},h('small',null,comment.author),'：',comment.text)),h(CommunityReply,{postId:post.id,onDone:load})))):h('p',{className:'empty-state'},'还没有分享。这里不需要完美的故事，一件真实的小事就很好。'));
}
function CommunityReply({postId,onDone}){const [text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);return h('form',{onSubmit:async e=>{e.preventDefault();if(busy)return;setBusy(true);try{await accountRequest('/api/community/comment',{postId,text});setText('');await onDone();}catch(err){setError(err.message);}finally{setBusy(false);}}},h('input',{'aria-label':'写一句回应',value:text,onChange:e=>setText(e.target.value),required:true,maxLength:2000,placeholder:'留一句平等、友好的支持'}),h('button',{className:'text-button',disabled:busy},'发送回应'),error&&h('p',{role:'alert'},error));}
async function sendMeliusMessage(messages, requestId, signal, onEvent) {
  const response = await fetch(MELIUS_CHAT_ENDPOINT, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, requestId, stream: true })
  });
  if (response.ok && response.headers.get("Content-Type")?.includes("text/event-stream")) {
    let result;
    await QuittrStream.consumeSSE(response.body, ({ event, data }) => {
      const value = JSON.parse(data);
      if (event === "error") { const error = new Error(value.error || "回复中断，请重新发送。"); error.actions = value.actions || []; throw error; }
      if (event === "done") result = value;
      else onEvent?.({ type: event, ...value });
    });
    if (!result) throw new Error("回复连接中断，请重新发送。已保存的记录不会重复。");
    return result;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "暂时没有收到回复，请重新发送。");
    error.actions = data.actions || [];
    throw error;
  }
  return data;
}

function getClientErrorMessage(error) {
  return error?.message || "小轻暂时无法回复，请稍后重试。";
}

createRoot(document.getElementById('root')).render(h(QuittrRoot));
