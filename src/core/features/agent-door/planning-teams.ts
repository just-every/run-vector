import { z } from 'zod';
import type { WorkerBindings } from '../../app/bindings';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import { ToolRefusal } from '../../../../vendor/base/agent-door/index.ts';
import { teamCreateSchema, statusCreateSchema, statusRenameSchema, statusReorderSchema, statusRemoveSchema,
  labelCreateSchema, labelUpdateSchema, labelMergeSchema } from '../administration/schema';
import { updateTeam, createStatus, renameStatus, reorderStatuses, removeStatus } from '../administration/teams';
import { createLabel, updateLabel, mergeLabel, removeLabel } from '../administration/labels';
import { readAdministration } from '../administration/read';
import { nativeMutation } from './native.ts';
import { idArgs, nativeId } from './reads.ts';
import { destructive, planningRead, planningRevision, planningRow, requiredPlanning, standard } from './planning-shared.ts';

async function team(db: D1Database, actor: string, id: string) {
  const result = (await readAdministration(db, actor)).teams.find(t => t.id === id);
  if (!result) throw new ToolRefusal('not_found');
  const statusDestinations: Record<string, string> = {};
  for (const status of result.statuses) statusDestinations[status.category] ??= status.id;
  return { ...result, statusIds: result.statuses.map(status => status.id), statusDestinations };
}
async function label(db: D1Database, actor: string, id: string) {
  const result = (await readAdministration(db, actor)).labels.find(l => l.id === id);
  if (!result) throw new ToolRefusal('not_found');
  return result;
}
const teamParams = (a: any) => ({ id: a.id });
const teamUri = (_r: unknown, a: any) => `vector://teams/${a.id}`;
const labelUri = (_r: unknown, a: any) => `vector://labels/${a.id}`;
const statusArgs = z.object({ id: nativeId, statusId: nativeId }).strict();
const statusParams = (a: any) => ({ id: a.id, statusId: a.statusId });

