import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import type { collaborationFixture } from './collaboration-fixture';
import { snapshot, resetLimits } from './role-fixture';
import { signIn, request } from './base-auth-fixture';
import { afterNativeStatement } from './notification-session-fixture';

type Fixture = Awaited<ReturnType<typeof collaborationFixture>>;
async function body(response: Response, status = 200): Promise<any> {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json();
}
const action = (response: Response) => {
  expect(response.headers.get('x-vector-undo')).toBeTruthy();
  return JSON.parse(response.headers.get('x-vector-undo')!);
};
const storage = () => snapshot(['issues', 'issue_parents', 'issue_activity', 'audit_records', 'issue_followers', 'notifications', 'notification_events', 'subissue_progress_events']);

/** One mounted native journey, with actual ordered relations and progress rules. */
export async function parentUndoScenario(f: Fixture) {
  await resetLimits();
  const team = f.initial.teams[0], read = (id: string) => f.data(f.cookie, '/issues/' + id);
  const progress = (id: string) => f.data(f.cookie, '/issues/' + id + '/subissues');
  const undo = (id: string, cookie = f.cookie) => f.any(cookie, '/issues/undo', 'POST', { actionId: id });
  const parent = await f.create({ title: 'synthetic-vector-2001' });
  const other = await f.create({ title: 'synthetic-vector-2002' });
  const child = await f.create({ title: 'synthetic-vector-2003' });
  const sibling = await f.create({ title: 'synthetic-vector-2004' });
  const link = async (id: string, parentIdentifier: string | null, cookie = f.cookie) => {
    const current = await read(id);
    const response = await f.any(cookie, '/issues/' + id + '/parent', 'PATCH', { expectedVersion: current.version, parentIdentifier });
    await body(response); return response;
  };
  const edge = () => env.DB.prepare('SELECT * FROM issue_parents WHERE issue_id=?').bind(child.id).first();
  await link(sibling.identifier, parent.identifier);
  await link(child.identifier, parent.identifier);
  let p = await progress(parent.identifier);
  await body(await f.call('/issues/' + parent.identifier + '/subissues', 'PATCH', { expectedVersion: p.version, identifiers: [child.identifier, sibling.identifier] }));
  const original = await edge();
  // Set, change and clear preserve the exact edge, including its first position.
  for (const destination of [other.identifier, null]) {
    const response = await link(child.identifier, destination), receipt = action(response);
    expect(receipt.identifiers).toEqual([child.identifier]);
    expect(receipt.expiresAt - Date.now()).toBeGreaterThan(0);
    expect(receipt.expiresAt - Date.now()).toBeLessThanOrEqual(10_000);
    await body(await undo(receipt.actionId));
    expect(await edge()).toEqual(original);
    expect((await read(child.identifier)).parent.identifier).toBe(parent.identifier);
    expect((await progress(parent.identifier)).children.map((row: any) => row.identifier)).toEqual([child.identifier, sibling.identifier]);
    expect((await progress(other.identifier)).total).toBe(0);
    const activity = (await read(child.identifier)).activity.filter((row: any) => row.nextValue?.undoOf === receipt.actionId);
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({ kind: 'issue.parent_changed', actor: f.initial.operators.find(row => row.id === f.owner)!.name,
      previousValue: { parentIdentifier: destination }, nextValue: { parentIdentifier: parent.identifier } });
    const kept = await storage();
    await body(await undo(receipt.actionId), 409); expect(await storage()).toEqual(kept);
  }
  await link(child.identifier, null);
  const set = await link(child.identifier, other.identifier);
  await body(await undo(action(set).actionId)); expect(await edge()).toBeNull();
  const noop = await link(child.identifier, null); expect(noop.headers.get('x-vector-undo')).toBeNull();

  // A parent that lost its only unfinished child completes, and the destination
  // reopens. Undo returns both their original status timestamps and progress.
  const done = team.statuses.find(row => row.category === 'completed')!.id;
  await body(await f.call('/issues/' + sibling.identifier, 'PATCH', { expectedVersion: (await read(sibling.identifier)).version, statusId: done }));
  await link(child.identifier, parent.identifier);
  const completed = await f.create({ title: 'synthetic-vector-2005', statusId: done });
  await link(completed.identifier, other.identifier);
  const rule = await f.data(f.cookie, '/teams/' + team.id + '/subissue-rule');
  await body(await f.call('/teams/' + team.id + '/subissue-rule', 'PATCH', { expectedVersion: rule.version, enabled: true }));
  const beforeParents = await Promise.all([parent, other].map(row => read(row.identifier)));
  const moved = await link(child.identifier, other.identifier);
  expect((await read(parent.identifier)).status.category).toBe('completed');
  expect((await read(other.identifier)).status.category).toBe('unstarted');
  await body(await undo(action(moved).actionId));
  for (const [index, row] of [parent, other].entries()) {
    const current = await read(row.identifier);
    for (const field of ['status', 'completedAt', 'canceledAt', 'cycle', 'deferredUntil']) expect(current[field]).toEqual(beforeParents[index][field]);
  }
  expect((await progress(parent.identifier))).toMatchObject({ total: 2, completed: 1 });
  expect((await progress(other.identifier))).toMatchObject({ total: 1, completed: 1 });

  // Latest action, expiry, another session of this actor, and another actor.
  let changed = await link(child.identifier, other.identifier), receipt = action(changed);
  await body(await f.call('/issues/' + sibling.identifier, 'PATCH', { expectedVersion: (await read(sibling.identifier)).version, priority: 'urgent' }));
  let kept = await storage(); await body(await undo(receipt.actionId), 409); expect(await storage()).toEqual(kept);
  changed = await link(child.identifier, parent.identifier); receipt = action(changed);
  const ownerEmail = await env.DB.prepare('SELECT email FROM operators WHERE id=?').bind(f.owner).first<string>('email');
  const secondSession = await signIn(ownerEmail!);
  for (const cookie of [secondSession, f.bobCookie]) { kept = await storage(); await body(await undo(receipt.actionId, cookie), 409); expect(await storage()).toEqual(kept); }
  await env.DB.prepare("UPDATE issue_activity SET next_value_json=json_set(next_value_json,'$.undo.expiresAt','2000-01-01T00:00:00.000Z') WHERE id=?").bind(receipt.actionId).run();
  kept = await storage(); await body(await undo(receipt.actionId), 410); expect(await storage()).toEqual(kept);

  // Every later child, parent, sibling, ordering or ancestor change is fenced.
  for (const race of ['child', 'parent', 'sibling', 'order', 'graph']) {
    await resetLimits();
    const response = await link(child.identifier, other.identifier);
    const target = race === 'child' ? child : race === 'sibling' ? sibling : parent;
    if (race === 'graph') {
      const extra = await f.create({ title: 'synthetic-vector-2006' });
      await link(extra.identifier, parent.identifier, f.bobCookie);
    } else if (race === 'order') {
      p = await progress(other.identifier);
      await body(await f.any(f.bobCookie, '/issues/' + other.identifier + '/subissues', 'PATCH', { expectedVersion: p.version, identifiers: p.children.map((row: any) => row.identifier).reverse() }));
    } else await body(await f.any(f.bobCookie, '/issues/' + target.identifier, 'PATCH', { expectedVersion: (await read(target.identifier)).version, title: 'synthetic-vector-' + race }));
    kept = await storage(); await body(await undo(action(response).actionId), 409); expect(await storage()).toEqual(kept);
    await link(child.identifier, parent.identifier);
  }

  // Transaction-time admission, after the readable preflight has already run.
  changed = await link(child.identifier, other.identifier); receipt = action(changed);
  let raced = false, concurrentState: Awaited<ReturnType<typeof storage>> | undefined;
  const db = afterNativeStatement(async sql => {
    if (!raced && sql.includes('parent_issue_id') && sql.includes('unauthorized') && sql.includes('expired')) {
      raced = true;
      await body(await f.any(f.bobCookie, '/issues/' + parent.identifier, 'PATCH', { expectedVersion: (await read(parent.identifier)).version, title: 'synthetic-vector-2007' }));
      concurrentState = await storage();
    }
  });
  await body(await request('/api/issues/undo', 'POST', { actionId: receipt.actionId }, f.cookie, { DB: db }), 409);
  expect(raced).toBe(true); expect(await storage()).toEqual(concurrentState);
  await link(child.identifier, parent.identifier);

  // A real invited Guest may reverse in their invited team. Current Viewer
  // authority, withdrawn invitations and private parent access deny without data.
  await body(await f.call('/settings/operators/' + f.bob + '/role', 'PATCH', { role: 'guest', teamIds: [team.id] }));
  changed = await link(child.identifier, other.identifier, f.bobCookie);
  await body(await undo(action(changed).actionId, f.bobCookie));
  changed = await link(child.identifier, other.identifier, f.bobCookie); receipt = action(changed);
  await body(await f.call('/settings/operators/' + f.bob + '/role', 'PATCH', { role: 'viewer' }));
  kept = await storage(); await body(await undo(receipt.actionId, f.bobCookie), 403); expect(await storage()).toEqual(kept);
  await body(await f.any(f.bobCookie, '/issues/' + child.identifier + '/parent', 'PATCH', { expectedVersion: (await read(child.identifier)).version, parentIdentifier: null }), 403);
  expect(await storage()).toEqual(kept);
  await body(await f.call('/settings/operators/' + f.bob + '/role', 'PATCH', { role: 'member' }));
  const privateTeam = (await body(await f.call('/settings/teams', 'POST', { name: 'synthetic-vector-2008', identifierPrefix: 'UPVT', isPrivate: true }))).teams.find((row: any) => row.identifierPrefix === 'UPVT');
  await body(await f.call('/settings/teams/' + privateTeam.id + '/members/' + f.bob, 'PUT', { role: 'member' }));
  const secretParent = await f.create({ teamId: privateTeam.id, title: 'synthetic-vector-2009' });
  await link(child.identifier, secretParent.identifier, f.bobCookie);
  changed = await link(child.identifier, null, f.bobCookie); receipt = action(changed);
  await body(await f.call('/settings/teams/' + privateTeam.id + '/members/' + f.bob, 'DELETE'));
  kept = await storage(); const denied = await body(await undo(receipt.actionId, f.bobCookie), 404);
  expect(JSON.stringify(denied)).not.toContain(secretParent.identifier); expect(JSON.stringify(denied)).not.toContain(secretParent.id);
  expect(await storage()).toEqual(kept);
  await body(await f.call('/settings/operators/' + f.bob + '/role', 'PATCH', { role: 'guest', teamIds: [team.id] }));
  changed = await link(child.identifier, parent.identifier, f.bobCookie); receipt = action(changed);
  await body(await f.call('/settings/teams/' + team.id + '/members/' + f.bob, 'DELETE'));
  kept = await storage(); const withdrawn = await undo(receipt.actionId, f.bobCookie);
  expect([404, 409]).toContain(withdrawn.status); expect(await withdrawn.text()).not.toContain(child.identifier); expect(await storage()).toEqual(kept);
  await body(await f.call('/settings/operators/' + f.bob + '/role', 'PATCH', { role: 'member' }));
}
