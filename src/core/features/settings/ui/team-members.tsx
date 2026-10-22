import type { FormEvent } from "react";
import type { Administration } from "../../administration/schema";
import { useAdministrationAction } from "./administration-action";
import { AdministrationFeedback } from "./administration-feedback";
import { teamAccess } from "./team-access";

type Team = Administration["teams"][number];
const teamRoles = { owner: "Team owner", member: "Member" } as const;

/** ROLE-007: a team's member list and owners, managed by its team owners or an Admin. */
export function TeamMembers({ data, team, onChanged }: { data: Administration; team: Team; onChanged: () => void }) {
  const action = useAdministrationAction(onChanged);
  const access = teamAccess(data, team);
  const name = (id: string) => data.operators.find((operator) => operator.id === id)?.name ?? "Former member";
  const outside = data.operators.filter((operator) => !team.members.some((member) => member.operatorId === operator.id));
  const base = `/api/settings/teams/${team.id}/members/`;
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, fields = new FormData(form);
    if (await action.run(base + fields.get("operator"), "PUT", { role: fields.get("role") })) form.reset();
  }
  return (
    <div role="group" aria-label={`${team.name} members`}>
      <h3>Members</h3>
      <p>
        Team owners and Admins add and remove this team&apos;s members and name its owners. A team keeps at least one
        team owner. Anyone who leaves keeps their assigned issues, listed below for reassignment.
      </p>
      <ul>
        {team.members.map((member) => (
          <li key={member.operatorId}>
            <span>{name(member.operatorId)} · {teamRoles[member.role]}</span>
            {access.members && (
              <span className="admin-actions">
                <button type="button" disabled={action.pending}
                  onClick={() => void action.run(base + member.operatorId, "PUT", { role: member.role === "owner" ? "member" : "owner" })}>
                  {member.role === "owner" ? `Make ${name(member.operatorId)} a member` : `Make ${name(member.operatorId)} a team owner`}
                </button>
                <button type="button" disabled={action.pending} onClick={() => void action.run(base + member.operatorId, "DELETE")}>
                  Remove {name(member.operatorId)} from {team.name}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {!team.members.some((member) => member.role === "owner") && <p>This team has no team owner. Admins manage it until one is named.</p>}
      {access.members ? (
        outside.length > 0 && (
          <form aria-label={`Add member to ${team.name}`} onSubmit={add}>
            <fieldset disabled={action.pending}>
              <label>
                Member to add
                <select name="operator" required>
                  {outside.map((operator) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}
                </select>
              </label>
              <label>
                Team role
                <select name="role" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="owner">Team owner</option>
                </select>
              </label>
              <button type="submit">Add member</button>
            </fieldset>
          </form>
        )
      ) : (
        <p>Only this team&apos;s owners and Admins change its members.</p>
      )}
      {team.departedAssignments.length > 0 && (
        <>
          <h4>Assigned to people who left</h4>
          <ul>
            {team.departedAssignments.map((issue) => (
              <li key={issue.identifier}><span>{issue.identifier} {issue.title} · {name(issue.assigneeOperatorId)}</span></li>
            ))}
          </ul>
        </>
      )}
      <AdministrationFeedback action={action} />
    </div>
  );
}
