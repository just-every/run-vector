import { readFile, readdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { validateAgentSurface } from '../../vendor/base/agent-door/conformance/index.mjs';
import { signJws } from '../../vendor/base/agent-door/conformance/crypto.mjs';
import initialize from './initialize-owner.mjs';
import { runNativePhases } from './runtime-phases.mjs';
import { resolveArgs } from '../../vendor/base/agent-door/conformance/protocol.mjs';
import { consentProbe } from './consent-probe.mjs';
import { nativeRuntime } from './runtime-installation.mjs';

const root = process.cwd(), require = createRequire(join(root, 'package.json'));
const { unstable_splitSqlQuery: split } = require('wrangler');
let surface = JSON.parse(await readFile('agent-surface.json', 'utf8'));
const contract = await readFile('CONTRACT.md', 'utf8');
const declarations = validateAgentSurface(surface, { contract });
const origin = 'https://vector-agent-conformance.invalid', issuer = 'https://business-agent-conformance.invalid';
const kid = randomUUID(), installationId = randomUUID(), sub = randomUUID(), email = 'agent-owner@example.test';
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const key = await webcrypto.subtle.exportKey('jwk', pair.publicKey), publicKeys = { [kid]: key };
const signer = { privateKey: pair.privateKey, kid, issuer, installationId };
const scratch = await mkdtemp(join(tmpdir(), 'vector-agent-runtime-'));
let mf;
try {
  const bindings = {
    APP_ORIGIN: origin, FIRST_OWNER_EMAIL: email, FIRST_OWNER_NAME: 'Morgan Delivery',
    WORKSPACE_NAME: 'Delivery workspace', WORKSPACE_TIMEZONE: 'UTC', DEFAULT_TEAM_NAME: 'Delivery', DEFAULT_TEAM_PREFIX: 'DEL',
    SETUP_TOKEN: randomBytes(32).toString('hex'), SESSION_SECRET: randomBytes(32).toString('hex'),
    MAIL_MODE: 'hosted', MAIL_PROVIDER: 'resend', MAIL_API_KEY: randomBytes(32).toString('hex'), MAIL_FROM: email,
    NOTIFICATION_EMAIL_ENABLED: 'false',
    RER_OWNER_CLAIM_ISSUER: issuer, RER_OWNER_CLAIM_INSTALLATION_ID: installationId,
    RER_OWNER_CLAIM_APP_ORIGIN: origin, RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify(publicKeys),
    RER_BUSINESS_TRUST: JSON.stringify({ v: 1, issuer, audience: origin, subject: installationId, email, keys: publicKeys }),
  };
  const installed = await nativeRuntime({ root, bindings, scratch, generationOnly: process.argv.includes('--write-surface') });
  mf = installed.mf;
  const { db, native } = installed;
  for (const name of (await readdir('migrations/core')).filter(name => name.endsWith('.sql')).sort()) {
    for (const sql of split(await readFile(join('migrations/core', name), 'utf8'))) await db.prepare(sql).run();
  }
  if (process.argv.includes('--write-surface')) {
    const catalogue = await native.catalogue();
    if (catalogue.invalidSchemas.length) throw new Error('Unsupported native schemas: ' + JSON.stringify(catalogue.invalidSchemas));
    const { default: issues } = await import('./issue-steps.mjs');
    const { default: planning } = await import('./planning-steps.mjs');
    const { default: workspace } = await import('./workspace-steps.mjs');
    const { default: access } = await import('./access-steps.mjs');
    surface = { ...surface, tools: [...catalogue.tools, surface.tools.find(tool => tool.name === 'vector.events.list')],
      resources: catalogue.resources,
      notTools: [...surface.notTools.filter(item => !item.clauses.includes('ROLE-014')), { clauses: ['API-004', 'ROLE-010'], reason: 'screen' },
        { clauses: ['GITHUB-001', 'GITHUB-002', 'WEBHOOK-001'], reason: 'connector' }, { clauses: ['ISSUE-009'], reason: 'device' }],
      journey: [...surface.journey.slice(0, 6), ...issues.journey,
        { id: 'native-file-issue', tool: 'vector.issues.list', args: { q: 'Investigate a reported checkout failure', sort: 'oldest' }, expect: [{ class: 'standard', facts: { measure: 1 } }] },
        { id: 'native-files', tool: 'vector.issue.read_discussion', args: { identifier: { $from: 'native-file-issue', pointer: '/issues/0/identifier' } }, expect: [{ class: 'standard', facts: { measure: 1 } }] },
        { id: 'native-file-remove', tool: 'vector.issue.remove_file', args: { identifier: { $from: 'native-file-issue', pointer: '/issues/0/identifier' }, itemId: { $from: 'native-files', pointer: '/files/0/id' } }, expect: [{ class: 'destructive', facts: { measure: 1 } }] },
        ...planning, ...workspace, ...access, surface.journey.find(step => step.id === 'events')],
      witness: { tool: 'vector.issues.list', args: { sort: 'oldest', pageSize: 100 } },
    };
    surface.notTools = [...new Map(surface.notTools.map(item => [JSON.stringify(item), item])).values()];
    await writeFile('agent-surface.json', JSON.stringify(surface, null, 2) + '\n');
    console.log('Wrote native registry declaration: ' + catalogue.tools.length + ' tools plus events; ' + catalogue.resources.length + ' resources.');
  } else {
  let requests = 0;
  const request = (url, init = {}) => {
    if (++requests % 100 === 0) console.log(`Native conformance requests: ${requests}`);
    return mf.dispatchFetch('http://localhost' + new URL(url).pathname + new URL(url).search, { redirect: 'manual', ...init,
      headers: { 'x-native-origin-url': url, 'CF-Connecting-IP': '192.0.2.1', ...Object.fromEntries(new Headers(init.headers)) } });
  };
  const iat = Math.floor(Date.now() / 1000);
  const claim = await signJws(pair.privateKey, kid, 'rer-owner-claim+jwt', {
    v: 1, iss: issuer, aud: origin, installationId, email, jti: randomUUID(), iat, exp: iat + 300,
  });
  const owner = await initialize({ request, origin, displayName: 'Morgan Delivery', returnTo: '/app', claim: { mode: 'signed', path: '/auth/owner-claim', token: claim } });
  if (owner.status !== 303) {
    const body = await owner.json().catch(() => ({}));
    throw new Error('Signed native owner bootstrap returned HTTP ' + owner.status + ' (' + (body.code ?? body.error ?? 'unknown') + ')');
  }
  const cookie = owner.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ');
  await owner.body?.cancel();
  const settings = await signJws(pair.privateKey, kid, 'rer-business-settings+jwt', {
    v: 1, iss: issuer, aud: origin, sub: installationId, business: 'rer-agent-conformance', email,
    owner_id: sub, jti: randomUUID(), iat, exp: iat + 3600, rev: 1,
    values: { display_name: 'Delivery workspace' }, logo: null, team: null,
  });
  const adopted = await request(origin + '/api/rer/business-settings', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
  if (!adopted.ok) throw new Error('Signed native people mapping returned HTTP ' + adopted.status);
  await adopted.body?.cancel();
  console.log('PASS signed-owner-claim and native first-run lifecycle');
  await native.scheduledReminders();
  if (process.argv.includes('--bootstrap-only')) {
    console.log('Native bootstrap and scheduled reminder fixture completed.');
  } else if (process.argv.includes('--consent-only')) {
    const probe = await consentProbe({ request, origin, surface, signer, person: { email, cookie, sub }, db, invoke: (...args) => native.invoke(...args) });
    console.log('Native embedded consent probe: ' + JSON.stringify(probe));
    if (!probe.ok) process.exitCode = 1;
  } else if (process.argv.includes('--screens')) {
    const { browserJourney } = await import('./browser-journey.mjs');
    await browserJourney({ request, origin, surface, signer, person: { email, cookie, sub }, db });
  } else {
  // The pin's optional invocation phase starts with no journey output map.
  // Materialize its first native metadata reference from this installation;
  // these are the same values the ordinary journey's options step returns.
  const optionsResponse = await request(origin + '/api/metadata', { headers: { Cookie: cookie } });
  const options = await optionsResponse.json();
  const sessionResponse = await request(origin + '/api/session', { headers: { Cookie: cookie } });
  const session = await sessionResponse.json();
  const installedSurface = structuredClone(surface);
  const firstMutation = installedSurface.journey.find(step => !surface.tools.find(tool => tool.name === step.tool).readOnly);
  firstMutation.args = resolveArgs(firstMutation.args, new Map([['options', options]]), { sponsor: { id: session.operatorId, email } });
  const result = await runNativePhases({ fetch: request, origin, surface: installedSurface, signer, person: { email, cookie, sub },
    invoke: (name, args, who) => native.invoke(name, args, { ...who, clientId: 'rer-agent-conformance' }) });
  for (const point of declarations.points) console.log(`${point.ok ? 'PASS' : 'FAIL'} ${point.id}${point.detail ? ': ' + point.detail : ''}`);
  for (const point of result.points.filter(point => !point.id.includes('.surface.'))) console.log(`${point.ok ? 'PASS' : 'FAIL'} ${point.id}${point.detail ? ': ' + point.detail : ''}`);
  const runtime = result.points.filter(point => !point.id.includes('.surface.'));
  console.log(`Runtime conformance: ${runtime.filter(point => point.ok).length}/${runtime.length}; declarations: ${declarations.points.filter(point => point.ok).length}/${declarations.points.length}.`);
  const probe = await consentProbe({ request, origin, surface, signer, person: { email, cookie, sub }, db, invoke: (...args) => native.invoke(...args) });
  console.log('Native embedded consent probe: ' + JSON.stringify(probe));
  if (!result.ok || !declarations.ok || !probe.ok) process.exitCode = 1;
  }
  }
} finally {
  await mf?.dispose();
  await rm(scratch, { recursive: true, force: true });
}
