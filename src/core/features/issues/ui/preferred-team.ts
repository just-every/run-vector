import type { Administration } from '../../administration/schema';
import type { WorkspaceOptions } from '../../../shared/workspace-options';

export function preferredTeam(options: WorkspaceOptions, administration: Administration | null, lastUsed: unknown[] = []) {
  const recent = lastUsed.find(id => options.teams.some(team => team.id === id));
  if (typeof recent === 'string') return recent;
  const teams = administration?.teams.filter(team => !team.archivedAt &&
    options.teams.some(choice => choice.id === team.id)) ?? [];
  const memberTeams = teams.filter(team => team.members.some(member => member.operatorId === options.operator.id));
  return memberTeams.find(team => (team.issueCount ?? 0) > 0)?.id ??
    teams.find(team => (team.issueCount ?? 0) > 0)?.id ??
    memberTeams[0]?.id ?? options.teams[0]?.id ?? '';
}

export function lastCreatedTeamKey(workspaceId: string, operatorId: string) {
  return `vector:last-created-team:${workspaceId}:${operatorId}`;
}
