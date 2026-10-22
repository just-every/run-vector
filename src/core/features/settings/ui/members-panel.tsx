import { useState, type FormEvent } from "react";
import { z } from "zod";
import { fetchJson } from "../../../app/api-client";
import { matrix, type AssignableRole, type Role } from "../../roles/matrix";
import { settingsSchema } from "../schema";
import { InviteOperator } from "./invite-operator";

type Settings = z.infer<typeof settingsSchema>;
type Member = Settings["operators"][number];
export const roleLabels: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member", guest: "Guest" };

/** What the viewer's role allows here (ROLE-001, OPS-002). The server decides
 * every request; these controls only show the choices it will accept. */
export function memberControls(data: Settings) {
  const viewer = data.role;
  const leads = matrix["leaders.manage"].cells[viewer] === "yes";
  const manages = matrix["members.manage"].cells[viewer] === "yes";
  const memberInvites = matrix["members.manage"].cells[viewer] === "member-invites" && data.workspace.memberInvites;
  return {
    leads,
    manages,
    inviteRoles: (leads ? ["member", "admin", "owner"] : manages || memberInvites ? ["member"] : []) as AssignableRole[],
    removable: (member: Member) => member.id === data.operatorId
      || (leads && member.id !== data.workspace.setupOperatorId)
      || (manages && (member.role === "member" || member.role === "guest")),
  };
}

export function MembersPanel({ data, denied, onMessage, onChanged }: { data: Settings; denied: boolean; onMessage: (message: string) => void; onChanged: () => void }) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const controls = memberControls(data);
  async function act(run: () => Promise<unknown>, done: string) {
    setPending(true); onMessage("");
    try { await run(); onMessage(done); }
    catch (error) { onMessage(error instanceof Error ? error.message : "The change could not be saved."); }
    finally { setPending(false); onChanged(); }
  }
  const remove = async () => {
    if (!removing) return;
    const self = removing === data.operatorId;
    await act(async () => {
      const result = await fetchJson("/api/settings/operators/" + removing, z.object({ removed: z.boolean(), signedOut: z.boolean() }), { method: "DELETE" });
      if (result.signedOut) window.location.assign("/signin");
      setRemoving(null);
    }, self ? "You left the workspace." : "Member removed. Their sessions are revoked.");
  };
  const changeRole = (member: Member) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const role = String(new FormData(event.currentTarget).get("role"));
    await act(() => fetchJson(`/api/settings/operators/${member.id}/role`, settingsSchema, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }),
    }), `${member.name} is now ${role === "admin" ? "an" : "a"} ${roleLabels[role as Role]}.`);
  };
  const saveInvites = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const memberInvites = new FormData(event.currentTarget).has("memberInvites");
    await act(() => fetchJson("/api/settings", settingsSchema, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone: data.workspace.timezone, memberInvites }),
    }), memberInvites ? "Members can now invite Members." : "Only Owners and Admins invite now.");
  };
  return (
    <section id="members" aria-labelledby="members-heading">
      <h2 id="members-heading">Members</h2>
      <p>
        Each member has one role. Owners and Admins invite and remove Members; only Owners invite, promote or remove
        Owners and Admins. Anyone can leave. The installation owner stays an Owner, and the last Owner cannot be demoted or removed.
      </p>
      {!data.workspace.setupOperatorId && (
        <p role="alert">
          Ask the person who deployed Vector to finish owner setup before
          removing members. They can run the setup command in DEPLOY.md
          and set the first owner’s email (FIRST_OWNER_EMAIL).
        </p>
      )}
      <ul className="settings-members">
        {data.operators.map((member) => {
          const own = member.id === data.operatorId;
          return (
            <li key={member.id}>
              <div>
                <strong>{member.name}{own ? " (you)" : ""}</strong>
                <span>{member.email}</span>
                <span className="settings-role">{roleLabels[member.role]}{member.id === data.workspace.setupOperatorId ? " · Installation owner" : ""}</span>
              </div>
              {controls.leads && (
                <form aria-label={`Role for ${member.name}`} onSubmit={changeRole(member)}>
                  <label>
                    Role for {member.name}
                    <select name="role" defaultValue={member.role} disabled={pending || denied} key={member.role}>
                      {(["owner", "admin", "member"] as const).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                    </select>
                  </label>
                  <button type="submit" disabled={pending || denied}>Change role</button>
                </form>
              )}
              {controls.removable(member) && (
                <button type="button" disabled={pending || denied || !data.workspace.setupOperatorId}
                  onClick={() => { setRemoving(member.id); onMessage(""); }}>
                  Remove {member.name}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {removing && (
        <div className="settings-confirm" role="group" aria-label="Confirm member removal">
          <p>
            {removing === data.operatorId ? "Leave this workspace? Your sessions will end." : "Remove this member? Their sessions will end."} Open
            issues will be unassigned, and projects and shared views will transfer. Retained history will show an anonymous member.
          </p>
          <button autoFocus disabled={pending} type="button" onClick={remove}>Confirm removal</button>
          <button disabled={pending} type="button" onClick={() => setRemoving(null)}>Cancel</button>
        </div>
      )}
      {(controls.leads || controls.manages) && (
        <form aria-label="Member invitations" onSubmit={saveInvites}>
          <label className="admin-checkbox">
            <input type="checkbox" name="memberInvites" defaultChecked={data.workspace.memberInvites} disabled={pending || denied} key={String(data.workspace.memberInvites)} />
            Members can invite other Members
          </label>
          <button type="submit" disabled={pending || denied}>Save invitation setting</button>
        </form>
      )}
      {controls.inviteRoles.length ? (
        <InviteOperator delivery={data.invitationDelivery} roles={controls.inviteRoles} disabled={pending || denied} onInvited={onChanged} />
      ) : (
        <p>Only Owners and Admins invite people{data.workspace.memberInvites ? "" : " unless they let Members invite Members"}.</p>
      )}
    </section>
  );
}
