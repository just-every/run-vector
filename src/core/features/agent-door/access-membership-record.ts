import { z } from 'zod';
import { ToolRefusal, type Person, type ResourceDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { readAdministration } from '../administration/read';
import { removeTeamMember } from '../team-membership/service';
import { accessMutation, accessRead } from './access-native.ts';
import { nativeRead, nativeId } from './reads.ts';

// A membership's native key is (team_id, operator_id). Its resource URI names
// that exact row; it neither creates another identity nor changes its key.
export const membershipUri = (teamId: string, operatorId: string) => `vector://teams/${teamId}/members/${operatorId}`;
const membershipId = z.string().regex(/^vector:\/\/teams\/[0-9A-HJKMNP-TV-Z]{26}\/members\/[0-9A-HJKMNP-TV-Z]{26}$/);
const argsSchema = z.object({ id: nativeId, operatorId: nativeId }).strict();
const key = (id: string) => {
  const [, , , teamId, , operatorId] = membershipId.parse(id).split('/');
  return { teamId, operatorId };
};

async function record(db: D1Database, person: Person, id: string) {
  const { teamId, operatorId } = key(id);
  const team = (await readAdministration(db, person.id)).teams.find(team => team.id === teamId);
  if (!team) throw new ToolRefusal('not_found');
  const member = team.members.find(member => member.operatorId === operatorId);
  return { team, member, teamId, operatorId };
}

export function vectorMembershipRecordTools(env: WorkerBindings) {
  return [
    accessRead(env, { name: 'vector.role.team_membership.member_grants', title: 'Read one native membership and its current grants',
      scope: 'access:read', path: '/settings/administration', clauses: ['ROLE-007', 'ROLE-009'], schema: argsSchema,
      uri: result => result.role ? result.id : undefined,
      async read(db, person, args) {
        const { teamId, operatorId, member } = await record(db, person, membershipUri(args.id, args.operatorId));
        return { id: membershipUri(teamId, operatorId), teamId, operatorId, role: member?.role ?? null,
          grants: member ? [`team:${teamId}:member`, ...(member.role === 'owner' ? [`team:${teamId}:owner`] : [])] : [] };
      } }),
    accessMutation(env, { name: 'vector.role.team_membership.remove', title: 'Remove a native team membership',
      scope: 'access:write', clauses: ['ROLE-007', 'ROLE-003', 'ROLE-013'], schema: argsSchema,
      method: 'DELETE', path: '/settings/teams/:id/members/:operatorId',
      params: args => ({ id: args.id, operatorId: args.operatorId }),
      // Released 0.2.86 rejects checked narrowing metadata for a two-key row.
      // Keep both native identifiers and the real authority callback; the
      // surface retains its failing checked-contract assertion for the re-pin.
      resource: false, uri: (_result, args) => membershipUri(args.id, args.operatorId),
      async change(db, person, args) {
        const { member, operatorId } = await record(db, person, membershipUri(args.id, args.operatorId));
        return { subjects: member ? [operatorId] : [], widens: false };
      },
      async summary(db, person, args) {
        const { team, member, operatorId } = await record(db, person, membershipUri(args.id, args.operatorId));
        return { target: { id: membershipUri(args.id, args.operatorId), name: `${operatorId} in ${team.name}` },
          items: [`Remove ${member?.role ?? 'absent'} membership from ${team.name}`] };
      },
      async run(db, person, args) {
        const teamId = args.id, operatorId = args.operatorId;
        await removeTeamMember(db, person.id, teamId, operatorId);
        return { id: membershipUri(teamId, operatorId), teamId, operatorId, removed: true };
      } }),
  ];
}

export function vectorMembershipResources(env: WorkerBindings): ResourceDefinition[] {
  return [{ uriTemplate: 'vector://teams/{teamId}/members/{operatorId}', name: 'Visible native team membership',
    scope: 'access:read', classes: ['standard'],
    classify: value => [{ class: 'standard', facts: { measure: value.json == null ? 0 : 1 } }],
    async read(uri, ctx) {
      try {
        const value = await nativeRead(env, ctx.person, db => record(db, ctx.person, uri));
        return value.member ? { json: { id: uri, teamId: value.teamId, ...value.member }, untrusted: true } : null;
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof ToolRefusal && ['not_found', 'forbidden'].includes(error.code)) return null;
        throw error;
      }
    } }];
}
