import { z } from 'zod';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { listViews, getView, createView, updateView, duplicateView } from '../views/service';
import { getPreference, putPreference, resetPreference } from '../views/preferences';
import { createViewSchema, updateViewSchema, duplicateViewSchema, preferenceInputSchema, preferenceSurfaceSchema } from '../views/schema';
import { listIssues, issueListResponse } from '../issues/list';
import { issueListQuerySchema } from '../issues/list-schema';
import { readMonthCalendar } from '../calendar-view/read';
import { monthSchema } from '../calendar-view/schema';
import { readAppearance, updateAppearance } from '../settings/appearance';
import { appearanceSchema } from '../settings/appearance-schema';
import { idArgs, nativeId } from './reads.ts';
import { nativeMutation } from './native.ts';
import { workspaceRead, workspaceEmpty } from './workspace-shared.ts';

const viewUri = (_r: unknown, a: any) => `vector://views/${a.id}`;
const preferenceArgs = z.object({ surface: preferenceSurfaceSchema }).strict();
const preferenceUri = (_r: unknown, a: any) => `vector://preferences/${a.surface}`;

export function workspaceViewTools(env: WorkerBindings): ToolDefinition[] {
  return [
    ...([
      ['view.issue_controls', 'Read issues using native list controls', 'VIEW-001'],
      ['search.advanced_filters', 'Read issues matching native advanced filters', 'SEARCH-004'],
      ['view.team_board', 'Read native board rows and status counts', 'VIEW-005'],
      ['view.workspace_wide_views', 'Read issues across visible teams', 'VIEW-009'],
    ] as const).map(([name, title, clause]) => workspaceRead(env, { name, title, scope: 'views:read',
      clauses: [clause], schema: issueListQuerySchema,
      read: async (db, p, a) => issueListResponse(await listIssues(db, p.id, a)) })),
    workspaceRead(env, { name: 'view.saved_views', title: 'List your private and visible shared saved views',
      scope: 'views:read', clauses: ['VIEW-002'], schema: workspaceEmpty, read: (db, p) => listViews(db, p.id) }),
    workspaceRead(env, { name: 'view.saved_views.read', title: 'Read a visible saved view definition',
      scope: 'views:read', clauses: ['VIEW-002'], schema: idArgs,
      read: (db, p, a) => getView(db, p.id, a.id), uri: a => `vector://views/${a.id}` }),
    nativeMutation(env, { name: 'vector.view.saved_views.create', title: 'Save an issue list or board as your own view',
      scope: 'views:write', clauses: ['VIEW-002'], schema: createViewSchema,
      method: 'POST', path: '/views', run: (db, p, a) => createView(db, p.id, a),
      uri: r => `vector://views/${r.id}` }),
    nativeMutation(env, { name: 'vector.view.saved_views.edit', title: 'Edit a saved view you own',
      scope: 'views:write', clauses: ['VIEW-002'], schema: z.object({ id: nativeId, input: updateViewSchema }).strict(),
      method: 'PATCH', path: '/views/:id', params: a => ({ id: a.id }), body: a => a.input,
      revision: async (db, p, a) => JSON.stringify(await getView(db, p.id, a.id)),
      run: (db, p, a) => updateView(db, p.id, a.id, a.input), uri: viewUri }),
    nativeMutation(env, { name: 'vector.view.saved_views.duplicate', title: 'Duplicate a visible view into your private views',
      scope: 'views:write', clauses: ['VIEW-002'], schema: z.object({ id: nativeId, input: duplicateViewSchema }).strict(),
      method: 'POST', path: '/views/:id/duplicate', params: a => ({ id: a.id }), body: a => a.input,
      revision: async (db, p, a) => JSON.stringify(await getView(db, p.id, a.id)),
      run: (db, p, a) => duplicateView(db, p.id, a.id, a.input.name), uri: r => `vector://views/${r.id}` }),
    workspaceRead(env, { name: 'view.control_persistence', title: 'Read your saved controls for a native surface',
      scope: 'preferences:read', clauses: ['VIEW-003'], schema: preferenceArgs,
      read: (db, p, a) => getPreference(db, p.id, a.surface), uri: a => preferenceUri(null, a) }),
    nativeMutation(env, { name: 'vector.view.control_persistence.save', title: 'Save your native list or stream controls',
      scope: 'preferences:write', clauses: ['VIEW-003'], schema: preferenceArgs.extend({ input: preferenceInputSchema }),
      method: 'PUT', path: '/preferences/:surface', params: a => ({ surface: a.surface }), body: a => a.input,
      revision: async (db, p, a) => JSON.stringify(await getPreference(db, p.id, a.surface)),
      run: (db, p, a) => putPreference(db, p.id, a.surface, a.input), uri: preferenceUri }),
    nativeMutation(env, { name: 'vector.view.control_persistence.reset', title: 'Reset your controls for a native surface',
      scope: 'preferences:write', clauses: ['VIEW-003'], schema: preferenceArgs,
      method: 'DELETE', path: '/preferences/:surface', params: a => ({ surface: a.surface }),
      revision: async (db, p, a) => JSON.stringify(await getPreference(db, p.id, a.surface)),
      run: (db, p, a) => resetPreference(db, p.id, a.surface), uri: preferenceUri }),
    workspaceRead(env, { name: 'view.timeline_and_calendar_views', title: 'Read the native month calendar',
      scope: 'views:read', clauses: ['VIEW-007'], schema: z.object({ month: monthSchema.optional() }).strict(),
      path: '/calendar/events', read: (db, p, a) => readMonthCalendar(db, p.id, env.APP_ORIGIN, a.month) }),
    workspaceRead(env, { name: 'view.appearance', title: 'Read your saved theme choice', scope: 'preferences:read',
      clauses: ['VIEW-011'], schema: workspaceEmpty, path: '/settings/appearance', read: (db, p) => readAppearance(db, p.id) }),
    nativeMutation(env, { name: 'vector.view.appearance.save', title: 'Save your light, dark or system theme choice',
      scope: 'preferences:write', clauses: ['VIEW-011'], schema: appearanceSchema, method: 'PATCH', path: '/settings/appearance',
      revision: async (db, p) => JSON.stringify(await readAppearance(db, p.id)),
      run: (db, p, a) => updateAppearance(db, p.id, a.theme), uri: () => 'vector://preferences/appearance' }),
  ];
}
