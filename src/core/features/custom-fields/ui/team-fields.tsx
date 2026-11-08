import type { Administration } from '../../administration/schema';
import { teamAccess } from '../../settings/ui/team-access';
import { AddField } from './add-field';
import { FieldRow } from './field-row';
import './fields.css';

type Team = Administration['teams'][number];

/** A team's custom fields (FIELD-001), each with its type and options. Whoever may
 * change the team's settings adds fields and renames fields and options in place;
 * everyone else who opens the team reads them. */
export function TeamFields({ data, team }: { data: Administration; team: Team }) {
  const editable = teamAccess(data, team).fields && !team.archivedAt;
  return <div className="team-fields">
    {team.customFields.length
      ? team.customFields.map(field => <FieldRow key={field.id} team={team} field={field} editable={editable} />)
      : <p className="field-hint">This team has no custom fields yet.</p>}
    {editable ? <AddField team={team} /> : !team.archivedAt && <p className="field-hint">Only this team’s owners and Admins change its fields.</p>}
  </div>;
}
