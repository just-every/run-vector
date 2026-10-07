import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, providers, post, sessionCookie } from './binding-runtime.mjs';
import { AuthStore } from '../../store.mjs';
import { createOperatorAuth } from '../../index.mjs';

async function accepted(response) {
  assert.equal(response.status, 303, await response.clone().text());
  assert.equal(response.headers.get('location'), '/private');
  assert.ok(sessionCookie(response));
  return sessionCookie(response);
}
async function denied(response) {
  assert.equal(response.status, 403, await response.clone().text());
  assert.equal(await response.text(), '{"error":"oidc_admission_denied"}');
  assert.equal(sessionCookie(response), undefined);
  assert.equal(response.headers.get('location'), null);
}
async function member(r) {
  await r.db.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES('member','member@example.com','Member','member','active',?)").bind(Date.now()).run();
}
function core(r) {
  return createOperatorAuth({ db: r.db, config: { origin: 'https://app.example', OWNER_EMAIL: 'owner@example.com', SESSION_SECRET: 'only-for-tests-binding-session-secret', externalIssuers: providers.map(p => p.issuer) }, clientIp: () => '192.0.2.1' });
}
const request = () => new Request('https://app.example/auth/oidc/0/callback');

test('signed fresh browser-bound different subjects cannot silently join the same owner, on either issuer', async t => {
  const r = await runtime(t); await r.bootstrap();
  const initial = await accepted(await r.login());
  assert.equal((await r.call('/private', { cookie: initial })).status, 200);
  for (const provider of [0, 1]) {
    const f = await r.flow({ sub: 'subject-b' }, provider, { associated: true, subjectEmails: { 'subject-b': 'owner@example.com' } });
    f.path += '&associated=true&emailVerified=true';
    await denied(await r.finish(f));
    assert.deepEqual(await r.counts(), { bindings: 1, sessions: 1 });
    assert.equal((await r.finish(f)).status, 400, 'Denied login correlation is consumed');
  }
  await r.restart();
  await accepted(await r.login());
  assert.deepEqual(await r.counts(), { bindings: 1, sessions: 2 });
  const row = await r.db.prepare('SELECT issuer,subject FROM oa_external_identities').first();
  assert.deepEqual(row, { issuer: providers[0].issuer, subject: 'subject-a' });
});

test('explicit server subject associations admit additional principals without verified email on both issuers', async t => {
  const r = await runtime(t, providers.map(p => ({ ...p, subjectEmails: { 'subject-b': 'owner@example.com' } })));
  await r.bootstrap(); await accepted(await r.login());
  for (const provider of [0, 1]) {
    const cookie = await accepted(await r.login({ sub: 'subject-b', email: 'mutable@untrusted.example', email_verified: false, role: 'admin' }, provider));
    const session = await (await r.call('/private', { cookie })).json();
    assert.equal(session.email, 'owner@example.com'); assert.equal(session.role, 'owner');
  }
  assert.deepEqual(await r.counts(), { bindings: 3, sessions: 3 });
  await denied(await r.login({ sub: 'unconfigured', email: 'owner@example.com' }));
  assert.deepEqual(await r.counts(), { bindings: 3, sessions: 3 });
});

test('concurrent independent signed logins bind exactly one principal, within and across issuers', async t => {
  for (const secondProvider of [0, 1]) await t.test(`second provider ${secondProvider}`, async t => {
    const r = await runtime(t); await r.bootstrap();
    const a = await r.flow({ sub: 'racer-a' }); const b = await r.flow({ sub: 'racer-b' }, secondProvider);
    const outcomes = await Promise.all([r.finish(a), r.finish(b)]);
    assert.deepEqual(outcomes.map(o => o.status).sort(), [303, 403]);
    await denied(outcomes.find(o => o.status === 403));
    assert.deepEqual(await r.counts(), { bindings: 1, sessions: 1 });
    const winner = await r.db.prepare('SELECT issuer,subject FROM oa_external_identities').first();
    await accepted(await r.login({ sub: winner.subject }, providers.findIndex(p => p.issuer === winner.issuer)));
    assert.deepEqual(await r.counts(), { bindings: 1, sessions: 2 });
  });
});

