(function () {
  const root = document.documentElement;
  let frame = 0, restingHeight = window.innerHeight;
  function updateViewport() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const viewport = window.visualViewport;
      // Pinch zoom is an accessibility action, not a software keyboard resize.
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
      const focused = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]');
      const height = viewport?.height || window.innerHeight;
      if (!focused) restingHeight = window.innerHeight;
      const keyboard = !!focused && Math.max(restingHeight, window.innerHeight) - height > 120;
      root.style.setProperty('--app-height', `${Math.round(height)}px`);
      root.style.setProperty('--viewport-top', `${Math.round(viewport?.offsetTop || 0)}px`);
      root.dataset.keyboard = keyboard ? 'open' : 'closed';
    });
  }
  window.visualViewport?.addEventListener('resize', updateViewport);
  window.visualViewport?.addEventListener('scroll', updateViewport);
  window.addEventListener('resize', updateViewport);
  document.addEventListener('focusin', updateViewport);
  document.addEventListener('focusout', () => setTimeout(updateViewport, 100));
  window.addEventListener('orientationchange', () => { restingHeight = 0; setTimeout(updateViewport, 250); });
  updateViewport();

  function connection() { root.dataset.connection = navigator.onLine === false ? 'offline' : 'online'; }
  window.addEventListener('online', connection);
  window.addEventListener('offline', connection);
  connection();
  if ('serviceWorker' in navigator && window.isSecureContext && !window.webkit?.messageHandlers?.quittrNative) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
})();

function MobileInstallHelp() {
  const [open, setOpen] = useState(false);
  const native = !!window.webkit?.messageHandlers?.quittrNative;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (native) return h('button', { type: 'button', className: 'auth-link', onClick: () => window.webkit.messageHandlers.quittrNative.postMessage('settings') }, '服务器连接设置');
  if (standalone) return null;
  return h('div', { className: 'mobile-install' },
    h('button', { type: 'button', className: 'auth-link', 'aria-expanded': open, onClick: () => setOpen(value => !value) }, '在 iPhone 上添加到主屏幕 ↗'),
    open && h('div', { className: 'install-instructions' }, h('strong', null, '把 Quittr 放到主屏幕'),
      h('p', null, '用 iPhone 的 Safari 打开此服务，轻点分享按钮，选择「添加到主屏幕」，再轻点「添加」。'),
      h('p', null, '手机需能连接到这台服务器。主屏幕版本可能需要重新登录，同一账号的记录会自动恢复。')));
}
