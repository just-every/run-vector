import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import { actor, bindings, invite, request } from './base-auth-fixture';
import type { setupIntegrations } from './integration-fixture';
import { dispatchWebhooks, outboundService } from '../../src/core/features/integrations/outbound';
import { verifyWebhook } from '../../vendor/base/integrations';

/** Mounted native and scoped doors share one durable, filtered comment stream. */
export async function outboundCommentJourney(f: Awaited<ReturnType<typeof setupIntegrations>>) {
  const team = f.initial.teams[0], events = ['comment.created', 'comment.updated', 'comment.deleted'];
  const workspace = (await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id'))!;
  const legacyResponse = await f.call('/settings/integrations/destinations', 'POST', { name: 'synthetic-vector-9001', url: 'https://receiver.example.com/legacy' });
  expect(legacyResponse.status).toBe(201);
  const legacy = await legacyResponse.json() as { id: string };
  const response = await f.call('/settings/integrations/destinations', 'POST', { name: 'synthetic-vector-9002', url: 'https://receiver.example.com/comments', events, teamIds: [team.id] });
  expect(response.status).toBe(201);
  const destination = await response.json() as { id: string; secret: string };
  const path = '/settings/integrations/destinations/' + destination.id + '/subscriptions';
  const update = (selected: string[], teamIds = [team.id]) => f.call(path, 'PUT', { events: selected, teamIds });
  const projection = async () => (await (await f.call('/settings/integrations')).json()) as any;
  f.restart();
  expect((await projection()).destinations.find((d: any) => d.id === destination.id)).toMatchObject({ events, teamIds: [team.id] });
  expect((await projection()).destinations.find((d: any) => d.id === legacy.id).events).toEqual(['issue.created', 'issue.updated', 'issue.completed']);
  const otherState = await f.mutate('/settings/teams', 'POST', { name: 'synthetic-vector-9003', identifierPrefix: 'WHSUB' });
  const other = otherState.teams.find(t => t.name === 'synthetic-vector-9003')!;
  const issue = await f.create({ title: 'synthetic-vector-9004' }), otherIssue = await f.create({ teamId: other.id, title: 'synthetic-vector-9005' });
  const commentPath = '/issues/' + issue.identifier + '/comments';
  const post = async (body: string, parentId?: string) => {
    const res = await f.call(commentPath, 'POST', { body, ...(parentId ? { parentId } : {}) });
    expect(res.status, await res.clone().text()).toBe(201);
    return (await res.json() as { id: string }).id;
  };
  const snapshot = () => Promise.all(['issue_comments', 'issue_activity', 'issue_followers', 'notifications', 'vector_webhook_events'].map(async table =>
    (await env.DB.prepare('SELECT * FROM ' + table + ' ORDER BY 1').all()).results));
  const before = await snapshot();
  await env.DB.prepare("CREATE TRIGGER comment_publication_failure BEFORE INSERT ON vector_webhook_events WHEN NEW.event LIKE 'comment.%' BEGIN SELECT RAISE(ABORT,'synthetic-vector-9006'); END").run();
  expect((await f.call(commentPath, 'POST', { body: 'synthetic-vector-9007' })).status).toBeGreaterThanOrEqual(500);
  expect(await snapshot()).toEqual(before);
  await env.DB.prepare('DROP TRIGGER comment_publication_failure').run();
  const root = await post('synthetic-vector-9008'), reply = await post('synthetic-vector-9009', root);
  const scoped = await f.issueToken(['issues:read', 'comments:write', 'comments:read', 'comments:edit', 'comments:delete']);
  const scopedRootResponse = await f.api(scoped.token, commentPath, 'POST', { body: 'synthetic-vector-9010' });
  expect(scopedRootResponse.status).toBe(201);
  const scopedRoot = (await scopedRootResponse.json() as { id: string }).id;
  const memberCookie = await invite(['synthetic-vector-9011', 'vector.test'].join('@'), f.cookie, 'member');
  const viewerCookie = await invite(['synthetic-vector-9012', 'vector.test'].join('@'), f.cookie, 'viewer');
  for (const [cookie, url, method, input, status] of [
    [memberCookie, '/api' + path, 'PUT', { events, teamIds: [] }, 403],
    [viewerCookie, '/api' + commentPath, 'POST', { body: 'synthetic-vector-9013' }, 403],
    [memberCookie, '/api' + commentPath + '/' + root, 'PATCH', { body: 'synthetic-vector-9014' }, 403],
  ] as const) {
    const prior = await snapshot();
    expect((await request(url, method, input, cookie)).status).toBe(status);
    expect(await snapshot()).toEqual(prior);
  }
  const stored = await env.DB.prepare('SELECT event_kinds,team_ids FROM vector_webhook_destinations WHERE id=?').bind(destination.id).first();
  expect((await update(['project.updated'])).status).toBe(400);
  expect((await update(events, ['01K00000000000000000009999'])).status).toBeGreaterThanOrEqual(400);
  expect(await env.DB.prepare('SELECT event_kinds,team_ids FROM vector_webhook_destinations WHERE id=?').bind(destination.id).first()).toEqual(stored);
  const adminCookie = await invite(['synthetic-vector-9015', 'vector.test'].join('@'), f.cookie, 'admin');
  expect((await request('/api' + path, 'PUT', { events, teamIds: [team.id] }, adminCookie)).status).toBe(200);
  for (const id of [root, reply]) {
    const version = await f.api(scoped.token, '/comments/' + id).then(r => r.json()) as { version: number };
    expect((await f.api(scoped.token, '/comments/' + id, 'PATCH', { expectedVersion: version.version, body: 'synthetic-vector-9016' })).status).toBe(200);
    if (id === root) expect((await f.call(commentPath + '/' + id, 'DELETE')).status).toBe(200);
    else {
      const updated = await f.api(scoped.token, '/comments/' + id).then(r => r.json()) as { version: number };
      expect((await f.api(scoped.token, '/comments/' + id, 'DELETE', { expectedVersion: updated.version })).status).toBe(200);
    }
    const prior = await snapshot();
    expect((await f.call(commentPath + '/' + id, 'DELETE')).status).toBe(404);
    expect(await snapshot()).toEqual(prior);
  }
  const rollback = await snapshot();
  await env.DB.prepare("CREATE TRIGGER comment_update_publication_failure BEFORE INSERT ON vector_webhook_events WHEN NEW.event IN ('comment.updated','comment.deleted') BEGIN SELECT RAISE(ABORT,'synthetic-vector-9017'); END").run();
  for (const method of ['PATCH', 'DELETE']) {
    expect((await f.call(commentPath + '/' + scopedRoot, method, method === 'PATCH' ? { body: 'synthetic-vector-9018' } : undefined)).status).toBeGreaterThanOrEqual(500);
    expect(await snapshot()).toEqual(rollback);
  }
  await env.DB.prepare('DROP TRIGGER comment_update_publication_failure').run();
  expect((await f.call('/issues/' + otherIssue.identifier + '/comments', 'POST', { body: 'synthetic-vector-9019' })).status).toBe(201);
  const queued = async () => (await env.DB.prepare('SELECT id,event,body FROM vector_webhook_events WHERE destination_id=? ORDER BY created_at,id').bind(destination.id).all<{ id: string; event: string; body: string }>()).results;
  const selected = await queued();
  expect(selected).toHaveLength(7);
  expect(selected.map(e => e.event).sort()).toEqual(['comment.created', 'comment.created', 'comment.created', 'comment.updated', 'comment.updated', 'comment.deleted', 'comment.deleted'].sort());
  for (const entry of selected) {
    const payload = JSON.parse(entry.body);
    expect(payload).toMatchObject({ identifier: issue.identifier, issueId: issue.id, teamId: team.id });
    expect(payload.rootCommentId).toBe(payload.commentId === reply ? root : payload.commentId);
    expect(payload.parentCommentId).toBe(payload.commentId === reply ? root : null);
    for (const value of ['synthetic-vector-9008', 'synthetic-vector-9009', 'synthetic-vector-9016']) expect(entry.body).not.toContain(value);
    expect(payload).not.toHaveProperty('body');
  }
  expect(await env.DB.prepare("SELECT count(*) n FROM vector_webhook_events WHERE destination_id=? AND event LIKE 'comment.%'").bind(legacy.id).first<number>('n')).toBe(0);
  expect((await env.DB.prepare('SELECT count(*) n FROM vector_webhook_events WHERE destination_id=?').bind(legacy.id).first<number>('n'))!).toBeGreaterThan(0);
  // Isolate the selected stream; the earlier journey's held history stays inert.
  for (const d of (await projection()).destinations) if (d.id !== destination.id && !d.revokedAt) expect((await f.call('/settings/integrations/destinations/' + d.id, 'DELETE')).status).toBe(200);
  const key = new Uint8Array(destination.secret.match(/../g)!.map(pair => parseInt(pair, 16)));
  const sent: { id: string; event: string; body: string }[] = [];
  let mode = 'retry';
  const current = { ...bindings, INTEGRATION_EGRESS_POLICY: 'public-dns-pinned-tls-v1', INTEGRATION_EGRESS: { async send(wire: { body: string; headers: Record<string, string> }) {
    await verifyWebhook({ body: wire.body, headers: wire.headers, key, tenant: workspace, destinationId: destination.id });
    sent.push({ id: wire.headers['webhook-id'], event: wire.headers['webhook-event'], body: wire.body });
    if (mode === 'uncertain') throw Error('synthetic-vector-9020');
    return { status: mode === 'retry' ? 429 : 204, headers: {}, body: '' };
  } } };
  await dispatchWebhooks(current);
  expect(sent).toHaveLength(selected.length);
  const retryRows = (await env.DB.prepare("SELECT id,next_at FROM integration_deliveries WHERE json_extract(envelope,'$.destinationId')=? AND state='queued'").bind(destination.id).all<{ id: string; next_at: number }>()).results;
  expect(retryRows).toHaveLength(selected.length);
  mode = 'accepted';
  for (const row of retryRows) expect((await outboundService(current, workspace, () => row.next_at + 1).dispatch(row.id))?.state).toBe('accepted');
  expect(new Set(sent.map(w => w.id)).size).toBe(selected.length);
  for (const entry of selected) expect(sent.filter(w => w.id === entry.id).map(w => w.body)).toEqual([entry.body, entry.body]);
  const acceptedCount = sent.length;
  f.restart(); await dispatchWebhooks(current); expect(sent).toHaveLength(acceptedCount);
  mode = 'uncertain'; await post('synthetic-vector-9021'); await dispatchWebhooks(current);
  const uncertainCount = sent.length; await dispatchWebhooks(current); expect(sent).toHaveLength(uncertainCount);
  // Both uncaptured intent and already queued retries must honor current choices.
  mode = 'retry'; await post('synthetic-vector-9022'); await dispatchWebhooks(current);
  const pending = await env.DB.prepare("SELECT id,next_at FROM integration_deliveries WHERE json_extract(envelope,'$.destinationId')=? AND state='queued'").bind(destination.id).first<{ id: string; next_at: number }>();
  expect(pending).toBeTruthy();
  expect((await update(['comment.deleted'])).status).toBe(200);
  mode = 'accepted'; const beforeUnsubscribe = sent.length;
  expect((await outboundService(current, workspace, () => pending!.next_at + 1).dispatch(pending!.id))?.state).toBe('rejected');
  expect(sent).toHaveLength(beforeUnsubscribe);
  expect((await update(events)).status).toBe(200);
  mode = 'retry'; await post('synthetic-vector-9026'); await dispatchWebhooks(current);
  const teamPending = await env.DB.prepare("SELECT id,next_at FROM integration_deliveries WHERE json_extract(envelope,'$.destinationId')=? AND state='queued'").bind(destination.id).first<{ id: string; next_at: number }>();
  expect(teamPending).toBeTruthy();
  expect((await update(events, [other.id])).status).toBe(200);
  const beforeTeamChange = sent.length; mode = 'accepted';
  expect((await outboundService(current, workspace, () => teamPending!.next_at + 1).dispatch(teamPending!.id))?.state).toBe('rejected');
  expect(sent).toHaveLength(beforeTeamChange);
  expect((await update(events)).status).toBe(200);
  mode = 'retry'; await post('synthetic-vector-9027'); await dispatchWebhooks(current);
  const privatePending = await env.DB.prepare("SELECT id,next_at FROM integration_deliveries WHERE json_extract(envelope,'$.destinationId')=? AND state='queued'").bind(destination.id).first<{ id: string; next_at: number }>();
  expect(privatePending).toBeTruthy();
  await post('synthetic-vector-9023');
  expect((await f.call('/settings/teams/' + team.id + '/privacy', 'PUT', { isPrivate: true })).status).toBe(200);
  const beforePrivate = sent.length; mode = 'accepted';
  expect((await outboundService(current, workspace, () => privatePending!.next_at + 1).dispatch(privatePending!.id))?.state).toBe('rejected');
  await dispatchWebhooks(current); expect(sent).toHaveLength(beforePrivate);
  const privateCount = (await queued()).length; await post('synthetic-vector-9024'); expect(await queued()).toHaveLength(privateCount);
  expect((await f.call('/settings/teams/' + team.id + '/privacy', 'PUT', { isPrivate: false })).status).toBe(200);
  // Removing and erasing a real author cannot expose their old body in a later send.
  const authored = await request('/api' + commentPath, 'POST', { body: 'synthetic-vector-9028' }, memberCookie);
  expect(authored.status).toBe(201);
  const authoredId = (await authored.json() as { id: string }).id;
  const memberId = await actor(memberCookie);
  expect((await f.call('/settings/operators/' + memberId, 'DELETE')).status).toBe(200);
  const subject = { names: ['synthetic-vector-9011'] };
  expect((await f.call('/data/erasure', 'POST', { subject, confirmation: 'erase synthetic-vector-9011' })).status).toBe(200);
  const retained = (await queued()).filter(e => JSON.parse(e.body).commentId === authoredId);
  expect(retained).toHaveLength(1);
  expect(retained[0].body).not.toContain('synthetic-vector-9028');
  expect(retained[0].body).not.toContain(memberId);
  await dispatchWebhooks(current);
  expect(sent.some(w => w.id === retained[0].id)).toBe(true);
  await post('synthetic-vector-9025'); mode = 'retry'; await dispatchWebhooks(current);
  const revokedPending = await env.DB.prepare("SELECT id,next_at FROM integration_deliveries WHERE json_extract(envelope,'$.destinationId')=? AND state='queued'").bind(destination.id).first<{ id: string; next_at: number }>();
  expect(revokedPending).toBeTruthy();
  expect((await f.call('/settings/integrations/destinations/' + destination.id, 'DELETE')).status).toBe(200);
  const beforeRevoke = sent.length; mode = 'accepted';
  expect((await outboundService(current, workspace, () => revokedPending!.next_at + 1).dispatch(revokedPending!.id))?.state).toBe('rejected');
  expect(sent).toHaveLength(beforeRevoke);
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}
