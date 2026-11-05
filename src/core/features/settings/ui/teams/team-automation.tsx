import type { Administration } from '../../../administration/schema';
import { TeamEmailIntake } from '../../../email-intake/ui/team-email-intake';
import { TeamHousekeeping } from '../../../housekeeping/panel';
import { TeamIntakeRouting } from '../../../triage-routing/ui/team-routing';
import { GitRules } from './git-rules';

/**
 * Automation: auto-close and auto-archive (Owners and Admins, C3), Git rules, intake routing and email intake (whoever
 * may change the team's settings). Routing and intake are read only when this tab opens.
 */
export function TeamAutomation({ data, team }: { data: Administration; team: Administration['teams'][number] }) {
  const leads = data.viewer.role === 'owner' || data.viewer.role === 'admin';
  return <div className="team-automation">
    {leads && !team.archivedAt && <TeamHousekeeping data={data} team={team} />}
    {!team.archivedAt && <GitRules teamId={team.id} />}
    {!team.archivedAt && <TeamIntakeRouting team={team} />}
    <TeamEmailIntake teamId={team.id} teamName={team.name} archived={team.archivedAt !== null} />
  </div>;
}
