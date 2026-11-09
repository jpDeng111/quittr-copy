/* Authentication gates the application before any personal data is requested. */
window.QUITTR_ACCOUNT = null;

async function accountRequest(path, body) {
  const response = await fetch(path, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Quittr-Request': '1' }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试。');
  return data;
}

function QuittrRoot() {
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [account, setAccount] = useState(null);
  const [retry, setRetry] = useState(0);
  const channelRef = useRef(null);
  async function enter() {
    setPhase('loading'); setError('');
    try {
      const session = await accountRequest('/api/auth/session');
      setRegistrationOpen(session.registrationOpen);
      if (!session.user) { window.QUITTR_ACCOUNT = null; setAccount(null); setPhase('login'); return; }
      const bootstrap = await accountRequest('/api/account/bootstrap');
      window.QUITTR_ACCOUNT = bootstrap;
      setAccount(bootstrap); setPhase('app');
    } catch (err) { setError(err.message); setPhase('error'); }
  }
  useEffect(() => { enter(); }, [retry]);
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const url = new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href);
      if (url.origin === location.origin && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/') && window.QUITTR_ACCOUNT) {
        const headers = new Headers(args[1]?.headers || (typeof args[0] !== 'string' ? args[0].headers : undefined));
        headers.set('X-Quittr-Account', window.QUITTR_ACCOUNT.user.id);
        args[1] = { ...args[1], headers };
      }
      const response = await nativeFetch(...args);
      if (url.origin === location.origin && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/') && response.status === 401) {
        window.QUITTR_ACCOUNT = null; setAccount(null); setPhase('login'); setError('登录已过期，请重新登录。');
      }
      return response;
    };
    return () => { window.fetch = nativeFetch; };
  }, []);
  useEffect(() => {
    if (!window.BroadcastChannel) return;
    const channel = new BroadcastChannel('quittr-auth'); channelRef.current = channel;
    channel.onmessage = () => { window.QUITTR_ACCOUNT = null; setAccount(null); setPhase('login'); setError('账号状态已在其他页面更新，请重新登录。'); };
    return () => channel.close();
  }, []);
  useEffect(() => { if (phase !== 'app') document.body.classList.remove('modal-open'); }, [phase]);
  window.quittrSignOut = async () => {
    await accountRequest('/api/auth/logout', {});
    window.QUITTR_ACCOUNT = null; setAccount(null); setPhase('login'); setError('');
    channelRef.current?.postMessage('changed');
  };
  if (phase === 'app' && account) return h(React.Fragment, null,
    h('div', { className: 'connection-notice', role: 'status' }, '网络已断开，请连接到服务器后再保存记录。'), h(App, { key: account.user.id }));
  if (phase === 'login') return h(AuthScreen, { onAuthenticated: async () => { channelRef.current?.postMessage('changed'); await enter(); }, registrationOpen, notice: error });
  return h('main', { className: 'auth-shell' }, h('section', { className: 'auth-card', role: 'status' },
    h('span', { className: 'auth-brand' }, 'QUITTR'), h('h1', null, phase === 'error' ? '暂时无法连接' : '正在打开你的空间'),
    h('p', null, error || '正在恢复账号和记录…'), phase === 'error' && h('button', { className: 'auth-primary', onClick: () => setRetry(value => value + 1) }, '重新连接')));
}

