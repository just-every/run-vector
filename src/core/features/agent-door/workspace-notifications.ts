import { z } from 'zod';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { inbox, unreadCount, subscription, preferences } from '../notifications/read';
import { markRead, changeSubscription, changePreferences } from '../notifications/mutations';
import { notificationKinds } from '../notifications/schema';
import { notificationEmailAvailable } from '../notifications/context';
import { snooze, unsnooze, reminders, createReminder, cancelReminder } from '../notification-followups/repository';
import { nativeMutation } from './native.ts';
import { issueArgs, identifier } from './reads.ts';
import { workspaceRead, workspaceEmpty, notificationId, workspaceNotification, workspaceReminder } from './workspace-shared.ts';

const notificationArgs = z.object({ id: notificationId }).strict();
const subscriptionInput = z.object({ following: z.boolean().optional(), muted: z.boolean().optional() })
  .strict().refine(v => Object.keys(v).length > 0);
const notificationPreferences = z.object({ emailEnabled: z.boolean().optional(),
  mutedKinds: z.array(z.enum(notificationKinds)).max(notificationKinds.length)
    .refine(v => new Set(v).size === v.length).optional(),
}).strict().refine(v => Object.keys(v).length > 0);
const pageArgs = z.object({ limit: z.number().int().min(1).max(50).default(30), snoozed: z.boolean().default(false),
  cursor: z.object({ at: z.iso.datetime(), id: notificationId }).strict().optional() }).strict();
const notificationUri = (_r: unknown, a: any) => `vector://notifications/${a.id}`;

