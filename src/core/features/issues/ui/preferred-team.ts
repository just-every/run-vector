import type { Administration } from '../../administration/schema';
import type { WorkspaceOptions } from '../../../shared/workspace-options';

export function preferredTeam(options: WorkspaceOptions, administration: Administration | null) {
  return administration?.teams.find(team => !team.archivedAt &&
    options.teams.some(choice => choice.id === team.id) &&
    team.members.some(member => member.operatorId === options.operator.id))?.id ?? options.teams[0]?.id ?? '';
}