export function planningTeamTools(env: WorkerBindings): ToolDefinition[] {
  const editTeam = (name: string, title: string, clauses: string[], schema: z.ZodType<any>) => nativeMutation(env, {
    name, title, scope: 'teams:write', clauses, schema: z.object({ id: nativeId, input: schema }).strict(),
    method: 'PATCH', path: '/settings/teams/:id', params: teamParams, body: a => a.input,
    revision: (db, _p, a) => planningRevision(db, 'teams', a.id), uri: teamUri,
    run: async (db, p, a) => { await updateTeam(db, p.id, a.id, a.input); return team(db, p.id, a.id); },
  });
  return [
    editTeam('vector.team.team_identity', 'Edit a team name or unused identifier prefix', ['TEAM-001'],
      teamCreateSchema.omit({ createSlackChannel: true, isPrivate: true }).partial().refine(v => Object.keys(v).length > 0)),
    editTeam('vector.team.team_archiving', 'Archive or unarchive a team', ['TEAM-003'], z.object({ archived: z.boolean() }).strict()),
    planningRead(env, { name: 'vector.team.team_settings', title: 'Read visible team planning settings', scope: 'teams:read',
      clauses: ['TEAM-005'], schema: idArgs, read: (db, p, a) => team(db, p.id, a.id), uri: a => `vector://teams/${a.id}` }),
    nativeMutation(env, {
      name: 'vector.team.team_workflow', title: 'Create a workflow status', scope: 'teams:write', clauses: ['TEAM-002'],
      schema: z.object({ id: nativeId, input: statusCreateSchema }).strict(), method: 'POST',
      path: '/settings/teams/:id/statuses', params: teamParams, body: a => a.input,
      run: async (db, p, a) => {
        await createStatus(db, p.id, a.id, a.input);
        return requiredPlanning((await team(db, p.id, a.id)).statuses.find(s => s.name === a.input.name && s.category === a.input.category));
      }, uri: r => `vector://statuses/${r.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.team.team_workflow.rename', title: 'Rename a workflow status', scope: 'teams:write', clauses: ['TEAM-002'],
      schema: statusArgs.extend({ input: statusRenameSchema }), method: 'PATCH', path: '/settings/teams/:id/statuses/:statusId',
      params: statusParams, body: a => a.input, revision: (db, _p, a) => planningRevision(db, 'workflow_statuses', a.statusId),
      run: async (db, p, a) => {
        await renameStatus(db, p.id, a.id, a.statusId, a.input.name);
        return requiredPlanning((await team(db, p.id, a.id)).statuses.find(s => s.id === a.statusId));
      }, uri: (_r, a) => `vector://statuses/${a.statusId}`,
    }),
    nativeMutation(env, {
      name: 'vector.team.team_workflow.order', title: 'Order every workflow status in a team', scope: 'teams:write', clauses: ['TEAM-002'],
      schema: z.object({ id: nativeId, input: statusReorderSchema }).strict(), method: 'PUT', path: '/settings/teams/:id/statuses/order',
      params: teamParams, body: a => a.input, classify: async (_db, _p, a) => standard(a.input.statusIds.length),
      run: async (db, p, a) => { await reorderStatuses(db, p.id, a.id, a.input.statusIds); return team(db, p.id, a.id); }, uri: teamUri,
    }),
    nativeMutation(env, {
      name: 'vector.team.status_removal', title: 'Permanently remove a status after moving issues to the chosen status',
      scope: 'teams:write', clauses: ['TEAM-004'], schema: statusArgs.extend({ input: statusRemoveSchema }),
      method: 'DELETE', path: '/settings/teams/:id/statuses/:statusId', params: statusParams, body: a => a.input,
      classes: ['destructive'], classify: async (db, _p, a) => {
        const row = await planningRow(db, 'workflow_statuses', a.statusId);
        if (row.team_id !== a.id) throw new ToolRefusal('not_found'); return destructive(1);
      }, revision: (db, _p, a) => planningRevision(db, 'workflow_statuses', a.statusId),
      run: async (db, p, a) => {
        await removeStatus(db, p.id, a.id, a.statusId, a.input.destinationStatusId);
        return { id: a.statusId, deleted: true, destinationStatusId: a.input.destinationStatusId };
      }, uri: (_r, a) => `vector://statuses/${a.statusId}`, resource: false,
    }),
    nativeMutation(env, {
      name: 'vector.issue.labels.create', title: 'Create a native workspace label', scope: 'labels:write', clauses: ['ISSUE-014'],
      schema: labelCreateSchema, method: 'POST', path: '/settings/labels',
      run: async (db, p, a) => label(db, p.id, await createLabel(db, p.id, a)), uri: r => `vector://labels/${r.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.issue.labels.edit', title: 'Edit a native workspace label', scope: 'labels:write', clauses: ['ISSUE-014'],
      schema: z.object({ id: nativeId, input: labelUpdateSchema }).strict(), method: 'PATCH', path: '/settings/labels/:id',
      params: teamParams, body: a => a.input, revision: (db, _p, a) => planningRevision(db, 'labels', a.id),
      run: async (db, p, a) => { await updateLabel(db, p.id, a.id, a.input); return label(db, p.id, a.id); }, uri: labelUri,
    }),
    nativeMutation(env, {
      name: 'vector.issue.labels.merge', title: 'Merge a label into another and permanently remove the source label',
      scope: 'labels:write', clauses: ['ISSUE-014'], schema: z.object({ id: nativeId, input: labelMergeSchema }).strict(),
      method: 'POST', path: '/settings/labels/:id/merge', params: teamParams, body: a => a.input, classes: ['destructive'],
      classify: async (db, _p, a) => { await planningRow(db, 'labels', a.id); return destructive(1); },
      revision: async (db, _p, a) => JSON.stringify([await planningRow(db, 'labels', a.id), await planningRow(db, 'labels', a.input.destinationLabelId)]),
      run: async (db, p, a) => { await mergeLabel(db, p.id, a.id, a.input.destinationLabelId); return label(db, p.id, a.input.destinationLabelId); },
      uri: r => `vector://labels/${r.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.issue.labels.delete', title: 'Permanently remove a label and its issue, project and saved-view assignments',
      scope: 'labels:write', clauses: ['ISSUE-014'], schema: idArgs, method: 'DELETE', path: '/settings/labels/:id',
      params: teamParams, classes: ['destructive'],
      classify: async (db, _p, a) => { await planningRow(db, 'labels', a.id); return destructive(1); },
      revision: (db, _p, a) => planningRevision(db, 'labels', a.id),
      run: async (db, p, a) => { await removeLabel(db, p.id, a.id); return { id: a.id, deleted: true }; }, uri: labelUri, resource: false,
    }),
  ];
}
