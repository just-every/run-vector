import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { contractWith } from '../contract-tags';
import { collaborationFixture } from './collaboration-fixture';
import { tick } from './due-reminders-fixture';
import type { InboxPage } from '../../src/core/features/notifications/schema';

contractWith(it, 'NOTIFY-008', 'snoozes return once by time or issue change and personal reminders deliver privately once', async () => {
  const f = await collaborationFixture();
  const issue = await f.create({ title: 'Review checkout accessibility', assigneeOperatorId: f.bob });
  const call = (path: string, method = 'GET', body?: unknown) => f.any(f.bobCookie, path, method, body);
  async function page(snoozed = false) {
    const response = await call('/notifications' + (snoozed ? '?snoozed=true' : ''));
    expect(response.status, await response.clone().text()).toBe(200);
    return response.json() as Promise<InboxPage>;
  }
  const original = (await page()).items.find(n => n.identifier === issue.identifier)!;
  expect(original).toBeDefined();
  const at = new Date(Date.now() + 3_600_000).toISOString();
  expect((await f.call('/notifications/' + original.id + '/snooze', 'POST', { until: at })).status).toBe(404);
  expect((await call('/notifications/' + original.id + '/snooze', 'POST', { until: new Date(Date.now() - 1).toISOString() })).status).toBe(400);
  expect((await call('/notifications/' + original.id + '/snooze', 'POST', { until: at, untilChange: true })).status).toBe(400);
  expect((await call('/notifications/' + original.id + '/snooze', 'POST', { until: at })).status).toBe(200);
  expect((await page()).items.some(n => n.id === original.id)).toBe(false);
  expect((await page(true)).items).toMatchObject([{ id: original.id, snoozedUntil: at }]);
  await tick(new Date(Date.parse(at) - 1).toISOString());
  expect((await page()).items.some(n => n.id === original.id)).toBe(false);
  await Promise.all([tick(at), tick(at)]);
  expect((await page()).items.filter(n => n.id === original.id)).toHaveLength(1);
  expect((await page()).items.find(n => n.id === original.id)).toMatchObject({ readAt: null, visibleAt: at });
  expect((await page(true)).items).toHaveLength(0);
  await tick(new Date(Date.parse(at) + 60_000).toISOString());
  expect((await page()).items.find(n => n.id === original.id)?.visibleAt).toBe(at);

  expect((await call('/notifications/' + original.id + '/snooze', 'POST', { untilChange: true })).status).toBe(200);
  expect((await page(true)).items[0]).toMatchObject({ id: original.id, snoozeOnChange: true });
  const comment = await f.call('/issues/' + issue.identifier + '/comments', 'POST', { body: 'The keyboard path is ready for review.' });
  expect(comment.status, await comment.clone().text()).toBe(201);
  expect((await page()).items.filter(n => n.id === original.id)).toHaveLength(1);
  expect((await page(true)).items).toHaveLength(0);
  expect((await call('/notifications/' + original.id + '/snooze', 'POST', { until: at })).status).toBe(200);
  expect((await call('/notifications/' + original.id + '/unsnooze', 'POST')).status).toBe(200);
  expect((await call('/notifications/' + original.id + '/unsnooze', 'POST')).status).toBe(404);

  const path = '/issues/' + issue.identifier + '/reminders';
  const remindAt = new Date(Date.now() + 7_200_000).toISOString();
  const created = await call(path, 'POST', { remindAt });
  expect(created.status, await created.clone().text()).toBe(200);
  const reminders = (await created.json()) as { reminders: { id: string; remindAt: string }[] };
  expect(reminders.reminders).toMatchObject([{ remindAt }]);
  expect((await (await f.call(path)).json()) as unknown).toEqual({ reminders: [] });
  expect((await f.call(path + '/' + reminders.reminders[0].id, 'DELETE')).status).toBe(404);
  const canceled = await call(path, 'POST', { remindAt });
  const cancelId = ((await canceled.json()) as typeof reminders).reminders.find(r => r.id !== reminders.reminders[0].id)!.id;
  expect((await call(path + '/' + cancelId, 'DELETE')).status).toBe(200);
  await env.DB.prepare("INSERT INTO vector_restore_status(id,import_id,effects_held) VALUES(1,'followup-fixture',1)").run();
  await env.DB.prepare("INSERT INTO vector_restore_operator_grants(auth_id,approved_at) SELECT auth_id,? FROM vector_auth_operators WHERE operator_id=?").bind(remindAt, f.bob).run();
  await tick(remindAt);
  expect((await page()).items.filter(n => n.causes.includes('reminder'))).toHaveLength(0);
  await env.DB.prepare('UPDATE vector_restore_status SET effects_held=0').run();
  await Promise.all([tick(remindAt), tick(remindAt)]);
  await tick(new Date(Date.parse(remindAt) + 60_000).toISOString());
  expect((await page()).items.filter(n => n.causes.includes('reminder'))).toMatchObject([{ identifier: issue.identifier, createdAt: remindAt }]);
  expect((await (await call(path)).json()) as unknown).toEqual({ reminders: [] });
  expect(await env.DB.prepare("SELECT count(*) n FROM audit_records WHERE subject_id=? AND action='personal_reminder.delivered'").bind(issue.id).first('n')).toBe(1);
});
