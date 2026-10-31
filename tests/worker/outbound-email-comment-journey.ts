import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import type { setupIntegrations } from './integration-fixture';
import { inboundFixture, mailBindings, seedIntakeForTeam } from './email-intake-fixture';
import worker from './entry';
import { verifyWebhook } from '../../vendor/base/integrations';

/** Email intake and the native comment door feed the same signed delivery path. */
export async function outboundEmailCommentJourney(f: Awaited<ReturnType<typeof setupIntegrations>>) {
  const team = f.initial.teams[0];
  const workspace = (await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id'))!;
  const response = await f.call('/settings/integrations/destinations', 'POST', {
    name: 'synthetic-vector-9100', url: 'https://receiver.example.com/email-comments',
    events: ['comment.created', 'comment.updated', 'comment.deleted'], teamIds: [team.id],
  });
  expect(response.status).toBe(201);
  const destination = await response.json() as { id: string; secret: string };
  const key = new Uint8Array(destination.secret.match(/../g)!.map(pair => parseInt(pair, 16)));
  const received: { id: string; event: string; body: string }[] = [];
  const current = { ...mailBindings, INTEGRATION_EGRESS_POLICY: 'public-dns-pinned-tls-v1', INTEGRATION_EGRESS: {
    async send(wire: { body: string; headers: Record<string, string> }) {
      await verifyWebhook({ body: wire.body, headers: wire.headers, key, tenant: workspace, destinationId: destination.id });
      received.push({ id: wire.headers['webhook-id'], event: wire.headers['webhook-event'], body: wire.body });
      return { status: 204, headers: {}, body: '' };
    },
  } };
  const deliver = () => worker.scheduled({ scheduledTime: Date.now() }, current);
  const intake = await seedIntakeForTeam(team.id, f.cookie);
  const messageId = '<synthetic-vector-9101@example.test>';
  const reply = () => inboundFixture(intake.address, messageId, { replyTo: intake.messageId });
  expect((await worker.email(reply().message, mailBindings)).status).toBe('received');
  expect((await worker.email(reply().message, mailBindings)).status).toBe('duplicate');
  const discussionResponse = await f.call('/issues/' + intake.identifier + '/discussion');
  expect(discussionResponse.status).toBe(200);
  const discussion = await discussionResponse.json() as {
    comments: { id: string; body: string; actor: string; imported: number }[];
  };
  expect(discussion.comments).toHaveLength(1);
  const email = discussion.comments[0];
  expect(email.actor).toBe('synthetic-vector-712@example.test');
  expect(email.imported).toBeTruthy();
  const door = '/issues/' + intake.identifier + '/comments';
  const nativeResponse = await f.call(door, 'POST', { body: 'synthetic-vector-9102' });
  expect(nativeResponse.status).toBe(201);
  const native = await nativeResponse.json() as { id: string };
  await deliver();
  for (const comment of [email, native]) {
    expect(received.filter(w => JSON.parse(w.body).commentId === comment.id).map(w => w.event)).toEqual(['comment.created']);
    expect((await f.call(door + '/' + comment.id, 'DELETE')).status).toBe(200);
    expect((await f.call(door + '/' + comment.id, 'DELETE')).status).toBe(404);
  }
  f.restart();
  await deliver();
  await deliver();
  console.log('PROBE WEBHOOK-002 Owner deletion: ' + JSON.stringify({
    email: received.filter(w => JSON.parse(w.body).commentId === email.id).map(w => w.event),
    native: received.filter(w => JSON.parse(w.body).commentId === native.id).map(w => w.event),
    signedDeliveries: received.length, uniqueDeliveryIds: new Set(received.map(w => w.id)).size,
  }));
  for (const comment of [email, native]) {
    const deliveries = received.filter(w => JSON.parse(w.body).commentId === comment.id);
    expect(deliveries.map(w => w.event)).toEqual(['comment.created', 'comment.deleted']);
    expect(new Set(deliveries.map(w => w.id)).size).toBe(2);
    for (const delivery of deliveries) {
      expect(JSON.parse(delivery.body)).toEqual({
        identifier: intake.identifier, issueId: expect.any(String), teamId: team.id,
        commentId: comment.id, parentCommentId: null, rootCommentId: comment.id, occurredAt: expect.any(String),
      });
      for (const content of [email.body, email.actor, 'synthetic-vector-9102', destination.secret, f.owner])
        expect(delivery.body).not.toContain(content);
    }
  }
  expect(received).toHaveLength(4);
  expect(new Set(received.map(w => w.id)).size).toBe(4);
  expect((await f.call('/settings/integrations/destinations/' + destination.id, 'DELETE')).status).toBe(200);
}
