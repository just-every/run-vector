import { z } from 'zod';
import { workspaceAuditResource } from './workspace-audit.ts';
import { ToolRefusal, type Person, type ResourceDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { getView } from '../views/service';
import { getPreference } from '../views/preferences';
import { preferenceSurfaceSchema } from '../views/schema';
import { readDashboard } from '../dashboards/service';
import { dashboardFiltersSchema } from '../dashboards/schema';
import { readAppearance } from '../settings/appearance';
import { readPersonalTime } from '../settings/personal-time';
import { preferences } from '../notifications/read';
import { channelPreferences } from '../notifications/channel-preferences';
import { notificationEmailAvailable } from '../notifications/context';
import { nativeId, nativeRead } from './reads.ts';
import { workspaceSubscription } from './workspace-personal.ts';
import { notificationId, workspaceNotification, workspaceReminder, workspaceReadAuthority } from './workspace-shared.ts';

export function vectorWorkspaceResources(env: WorkerBindings): ResourceDefinition[] {
  const resource = (kind: string, name: string, scope: string, schema: z.ZodType<string>,
    read: (db: D1Database, person: Person, key: string) => Promise<unknown>): ResourceDefinition => ({
    uriTemplate: `vector://${kind}/{id}`, name, scope, classes: ['standard'],
    classify: record => [{ class: 'standard', facts: { measure: record.json == null ? 0 : 1 } }],
    async read(uri, ctx) {
      try {
        const key = schema.parse(decodeURIComponent(uri.split('/').at(-1)!));
        const json = await nativeRead(env, ctx.person, db => read(db, ctx.person, key));
        return { json, untrusted: true };
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof URIError ||
          error instanceof ToolRefusal && ['not_found', 'forbidden'].includes(error.code)) return null;
        throw error;
      }
    },
  });
  const preferenceKey = z.union([preferenceSurfaceSchema, z.enum(['appearance', 'personal-time', 'notifications', 'channels'])]);
  return [
    workspaceAuditResource(env),
    resource('views', 'Visible saved view definition', 'views:read', nativeId, (db, p, id) => getView(db, p.id, id)),
    resource('notifications', 'Your visible notification and snooze state', 'notifications:read', notificationId, workspaceNotification),
    resource('reminders', 'Your personal issue reminder', 'notifications:read', notificationId, workspaceReminder),
    resource('subscriptions', 'Your subject subscription', 'subscriptions:read', nativeId, workspaceSubscription),
    resource('dashboards', 'Visible dashboard with current native widgets', 'reports:read', nativeId, async (db, p, id) => {
      await workspaceReadAuthority(db, p, '/dashboards/:id', { id });
      return readDashboard(db, p.id, id, dashboardFiltersSchema.parse({}));
    }),
    resource('preferences', 'Your native personal preferences', 'preferences:read', preferenceKey, async (db, p, key) => {
      if (key === 'appearance') return readAppearance(db, p.id);
      if (key === 'personal-time') return readPersonalTime(db, p.id);
      if (key === 'notifications') return preferences(db, p.id, notificationEmailAvailable(env));
      if (key === 'channels') return channelPreferences(db, p.id);
      return getPreference(db, p.id, preferenceSurfaceSchema.parse(key));
    }),
  ];
}
