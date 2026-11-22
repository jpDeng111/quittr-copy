/* Authentication gates the application before any personal data is requested. */
window.QUITTR_ACCOUNT = null;
const providerLabels = { apple: 'Apple', google: 'Google', sms: '手机号' };
const oauthAttempt = 'quittr-oauth-verifier';

function usesNativeAuth() {
  return !!window.webkit?.messageHandlers?.quittrNative;
}

async function completeOAuth(ticket) {
  const verifier = sessionStorage.getItem(oauthAttempt);
  sessionStorage.removeItem(oauthAttempt);
  if (!ticket || !verifier) throw new Error('授权未完成，请重试。');
  return accountRequest('/api/auth/oauth/finish', { ticket, verifier });
}

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
  const [providers, setProviders] = useState({});
  const [legacy, setLegacy] = useState(false);
  const [account, setAccount] = useState(null);
  const [retry, setRetry] = useState(0);
  const channelRef = useRef(null);
  const mobile = usesNativeAuth() || window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
  async function enter() {
    setPhase('loading'); setError('');
    let authNotice = '';
    const result = new URLSearchParams(location.hash.slice(1));
    if (result.has('ticket') || result.has('loginFailed')) {
      history.replaceState(null, '', location.pathname + location.search);
      try { await completeOAuth(result.get('ticket')); }
      catch (err) { authNotice = err.message; }
    }
    try {
      const session = await accountRequest('/api/auth/session');
      setRegistrationOpen(session.registrationOpen);
      setProviders(session.providers || {});
      if (!session.user) { window.QUITTR_ACCOUNT = null; setAccount(null); setPhase('login'); setError(authNotice); return; }
      const bootstrap = await accountRequest('/api/account/bootstrap');
      window.QUITTR_ACCOUNT = { ...bootstrap, providers: session.providers, methods: session.methods };
      setAccount(bootstrap); setPhase('app');
      if (authNotice) setError(authNotice);
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
    window.QUITTR_ACCOUNT = null; setAccount(null); setLegacy(false); setPhase('login'); setError('');
    channelRef.current?.postMessage('changed');
  };
  if (phase === 'app' && account) return h(React.Fragment, null,
    error && h('div', { className: 'auth-redirect-notice', role: 'status' }, error, h('button', { type: 'button', onClick: () => setError(''), 'aria-label': '关闭提示' }, '×')),
    h('div', { className: 'connection-notice', role: 'status' }, '网络已断开，请连接到服务器后再保存记录。'), h(App, { key: account.user.id }));
  if (phase === 'login') {
    const onAuthenticated = async () => { setLegacy(false); channelRef.current?.postMessage('changed'); await enter(); };
    if (mobile && !legacy) return h(MobileAuthScreen, { providers, notice: error, onAuthenticated, onLegacy: () => { setError(''); setLegacy(true); } });
    return h(AuthScreen, { onAuthenticated, registrationOpen: !mobile && registrationOpen, providers: mobile ? {} : providers,
      notice: error, onBack: mobile ? () => { setError(''); setLegacy(false); } : null });
  }
  return h('main', { className: 'auth-shell' }, h('section', { className: 'auth-card', role: 'status' },
    h('span', { className: 'auth-brand' }, 'QUITTR'), h('h1', null, phase === 'error' ? '暂时无法连接' : '正在打开你的空间'),
    h('p', null, error || '正在恢复账号和记录…'), phase === 'error' && h('button', { className: 'auth-primary', onClick: () => setRetry(value => value + 1) }, '重新连接')));
}

function MobileAuthScreen({ providers, onAuthenticated, onLegacy, notice }) {
  return h('main', { className: 'mobile-auth' },
    h('div', { className: 'mobile-auth-heading' },
      h('div', { className: 'mobile-auth-brand' }, h('img', { src: '/icons/icon-192.png', alt: '' }), h('span', null, 'Quittr')),
      h('h1', null, '给自己一点空间。'),
      h('p', null, '登录后接续你的打卡、日记和小课堂。')),
    h('section', { className: 'mobile-auth-card', 'aria-label': '登录方式' },
      h('h2', null, '开始你的旅程'),
      h(LoginMethods, { providers, onDone: onAuthenticated }),
      notice && h('p', { className: 'auth-error', role: 'alert' }, notice),
      h('button', { type: 'button', className: 'auth-link mobile-auth-legacy', onClick: onLegacy }, '已有邮箱账号？'), h(MobileInstallHelp)));
}

