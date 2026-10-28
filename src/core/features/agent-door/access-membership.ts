import { z } from 'zod';
import { ToolRefusal, type Person } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { readAdministration } from '../administration/read';
import { joinTeam, leaveTeam, setTeamMember } from '../team-membership/service';
import { requestMembership, decideMembership } from '../team-membership/join-rules';
import { accessMutation, accessRead, type AccessChange } from './access-native.ts';
import { nativeMutation } from './native.ts';
import { nativeId } from './reads.ts';
import { membershipUri } from './access-membership-record.ts';

const teamArgs = z.object({ id: nativeId }).strict();
const memberArgs = teamArgs.extend({ operatorId: nativeId }).strict();
const roleArgs = memberArgs.extend({ role: z.enum(['owner', 'member']) }).strict();
const params = (args: any) => ({ id: args.id, operatorId: args.operatorId });
const membership = (db: D1Database, team: string, operator: string) => db.prepare(
  'SELECT role FROM main.team_members WHERE team_id=? AND operator_id=?').bind(team, operator).first<'owner' | 'member'>('role');

async function team(db: D1Database, person: Person, id: string) {
  const value = (await readAdministration(db, person.id)).teams.find(t => t.id === id);
  if (!value) throw new ToolRefusal('not_found');
  return value;
}
async function memberChange(db: D1Database, _person: Person, args: any): Promise<AccessChange> {
  const current = await membership(db, args.id, args.operatorId);
  return { subjects: current === args.role ? [] : [args.operatorId], widens: !current || args.role === 'owner' && current !== 'owner' };
}

export function vectorMembershipTools(env: WorkerBindings) {
  return [
    accessRead(env, { name: 'vector.role.team_membership', title: 'Read native team membership and join requests',
      scope: 'access:read', path: '/settings/administration', clauses: ['ROLE-007', 'TEAM-007'], schema: teamArgs,
      async read(db, person, args) {
        const value = await team(db, person, args.id);
        return { team: value, memberships: value.members.map(member => ({ ...member,
          id: membershipUri(value.id, member.operatorId), teamId: value.id })) };
      } }),
    accessRead(env, { name: 'vector.role.team_membership.grants', title: 'Read the sponsor’s current native standing in a team',
      scope: 'access:read', path: '/settings/administration', clauses: ['ROLE-007', 'ROLE-009'], schema: teamArgs,
      async read(db, person, args) {
        await team(db, person, args.id);
        const role = await membership(db, args.id, person.id);
        return { id: args.id, grants: role ? [`team:${args.id}:member`, ...(role === 'owner' ? [`team:${args.id}:owner`] : [])] : [] };
      } }),
    accessMutation(env, { name: 'vector.role.team_membership.join', title: 'Join an open public team as the current native sponsor',
      scope: 'access:write', clauses: ['ROLE-007', 'TEAM-007'], schema: teamArgs,
      method: 'POST', path: '/teams/:teamId/join', params: args => ({ teamId: args.id }),
      change: async (db, person, args) => ({ subjects: await membership(db, args.id, person.id) ? [] : [person.id], widens: true }),
      run: async (db, person, args) => { await joinTeam(db, person.id, args.id); return { id: args.id, joined: true }; } }),
    accessMutation(env, { name: 'vector.role.team_membership.leave', title: 'Leave the current sponsor’s native team membership',
      scope: 'access:write', clauses: ['ROLE-007', 'TEAM-007'], schema: teamArgs,
      method: 'POST', path: '/teams/:teamId/leave', params: args => ({ teamId: args.id }),
      narrowing: { effect: 'revoke', target: 'id' },
      change: async (_db, person) => ({ subjects: [person.id], widens: false }),
      run: async (db, person, args) => { await leaveTeam(db, person.id, args.id); return { id: args.id, left: true }; } }),
    accessMutation(env, { name: 'vector.role.team_membership.set', title: 'Add a native member or change their native team role',
      scope: 'access:write', clauses: ['ROLE-007', 'ROLE-003', 'ROLE-013'], schema: roleArgs,
      method: 'PUT', path: '/settings/teams/:id/members/:operatorId', params, body: args => ({ role: args.role }),
      change: memberChange,
      run: async (db, person, args) => { await setTeamMember(db, person.id, args.id, args.operatorId, args.role); return { id: args.id, operatorId: args.operatorId, role: args.role }; } }),
    nativeMutation(env, { name: 'vector.team.join_permissions.request', title: 'Request native team membership without granting access',
      scope: 'access:write', clauses: ['TEAM-007', 'ROLE-002'], schema: teamArgs,
      method: 'POST', path: '/teams/:teamId/requests', params: args => ({ teamId: args.id }),
      run: async (db, person, args) => { await requestMembership(db, person.id, args.id); return { id: args.id, requested: true }; } }),
    accessMutation(env, { name: 'vector.team.join_permissions.decide', title: 'Approve or decline a native membership request',
      scope: 'access:write', clauses: ['TEAM-007', 'ROLE-002'],
      schema: teamArgs.extend({ requesterId: nativeId, decision: z.enum(['approved', 'declined']) }).strict(),
      method: 'POST', path: '/settings/teams/:id/requests/:requesterId/decision',
      params: args => ({ id: args.id, requesterId: args.requesterId }), body: args => ({ decision: args.decision }),
      change: async (db, _person, args) => ({ subjects: args.decision === 'approved' && !await membership(db, args.id, args.requesterId) ? [args.requesterId] : [], widens: args.decision === 'approved' }),
      run: async (db, person, args) => { await decideMembership(db, person.id, args.id, args.requesterId, args.decision); return { id: args.id, requesterId: args.requesterId, decision: args.decision }; } }),
  ];
}

