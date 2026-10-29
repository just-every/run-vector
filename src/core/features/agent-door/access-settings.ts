import { z } from 'zod';
import { ToolRefusal } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { readSettings, updateWorkspaceTime } from '../settings/repository';
import { changeRole } from '../settings/roles';
import { removeOperator } from '../settings/removal';
import { setTeamCreation } from '../administration/teams';
import { setLabelCreation } from '../administration/labels';
import { reminderTimeSchema } from '../settings/schema';
import { timezoneSchema } from '../bootstrap/config';
import { accessMutation, accessRead } from './access-native.ts';
import { nativeMutation } from './native.ts';
import { nativeId } from './reads.ts';
import { removalEffects } from './access-removal.ts';

const idArgs = z.object({ id: nativeId }).strict();
const creationArgs = z.object({ membersMayCreate: z.boolean() }).strict();
type Setting = 'member_invites' | 'member_team_creation' | 'member_label_creation';
async function workspace(db: D1Database, actor: string) {
  const current = await db.prepare(`SELECT w.id,w.timezone,w.member_invites,w.member_team_creation,w.member_label_creation
    FROM main.workspace_settings w JOIN main.operators o ON o.workspace_id=w.id WHERE o.id=? AND o.removed_at IS NULL`)
    .bind(actor).first<{ id: string; timezone: string; member_invites: number; member_team_creation: number; member_label_creation: number }>();
  if (!current) throw new ToolRefusal('unauthenticated');
  return current;
}
const settingChange = (field: Setting, proposed: (args: any) => boolean) => async (db: D1Database, person: { id: string }, args: any) => {
  const current = await workspace(db, person.id), next = proposed(args);
  const subjects = current[field] === Number(next) ? [] : (await db.prepare(
    "SELECT id FROM main.operators WHERE workspace_id=? AND role='member' AND removed_at IS NULL ORDER BY id")
    .bind(current.id).all<{ id: string }>()).results.map(row => row.id);
  return { subjects, widens: next && subjects.length > 0 };
};

