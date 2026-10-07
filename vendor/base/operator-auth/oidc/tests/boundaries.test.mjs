import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, config } from './runtime.mjs';
import { keys } from './idp.mjs';
import { createOidcClient } from '../index.mjs';
const rsa = await keys();
async function fixture(t, opts = {}, cfg = {}) { const r = await runtime(rsa, opts, cfg); t.after(() => r.close()); return r; }

test('inactive membership, reactivation fences and revoke use the core store', async t => {
  const r = await fixture(t, { claims: { email: 'member@example.com' } }); const owner = await r.bootstrap();
  r.sqlite.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('member','member@example.com','Member','member','active',1,?)").run(Date.now());
  const ownerRequest = r.request('/auth/operator/status', { method: 'POST', cookie: owner.cookie.split(';')[0] });
  const f = await r.flow(); const ok = await r.finish(f); assert.equal(ok.status, 303);
  const cookie = ok.headers.getSetCookie().find(s => s.startsWith('__Host-operator_session=')).split(';')[0];
  const sessionRequest = r.request('/auth/session', { cookie });
  const session = await r.auth.getSession(sessionRequest); assert.equal(session.operator.id, 'member');
  await r.auth.setOperatorStatus(ownerRequest, 'member', 'inactive');
  assert.equal(await r.auth.getSession(sessionRequest), null);
  assert.equal((await r.finish(await r.flow())).status, 403);
  await r.auth.setOperatorStatus(ownerRequest, 'member', 'active');
  assert.equal(await r.auth.getSession(sessionRequest), null);
  const fresh = await r.finish(await r.flow()); const freshCookie = fresh.headers.getSetCookie().find(s => s.startsWith('__Host-operator_session=')).split(';')[0];
  const freshSession = await r.auth.getSession(r.request('/auth/session', { cookie: freshCookie }));
  await r.auth.revokeSession(ownerRequest, freshSession.id);
  assert.equal(await r.auth.getSession(r.request('/auth/session', { cookie: freshCookie })), null);
});

test('issuer/subject binding cannot migrate to a different admitted email', async t => {
  const options = {}; const r = await fixture(t, options); await r.bootstrap(); assert.equal((await r.finish(await r.flow())).status, 303);
  r.sqlite.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('member','member@example.com','Member','member','active',1,?)").run(Date.now());
  options.claims = { email: 'member@example.com' };
  assert.equal((await r.finish(await r.flow())).status, 403);
});

test('code exchange failure consumes once; IdP error descriptions are never reflected', async t => {
  const r = await fixture(t); await r.bootstrap();
  const failed = await r.flow(); r.provider.grants.delete(failed.code);
  assert.equal((await r.finish(failed)).status, 502);
  assert.equal((await r.finish(failed)).status, 400);
  const declined = await r.flow();
  const response = await r.finish({ ...declined, path: `/auth/oidc/callback?state=${declined.state}&error=access_denied&error_description=private-idp-message&error_uri=https://evil.example` });
  assert.equal(response.status, 401); assert.equal(await response.text(), '{"error":"oidc_provider_denied"}'); assert.equal(response.headers.get('location'), null);
});

test('fresh JWKS enables rotation and substitution under same kid fails', async t => {
  const replacement = await keys(); const options = { signingKey: replacement, jwks: [replacement.public] };
  const r = await fixture(t, options); await r.bootstrap(); assert.equal((await r.finish(await r.flow())).status, 303);
  options.signingKey = rsa; options.jwks = [{ ...replacement.public, kid: rsa.public.kid }];
  assert.equal((await r.finish(await r.flow())).status, 400);
});

test('slow body and redirecting token exchange are bounded and fail closed', async t => {
  for (const behavior of ['body', 'redirect']) {
    const r = await fixture(t, { transport: async uri => uri.endsWith('/token') ? behavior === 'redirect' ? Response.redirect('https://evil.example', 307) : new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } }) : null }, { timeoutMs: 100 });
    await r.bootstrap(); const f = await r.flow(); const start = Date.now();
    const response = await r.finish(f); assert.equal(response.status, 502); assert.ok(Date.now() - start < 2000);
    assert.equal((await r.finish(f)).status, 400);
  }
});

test('local browser origin is explicit loopback only, providers always HTTPS', async t => {
  const r = await fixture(t);
  for (const invalid of [{ origin: 'http://app.example' }, { local: true }, { issuer: 'http://idp.example' }, { redirectUri: 'https://evil.example/callback' }, { algorithms: ['HS256'] }, { tokenAuthMethod: 'private_key_jwt' }, { transactionSecret: 'short' }]) {
    assert.throws(() => createOidcClient({ db: r.db, auth: r.auth, clientIp: () => '192.0.2.1', config: { ...config, ...invalid } }), e => e.code === 'oidc_invalid_configuration');
  }
  const local = createOidcClient({ db: r.db, auth: r.auth, clientIp: () => '192.0.2.1', fetch: r.provider.fetch, config: { ...config, local: true, origin: 'http://localhost:4321', redirectUri: 'http://localhost:4321/auth/oidc/callback' } });
  const headers = { Host: 'localhost:4321', Origin: 'http://localhost:4321' };
  const good = await local.begin(new Request('http://localhost:4321/auth/oidc/start', { method: 'POST', headers }));
  assert.equal(good.status, 303); assert.match(good.headers.get('set-cookie'), /^oa_oidc_local_/); assert.ok(!good.headers.get('set-cookie').includes('; Secure'));
  const bad = await local.begin(new Request('http://localhost:4321/auth/oidc/start', { method: 'POST', headers: { Origin: 'http://localhost:4321' } })); assert.equal(bad.status, 403);
});

test('multiple audiences require explicit trust of every extra audience plus matching azp', async t => {
  const claims = { aud: ['client', 'api-resource'], azp: 'client' };
  const untrusted = await fixture(t, { claims }); await untrusted.bootstrap();
  assert.equal((await untrusted.finish(await untrusted.flow())).status, 400);
  const trusted = await fixture(t, { claims }, { additionalAudiences: ['api-resource'] }); await trusted.bootstrap();
  assert.equal((await trusted.finish(await trusted.flow())).status, 303);
});
