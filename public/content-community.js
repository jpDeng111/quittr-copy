/* Public content is always an explicit, editable publication, never a private transcript. */
const COMMUNITY_KINDS = { experience: '经验', tutorial: '小课', audio: '声音' };
function lessonShareContent(lesson) {
  return { kind: 'tutorial', provenance: lesson.origin === 'ai' ? 'ai' : 'personal', title: lesson.title.replace(/\n/g, ''), body: lesson.cards.map(card => [card.title.replace(/\n/g, ''), card.body, ...card.steps.map((step,index) => `${index+1}. ${step}`), `记住：${card.highlight}`].join('\n')).join('\n\n') };
}
function CommunityShareButton({ content, label = '分享给社区 ↗' }) {
  const [open,setOpen]=useState(false),[message,setMessage]=useState('');
  return h(React.Fragment,null,h('button',{type:'button',className:'community-share-entry',onClick:()=>setOpen(true)},label),message&&h('small',{className:'community-share-notice',role:'status'},message),open&&h(CommunityComposer,{initial:content,onClose:()=>setOpen(false),onSaved:post=>{setMessage(post.status==='pending'?'已提交审核，通过后会在社区展示。':'已分享，大家可以看到了。');setOpen(false);}}));
}
function CommunityComposer({ initial = {}, onClose, onSaved }) {
  const [title,setTitle]=useState(initial.title||''),[body,setBody]=useState(initial.body||''),[kind,setKind]=useState(initial.kind||'experience'),[ai,setAI]=useState(initial.provenance==='ai'),[consent,setConsent]=useState(false),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const ref=useRef(null),busyRef=useRef(false),uploadedRef=useRef(null);
  useEffect(()=>{const previous=document.activeElement;ref.current?.querySelector('input')?.focus();return()=>previous?.focus?.();},[]);
  async function submit(event){
    event.preventDefault();if(busyRef.current)return;if(!consent){setError('请先确认公开范围与内容权限。');return;}
    busyRef.current=true;setBusy(true);setError('');
    try{
      let audioId;
      if(kind==='audio'){
        if(!file)throw new Error('请选择音频文件。');if(file.size>8*1024*1024)throw new Error('音频文件应小于8 MB。');
        if(uploadedRef.current?.file===file) audioId=uploadedRef.current.audioId;
        else {
        const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('音频读取失败。'));reader.readAsDataURL(file);});
        audioId=(await accountRequest('/api/community/audio',{data,consent:true})).audioId; uploadedRef.current={file,audioId};
        }
      }
      const {post}=await accountRequest('/api/community/posts',{title,body,kind,audioId,provenance:ai?'ai':'personal',consent:true});onSaved(post);
    }catch(err){setError(err.message);}finally{busyRef.current=false;setBusy(false);}
  }
  return h('div',{className:'community-publish-overlay',onKeyDown:event=>{
    if(event.key==='Escape'&&!busy)onClose();
    if(event.key==='Tab'){const items=[...ref.current.querySelectorAll('button:not(:disabled),input,textarea,select')];const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  }},h('form',{ref,className:'community-publish-sheet',role:'dialog','aria-modal':true,'aria-label':'公开分享预览',onSubmit:submit},
    h('header',null,h('div',null,h('small',null,'SOMETHING GOOD TO SHARE'),h('h2',null,'让一点好内容，陪到更多人。')),h('button',{type:'button',disabled:busy,onClick:onClose,'aria-label':'关闭分享'},'×')),
    h('p',{className:'publish-privacy-note'},'下方内容会分享给社区。请删去姓名、私人经历和不希望公开的细节。聊天原文、推荐原因与打卡记录不会被自动附带。'),
    h('label',null,'分享类型',h('select',{value:kind,disabled:busy,onChange:e=>setKind(e.target.value)},Object.entries(COMMUNITY_KINDS).map(([value,label])=>h('option',{key:value,value},label)))),
    h('label',null,'标题',h('input',{value:title,required:true,maxLength:100,onChange:e=>setTitle(e.target.value),disabled:busy})),
    h('label',null,'公开内容',h('textarea',{value:body,required:true,maxLength:5000,rows:8,onChange:e=>setBody(e.target.value),disabled:busy})),
    kind==='audio'&&h('label',null,'音频文件 · MP3 / WAV，最多 8 MB',h('input',{type:'file',accept:'.mp3,.wav,audio/mpeg,audio/wav',disabled:busy,onChange:e=>setFile(e.target.files[0]||null)})),
    h('label',{className:'publish-check'},h('input',{type:'checkbox',checked:ai,onChange:e=>setAI(e.target.checked),disabled:busy}),'使用了 AI 辅助创作'),
    h('label',{className:'publish-check'},h('input',{type:'checkbox',checked:consent,onChange:e=>setConsent(e.target.checked),disabled:busy}),'我已检查公开内容，并拥有文字／音频的分享权限。'),
    h('small',{className:'publish-review-note'},kind==='experience'?'经验分享发布后可撤回；请尊重每个人的节奏。':'小课与声音先进入运营审核，通过后才对其他用户可见。'),error&&h('p',{className:'auth-error',role:'alert'},error),
    h('button',{className:'community-publish-submit',type:'submit',disabled:busy||!consent||!title.trim()||!body.trim()},busy?'正在提交…':kind==='experience'?'确认公开分享':'确认提交审核')));
}
function SharedContentControls({ post, onChange = ()=>{} }) {
  const [message,setMessage]=useState(''),[reason,setReason]=useState(''),[reportOpen,setReportOpen]=useState(false),[busy,setBusy]=useState(false);
  async function act(path,body){if(busy)return;setBusy(true);setMessage('');try{const result=await accountRequest('/api/community/'+path,{postId:post.id,...body});if(result.post)onChange(result.post);setMessage(path==='save'?(result.post.savedByMe?'已收藏。':'已取消收藏。'):path==='consume'?'已记录这次学习。':path==='withdraw'?'已撤回，其他用户不再可见。':'已提交举报，运营会查看。');setReportOpen(false);}catch(err){setMessage(err.message);}finally{setBusy(false);}}
  return h('div',{className:'shared-content-controls'},
    post.audio&&h('audio',{controls:true,preload:'none',src:post.audio.url,'aria-label':post.title,onEnded:()=>act('consume',{kind:'listen'})}),
    h('div',{className:'shared-content-actions'},h('button',{type:'button',disabled:busy,onClick:()=>act('save',{})},post.savedByMe?'已收藏 ✓':'收藏 +'),post.status==='published'&&post.kind==='tutorial'&&h('button',{type:'button',disabled:busy,onClick:()=>act('consume',{kind:'read'})},'我读完了 ✓'),post.isOwner?h('button',{type:'button',disabled:busy||post.status==='withdrawn',onClick:()=>act('withdraw',{})},'撤回分享'):h('button',{type:'button',disabled:busy,onClick:()=>setReportOpen(value=>!value)},'举报')),
    reportOpen&&h('form',{onSubmit:e=>{e.preventDefault();act('report',{reason});},className:'content-report-form'},h('input',{value:reason,required:true,maxLength:500,onChange:e=>setReason(e.target.value),placeholder:'说明问题，例如不当内容、侵权或虚假信息','aria-label':'举报原因'}),h('button',{type:'submit',disabled:busy||!reason.trim()},'提交举报')),
    message&&h('small',{role:'status',className:'shared-content-message'},message),
    message==='已记录这次学习。'&&h(CheckinReturnButton,{label:'带着这点理解，回去打卡 ↗'}));
}
function CommunityReviewItem({ post, onUpdated }) {
  const [note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function review(action){if(busy)return;setBusy(true);setError('');try{await accountRequest('/api/community/moderate',{postId:post.id,action,note});onUpdated();}catch(err){setError(err.message);}finally{setBusy(false);}}
  return h('article',{className:'community-review-card'},h('small',null,`${COMMUNITY_KINDS[post.kind]} · ${post.status==='pending'?'等待审核':'被举报'}`),h('h3',null,post.title),h('p',null,post.body),post.audio&&h('audio',{controls:true,preload:'none',src:post.audio.url}),post.reports?.map((report,i)=>h('p',{key:i,className:'review-report'},'举报：',report.reason)),h('input',{value:note,maxLength:500,onChange:e=>setNote(e.target.value),placeholder:'审核说明（拒绝／下架时必填）','aria-label':'审核说明'}),h('div',null,h('button',{type:'button',disabled:busy,onClick:()=>review('approve')},'通过 / 保留'),h('button',{type:'button',disabled:busy||!note.trim(),onClick:()=>review('reject')},'拒绝 / 下架')),error&&h('p',{role:'alert'},error));
}
function CommunityHub({ onAction }) {
  const [kind,setKind]=useState(''),[filter,setFilter]=useState('new'),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[posts,setPosts]=useState([]),[canModerate,setCanModerate]=useState(false),[queue,setQueue]=useState(null),[compose,setCompose]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;setLoading(true);accountRequest('/api/community/posts?'+new URLSearchParams({kind,filter,query:search})).then(result=>{if(active){setPosts(result.posts);setCanModerate(result.canModerate);setError('');}}).catch(err=>{if(active)setError(err.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[kind,filter,search,revision]);
  async function loadQueue(){try{setQueue((await accountRequest('/api/community/moderation')).posts);}catch(err){setError(err.message);}}
  const refresh=()=>{setRevision(value=>value+1);if(queue!==null)loadQueue();};
  return h('section',{className:'content-community'},
    h('header',{className:'content-community-heading'},h('span',null,'A LITTLE BETTER, TOGETHER'),h('h1',null,'把有用的改变，',h('br'),'分享给彼此。'),h('p',null,'一节小课，一段声音，一次真实的尝试。'),h('button',{type:'button',onClick:()=>setCompose(true)},'分享我的内容 ↗')),
    h('nav',{className:'content-kind-tabs','aria-label':'社区内容分类'},[['','全部'],['tutorial','小课'],['audio','声音'],['experience','经验']].map(([value,label])=>h('button',{key:value,type:'button','aria-pressed':kind===value,onClick:()=>setKind(value)},label))),
    h('div',{className:'content-feed-tools'},h('select',{'aria-label':'内容排序',value:filter,onChange:e=>setFilter(e.target.value)},h('option',{value:'new'},'精选与最新'),h('option',{value:'top'},'大家喜欢'),h('option',{value:'saved'},'我的收藏')),h('form',{onSubmit:e=>{e.preventDefault();setSearch(query);}},h('input',{value:query,maxLength:100,onChange:e=>setQuery(e.target.value),placeholder:'搜索想了解的内容','aria-label':'搜索社区内容'}),h('button',{type:'submit'},'搜索'))),
    canModerate&&h('button',{type:'button',className:'content-review-toggle',onClick:()=>queue===null?loadQueue():setQueue(null)},queue===null?'运营审核台 ↗':'收起审核台'),
    queue!==null&&h('section',{className:'community-review-panel','aria-label':'运营审核台'},h('h2',null,'审核与举报处理'),queue.length?queue.map(post=>h(CommunityReviewItem,{key:post.id,post,onUpdated:refresh})):h('p',null,'暂时没有待处理内容。')),
    error&&h('p',{role:'alert',className:'auth-error'},error),loading?h('p',{className:'content-feed-empty',role:'status'},'正在整理好内容…'):posts.length?h('div',{className:'content-feed-grid'},posts.map(post=>h('article',{key:post.id,className:`content-entry content-${post.kind}`},
      h('div',{className:'content-entry-top'},h('span',null,post.featured?'✧ 运营精选':COMMUNITY_KINDS[post.kind]),h('small',null,post.provenance==='ai'?'AI 辅助 · 作者整理':'原创分享')),
      h('button',{type:'button',className:'content-entry-open',onClick:()=>onAction(`community open ${post.id}`)},h('span',{className:'content-entry-art','aria-hidden':true},post.kind==='audio'?'♫':post.kind==='tutorial'?'✧':'↗'),h('h2',null,post.title),h('p',null,post.body.slice(0,125)+(post.body.length>125?'…':''))),
      post.status!=='published'&&h('p',{className:'content-review-status'},({pending:'审核中，仅自己可见',rejected:'未通过／已下架',withdrawn:'已撤回'})[post.status],post.reviewNote&&` · ${post.reviewNote}`),
      h('footer',null,h('small',null,post.author),h('span',null,`♡ ${post.likes} · ${post.commentCount} 条讨论`)),
      h(SharedContentControls,{post,onChange:updated=>setPosts(items=>items.map(item=>item.id===updated.id?updated:item))}),
      canModerate&&post.status==='published'&&h('button',{className:'content-feature-action',type:'button',onClick:async()=>{try{await accountRequest('/api/community/moderate',{postId:post.id,action:post.featured?'unfeature':'feature'});refresh();}catch(err){setError(err.message);}}},post.featured?'取消精选':'加入运营精选')))):h('div',{className:'content-feed-empty'},h('span',null,'✧'),h('h2',null,'好内容，从一次真实的分享开始。'),h('p',null,'还没有匹配的分享。可以先收藏一段声音，或分享帮助过自己的小课。')),
    h('p',{className:'content-community-footnote'},'内容用于经验交流与日常支持。支持举报与撤回；不展示用户邮箱，不公开私人打卡与对话。'),
    compose&&h(CommunityComposer,{onClose:()=>setCompose(false),onSaved:()=>{setCompose(false);refresh();}}));
}