export function vectorWorkspaceAccessTools(env: WorkerBindings) {
  return [
    accessRead(env, { name: 'vector.ops.member_management', title: 'Read the native workspace settings and member directory',
      scope: 'access:read', path: '/settings', clauses: ['OPS-002', 'ROLE-001', 'OPS-003'], schema: z.object({}).strict(),
      read: (db, person) => readSettings(db, person.id) }),
    accessRead(env, { name: 'vector.ops.member_management.grants', title: 'Read a native member’s retained workspace and team standing',
      scope: 'access:read', path: '/settings', clauses: ['OPS-002', 'ROLE-001', 'ROLE-007'], schema: idArgs,
      async read(db, person, args) {
        const current = await db.prepare(`SELECT id,role,removed_at FROM main.operators WHERE id=?
          AND workspace_id=(SELECT workspace_id FROM main.operators WHERE id=?)`).bind(args.id, person.id)
          .first<{ id: string; role: string; removed_at: string | null }>();
        if (!current) throw new ToolRefusal('not_found');
        if (current.removed_at) return { id: args.id, grants: [] };
        const memberships = (await db.prepare('SELECT team_id AS id,role FROM team_members WHERE operator_id=? ORDER BY team_id')
          .bind(args.id).all<{ id: string; role: string }>()).results;
        return { id: args.id, grants: [`workspace:${current.role}`, ...memberships.flatMap(row => [
          `team:${row.id}:member`, ...(row.role === 'owner' ? [`team:${row.id}:owner`] : [])])] };
      } }),
    nativeMutation(env, { name: 'vector.ops.workspace_time.set', title: 'Set the native workspace timezone and due-reminder time',
      scope: 'settings:write', clauses: ['OPS-003', 'NOTIFY-005'],
      schema: z.object({ timezone: timezoneSchema, reminderTime: reminderTimeSchema.optional() }).strict(),
      method: 'PATCH', path: '/settings',
      run: async (db, person, args) => { await updateWorkspaceTime(db, person.id, args.timezone, args.reminderTime); return { timezone: args.timezone, ...(args.reminderTime ? { reminderTime: args.reminderTime } : {}) }; } }),
    accessMutation(env, { name: 'vector.ops.member_management.invitation_permission', title: 'Set the native Member invitation permission',
      scope: 'access:write', clauses: ['OPS-002', 'ROLE-001'], schema: z.object({ memberInvites: z.boolean() }).strict(),
      method: 'PATCH', path: '/settings', securitySetting: 'workspace.member_invitations',
      change: settingChange('member_invites', args => args.memberInvites),
      run: async (db, person, args) => { const current = await workspace(db, person.id); await updateWorkspaceTime(db, person.id, current.timezone, undefined, args.memberInvites); return { memberInvites: args.memberInvites }; } }),
    accessMutation(env, { name: 'vector.team.creation_permission.set', title: 'Set the native Member team-creation permission',
      scope: 'access:write', clauses: ['TEAM-008'], schema: creationArgs,
      method: 'PUT', path: '/settings/teams/creation', securitySetting: 'workspace.team_creation',
      change: settingChange('member_team_creation', args => args.membersMayCreate),
      run: async (db, person, args) => { await setTeamCreation(db, person.id, args.membersMayCreate); return { membersMayCreate: args.membersMayCreate }; } }),
    accessMutation(env, { name: 'vector.issue.labels.creation_permission', title: 'Set the native Member label-creation permission',
      scope: 'access:write', clauses: ['ISSUE-014'], schema: creationArgs,
      method: 'PUT', path: '/settings/labels/creation', securitySetting: 'workspace.label_creation',
      change: settingChange('member_label_creation', args => args.membersMayCreate),
      run: async (db, person, args) => { await setLabelCreation(db, person.id, args.membersMayCreate); return { membersMayCreate: args.membersMayCreate }; } }),
    accessMutation(env, { name: 'vector.role.workspace_roles.set', title: 'Change a native workspace member’s product role and Guest or Viewer teams',
      scope: 'access:write', clauses: ['ROLE-001', 'ROLE-003', 'ROLE-013'],
      schema: idArgs.extend({ role: z.enum(['owner', 'admin', 'member', 'guest', 'viewer']), teamIds: z.array(nativeId).max(100).optional() }).strict(),
      method: 'PATCH', path: '/settings/operators/:operatorId/role', params: args => ({ operatorId: args.id }),
      body: args => ({ role: args.role, ...(args.teamIds ? { teamIds: args.teamIds } : {}) }),
      async change(db, person, args) {
        const current = await db.prepare(`SELECT role FROM main.operators WHERE id=? AND removed_at IS NULL
          AND workspace_id=(SELECT workspace_id FROM main.operators WHERE id=?)`).bind(args.id, person.id).first<string>('role');
        if (!current) throw new ToolRefusal('not_found');
        const before = (await db.prepare('SELECT team_id AS id,role FROM main.team_members WHERE operator_id=? ORDER BY team_id')
          .bind(args.id).all<{ id: string; role: string }>()).results;
        const assigned = args.role === 'guest' || args.role === 'viewer';
        const next = [...new Set(args.teamIds ?? [])].sort();
        const teamsChanged = assigned && (JSON.stringify(before.map(row => row.id)) !== JSON.stringify(next) || before.some(row => row.role !== 'member'));
        const stronger = args.role !== current && (args.role === 'owner' || args.role === 'admin' && current !== 'owner'
          || args.role === 'member' && ['guest', 'viewer'].includes(current) || args.role === 'viewer' && current === 'guest'
          || args.role === 'guest' && current === 'viewer');
        const addsTeam = assigned && next.some(id => !before.some(row => row.id === id));
        return { subjects: current !== args.role || teamsChanged ? [args.id] : [], widens: stronger || addsTeam };
      },
      run: async (db, person, args) => { await changeRole(db, person.id, args.id, args.role, args.teamIds); return { id: args.id, role: args.role, ...(args.teamIds ? { teamIds: args.teamIds } : {}) }; } }),
    accessMutation(env, { name: 'vector.ops.safe_removal', title: 'Remove a native workspace member using Vector’s existing removal lifecycle',
      scope: 'access:write', clauses: ['OPS-002', 'OPS-004'], schema: idArgs,
      method: 'DELETE', path: '/settings/operators/:operatorId', params: args => ({ operatorId: args.id }),
      classes: ['destructive'], classify: async (db, _person, args) => [{ class: 'destructive', facts: { measure: await removalEffects(db, args.id) } }],
      narrowing: { effect: 'revoke', target: 'id' },
      change: async (_db, person, args) => {
        // A successful self-removal invalidates the sponsoring identity before
        // the door can retain its outcome. The native person door owns that
        // sign-out transition; no replacement session is manufactured here.
        if (args.id === person.id) throw new ToolRefusal('native_person_required');
        return { subjects: [args.id], widens: false };
      },
      run: (db, person, args) => removeOperator(db, person.id, args.id) }),
  ];
}
