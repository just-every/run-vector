import { expect, it } from 'vitest';
import { collaborationFixture } from './collaboration-fixture';

it('[NOTIFY-001 NOTIFY-003] only the last resolved blocker notifies the assignee, once and never its actor', async () => {
  const f = await collaborationFixture(), team = f.initial.teams[0];
  const status = (category: string) => team.statuses.find(row => row.category === category)!.id;
  const read = async (response: Response) => {
    expect(response.status, await response.clone().text()).toBe(200);
    return response.json() as Promise<any>;
  };
  const detail = (identifier: string) => f.data(f.cookie, '/issues/' + identifier);
  const events = async (cookie: string, identifier: string) =>
    (await f.data(cookie, '/notifications?limit=50')).items.filter((row: any) => row.identifier === identifier && row.causes.includes('unblocked'));
  const issue = await f.create({ assigneeOperatorId: f.owner });
  const blockers = await Promise.all([f.create(), f.create()]);
  for (const blocker of blockers) {
    const current = await detail(issue.identifier);
    await read(await f.any(f.bobCookie, '/issues/' + issue.identifier + '/dependencies', 'POST', {
      expectedVersion: current.version, relatedIdentifier: blocker.identifier,
      relatedVersion: blocker.version, direction: 'blocked-by',
    }));
  }
  for (const [index, blocker] of blockers.entries()) {
    const current = await detail(blocker.identifier);
    const completed = await read(await f.any(f.bobCookie, '/issues/' + blocker.identifier, 'PATCH', {
      expectedVersion: current.version, statusId: status('completed'),
    }));
    expect(await events(f.cookie, issue.identifier)).toHaveLength(index);
    expect(await events(f.bobCookie, issue.identifier)).toEqual([]);
    await read(await f.any(f.bobCookie, '/issues/' + blocker.identifier, 'PATCH', {
      expectedVersion: completed.version, statusId: status('completed'),
    }));
    expect(await events(f.cookie, issue.identifier)).toHaveLength(index);
  }
  const notification = (await events(f.cookie, issue.identifier))[0];
  expect(notification.actor).toBe((await f.state()).operators.find(row => row.id === f.bob)!.name);
  const reopened = await detail(blockers[0].identifier);
  await read(await f.any(f.bobCookie, '/issues/' + reopened.identifier, 'PATCH', {
    expectedVersion: reopened.version, statusId: status('started'),
  }));
  const current = await detail(blockers[0].identifier);
  await read(await f.call('/issues/' + current.identifier, 'PATCH', {
    expectedVersion: current.version, statusId: status('completed'),
  }));
  expect(await events(f.cookie, issue.identifier)).toEqual([notification]);
});
