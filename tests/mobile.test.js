const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('visual viewport follows keyboard height without mistaking pinch zoom for a keyboard', () => {
  const events = {}, styles = {}, dataset = {};
  let focused = false;
  const viewport = { height: 844, offsetTop: 0, scale: 1, addEventListener(name, handler) { events[`viewport:${name}`] = handler; } };
  const context = vm.createContext({
    document: { documentElement: { dataset, style: { setProperty(name, value) { styles[name] = value; } } }, activeElement: { matches: () => focused }, addEventListener(name, handler) { events[name] = handler; } },
    window: { innerHeight: 844, visualViewport: viewport, addEventListener(name, handler) { events[name] = handler; } },
    navigator: { onLine: true }, requestAnimationFrame(handler) { handler(); return 1; }, cancelAnimationFrame() {}, setTimeout(handler) { handler(); }
  });
  vm.runInContext(fs.readFileSync(require.resolve('../public/mobile.js'), 'utf8'), context);
  assert.equal(styles['--app-height'], '844px');
  focused = true; viewport.height = 480; viewport.offsetTop = 20; events['viewport:resize']();
  assert.equal(dataset.keyboard, 'open');
  assert.equal(styles['--app-height'], '480px');
  assert.equal(styles['--viewport-top'], '20px');
  viewport.scale = 2; viewport.height = 240; events['viewport:resize']();
  assert.equal(styles['--app-height'], '480px');
  viewport.scale = 1; viewport.height = 844; focused = false; events.focusout();
  assert.equal(dataset.keyboard, 'closed');
});

test('service worker never intercepts private API requests, writes or external resources', () => {
  const handlers = {};
  const context = vm.createContext({ self: { location: { origin: 'https://quittr.test' }, addEventListener(name, handler) { handlers[name] = handler; } }, URL });
  vm.runInContext(fs.readFileSync(require.resolve('../public/sw.js'), 'utf8'), context);
  for (const [method, url] of [['GET', '/api/account/export'], ['GET', '/api/quittr/journal'], ['POST', '/api/melius/chat'], ['GET', 'https://external.test/file']]) {
    let intercepted = false;
    handlers.fetch({ request: { method, url: new URL(url, 'https://quittr.test').href }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});