export function workspaceNotificationTools(env: WorkerBindings): ToolDefinition[] {
  const prefs = (db: D1Database, person: { id: string }) => preferences(db, person.id, notificationEmailAvailable(env));
  return [
    workspaceRead(env, { name: 'notify.inbox_events', title: 'Read your visible inbox events', scope: 'notifications:read',
      clauses: ['NOTIFY-001'], schema: pageArgs, read: (db, p, a) => inbox(db, p.id, a.limit, a.cursor, a.snoozed) }),
    workspaceRead(env, { name: 'notify.inbox_events.read', title: 'Read one of your visible notifications', scope: 'notifications:read',
      clauses: ['NOTIFY-001'], schema: notificationArgs, read: (db, p, a) => workspaceNotification(db, p, a.id),
      uri: a => notificationUri(null, a) }),
    workspaceRead(env, { name: 'notify.inbox_events.count', title: 'Read your current unread notification count',
      scope: 'notifications:read', clauses: ['NOTIFY-001'], schema: workspaceEmpty,
      read: async (db, p) => ({ unreadCount: await unreadCount(db, p.id) }) }),
    workspaceRead(env, { name: 'notify.followers', title: 'Read your follow and mute state on an issue', scope: 'notifications:read',
      clauses: ['NOTIFY-002'], schema: issueArgs, read: (db, p, a) => subscription(db, p.id, a.identifier) }),
    workspaceRead(env, { name: 'notify.no_self_notification', title: 'Read your native inbox with self-event suppression',
      scope: 'notifications:read', clauses: ['NOTIFY-003'], schema: pageArgs,
      read: (db, p, a) => inbox(db, p.id, a.limit, a.cursor, a.snoozed) }),
    nativeMutation(env, { name: 'vector.notify.read_and_mute', title: 'Change your issue follow or mute state',
      scope: 'notifications:write', clauses: ['NOTIFY-002', 'NOTIFY-004'],
      schema: z.object({ identifier, input: subscriptionInput }).strict(), method: 'PATCH', path: '/issues/:identifier/subscription',
      params: a => ({ identifier: a.identifier }), body: a => a.input,
      revision: async (db, p, a) => JSON.stringify(await subscription(db, p.id, a.identifier)),
      run: async (db, p, a) => { await changeSubscription(db, p.id, a.identifier, a.input); return subscription(db, p.id, a.identifier); },
      uri: (_r, a) => `vector://issues/${a.identifier}` }),
    nativeMutation(env, { name: 'vector.notify.read_and_mute.read', title: 'Mark one of your visible notifications read',
      scope: 'notifications:write', clauses: ['NOTIFY-004'], schema: notificationArgs, method: 'POST',
      path: '/notifications/:id/read', params: a => ({ id: a.id }), body: () => ({}),
      revision: async (db, p, a) => JSON.stringify(await workspaceNotification(db, p, a.id)),
      run: async (db, p, a) => { await markRead(db, p.id, a.id); return workspaceNotification(db, p, a.id); }, uri: notificationUri }),
    nativeMutation(env, { name: 'vector.notify.read_and_mute.read_all', title: 'Mark your visible notifications read',
      scope: 'notifications:write', clauses: ['NOTIFY-004'], schema: workspaceEmpty,
      method: 'POST', path: '/notifications/read-all', body: () => ({}),
      run: async (db, p) => { await markRead(db, p.id); return { unreadCount: await unreadCount(db, p.id) }; } }),
    workspaceRead(env, { name: 'notify.due_reminders', title: 'Read your pending personal reminders for an issue',
      scope: 'notifications:read', clauses: ['NOTIFY-005', 'NOTIFY-008'], schema: issueArgs,
      read: (db, p, a) => reminders(db, p.id, a.identifier) }),
    workspaceRead(env, { name: 'notify.assignment_and_mention_email', title: 'Read your email notification preference and delivery failures',
      scope: 'notifications:read', clauses: ['NOTIFY-006'], schema: workspaceEmpty, path: '/settings/notifications', read: prefs }),
    nativeMutation(env, { name: 'vector.notify.assignment_and_mention_email.save', title: 'Save your email and notification-kind preferences',
      scope: 'notifications:write', clauses: ['NOTIFY-004', 'NOTIFY-006'], schema: notificationPreferences,
      method: 'PATCH', path: '/settings/notifications', revision: async (db, p) => {
        const { emailEnabled, mutedKinds } = await prefs(db, p); return JSON.stringify({ emailEnabled, mutedKinds }); },
      run: async (db, p, a) => { await changePreferences(db, p.id, a); return prefs(db, p); },
      uri: () => 'vector://preferences/notifications' }),
    nativeMutation(env, { name: 'vector.notify.snooze_and_reminders', title: 'Create a personal issue reminder',
      scope: 'notifications:write', clauses: ['NOTIFY-008'], schema: z.object({ identifier, remindAt: z.iso.datetime() }).strict(),
      method: 'POST', path: '/issues/:identifier/reminders', params: a => ({ identifier: a.identifier }), body: a => ({ remindAt: a.remindAt }),
      run: async (db, p, a) => {
        const before = new Set((await reminders(db, p.id, a.identifier)).reminders.map(r => r.id));
        const result = await createReminder(db, p.id, a.identifier, a.remindAt);
        const created = result.reminders.find(r => !before.has(r.id));
        if (!created) throw new Error('Native reminder insertion returned no new record.');
        return workspaceReminder(db, p, String(created.id));
      }, uri: r => `vector://reminders/${r.id}` }),
    nativeMutation(env, { name: 'vector.notify.snooze_and_reminders.cancel', title: 'Cancel your pending personal reminder',
      scope: 'notifications:write', clauses: ['NOTIFY-008'], schema: z.object({ identifier, id: notificationId }).strict(),
      method: 'DELETE', path: '/issues/:identifier/reminders/:id', params: a => ({ identifier: a.identifier, id: a.id }), body: () => ({}),
      revision: async (db, p, a) => JSON.stringify(await workspaceReminder(db, p, a.id)),
      run: (db, p, a) => cancelReminder(db, p.id, a.identifier, a.id),
      uri: (_r, a) => `vector://issues/${a.identifier}` }),
    nativeMutation(env, { name: 'vector.notify.snooze_and_reminders.snooze', title: 'Snooze one of your notifications until a time or issue change',
      scope: 'notifications:write', clauses: ['NOTIFY-008'],
      schema: notificationArgs.extend({ input: z.union([z.object({ until: z.iso.datetime() }).strict(), z.object({ untilChange: z.literal(true) }).strict()]) }),
      method: 'POST', path: '/notifications/:id/snooze', params: a => ({ id: a.id }), body: a => a.input,
      revision: async (db, p, a) => JSON.stringify(await workspaceNotification(db, p, a.id)),
      run: async (db, p, a) => { await snooze(db, p.id, a.id, a.input); return workspaceNotification(db, p, a.id); }, uri: notificationUri }),
    nativeMutation(env, { name: 'vector.notify.snooze_and_reminders.unsnooze', title: 'Return one of your snoozed notifications to the inbox',
      scope: 'notifications:write', clauses: ['NOTIFY-008'], schema: notificationArgs,
      method: 'POST', path: '/notifications/:id/unsnooze', params: a => ({ id: a.id }), body: () => ({}),
      revision: async (db, p, a) => JSON.stringify(await workspaceNotification(db, p, a.id)),
      run: async (db, p, a) => { await unsnooze(db, p.id, a.id); return workspaceNotification(db, p, a.id); }, uri: notificationUri }),
  ];
}
