const { createPublicKey, verify } = require('node:crypto');
const { failure } = require('./storage');

const oauthDefinition = {
  apple: {
    authorize: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    keys: 'https://appleid.apple.com/auth/keys',
    issuers: ['https://appleid.apple.com'],
    scope: 'email',
    mode: 'form_post'
  },
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    keys: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    scope: 'openid email',
    mode: 'query'
  }
};

function createLoginProviders({ env = process.env, origin = '', request = fetch } = {}) {
  const oauth = Object.create(null);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const [name, definition] of Object.entries(oauthDefinition)) {
    const clientId = env[`QUITTR_${name.toUpperCase()}_CLIENT_ID`];
    const secret = env[`QUITTR_${name.toUpperCase()}_CLIENT_SECRET`];
    if (!origin.startsWith('https://') || !clientId || !secret) continue;
    const redirect = `${origin}/auth/callback/${name}`;
    let keyset;
    let expires = 0;
    let loading;
    async function keys() {
      if (expires > Date.now() && keyset) return keyset;
      loading ??= request(definition.keys, { signal: AbortSignal.timeout(10000), redirect: 'error' }).then(async response => {
        if (!response.ok) throw Error('Could not fetch identity signing keys');
        const body = await response.json();
        if (!Array.isArray(body.keys)) throw Error('Invalid identity signing keys');
        const maxAge = Number(/\bmax-age=(\d+)/i.exec(response.headers.get('cache-control') || '')?.[1] || 0);
        keyset = body.keys;
        expires = Date.now() + Math.min(maxAge, 3600) * 1000;
        return keyset;
      }).finally(() => { loading = null; });
      return loading;
    }
    oauth[name] = {
      url({ state, nonce, pkce }) {
        const url = new URL(definition.authorize);
        url.search = new URLSearchParams({
          client_id: clientId, redirect_uri: redirect, response_type: 'code',
          response_mode: definition.mode, scope: definition.scope, state, nonce
        });
        if (name === 'google') {
          url.searchParams.set('code_challenge', pkce);
          url.searchParams.set('code_challenge_method', 'S256');
        }
        return url.href;
      },
      async exchange(code, flow) {
        const params = new URLSearchParams({
          client_id: clientId, client_secret: secret, redirect_uri: redirect,
          grant_type: 'authorization_code', code
        });
        if (name === 'google') params.set('code_verifier', flow.pkce_verifier);
        const response = await request(definition.token, { method: 'POST', body: params, signal: AbortSignal.timeout(10000), redirect: 'error' });
        if (!response.ok) throw Error('Could not exchange identity authorization code');
        const { id_token: token } = await response.json();
        if (typeof token !== 'string' || token.length > 16000) throw Error('Invalid identity token');
        const parts = token.split('.');
        if (parts.length !== 3 || !parts.every(part => /^[\w-]+$/.test(part))) throw Error('Invalid identity token');
        const [encodedHeader, encodedClaims, signature] = parts;
        const decode = part => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
        const header = decode(encodedHeader);
        if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw Error('Unsupported identity signature');
        const key = (await keys()).find(item => item.kty === 'RSA' && item.kid === header.kid && (!item.alg || item.alg === 'RS256'));
        if (!key || !verify('RSA-SHA256', Buffer.from(encodedHeader + '.' + encodedClaims),
          createPublicKey({ key, format: 'jwk' }), Buffer.from(signature, 'base64url'))) throw Error('Invalid identity signature');
        const claims = decode(encodedClaims);
        if (!definition.issuers.includes(claims.iss) || claims.aud !== clientId ||
          claims.nonce !== flow.nonce || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000 ||
          typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) throw Error('Invalid identity claims');
        const email = typeof claims.email === 'string' && claims.email.length <= 254 && emailPattern.test(claims.email)
          && [true, 'true'].includes(claims.email_verified) ? claims.email.toLowerCase() : null;
        return { subject: claims.sub, email };
      }
    };
  }
  const { QUITTR_TWILIO_ACCOUNT_SID: account, QUITTR_TWILIO_AUTH_TOKEN: token, QUITTR_TWILIO_VERIFY_SERVICE_SID: service } = env;
  let sms;
  if (/^AC[0-9a-f]{32}$/i.test(account || '') && token && /^VA[0-9a-f]{32}$/i.test(service || '')) {
    const authorization = 'Basic ' + Buffer.from(account + ':' + token).toString('base64');
    const base = `https://verify.twilio.com/v2/Services/${service}`;
    async function post(path, params) {
      const response = await request(base + path, { method: 'POST', headers: { Authorization: authorization },
        body: new URLSearchParams(params), signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok) {
        if (response.status === 404 && path === '/VerificationCheck') return {};
        throw failure(response.status === 429 ? 429 : 502, '短信服务暂时无法使用，请稍后重试。');
      }
      return response.json();
    }
    sms = {
      async start(phone) {
        const result = await post('/Verifications', { To: phone, Channel: 'sms', Locale: 'zh' });
        if (result.status !== 'pending' || !/^VE[0-9a-f]{32}$/i.test(result.sid || '')) throw failure(502, '短信服务暂时无法使用，请稍后重试。');
        return result.sid;
      },
      async verify(reference, phone, code) {
        const result = await post('/VerificationCheck', { VerificationSid: reference, Code: code });
        return result.status === 'approved' && result.sid === reference && result.to === phone;
      }
    };
  }
  return { oauth, sms };
}

module.exports = { createLoginProviders };