function LoginMethods({ providers, link = false, linked = [], onDone }) {
  const [step, setStep] = useState('options');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [requestId, setRequestId] = useState('');
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (deadline <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  useEffect(() => () => { delete window.quittrNativeAuthResult; }, []);

  async function startOAuth(provider) {
    if (busy) return;
    setError(''); setBusy(true);
    try {
      const base64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const verifier = base64(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = base64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      const native = usesNativeAuth();
      const { url } = await accountRequest('/api/auth/oauth/start', { provider, challenge, native, link });
      sessionStorage.setItem(oauthAttempt, verifier);
      if (!native) { location.assign(url); return; }
      window.quittrNativeAuthResult = async (ticket, message) => {
        try {
          if (ticket) await onDone(await completeOAuth(ticket));
          else { sessionStorage.removeItem(oauthAttempt); setError(message); }
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
      };
      window.webkit.messageHandlers.quittrNative.postMessage({ action: 'oauth', url });
    } catch (err) { setError(err.message); setBusy(false); }
  }
  function reset() { setError(''); setCode(''); setRequestId(''); setStep('options'); }
  async function sendCode(event) {
    event?.preventDefault();
    if (busy || remaining) return;
    setError(''); setBusy(true);
    try {
      const digits = phone.trim().replace(/[\s()-]/g, '');
      const recipient = /^1[3-9]\d{9}$/.test(digits) ? '+86' + digits : digits;
      const result = await accountRequest('/api/auth/sms/start', { phone: recipient, link });
      setRequestId(result.requestId); setCode(''); setPhone(recipient); setNow(Date.now());
      setDeadline(Date.now() + result.retryAfter * 1000); setStep('code');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function verifyCode(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try {
      const result = await accountRequest('/api/auth/sms/verify', { requestId, code });
      reset(); await onDone(result);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const labels = link
    ? { apple: '关联 Apple', google: '关联 Google', sms: '关联手机号' }
    : { apple: '通过 Apple 登录', google: '通过 Google 登录', sms: '用手机验证码登录' };
  return h('div', { className: 'login-methods' },
    step === 'options' ? h('div', { className: 'login-method-buttons' },
      Object.entries(labels).map(([provider, label]) => {
        const existing = linked.find(item => item.provider === provider);
        return h('button', { type: 'button', key: provider, className: 'login-method login-method-' + provider,
          disabled: busy || !providers[provider] || !!existing,
          onClick: () => { if (provider === 'sms') { setError(''); setStep('phone'); } else startOAuth(provider); } },
        h('span', null, label), existing ? h('small', null, existing.last4 ? '尾号 ' + existing.last4 : '已关联')
          : !providers[provider] ? h('small', null, '暂未开通') : null);
      })) : h('form', { className: 'login-phone', onSubmit: step === 'phone' ? sendCode : verifyCode },
    step === 'phone' ? h('label', null, '手机号', h('input', { value: phone, required: true, disabled: busy,
      onChange: event => { setPhone(event.target.value); setDeadline(0); }, type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '+86 请输入手机号', maxLength: 24 }))
      : h(React.Fragment, null, h('p', null, '验证码已发送至 ', phone),
        h('label', null, '短信验证码', h('input', { value: code, required: true, disabled: busy,
          onChange: event => setCode(event.target.value.replace(/\D/g, '')), type: 'text', inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: 10, minLength: 4 }))),
    h('button', { className: 'auth-primary', type: 'submit', disabled: busy || (step === 'phone' && !!remaining) },
      busy ? '请稍候…' : step === 'phone' ? '获取验证码' : link ? '确认关联' : '验证并登录'),
    step === 'code' && h('button', { className: 'auth-link', type: 'button', disabled: busy || !!remaining, onClick: sendCode },
      remaining ? remaining + ' 秒后可重发' : '重新发送验证码'),
    step === 'code' && h('button', { className: 'auth-link', type: 'button', disabled: busy, onClick: () => {
      setCode(''); setError(''); setRequestId(''); setStep('phone');
    } }, '更换手机号'),
    h('button', { className: 'auth-link', type: 'button', disabled: busy, onClick: reset }, '返回登录方式')),
    error && h('p', { className: 'auth-error', role: 'alert' }, error));
}

function AuthScreen({ onAuthenticated, registrationOpen, providers, notice, onBack }) {
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
      h('h2', null, onBack ? '找回原有记录' : mode === 'login' ? '欢迎回来' : '创建你的账号'),
      h('p', null, onBack ? '进入原账号后，可在「我的账号」里关联新的登录方式。' : mode === 'login' ? '登录后继续你的旅程。' : '从今天开始，为自己留一份记录。'),
      h('form', { onSubmit: submit },
        h('label', null, '邮箱', h('input', { type: 'email', name: 'email', autoComplete: 'username', required: true, maxLength: 254, value: email, onChange: event => setEmail(event.target.value), placeholder: 'you@example.com', disabled: busy })),
        h('label', null, '密码', h('input', { type: 'password', name: 'password', autoComplete: mode === 'login' ? 'current-password' : 'new-password', required: true, minLength: mode === 'register' ? 12 : 1, maxLength: 128, value: password, onChange: event => setPassword(event.target.value), placeholder: mode === 'register' ? '至少 12 位字符' : '输入你的密码', disabled: busy })),
        mode === 'register' && h('label', null, '确认密码', h('input', { type: 'password', name: 'confirmation', autoComplete: 'new-password', required: true, minLength: 12, maxLength: 128, value: confirmation, onChange: event => setConfirmation(event.target.value), placeholder: '再次输入密码', disabled: busy })),
        error && h('p', { className: 'auth-error', role: 'alert' }, error),
        h('button', { className: 'auth-primary', type: 'submit', disabled: busy }, busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并开始')),
      registrationOpen && h('button', { className: 'auth-link', type: 'button', onClick: switchMode, disabled: busy }, mode === 'login' ? '还没有账号？创建账号' : '已有账号？登录'),
      onBack && h('button', { className: 'auth-link', type: 'button', onClick: onBack, disabled: busy }, '返回登录方式'),
      Object.values(providers).some(Boolean) && h(LoginMethods, { providers, onDone: onAuthenticated }),
      mode === 'login' && h('p', { className: 'auth-note' }, '忘记密码？请联系此服务的管理员重置。'),
      h('p', { className: 'auth-note' }, '记录保存在此服务的数据库中，登录同一账号即可在不同设备继续使用。'), h(MobileInstallHelp)));
}

function AccountPanel({ analytics, journalCount }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [linked, setLinked] = useState(window.QUITTR_ACCOUNT.methods || []);
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
    h('p', { className: 'account-email' }, user.email || (linked[0] ? providerLabels[linked[0].provider] + (linked[0].last4 ? ' · 尾号 ' + linked[0].last4 : '') : '')),
    h('p', { className: 'auth-note' }, `加入于 ${new Date(user.createdAt).toLocaleDateString()}`),
    h('div', { className: 'account-stats' }, h('div', null, h('strong', null, analytics?.currentStreakLabel || '0 days'), h('span', null, '当前坚持')), h('div', null, h('strong', null, journalCount), h('span', null, '日记'))),
    h('section', { className: 'account-section' }, h('h2', null, '数据与隐私'), h('p', null, '日记、会话、课程和游戏进度随账号保存。你可以下载自己的完整记录。'), h('a', { className: 'auth-link', href: '/api/account/export', download: 'quittr-data.json' }, '导出我的数据')),
    h('section', { className: 'account-section' }, h('h2', null, '登录方式'),
      h(LoginMethods, { providers: window.QUITTR_ACCOUNT.providers || {}, link: true, linked, onDone: result => {
        window.QUITTR_ACCOUNT.methods = result.methods;
        setLinked(result.methods);
        setNotice('已关联到当前账号。');
      } })),
    user.hasPassword && h('section', { className: 'account-section' }, h('h2', null, '修改密码'), h('form', { onSubmit: changePassword },
      h('label', null, '当前密码', h('input', { type: 'password', autoComplete: 'current-password', required: true, maxLength: 128, value: currentPassword, onChange: event => setCurrentPassword(event.target.value) })),
      h('label', null, '新密码', h('input', { type: 'password', autoComplete: 'new-password', required: true, minLength: 12, maxLength: 128, value: password, onChange: event => setPassword(event.target.value) })),
      h('label', null, '确认新密码', h('input', { type: 'password', autoComplete: 'new-password', required: true, minLength: 12, maxLength: 128, value: confirmation, onChange: event => setConfirmation(event.target.value) })),
      h('button', { className: 'auth-primary', type: 'submit', disabled: busy }, busy ? '请稍候…' : '更新密码'))),
    notice && h('p', { className: 'auth-notice', role: 'status' }, notice),
    h(MobileInstallHelp),
    h('button', { type: 'button', className: 'account-signout', disabled: busy, onClick: logout }, '退出登录'));
}
