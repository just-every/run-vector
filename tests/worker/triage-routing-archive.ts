import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import { freshTarget, httpExport, stageArchive, finalBody, targetCall, targetSignIn, destination, archiveRows, targetBindings } from './http-archive-fixture';
import { createServerApp } from '../../src/core/app/server';
import type { setupIntegrations } from './integration-fixture';

/** The real owner export and pristine-bootstrap restore preserve configuration
 * and routed native issues; excluded receiver credentials cannot replay it. */
export async function routingArchiveRoundTrip(
  f: Awaited<ReturnType<typeof setupIntegrations>>,
  sentry: { connection: { id: string; receiver: string }; secret: string },
  payload: unknown,
) {
  const config = (await env.DB.prepare('SELECT * FROM triage_routing_configs ORDER BY scope_key').all()).results;
  const routed = (await env.DB.prepare('SELECT id,identifier,team_id,triage_route_json FROM issues WHERE triage_route_json IS NOT NULL ORDER BY id').all()).results;
  expect(routed.length).toBeGreaterThan(0);
  const records = await httpExport(f.call);
  expect(archiveRows(records, 'triage_routing_configs')).toHaveLength(config.length);
  expect(archiveRows(records, 'issues').filter(row => row.triage_route_json !== null)).toHaveLength(routed.length);
  const cookie = await freshTarget(), id = await stageArchive(records, cookie);
  const result = await targetCall('/api/portability/imports/' + id + '/finalize', 'POST', finalBody(records), cookie);
  expect(result.status, await result.clone().text()).toBe(200);
  expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT * FROM triage_routing_configs ORDER BY scope_key').all()).results).toEqual(config);
  expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT id,identifier,team_id,triage_route_json FROM issues WHERE triage_route_json IS NOT NULL ORDER BY id').all()).results).toEqual(routed);
  const restoredOwner = await targetSignIn();
  const projection = await targetCall('/api/issues/' + routed[0].identifier, 'GET', undefined, restoredOwner);
  expect(projection.status).toBe(200);
  expect((await projection.json() as { routing: unknown }).routing).toMatchObject(JSON.parse(String(routed[0].triage_route_json)));
  expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT count(*) n FROM vector_integration_secret_keys').first<number>('n'))).toBe(0);
  const body = JSON.stringify(payload), key = await crypto.subtle.importKey('raw', new TextEncoder().encode(sentry.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))), byte => byte.toString(16).padStart(2, '0')).join('');
  const response = await createServerApp().request(sentry.connection.receiver, { method: 'POST', body, headers: {
    'Content-Type': 'application/json', 'Sentry-Hook-Signature': signature, 'Sentry-Hook-Resource': 'issue', 'Request-ID': 'synthetic-vector-9340',
  } }, targetBindings);
  expect(response.status).toBe(401);
  expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT id,identifier,team_id,triage_route_json FROM issues WHERE triage_route_json IS NOT NULL ORDER BY id').all()).results).toEqual(routed);
}
