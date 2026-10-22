import type { Administration } from "../../administration/schema";
import type { RowId } from "../../roles/matrix";
import { decide, type Authority } from "../../roles/policy";

type Team = Administration["teams"][number];
/** What the viewer may do with one team, decided by the same role matrix the
 * server enforces on every request (ROLE-001, ROLE-007, ROLE-009). */
export function teamAccess(data: Administration, team: Team) {
  const standing = team.members.find((member) => member.operatorId === data.viewer.id)?.role ?? null;
  const authority: Authority = {
    role: data.viewer.role, memberInvites: false,
    teams: new Map([[team.id, { role: standing, settings: "team_owners", planning: "all_members" }]]),
  };
  const may = (row: RowId) => decide(authority, { row, teams: [team.id] }) === "allow";
  const leads = data.viewer.role === "owner" || data.viewer.role === "admin";
  return {
    standing,
    /** Owners and Admins open every team; a Member opens the teams they belong to. */
    opens: leads || standing !== null,
    join: may("teams.join"),
    settings: may("teams.settings"),
    workflow: may("teams.workflow"),
    members: may("teams.members"),
  };
}
