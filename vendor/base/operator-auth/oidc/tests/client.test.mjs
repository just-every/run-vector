import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, config } from './runtime.mjs';
import { keys } from './idp.mjs';
import { createOidcClient } from '../index.mjs';
const rsa = await keys();
const ec = await keys('ES256');
async function fixture(t, opts = {}, cfg = {}, key = rsa) { const r = await runtime(key, opts, cfg); t.after(() => r.close()); return r; }
async function denied(response, status = 400) { assert.equal(response.status, status, await response.clone().text()); assert.ok(!response.headers.get('set-cookie')?.includes('__Host-operator_session=')); }

test('real PKCE exchange + signed token + durable restart admits through real operator store', async t => {
  const r = await fixture(t); await r.bootstrap();
  const f = await r.flow('/app/tickets?mine=1');
  assert.notEqual(f.location.searchParams.get('nonce'), f.state);
  assert.notEqual(f.cookie.split('=')[1], f.state);
  assert.match(f.start.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
  const row = r.sqlite.prepare('SELECT * FROM oa_oidc_transactions').get();
  for (const secret of [f.state, f.cookie.split('=')[1], f.location.searchParams.get('nonce')]) assert.ok(!JSON.stringify(row).includes(secret));
  r.restart();
  const response = await r.finish(f); assert.equal(response.status, 303, await response.clone().text());
  assert.equal(response.headers.get('location'), '/app/tickets?mine=1');
  const sessionCookie = response.headers.getSetCookie().find(s => s.startsWith('__Host-operator_session='));
  const session = await r.auth.getSession(r.request('/app', { cookie: sessionCookie.split(';')[0] }));
  assert.equal(session.kind, 'oidc'); assert.equal(session.operator.email, 'owner@example.com');
  assert.equal(r.sqlite.prepare('SELECT COUNT(*) AS n FROM oa_operators').get().n, 1);
  assert.equal(r.sqlite.prepare('SELECT COUNT(*) AS n FROM oa_oidc_transactions').get().n, 0);
  await denied(await r.finish(f));
  assert.equal(r.provider.requests.filter(x => x.uri.endsWith('/token')).length, 1);
});

test('parallel callback claims once and maintains independent browser tabs', async t => {
  const r = await fixture(t); await r.bootstrap(); const a = await r.flow(); const b = await r.flow();
  const responses = await Promise.all([r.finish(a), r.finish(a)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [303, 400]);
  assert.equal((await r.finish(b)).status, 303);
});

test('wrong/missing/duplicate binding, duplicate state, swapped state cannot consume a valid login', async t => {
  const r = await fixture(t); await r.bootstrap(); const f = await r.flow(); const other = await r.flow();
  await denied(await r.finish(f, { cookie: undefined }));
  await denied(await r.finish(f, { cookie: other.cookie }));
  await denied(await r.finish(f, { cookie: `${f.cookie}; ${f.cookie}` }));
  await denied(await r.finish({ ...f, path: f.path + `&state=${f.state}` }));
  await denied(await r.finish({ ...f, path: f.path + `&code=${f.code}` }));
  assert.equal((await r.finish(f)).status, 303);
});

test('start requires exact Origin, host, POST; callback exact route and GET', async t => {
  const r = await fixture(t); await r.bootstrap();
  await denied(await r.call('/auth/oidc/start'), 405);
  await denied(await r.call('/auth/oidc/start', { method: 'POST', headers: { Origin: 'https://attacker.example' }, body: {} }), 403);
  await denied(await r.call('/auth/oidc/start', { method: 'POST', headers: { Host: 'attacker.example' }, body: {} }), 403);
  await denied(await r.call('/auth/oidc/start', { method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' }, body: {} }), 403);
  const f = await r.flow(); await denied(await r.finish(f, { method: 'HEAD' }), 405);
  await denied(await r.finish(f, { headers: { Host: 'attacker.example' } }), 403);
  assert.equal((await r.finish(f)).status, 303);
});

test('returnTo is saved and cannot be overwritten by callback', async t => {
  const r = await fixture(t); await r.bootstrap(); const f = await r.flow('https://evil.example');
  const response = await r.finish({ ...f, path: f.path + '&returnTo=https://evil.example' });
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/app');
});

test('unknown and inactive operators never join; native policy governs later session admission', async t => {
  const unknown = await fixture(t); const f = await unknown.flow(); await denied(await unknown.finish(f), 403);
  assert.equal(unknown.sqlite.prepare('SELECT COUNT(*) AS n FROM oa_operators').get().n, 0);
  const r = await fixture(t); await r.bootstrap();
  const f2 = await r.flow(); r.sqlite.prepare("UPDATE oa_operators SET email='another@example.com'").run();
  await denied(await r.finish(f2), 403);
});

for (const [name, options] of Object.entries({
  issuer: { claims: { iss: 'https://attacker.example' } }, audience: { claims: { aud: 'another-client' } },
  multipleAudienceNoAzp: { claims: { aud: ['client', 'other'] } }, azp: { claims: { azp: 'another-client' } },
  expired: { claims: { exp: 1 } }, futureIat: { claims: { iat: 9999999999, exp: 10000000000 } }, staleIat: { claims: { iat: 1 } },
  futureNbf: { claims: { nbf: 9999999999 } }, nonce: { claims: { nonce: '$other' } },
  unverifiedEmail: { claims: { email_verified: false } }, stringEmailVerified: { claims: { email_verified: 'true' } },
  badAtHash: { claims: { at_hash: 'invalid' } }, badCodeHash: { claims: { c_hash: 'invalid' } },
  signature: { corruptSignature: true }, none: { header: { alg: 'none' } }, hs256: { header: { alg: 'HS256' } },
  unknownKid: { header: { kid: 'other-key' } }, headerJwk: { header: { jwk: {} } }, headerJku: { header: { jku: 'https://attacker.example' } },
  critical: { header: { crit: [] } }, keyUse: { jwks: [{ ...rsa.public, use: 'enc' }] },
  duplicateKid: { jwks: [rsa.public, rsa.public] }, keyAlgorithm: { jwks: [{ ...rsa.public, alg: 'HS256' }] },
  keyOps: { jwks: [{ ...rsa.public, key_ops: ['sign', 'verify'] }] },
  wrongTokenType: { token: { token_type: 'mac' } },
})) test(`rejects ${name} and consumes the correlation before any retry`, async t => {
  const r = await fixture(t, options); await r.bootstrap(); const f = await r.flow(); const response = await r.finish(f);
  assert.ok(response.status >= 400); assert.ok(!response.headers.get('set-cookie')?.includes('__Host-operator_session='));
  await denied(await r.finish(f));
  assert.equal(r.sqlite.prepare("SELECT COUNT(*) AS n FROM oa_sessions WHERE kind='oidc'").get().n, 0);
});

test('ES256, public and client_secret_post clients are genuine protocol variations', async t => {
  for (const method of ['none', 'client_secret_post']) {
    const r = await fixture(t, { method }, { tokenAuthMethod: method, clientSecret: method === 'none' ? undefined : 'fixture-secret' }, ec);
    await r.bootstrap(); assert.equal((await r.finish(await r.flow())).status, 303);
  }
});

test('Microsoft style unverified email only works with explicit verified subject binding', async t => {
  const r = await fixture(t, { claims: { email_verified: undefined, email: 'mutable@untrusted.example' } }, { subjectEmails: { 'operator-subject': 'owner@example.com' } });
  await r.bootstrap(); assert.equal((await r.finish(await r.flow())).status, 303);
});

test('response issuer enforced when advertised, and mismatches always rejected', async t => {
  const r = await fixture(t, { metadata: { authorization_response_iss_parameter_supported: true } }); await r.bootstrap();
  await denied(await r.finish(await r.flow()));
  const f = await r.flow(); await denied(await r.finish({ ...f, path: f.path + '&iss=https://evil.example' }));
  const good = await r.flow(); assert.equal((await r.finish({ ...good, path: good.path + '&iss=https://idp.example' })).status, 303);
});

test('expired correlations, altered encryption and changed configuration fail closed', async t => {
  const r = await fixture(t); await r.bootstrap(); const f = await r.flow();
  r.sqlite.prepare('UPDATE oa_oidc_transactions SET expires_at=0').run(); await denied(await r.finish(f));
  const altered = await r.flow(); r.sqlite.prepare("UPDATE oa_oidc_transactions SET payload='bad.ciphertext'").run();
  await denied(await r.finish(altered), 503);
  const changed = await r.flow();
  const client = createOidcClient({ auth: r.auth, db: r.db, config: { ...config, clientId: 'changed' }, clientIp: () => '192.0.2.1', fetch: r.provider.fetch });
  await denied(await client.callback(r.request(changed.path, { cookie: changed.cookie })));
});

test('discovery and requests enforce trust, size, redirects, timeout; diagnostics are redacted', async t => {
  for (const metadata of [{ issuer: 'https://evil.example' }, { token_endpoint: 'https://evil.example/token' }, { authorization_endpoint: 'http://idp.example/auth' }, { jwks_uri: 'https://idp.example/jwks?secret=fixture' }, { code_challenge_methods_supported: ['plain'] }]) {
    const r = await fixture(t, { metadata }); assert.ok((await r.begin()).status >= 400);
  }
  for (const transport of [async () => Response.redirect('https://evil.example', 302), async () => new Response('x'.repeat(70000), { headers: { 'Content-Type': 'application/json' } }), async () => { throw new Error('provider-secret-must-not-leak'); }, async () => new Promise(() => {})]) {
    const r = await fixture(t, { transport }, { timeoutMs: 100 }); const response = await r.begin();
    assert.equal(response.status, 502); assert.equal(await response.text(), '{"error":"oidc_provider_unavailable"}');
  }
});

test('rate limiting is durable and request bodies bounded', async t => {
  const r = await fixture(t, {}, { startLimit: 1 }); assert.equal((await r.begin()).status, 303); r.restart();
  await denied(await r.begin(), 429);
  await denied(await r.call('/auth/oidc/start', { method: 'POST', body: 'x'.repeat(4097) }), 413);
});
