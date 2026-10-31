import assert from 'node:assert/strict';
import { dispatchWebhooks } from '../../../src/core/features/integrations/outbound.ts';

/** Real native mutations arrive at the existing HMAC-verifying TLS receiver. */
export async function outboundCommentsJourney({ call, cookie, db, env, destination, team, received, eventKinds }) {
  const mutate = async (path, method, body, status = 200) => {
    const response = await call('/api' + path, method, body, cookie);
    assert.equal(response.status, status, await response.clone().text());
    return response.json();
  };
  const events = ['comment.created', 'comment.updated', 'comment.deleted'];
  const subscription = '/settings/integrations/destinations/' + destination.id + '/subscriptions';
  await mutate(subscription, 'PUT', { events, teamIds: [team.id] });
  const before = new Set(received.keys());
  const issue = await mutate('/issues', 'POST', { teamId: team.id, title: 'synthetic-vector-9070' }, 201);
  const door = '/issues/' + issue.identifier + '/comments';
  const root = await mutate(door, 'POST', { body: 'synthetic-vector-9071' }, 201);
  const reply = await mutate(door, 'POST', { body: 'synthetic-vector-9072', parentId: root.id }, 201);
  for (const id of [root.id, reply.id]) {
    await mutate(door + '/' + id, 'PATCH', { body: 'synthetic-vector-9073' });
    await mutate(door + '/' + id, 'DELETE');
  }
  const other = (await mutate('/settings/teams', 'POST', { name: 'synthetic-vector-9074', identifierPrefix: 'TLSHOOK' })).teams.find(t => t.name === 'synthetic-vector-9074');
  const excluded = await mutate('/issues', 'POST', { teamId: other.id, title: 'synthetic-vector-9075' }, 201);
  await mutate('/issues/' + excluded.identifier + '/comments', 'POST', { body: 'synthetic-vector-9076' }, 201);
  await dispatchWebhooks(env);
  const accepted = [...received].filter(([id]) => !before.has(id));
  assert.equal(accepted.length, 6);
  assert.deepEqual(accepted.map(([id]) => eventKinds.get(id)).sort(), [...events, ...events].sort());
  for (const [, body] of accepted) {
    const payload = JSON.parse(body);
    assert.equal(payload.identifier, issue.identifier);
    assert.equal(payload.issueId, issue.id);
    assert.equal(payload.teamId, team.id);
    assert.equal(payload.rootCommentId, root.id);
    assert.equal(payload.parentCommentId, payload.commentId === reply.id ? root.id : null);
    assert(!body.includes('synthetic-vector-9071'));
    assert(!body.includes('synthetic-vector-9072'));
    assert(!body.includes('synthetic-vector-9073'));
  }
  const queued = (await db.prepare('SELECT id FROM vector_webhook_events WHERE destination_id=? AND json_extract(body,\'$.identifier\')=?').bind(destination.id, issue.identifier).all()).results;
  assert.equal(queued.length, 6);
  await dispatchWebhooks(env);
  assert.equal([...received].filter(([id]) => !before.has(id)).length, 6);
  await mutate(subscription, 'PUT', { events: ['issue.created', 'issue.updated', 'issue.completed'], teamIds: [] });
}
