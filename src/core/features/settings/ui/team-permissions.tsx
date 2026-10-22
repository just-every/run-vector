import type { FormEvent } from "react";
import type { Administration } from "../../administration/schema";
import { useAdministrationAction } from "./administration-action";
import { AdministrationFeedback } from "./administration-feedback";
import { teamAccess } from "./team-access";

type Team = Administration["teams"][number];
const choices = [["team_owners", "Team owners only"], ["all_members", "All team members"]] as const;

/** ROLE-009: who manages the team's settings, and who its cycles and templates. */
export function TeamPermissions({ data, team, onChanged }: { data: Administration; team: Team; onChanged: () => void }) {
  const action = useAdministrationAction(onChanged);
  const access = teamAccess(data, team);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await action.run(`/api/settings/teams/${team.id}/permissions`, "PUT", { settings: fields.get("settings"), planning: fields.get("planning") });
  }
  return (
    <>
      <h3>Permissions</h3>
      <p>Owners and Admins always pass both; Guests never do. Changes apply on each member&apos;s next request.</p>
      {!access.permissions && <p>Only this team&apos;s owners and Admins change its permissions.</p>}
      <form aria-label={`Permissions for ${team.name}`} onSubmit={save} key={team.settingsPermission + team.planningPermission}>
        <fieldset disabled={action.pending || !access.permissions}>
          <label>
            Who manages team settings
            <select name="settings" defaultValue={team.settingsPermission}>
              {choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Who manages cycles and templates
            <select name="planning" defaultValue={team.planningPermission}>
              {choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit">Save permissions</button>
        </fieldset>
      </form>
      <AdministrationFeedback action={action} />
    </>
  );
}