test('D1 association transaction rejects stale competing snapshots and rolls binding back if session insertion fails', async t => {
  const r = await runtime(t); await r.bootstrap(); const store = new AuthStore(r.db);
  const operator = await store.byEmail('owner@example.com'); const now = Date.now();
  const input = subject => ({ identity: { issuer: providers[0].issuer, subject }, email: operator.email, expectedVersion: operator.version, now, session: { id: crypto.randomUUID(), hash: crypto.randomUUID(), expiresAt: now + 60000 } });
  const outcomes = await Promise.all([store.external(input('a')), store.external(input('b'))]);
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.deepEqual(await r.counts(), { bindings: 1, sessions: 1 });
  await member(r);
  await r.db.prepare("CREATE TRIGGER fixture_fail_session BEFORE INSERT ON oa_sessions BEGIN SELECT RAISE(ABORT,'fixture_session_failure'); END").run();
  await assert.rejects(store.external({ ...input('rollback'), email: 'member@example.com' }), /fixture_session_failure/);
  assert.equal(await r.db.prepare("SELECT * FROM oa_external_identities WHERE subject='rollback'").first(), null);
  await r.db.exec('DROP TRIGGER fixture_fail_session');
  const stale = { ...input('stale'), email: 'member@example.com' };
  await r.db.prepare("UPDATE oa_operators SET role='admin' WHERE id='member'").run();
  assert.equal(await store.external(stale), null, 'An authority change after lookup prevents admission');
  assert.equal(await r.db.prepare("SELECT * FROM oa_external_identities WHERE subject='stale'").first(), null);
});

test('trusted maps never move a bound principal; active status, role versions and allow-list still govern admission', async t => {
  const entries = providers.map(p => ({ ...p, subjectEmails: { 'staff-subject': 'member@example.com' } }));
  const r = await runtime(t, entries); const ownerCookie = await r.bootstrap(); await member(r);
  const staff = { sub: 'staff-subject', email_verified: false, role: 'owner' };
  const cookie = await accepted(await r.login(staff));
  assert.equal((await (await r.call('/private', { cookie })).json()).role, 'member', 'Token role never grants authority');
  const auth = core(r);
  const moved = auth.createIdentityAdmission({ issuer: providers[0].issuer, subjectEmails: { 'staff-subject': 'owner@example.com' } });
  await assert.rejects(moved(request(), { issuer: providers[0].issuer, subject: 'staff-subject' }));
  assert.equal((await r.db.prepare("SELECT operator_id FROM oa_external_identities WHERE subject='staff-subject'").first()).operator_id, 'member');
  assert.equal((await r.call('/auth/operator/role', post({ operatorId: 'member', role: 'admin' }, ownerCookie))).status, 200);
  assert.equal((await r.call('/private', { cookie })).status, 401);
  const freshCookie = await accepted(await r.login(staff));
  assert.equal((await (await r.call('/private', { cookie: freshCookie })).json()).role, 'admin');
  assert.equal((await r.call('/auth/operator/status', post({ operatorId: 'member', status: 'inactive' }, ownerCookie))).status, 200);
  await denied(await r.login(staff));
  assert.equal((await r.call('/auth/operator/status', post({ operatorId: 'member', status: 'active' }, ownerCookie))).status, 200);
  assert.equal((await r.call('/private', { cookie: freshCookie })).status, 401);
  await accepted(await r.login(staff));
  const excluded = await runtime(t, entries, { allowList: ['owner@example.com'] }); await excluded.bootstrap(); await member(excluded);
  await denied(await excluded.login(staff)); assert.deepEqual(await excluded.counts(), { bindings: 0, sessions: 0 });
});

test('core associations are immutable issuer-scoped configuration and identity fields cannot opt into linking', async t => {
  const r = await runtime(t); await r.bootstrap(); await member(r); await accepted(await r.login());
  const auth = core(r); const issuer = providers[0].issuer;
  const subjectEmails = { configured: 'member@example.com' };
  const admit = auth.createIdentityAdmission({ issuer, subjectEmails });
  subjectEmails.configured = 'owner@example.com'; subjectEmails.injected = 'owner@example.com';
  const session = await admit(request(), { issuer, subject: 'configured', email: 'owner@example.com', emailVerified: false });
  assert.equal(session.operator.id, 'member');
  await assert.rejects(admit(request(), { issuer: providers[1].issuer, subject: 'configured' }));
  await assert.rejects(admit(request(), { issuer, subject: 'injected', email: 'owner@example.com', emailVerified: true }));
  await assert.rejects(auth.admitVerifiedIdentity(request(), { issuer, subject: 'injected', email: 'owner@example.com', emailVerified: true, associated: true, associatedEmail: 'owner@example.com' }, { association: subjectEmails }));
  for (const input of [{ issuer: 'https://unconfigured.example' }, { issuer, subjectEmails: [] }, { issuer, subjectEmails: { '': 'owner@example.com' } }, { issuer, subjectEmails: { configured: 'invalid' } }]) assert.throws(() => auth.createIdentityAdmission(input), e => e.code === 'invalid_configuration');
  assert.deepEqual(await r.counts(), { bindings: 2, sessions: 2 });
});
