import { ToolRefusal, type Person, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { channelPreferences, saveChannelPreferences } from '../notifications/channel-preferences';
import { channelPreferencesInputSchema } from '../notifications/channel-schema';
import { subscriptions, subscribe, unsubscribe } from '../subscriptions/repository';
import { subscriptionInput } from '../subscriptions/schema';
import { readPersonalTime, updatePersonalTime } from '../settings/personal-time';
import { personalTimeInputSchema } from '../settings/personal-time-schema';
import { nativeMutation } from './native.ts';
import { idArgs } from './reads.ts';
import { workspaceRead, workspaceEmpty } from './workspace-shared.ts';

export async function workspaceSubscription(db: D1Database, person: Person, id: string) {
  const record = (await subscriptions(db, person.id)).subscriptions.find(row => row.id === id);
  if (!record) throw new ToolRefusal('not_found');
  return record;
}

export function workspacePersonalTools(env: WorkerBindings): ToolDefinition[] {
  return [
    workspaceRead(env, { name: 'notify.channels_and_digests', title: 'Read your channel overrides, inherited defaults and digest failures',
      scope: 'notifications:read', clauses: ['NOTIFY-007'], schema: workspaceEmpty,
      path: '/settings/notifications/channels', read: (db, p) => channelPreferences(db, p.id) }),
    nativeMutation(env, { name: 'vector.notify.channels_and_digests.save', title: 'Save or inherit your own notification channel choices',
      scope: 'notifications:write', clauses: ['NOTIFY-007'], schema: channelPreferencesInputSchema,
      method: 'PUT', path: '/settings/notifications/channels',
      revision: async (db, p) => JSON.stringify((await channelPreferences(db, p.id)).channels),
      run: (db, p, a) => saveChannelPreferences(db, p.id, a), uri: () => 'vector://preferences/channels' }),
    workspaceRead(env, { name: 'notify.subscriptions', title: 'Read your subject subscriptions and visible subjects',
      scope: 'subscriptions:read', clauses: ['NOTIFY-009'], schema: workspaceEmpty, read: (db, p) => subscriptions(db, p.id) }),
    workspaceRead(env, { name: 'notify.subscriptions.read', title: 'Read one of your subject subscriptions',
      scope: 'subscriptions:read', clauses: ['NOTIFY-009'], schema: idArgs,
      read: (db, p, a) => workspaceSubscription(db, p, a.id), uri: a => `vector://subscriptions/${a.id}` }),
    nativeMutation(env, { name: 'vector.notify.subscriptions.subscribe', title: 'Subscribe yourself to a visible native subject',
      scope: 'subscriptions:write', clauses: ['NOTIFY-009'], schema: subscriptionInput,
      method: 'POST', path: '/subscriptions',
      run: async (db, p, a) => { const result = await subscribe(db, p.id, a.subjectType, a.subjectId);
        return workspaceSubscription(db, p, result.id); }, uri: r => `vector://subscriptions/${r.id}` }),
    nativeMutation(env, { name: 'vector.notify.subscriptions.unsubscribe', title: 'Remove one of your subject subscriptions',
      scope: 'subscriptions:write', clauses: ['NOTIFY-009'], schema: idArgs,
      method: 'DELETE', path: '/subscriptions/:id', params: a => ({ id: a.id }),
      revision: async (db, p, a) => JSON.stringify(await workspaceSubscription(db, p, a.id)),
      run: (db, p, a) => unsubscribe(db, p.id, a.id), uri: (_r, a) => `vector://subscriptions/${a.id}`, resource: false }),
    workspaceRead(env, { name: 'notify.personal_time_zone_and_working_hours', title: 'Read your personal time zone and working hours',
      scope: 'preferences:read', clauses: ['NOTIFY-010'], schema: workspaceEmpty, path: '/settings/personal-time',
      read: (db, p) => readPersonalTime(db, p.id) }),
    nativeMutation(env, { name: 'vector.notify.personal_time_zone_and_working_hours.save', title: 'Save your personal time zone and working hours',
      scope: 'preferences:write', clauses: ['NOTIFY-010'], schema: personalTimeInputSchema,
      method: 'PATCH', path: '/settings/personal-time', revision: async (db, p) => JSON.stringify(await readPersonalTime(db, p.id)),
      run: async (db, p, a) => { await updatePersonalTime(db, p.id, a); return readPersonalTime(db, p.id); },
      uri: () => 'vector://preferences/personal-time' }),
  ];
}
