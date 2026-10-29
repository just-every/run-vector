import { z } from 'zod';
import { ToolRefusal, type Person } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { setTeamPermissions } from '../team-membership/permissions';
import { setMembershipMode } from '../team-membership/join-rules';
import { setTeamPrivacy } from '../team-membership/privacy';
import { accessMutation, type AccessChange } from './access-native.ts';
import { nativeId } from './reads.ts';

type Team = { id: string; name: string; settings: string; planning: string; mode: string; requests: number; private: number; archived: string | null };
async function team(db: D1Database, id: string, actor: string) {
  const value = await db.prepare(`SELECT id,name,settings_permission AS settings,planning_permission AS planning,
    membership_mode AS mode,requests_enabled AS requests,is_private AS private,archived_at AS archived FROM main.teams
    WHERE id=? AND workspace_id=(SELECT workspace_id FROM main.operators WHERE id=? AND removed_at IS NULL)`)
    .bind(id, actor).first<Team>();
  if (!value) throw new ToolRefusal('not_found');
  return value;
}
const people = async (db: D1Database, sql: string, id: string) =>
  (await db.prepare(sql).bind(id).all<{ id: string }>()).results.map(person => person.id);

async function permissionChange(db: D1Database, person: Person, args: any): Promise<AccessChange> {
  const current = await team(db, args.id, person.id);
  const changed = (['settings', 'planning'] as const).filter(key => current[key] !== args.input[key]);
  const widens = changed.some(key => args.input[key] === 'all_members');
  // Owners/Admins and team owners already pass both permission rows. Guests
  // and Viewers never pass them. Only these actual native Members change.
  const subjects = changed.length ? await people(db, `SELECT o.id FROM main.operators o
    JOIN main.team_members m ON m.operator_id=o.id WHERE m.team_id=? AND m.role='member'
    AND o.role='member' AND o.removed_at IS NULL ORDER BY o.id`, args.id) : [];
  return { subjects, widens };
}

export function vectorTeamPermissionTools(env: WorkerBindings) {
  const permission = z.enum(['team_owners', 'all_members']);
  return [
    accessMutation(env, { name: 'vector.role.team_permissions.set', title: 'Set the native team settings and planning permissions',
      scope: 'access:write', clauses: ['ROLE-009', 'ROLE-007'],
      schema: z.object({ id: nativeId, input: z.object({ settings: permission, planning: permission }).strict() }).strict(),
      method: 'PUT', path: '/settings/teams/:id/permissions', params: args => ({ id: args.id }), body: args => args.input,
      securitySetting: 'team.permissions', change: permissionChange,
      summary: async (db, person, args) => ({ target: { id: args.id, name: (await team(db, args.id, person.id)).name },
        items: [`Who manages team settings: ${args.input.settings}`, `Who manages cycles and templates: ${args.input.planning}`] }),
      run: async (db, person, args) => { await setTeamPermissions(db, person.id, args.id, args.input); return { id: args.id, ...args.input }; } }),
    accessMutation(env, { name: 'vector.team.join_permissions.set', title: 'Set native team joining and request exposure',
      scope: 'access:write', clauses: ['TEAM-007', 'ROLE-002'],
      schema: z.object({ id: nativeId, input: z.object({ mode: z.enum(['open', 'invite_only']), requestsEnabled: z.boolean() }).strict() }).strict(),
      method: 'PUT', path: '/settings/teams/:id/membership', params: args => ({ id: args.id }), body: args => args.input,
      securitySetting: 'team.membership',
      async change(db, person, args) {
        const current = await team(db, args.id, person.id);
        const changed = current.mode !== args.input.mode && !current.private && !current.archived;
        const subjects = changed ? await people(db, `SELECT o.id FROM main.operators o JOIN main.teams t ON t.workspace_id=o.workspace_id
          WHERE t.id=? AND o.role IN('owner','admin','member') AND o.removed_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM main.team_members m WHERE m.operator_id=o.id AND m.team_id=t.id) ORDER BY o.id`, args.id) : [];
        return { subjects, widens: changed && args.input.mode === 'open' };
      },
      run: async (db, person, args) => { await setMembershipMode(db, person.id, args.id, args.input); return { id: args.id, ...args.input }; } }),
    accessMutation(env, { name: 'vector.role.private_teams.set', title: 'Set the native team’s public or private visibility',
      scope: 'access:write', clauses: ['ROLE-002', 'OPS-001'],
      schema: z.object({ id: nativeId, isPrivate: z.boolean() }).strict(),
      method: 'PUT', path: '/settings/teams/:id/privacy', params: args => ({ id: args.id }), body: args => ({ isPrivate: args.isPrivate }),
      securitySetting: 'team.privacy',
      async change(db, person, args) {
        const current = await team(db, args.id, person.id);
        const subjects = current.private === Number(args.isPrivate) ? [] : await people(db, `SELECT o.id FROM main.operators o
          JOIN main.teams t ON t.workspace_id=o.workspace_id WHERE t.id=? AND o.role NOT IN('owner','guest') AND o.removed_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM main.team_members m WHERE m.operator_id=o.id AND m.team_id=t.id) ORDER BY o.id`, args.id);
        return { subjects, widens: !args.isPrivate && subjects.length > 0 };
      },
      run: async (db, person, args) => { await setTeamPrivacy(db, person.id, args.id, args.isPrivate); return { id: args.id, isPrivate: args.isPrivate }; } }),
  ];
}