function AuthScreen({ onAuthenticated, registrationOpen, notice }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice || '');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (mode === 'register' && password !== confirmation) { setError('两次输入的密码不一致。'); return; }
    setBusy(true); setError('');
    try { await accountRequest(`/api/auth/${mode}`, { email, password }); setPassword(''); setConfirmation(''); await onAuthenticated(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  function switchMode() { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setPassword(''); setConfirmation(''); }
  return h('main', { className: 'auth-shell' },
    h('section', { className: 'auth-intro' }, h('span', { className: 'auth-brand' }, '✦ QUITTR'),
      h('p', { className: 'auth-eyebrow' }, 'ONE DAY AT A TIME'), h('h1', null, '每一次改变，', h('br'), '都值得被记住。'),
      h('p', null, '记录感受、看见进步，与 Melius 一起走好今天。'),
      h('div', { className: 'auth-features' }, h('span', null, '日记与成长记录'), h('span', null, '随时接续的对话'), h('span', null, '属于你的个人空间'))),
    h('section', { className: 'auth-card' }, h('span', { className: 'auth-eyebrow' }, mode === 'login' ? 'WELCOME BACK' : 'A NEW BEGINNING'),
      h('h2', null, mode === 'login' ? '欢迎回来' : '创建你的账号'), h('p', null, mode === 'login' ? '登录后继续你的旅程。' : '从今天开始，为自己留一份记录。'),
      h('form', { onSubmit: submit },
        h('label', null, '邮箱', h('input', { type: 'email', name: 'email', autoComplete: 'username', required: true, maxLength: 254, value: email, onChange: event => setEmail(event.target.value), placeholder: 'you@example.com', disabled: busy })),
        h('label', null, '密码', h('input', { type: 'password', name: 'password', autoComplete: mode === 'login' ? 'current-password' : 'new-password', required: true, minLength: mode === 'register' ? 12 : 1, maxLength: 128, value: password, onChange: event => setPassword(event.target.value), placeholder: mode === 'register' ? '至少 12 位字符' : '输入你的密码', disabled: busy })),
        mode === 'register' && h('label', null, '确认密码', h('input', { type: 'password', name: 'confirmation', autoComplete: 'new-password', required: true, minLength: 12, maxLength: 128, value: confirmation, onChange: event => setConfirmation(event.target.value), placeholder: '再次输入密码', disabled: busy })),
        error && h('p', { className: 'auth-error', role: 'alert' }, error),
        h('button', { className: 'auth-primary', type: 'submit', disabled: busy }, busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并开始')),
      registrationOpen && h('button', { className: 'auth-link', type: 'button', onClick: switchMode, disabled: busy }, mode === 'login' ? '还没有账号？创建账号' : '已有账号？登录'),
      mode === 'login' && h('p', { className: 'auth-note' }, '忘记密码？请联系此服务的管理员重置。'),
      h('p', { className: 'auth-note' }, '记录保存在此服务的数据库中，登录同一账号即可在不同设备继续使用。'), h(MobileInstallHelp)));
}

function AccountPanel({ analytics, journalCount }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const user = window.QUITTR_ACCOUNT.user;
  async function changePassword(event) {
    event.preventDefault(); if (busy) return;
    if (password !== confirmation) { setNotice('两次输入的新密码不一致。'); return; }
    setBusy(true); setNotice('');
    try {
      const result = await accountRequest('/api/auth/password', { currentPassword, password });
      setCurrentPassword(''); setPassword(''); setConfirmation(''); setNotice(result.message);
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setNotice('');
    try { await window.quittrSignOut(); } catch (err) { setNotice(err.message); setBusy(false); }
  }
  return h('section', { className: 'account-panel' }, h('span', { className: 'auth-eyebrow' }, 'YOUR SPACE'), h('h1', null, '我的账号'),
    h('p', { className: 'account-email' }, user.email), h('p', { className: 'auth-note' }, `加入于 ${new Date(user.createdAt).toLocaleDateString()}`),
    h('div', { className: 'account-stats' }, h('div', null, h('strong', null, analytics?.currentStreakLabel || '0 days'), h('span', null, '当前坚持')), h('div', null, h('strong', null, journalCount), h('span', null, '日记'))),
    h('section', { className: 'account-section' }, h('h2', null, '数据与隐私'), h('p', null, '日记、会话、课程和游戏进度随账号保存。你可以下载自己的完整记录。'), h('a', { className: 'auth-link', href: '/api/account/export', download: 'quittr-data.json' }, '导出我的数据')),
    h('section', { className: 'account-section' }, h('h2', null, '修改密码'), h('form', { onSubmit: changePassword },
      h('label', null, '当前密码', h('input', { type: 'password', autoComplete: 'current-password', required: true, maxLength: 128, value: currentPassword, onChange: event => setCurrentPassword(event.target.value) })),
      h('label', null, '新密码', h('input', { type: 'password', autoComplete: 'new-password', required: true, minLength: 12, maxLength: 128, value: password, onChange: event => setPassword(event.target.value) })),
      h('label', null, '确认新密码', h('input', { type: 'password', autoComplete: 'new-password', required: true, minLength: 12, maxLength: 128, value: confirmation, onChange: event => setConfirmation(event.target.value) })),
      h('button', { className: 'auth-primary', type: 'submit', disabled: busy }, busy ? '请稍候…' : '更新密码'))),
    notice && h('p', { className: 'auth-notice', role: 'status' }, notice),
    h(MobileInstallHelp),
    h('button', { type: 'button', className: 'account-signout', disabled: busy, onClick: logout }, '退出登录'));
}
