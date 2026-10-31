import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import type { collaborationFixture } from './collaboration-fixture';
import { resetLimits, snapshot } from './role-fixture';

type Fixture = Awaited<ReturnType<typeof collaborationFixture>>;
async function body(response: Response, status = 200): Promise<any> {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json();
}
const receipt = (response: Response) => {
  expect(response.headers.get('x-vector-undo')).toBeTruthy();
  return JSON.parse(response.headers.get('x-vector-undo')!);
};

/** The two reviewed regressions extend the surviving native Undo registration. */
export async function parentUndoBlockers(f: Fixture) {
  await resetLimits();
  const team = f.initial.teams[0], read = (id: string, cookie = f.cookie) => f.data(cookie, '/issues/' + id);
  const status = (category: string) => team.statuses.find(row => row.category === category)!.id;
  const undo = (id: string, cookie = f.cookie) => f.any(cookie, '/issues/undo', 'POST', { actionId: id });
  const link = async (child: any, parent: any, cookie = f.cookie) => {
    const response = await f.any(cookie, '/issues/' + child.identifier + '/parent', 'PATCH', {
      expectedVersion: (await read(child.identifier)).version, parentIdentifier: parent?.identifier ?? null,
    });
    await body(response.clone()); return response;
  };
  const editStatus = async (issue: any, category: string) => body(await f.call('/issues/' + issue.identifier, 'PATCH', {
    expectedVersion: (await read(issue.identifier)).version, statusId: status(category),
  }));
  const rule = await f.data(f.cookie, '/teams/' + team.id + '/subissue-rule');
  await body(await f.call('/teams/' + team.id + '/subissue-rule', 'PATCH', { expectedVersion: rule.version, enabled: true }));
  const parent = await f.create({ title: 'synthetic-vector-2030' });
  const child = await f.create({ title: 'synthetic-vector-2031' });
  const sibling = await f.create({ title: 'synthetic-vector-2032' });
  await link(child, parent); await link(sibling, parent);
  await editStatus(parent, 'completed');
  const before = await read(parent.identifier);
  expect(before.completedAt).toBeTruthy();
  const edge = await env.DB.prepare('SELECT * FROM issue_parents WHERE issue_id=?').bind(child.id).first();
  const action = receipt(await link(child, null));
  expect(await read(parent.identifier)).toMatchObject({ status: { category: 'unstarted' }, completedAt: null });
  await body(await undo(action.actionId));
  expect(await read(parent.identifier)).toMatchObject({ status: before.status, completedAt: before.completedAt });
  expect(await env.DB.prepare('SELECT * FROM issue_parents WHERE issue_id=?').bind(child.id).first()).toEqual(edge);
  expect(await f.data(f.cookie, '/issues/' + parent.identifier + '/subissues')).toMatchObject({ total: 2, completed: 0 });
  for (const issue of [child, parent]) expect((await read(issue.identifier)).activity.filter((row: any) => row.nextValue?.undoOf === action.actionId)).toHaveLength(1);

  // Restoring a child's status can run automation on an ancestor even when
  // that ancestor's captured before/after status was identical.
  const ancestor = await f.create({ title: 'synthetic-vector-2033' });
  await link(parent, ancestor); await editStatus(sibling, 'completed');
  await editStatus(parent, 'unstarted'); await editStatus(ancestor, 'completed');
  const beforeAncestor = await read(ancestor.identifier), beforeParent = await read(parent.identifier);
  const moved = receipt(await link(child, null));
  expect((await read(parent.identifier)).status.category).toBe('completed');
  expect((await read(ancestor.identifier)).completedAt).toBe(beforeAncestor.completedAt);
  await body(await undo(moved.actionId));
  expect(await read(parent.identifier)).toMatchObject({ status: beforeParent.status, completedAt: beforeParent.completedAt });
  expect(await read(ancestor.identifier)).toMatchObject({ status: beforeAncestor.status, completedAt: beforeAncestor.completedAt });

  const teams = await body(await f.call('/settings/teams', 'POST', { name: 'synthetic-vector-2034', identifierPrefix: 'UHP', isPrivate: true }));
  const privateTeam = teams.teams.find((row: any) => row.identifierPrefix === 'UHP');
  const hidden = await f.create({ title: 'synthetic-vector-2035', teamId: privateTeam.id });
  const publicParent = await f.create({ title: 'synthetic-vector-2036' });
  const otherParent = await f.create({ title: 'synthetic-vector-2037' });
  const publicChild = await f.create({ title: 'synthetic-vector-2038' });
  await link(publicParent, hidden);
  await body(await f.any(f.bobCookie, '/issues/' + hidden.identifier), 404);
  expect((await read(publicParent.identifier, f.bobCookie)).parent).toBeNull();
  const noLeak = (value: unknown) => {
    for (const secret of [hidden.id, hidden.identifier, hidden.title]) expect(JSON.stringify(value)).not.toContain(secret);
  };
  for (const [target, previous] of [[publicParent, null], [otherParent, publicParent], [null, publicParent]]) {
    await resetLimits();
    if (previous) await link(publicChild, previous);
    const response = await link(publicChild, target, f.bobCookie), saved = receipt(response);
    noLeak(saved); noLeak(await response.clone().json());
    expect(saved.identifiers).toEqual([publicChild.identifier]);
    const reversed = await body(await undo(saved.actionId, f.bobCookie)); noLeak(reversed);
    const restored = await read(publicChild.identifier, f.bobCookie); noLeak(restored);
    expect(restored.parent?.id ?? null).toBe(previous?.id ?? null);
    expect(restored.activity.filter((row: any) => row.nextValue?.undoOf === saved.actionId)).toHaveLength(1);
    expect(restored.activity.find((row: any) => row.nextValue?.undoOf === saved.actionId).actor)
      .toBe(await env.DB.prepare('SELECT name FROM operators WHERE id=?').bind(f.bob).first('name'));
  }
  // Hidden later work still fences the reversal, without naming that ancestor.
  const saved = receipt(await link(publicChild, otherParent, f.bobCookie));
  await body(await f.call('/issues/' + hidden.identifier, 'PATCH', { expectedVersion: (await read(hidden.identifier)).version, title: 'synthetic-vector-2039' }));
  const tables = ['issues', 'issue_parents', 'issue_activity', 'notifications', 'notification_events', 'audit_records'];
  const kept = await snapshot(tables);
  noLeak(await body(await undo(saved.actionId, f.bobCookie), 409));
  expect(await snapshot(tables)).toEqual(kept);
}
