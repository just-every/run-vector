import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { setupAdministration, beforeBatch } from './administration-fixture';
import { actor, bindings, invite, origin, request, signIn } from './base-auth-fixture';
import { createApiApp } from '../../src/core/app/api';
import { Hono } from 'hono';
import { liveConnection } from '../../src/core/features/live-sync/server';
import type { AppEnvironment } from '../../src/core/app/bindings';

it('[SYNC-001] native sockets dispatch committed visible changes and retain current session and workspace authority', async () => {
  const f = await setupAdministration();
  const suffix = crypto.randomUUID();
  const memberEmail = ['synthetic-vector-' + suffix, 'vector.test'].join('@');
  const memberCookie = await invite(memberEmail, f.cookie);
  const member = await actor(memberCookie);
  const app = new Hono<AppEnvironment>();
  app.get('/api/live-sync', c => liveConnection(c.req.raw, c.env));
  app.route('/api', createApiApp());
  const mountedRequest = (path: string, method: string, data: unknown, cookie: string) => app.request(origin + '/api' + path, {
    method, headers: { host: new URL(origin).host, Origin: origin, cookie, 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  }, bindings);
  const connect = (cookie = memberCookie, extra: Record<string, string> = {}) => app.request(origin + '/api/live-sync', {
    headers: { host: new URL(origin).host, cookie, Origin: origin, Upgrade: 'websocket', ...extra },
  }, bindings);
  expect((await connect('', {})).status).toBe(401);
  expect((await connect(memberCookie, { Origin: 'https://foreign.invalid' })).status).toBe(403);
  expect((await app.request(origin + '/api/live-sync', { headers: { host: new URL(origin).host, cookie: memberCookie, Origin: origin } }, bindings)).status).toBe(426);
  const response = await connect();
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  const messages: string[] = [];
  socket.addEventListener('message', event => { messages.push(String(event.data)); });
  const barrier = async () => {
    const pong = new Promise<void>(resolve => {
      const receive = (event: MessageEvent) => {
        if (event.data === '{"type":"pong"}') { socket.removeEventListener('message', receive); resolve(); }
      };
      socket.addEventListener('message', receive);
    });
    socket.send('ping');
    await pong;
  };
  await barrier();
  const signals = () => messages.filter(message => message === '{"type":"invalidate"}').length;
  const issue = await f.create({ title: 'synthetic-vector-1' });
  let count = signals();
  expect((await f.call(`/issues/${issue.identifier}`, 'PATCH', { expectedVersion: 1, title: 'synthetic-vector-2' })).status).toBe(200);
  await barrier();
  expect(signals()).toBe(++count);
  const read = await request(`/api/issues/${issue.identifier}`, 'GET', undefined, memberCookie);
  expect(read.status).toBe(200);
  expect((await read.json() as { title: string }).title).toBe('synthetic-vector-2');
  expect((await f.call(`/issues/${issue.identifier}`, 'PATCH', { expectedVersion: 2, title: 'synthetic-vector-2' })).status).toBe(200);
  expect((await f.call(`/issues/${issue.identifier}`, 'PATCH', { expectedVersion: 1, title: 'Uncommitted stale title' })).status).toBe(409);
  const viewerCookie = await invite(['synthetic-vector-viewer-' + suffix, 'vector.test'].join('@'), f.cookie, 'viewer');
  expect((await request(`/api/issues/${issue.identifier}`, 'PATCH', { expectedVersion: 2, title: 'Refused title' }, viewerCookie)).status).toBe(403);
  await barrier();
  expect(signals()).toBe(count);
  const race = await Promise.all(['synthetic-vector-3', 'synthetic-vector-4'].map(title => f.call(`/issues/${issue.identifier}`, 'PATCH', { expectedVersion: 2, title })));
  expect(race.map(row => row.status).sort()).toEqual([200, 409]);
  await barrier();
  expect(signals()).toBe(++count);
  const intakeResponse = await f.call('/intake', 'POST', { teamId: f.initial.teams[0].id, title: 'synthetic-vector-5' });
  expect(intakeResponse.status).toBe(201);
  const intake = await intakeResponse.json() as { identifier: string; version: number };
  for (const [action, data] of [
    ['defer', { expectedVersion: 1, returnAt: new Date(Date.now() + 600000).toISOString() }],
    ['return', { expectedVersion: 2 }],
    ['accept', { expectedVersion: 3 }],
  ] as const) {
    expect((await f.call(`/issues/${intake.identifier}/${action}`, 'POST', data)).status).toBe(200);
    await barrier();
    expect(signals()).toBe(++count);
  }
  // Withdrawal is checked at dispatch, rather than copied into the attachment.
  const team = f.initial.teams[0].id;
  await env.DB.prepare('UPDATE teams SET is_private=1 WHERE id=?').bind(team).run();
  await env.DB.prepare('DELETE FROM team_members WHERE team_id=? AND operator_id=?').bind(team, member).run();
  expect((await f.call(`/issues/${issue.identifier}`, 'PATCH', { expectedVersion: 3, title: 'Confidential title' })).status).toBe(200);
  await barrier();
  expect(signals()).toBe(count);
  expect((await request(`/api/issues/${issue.identifier}`, 'GET', undefined, memberCookie)).status).toBe(404);
  const privateReconnect = await connect();
  expect(privateReconnect.status).toBe(101);
  privateReconnect.webSocket!.accept();
  privateReconnect.webSocket!.close();
  await env.DB.prepare('UPDATE teams SET is_private=0 WHERE id=?').bind(team).run();
  // Revoke after request admission but before commit: no activity or hint escapes.
  const before = await env.DB.prepare('SELECT COUNT(*) n FROM issue_activity').first<number>('n');
  const ownSocket = await connect(f.cookie);
  expect(ownSocket.status).toBe(101);
  ownSocket.webSocket!.accept();
  const refused = await createApiApp().request(origin + `/issues/${issue.identifier}`, {
    method: 'PATCH', headers: { host: new URL(origin).host, cookie: f.cookie, Origin: origin, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedVersion: 4, title: 'Rolled back title' }),
  }, { ...bindings, DB: beforeBatch(async () => { expect((await request('/auth/signout', 'POST', {}, f.cookie)).status).toBe(204); }) });
  expect(refused.status).toBe(401);
  await barrier();
  expect(signals()).toBe(count);
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM issue_activity').first<number>('n')).toBe(before);
  expect((await connect(f.cookie)).status).toBe(401);
  const closed = new Promise<CloseEvent>(resolve => socket.addEventListener('close', resolve, { once: true }));
  expect((await request('/auth/signout', 'POST', {}, memberCookie)).status).toBe(204);
  socket.send('ping');
  expect((await closed).code).toBe(4001);
  expect((await connect()).status).toBe(401);
  // The same workspace identity in another native session remains usable.
  const nextCookie = await signIn();
  const fresh = await connect(nextCookie);
  expect(fresh.status).toBe(101);
  fresh.webSocket!.accept(); fresh.webSocket!.close();
  const nextMemberCookie = await signIn(memberEmail);
  const oldWorkspace = await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(member).first<string>('workspace_id');
  const moved = await connect(nextMemberCookie);
  expect(moved.status).toBe(101);
  moved.webSocket!.accept();
  const movedClosed = new Promise<CloseEvent>(resolve => moved.webSocket!.addEventListener('close', resolve, { once: true }));
  const foreign = 'synthetic-vector-foreign-' + suffix;
  await env.DB.prepare('INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)').bind(foreign, 'synthetic-vector-foreign', 'UTC', 'now', 'now').run();
  await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(foreign, member).run();
  expect((await mountedRequest(`/issues/${issue.identifier}`, 'PATCH', { expectedVersion: 4, title: 'synthetic-vector-foreign-fenced' }, nextCookie)).status).toBe(200);
  expect((await movedClosed).code).toBe(4001);
  expect((await mountedRequest(`/issues/${issue.identifier}`, 'GET', undefined, nextMemberCookie)).status).toBe(404);
  // Reconnect follows today's workspace, ignoring any old scope in the URL.
  const foreignResponse = await connect(nextMemberCookie);
  expect(foreignResponse.status).toBe(101);
  const foreignSocket = foreignResponse.webSocket!;
  foreignSocket.accept();
  const foreignFrames: string[] = [];
  foreignSocket.addEventListener('message', event => { foreignFrames.push(String(event.data)); });
  expect((await mountedRequest(`/issues/${issue.identifier}`, 'PATCH', { expectedVersion: 5, title: 'synthetic-vector-foreign-hidden' }, nextCookie)).status).toBe(200);
  const foreignPong = new Promise<void>(resolve => foreignSocket.addEventListener('message', event => { if (event.data === '{"type":"pong"}') resolve(); }));
  foreignSocket.send('ping'); await foreignPong;
  expect(foreignFrames).not.toContain('{"type":"invalidate"}');
  foreignSocket.close();
  await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(oldWorkspace, member).run();
  await env.DB.prepare('DELETE FROM workspace_settings WHERE id=?').bind(foreign).run();
  ownSocket.webSocket!.close();
  expect(messages.every(value => ['{"type":"ready"}', '{"type":"pong"}', '{"type":"invalidate"}'].includes(value))).toBe(true);
});
