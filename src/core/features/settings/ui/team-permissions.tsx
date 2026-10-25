import {SettingsSaveForm} from "./settings-save-form";
import {administrationSchema} from "../../administration/schema";
import type { Administration } from "../../administration/schema";
import { teamAccess } from "./team-access";

type Team = Administration["teams"][number];
const choices = [["team_owners", "Team owners only"], ["all_members", "All team members"]] as const;

/** ROLE-009: who manages the team's settings, and who its cycles and templates. */
export function TeamPermissions({ data, team, onChanged }: { data: Administration; team: Team; onChanged: () => void }) {
  const access = teamAccess(data, team);
  return (
    <>
      <h3>Permissions</h3>
      <p>Owners and Admins always pass both; Guests never do. Changes apply on each member&apos;s next request.</p>
      {!access.permissions && <p>Only this team&apos;s owners and Admins change its permissions.</p>}
      <SettingsSaveForm aria-label={`Permissions for ${team.name}`} path={`/api/settings/teams/${team.id}/permissions`} schema={administrationSchema} onSaved={onChanged} confirm="Confirm permissions" read={fields=>({settings:fields.get("settings"),planning:fields.get("planning")})}>
        <fieldset disabled={!access.permissions}>
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
        </fieldset>
      </SettingsSaveForm>
    </>
  );
}
