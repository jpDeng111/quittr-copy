const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, generateKeyPairSync, randomBytes, sign } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../storage');
const { createAuth } = require('../auth');
const { createLoginProviders } = require('../login-providers');

const origin = 'https://quittr.example.test';
const proofOf = value => createHash('sha256').update(value).digest('base64url');
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), alg: 'RS256', kid: 'test-key' };
function jwt(claims) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = encode({ alg: 'RS256', kid: jwk.kid }) + '.' + encode(claims);
  return unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
}

function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quittr-identity-'));
  const store = createStore(path.join(dir, 'test.sqlite'));
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const responses = new Map();
  const trace = [];
  const service = 'VA' + 'a'.repeat(32);
  const verification = 'VE' + 'b'.repeat(32);
  let sentTo;
  const env = {
    QUITTR_APPLE_CLIENT_ID: 'apple.test', QUITTR_APPLE_CLIENT_SECRET: 'apple-test-secret',
    QUITTR_GOOGLE_CLIENT_ID: 'google.test', QUITTR_GOOGLE_CLIENT_SECRET: 'google-test-secret',
    QUITTR_TWILIO_ACCOUNT_SID: 'AC' + 'c'.repeat(32), QUITTR_TWILIO_AUTH_TOKEN: 'test-sms-token',
    QUITTR_TWILIO_VERIFY_SERVICE_SID: service
  };
  const providers = createLoginProviders({ env, origin, request: async (url, requestOptions) => {
    trace.push([url, requestOptions]);
    const { body } = requestOptions;
    if (url.endsWith('/certs') || url.endsWith('/keys')) return Response.json({ keys: [jwk] });
    if (url.endsWith('/token')) return Response.json({ id_token: responses.get(body.get('code')) });
    if (url === `https://verify.twilio.com/v2/Services/${service}/Verifications`) {
      assert.equal(body.get('Channel'), 'sms');
      sentTo = body.get('To');
      return Response.json({ sid: verification, status: 'pending' });
    }
    assert.equal(url, `https://verify.twilio.com/v2/Services/${service}/VerificationCheck`);
    assert.equal(body.get('VerificationSid'), verification);
    return Response.json({ sid: verification, to: sentTo, status: body.get('Code') === '123456' ? 'approved' : 'pending' });
  } });
  const auth = createAuth(store, { origin, providers, secure: true, ...options });
  const request = (cookie, remoteAddress = 'test-ip') => ({ headers: { cookie }, socket: { remoteAddress } });
  function call(action, body, cookie) {
    const headers = {};
    const result = auth.handle(action, request(cookie), { setHeader: (key, value) => { headers[key] = value; } }, body);
    return result.then(data => ({ ...data, cookie: headers['Set-Cookie']?.split(';')[0] }));
  }
  async function oauth(provider, claims = {}, { cookie, native = false, link = false } = {}) {
    const verifier = randomBytes(32).toString('base64url');
    const { url } = await call('oauth/start', { provider, native, link, challenge: proofOf(verifier) }, cookie);
    const authorization = new URL(url);
    const code = randomBytes(16).toString('hex');
    const nonce = authorization.searchParams.get('nonce');
    responses.set(code, jwt({
      iss: provider === 'apple' ? 'https://appleid.apple.com' : 'https://accounts.google.com',
      aud: authorization.searchParams.get('client_id'),
      nonce, sub: 'verified-provider-subject', exp: Math.floor(Date.now() / 1000) + 60, ...claims
    }));
    const query = new URLSearchParams({ state: authorization.searchParams.get('state'), code });
    const callback = new URL(await auth.callback(provider, query));
    const result = native ? callback.searchParams : new URLSearchParams(callback.hash.slice(1));
    return { authorization, query, callback, verifier, ticket: result.get('ticket') };
  }
  return { auth, call, oauth, store, trace };
}

test('Google signs in only after verifying the request, token, and one-time handoff', async t => {
  const { auth, call, oauth, trace } = fixture(t);
  const start = await oauth('google', { email: 'new@example.com', email_verified: true });
  assert.equal(start.callback.origin, origin);
  assert.equal(start.authorization.searchParams.get('code_challenge_method'), 'S256');
  const exchange = trace.find(([url]) => url === 'https://oauth2.googleapis.com/token')[1].body;
  assert.equal(proofOf(exchange.get('code_verifier')), start.authorization.searchParams.get('code_challenge'));
  await assert.rejects(auth.callback('google', start.query), { status: 400 });
  await assert.rejects(call('oauth/finish', { ticket: start.ticket, verifier: 'a'.repeat(43) }), { status: 400 });
  const account = await call('oauth/finish', start);
  assert.equal(account.user.email, 'new@example.com');
  assert.equal(account.user.hasPassword, false);
  assert.equal((await call('session', {}, account.cookie)).user.id, account.user.id);
  await assert.rejects(call('oauth/finish', start), { status: 400 });
  await assert.rejects(call('login', { email: account.user.email, password: 'arbitrary' }), { status: 401 });
  const invalid = await oauth('google', { nonce: 'wrong' });
  assert.equal(invalid.ticket, null);
  assert.match(invalid.callback.hash, /loginFailed=1/);
});

test('Apple returns to iOS and explicitly links the existing account and records', async t => {
  const { call, oauth, store } = fixture(t);
  const email = 'existing@example.com';
  const legacy = await call('register', { email, password: 'some-existing-password' });
  store.write(legacy.user.id, { preferences: { theme: 'existing' }, relapses: [] });
  const claims = { email, email_verified: 'true' };
  const collision = await oauth('apple', claims);
  await assert.rejects(call('oauth/finish', collision), { status: 409 });
  const link = await oauth('apple', claims, { native: true, link: true, cookie: legacy.cookie });
  assert.equal(link.authorization.searchParams.get('response_mode'), 'form_post');
  assert.equal(link.callback.protocol, 'com.quittr.selfhosted.auth:');
  await assert.rejects(call('oauth/finish', link), { status: 401 });
  const linked = await call('oauth/finish', link, legacy.cookie);
  assert.equal(linked.user.id, legacy.user.id);
  assert.deepEqual(linked.methods, [{ provider: 'apple' }]);
  assert.equal(store.read(legacy.user.id).preferences.theme, 'existing');
  const subsequent = await oauth('apple', { email: 'private-relay@example.com', email_verified: 'true' });
  assert.equal((await call('oauth/finish', subsequent)).user.id, legacy.user.id);
});

test('SMS rejects bad or repeated codes and never exposes the phone number in the account session', async t => {
  const { call } = fixture(t);
  const { requestId, retryAfter } = await call('sms/start', { phone: '+86 138 0013 8000' });
  assert.equal(retryAfter, 60);
  await assert.rejects(call('sms/start', { phone: '+8613800138000' }), { status: 429 });
  await assert.rejects(call('sms/verify', { requestId, code: '000000' }), { status: 401 });
  const account = await call('sms/verify', { requestId, code: '123456' });
  assert.equal(account.user.email, null);
  assert.equal(account.user.hasPassword, false);
  const session = await call('session', {}, account.cookie);
  assert.deepEqual(session.methods, [{ provider: 'sms', last4: '8000' }]);
  assert.doesNotMatch(JSON.stringify(session), /13800138000/);
  await assert.rejects(call('sms/verify', { requestId, code: '123456' }), { status: 400 });
});
