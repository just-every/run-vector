import { env } from "cloudflare:workers";
import { expect } from "vitest";
import type { Administration } from "../../src/core/features/administration/schema";
import { roleWorkspace, snapshot } from "./role-fixture";
const teams = async (response: Response) =>
  ((await response.json()) as Administration).teams;
const audits = (action: string) =>
  env.DB.prepare(
    "SELECT a.actor_operator_id AS actor,d.previous_value_json AS previous,d.next_value_json AS next FROM audit_records a JOIN administration_audit_details d ON d.audit_id=a.id WHERE a.action=? ORDER BY a.id",
  )
    .bind(action)
    .all()
    .then((rows) => rows.results);
export async function teamMembershipJourney() {
  const w = await roleWorkspace();
  const platform = (await w.mutate("/settings/teams", "POST", { name: "Platform", identifierPrefix: "PLATF" })).teams.find((t) => t.name === "Platform")!;
  // TEAM-008: the same Member session and scoped token follow each setting change.
  const readOnly=await w.fresh('member',false);
  expect((await w.call(`/settings/operators/${readOnly.id}/role`,'PATCH',{role:'viewer',teamIds:[]})).status).toBe(200);
  const viewerCreates=async()=>{for(const surface of ['call','api'] as const){expect((await readOnly[surface](surface==='call'?'/settings/teams':'/teams','POST',{name:'synthetic-vector-1947',identifierPrefix:'SYNREAD'})).status).toBe(403);if(surface==='call')expect((await readOnly.call('/settings/teams/creation','PUT',{membersMayCreate:true})).status).toBe(403);}};
  await viewerCreates();
  const memberCreate={name:"synthetic-vector-member-team",identifierPrefix:"SYNMEM"};
  expect((await w.member.call("/settings/teams","POST",memberCreate)).status).toBe(403);
  expect((await w.member.api("/teams","POST",memberCreate)).status).toBe(403);
  expect((await w.admin.call("/settings/teams/creation","PUT",{membersMayCreate:true})).status).toBe(200);
  expect((await w.member.call("/settings/teams/creation","PUT",{membersMayCreate:false})).status).toBe(403);
  await viewerCreates();
  for(const surface of ['call','api'] as const){
    expect((await w.member[surface](surface==='call'?'/settings/teams':'/teams','POST',{name:'synthetic-vector-989',identifierPrefix:'SYNDENY',isPrivate:true})).status).toBe(403);
    for(const who of [w.people.owner,w.admin]){const name='synthetic-vector-'+(surface==='call'?990:992)+(who===w.admin?'1':'0');const made=await who[surface](surface==='call'?'/settings/teams':'/teams','POST',{name,identifierPrefix:'SYN'+(surface==='call'?'N':'A')+(who===w.admin?'D':'O'),isPrivate:true});expect(made.status).toBe(surface==='call'?200:201);const body=await made.json() as any,created=surface==='call'?body.teams.find((t:any)=>t.name===name):body;expect(created.isPrivate).toBe(true);expect((await w.call(`/settings/teams/${created.id}/privacy`,'PUT',{isPrivate:false})).status).toBe(200);}
  }
  expect((await w.guest.call("/settings/teams","POST",memberCreate)).status).toBe(403);
  expect((await w.guest.api("/teams","POST",memberCreate)).status).toBe(403);
  const created=await w.member.api("/teams","POST",memberCreate);
  expect(created.status).toBe(201);
  const owned=await created.json() as Administration["teams"][number];
  expect(owned.isPrivate).toBe(false);
  expect(await env.DB.prepare("SELECT is_private FROM teams WHERE id=?").bind(owned.id).first("is_private")).toBe(0);
  expect(owned.members).toEqual([{operatorId:w.member.id,role:"owner"}]);
  expect((await w.call("/settings/teams/creation","PUT",{membersMayCreate:false})).status).toBe(200);
  expect((await w.member.call("/settings/teams","POST",{name:"synthetic-vector-next-team",identifierPrefix:"SYNNEXT"})).status).toBe(403);
  expect((await w.member.api("/teams","POST",{name:"synthetic-vector-next-api-team",identifierPrefix:"SYNAPI"})).status).toBe(403);
  expect((await w.guest.api("/teams","POST",{name:"synthetic-vector-guest-team",identifierPrefix:"SYNGST"})).status).toBe(403);
  expect((await w.state()).teams.find(team=>team.id===owned.id)?.isPrivate).toBe(false);
  expect((await w.state()).teams.find(team=>team.id===owned.id)?.members).toEqual([{operatorId:w.member.id,role:"owner"}]);
  expect(await audits("workspace.team_creation_changed")).toHaveLength(2);
  // TEAM-007: invite-only changes joining, never public work visibility.
  const inviteTeam=(await w.mutate("/settings/teams","POST",{name:"synthetic-vector-invite-team",identifierPrefix:"SYNINV"})).teams.find(team=>team.name==="synthetic-vector-invite-team")!;
  expect((await w.call(`/settings/teams/${inviteTeam.id}/members/${w.lead.id}`,"PUT",{role:"owner"})).status).toBe(200);
  expect((await w.lead.call(`/settings/teams/${inviteTeam.id}/membership`,"PUT",{mode:"invite_only",requestsEnabled:true})).status).toBe(200);
  expect((await w.member.call(`/teams/${inviteTeam.id}/join`,"POST",{})).status).toBe(403);
  const publicIssue=await w.call("/issues","POST",{title:"synthetic-vector-public-invite-work",teamId:inviteTeam.id});
  expect(publicIssue.status).toBe(201);
  const visible=await publicIssue.json() as {identifier:string};
  expect((await w.member.call(`/issues/${visible.identifier}`)).status).toBe(200);
  expect((await w.member.call(`/teams/${inviteTeam.id}/requests`,"POST",{})).status).toBe(200);
  const pending=await snapshot(["team_join_requests","team_members","audit_records"]);
  expect((await w.member.call(`/teams/${inviteTeam.id}/requests`,"POST",{})).status).toBe(200);
  expect(await snapshot(["team_join_requests","team_members","audit_records"])).toEqual(pending);
  expect(await env.DB.prepare("SELECT 1 FROM team_members WHERE team_id=? AND operator_id=?").bind(inviteTeam.id,w.member.id).first()).toBeNull();
  expect((await w.member.call(`/settings/teams/${inviteTeam.id}/requests/${w.member.id}/decision`,"POST",{decision:"approved"})).status).toBe(403);
  expect((await w.member.call(`/settings/teams/${inviteTeam.id}/members/${w.admin.id}`,"PUT",{role:"member"})).status).toBe(403);
  for(const path of [`/teams/${inviteTeam.id}/join`,`/teams/${inviteTeam.id}/requests`])expect((await w.guest.call(path,"POST",{})).status).toBe(403);
  expect(await snapshot(["team_join_requests","team_members","audit_records"])).toEqual(pending);
  const approve=()=>w.lead.call(`/settings/teams/${inviteTeam.id}/requests/${w.member.id}/decision`,"POST",{decision:"approved"});
  expect((await approve()).status).toBe(200);
  const approved=await snapshot(["team_join_requests","team_members","audit_records"]);
  expect((await approve()).status).toBe(200);
  expect(await snapshot(["team_join_requests","team_members","audit_records"])).toEqual(approved);
  expect(await env.DB.prepare("SELECT role FROM team_members WHERE team_id=? AND operator_id=?").bind(inviteTeam.id,w.member.id).first("role")).toBe("member");
  const another=await w.fresh("member",false);
  expect((await another.call(`/teams/${inviteTeam.id}/requests`,"POST",{})).status).toBe(200);
  expect((await w.admin.call(`/settings/teams/${inviteTeam.id}/requests/${another.id}/decision`,"POST",{decision:"declined"})).status).toBe(200);
  expect(await env.DB.prepare("SELECT 1 FROM team_members WHERE team_id=? AND operator_id=?").bind(inviteTeam.id,another.id).first()).toBeNull();
  expect((await w.call(`/settings/teams/${inviteTeam.id}/membership`,"PUT",{mode:"invite_only",requestsEnabled:false})).status).toBe(200);
  expect((await another.call(`/teams/${inviteTeam.id}/requests`,"POST",{})).status).toBe(403);
  expect((await w.call(`/settings/operators/${another.id}`,"DELETE")).status).toBe(200);
  expect(await env.DB.prepare("SELECT count(*) n FROM team_join_requests WHERE requester_id=?").bind(another.id).first("n")).toBe(0);
  // Owners and Admins create teams and become their first team owner.
  expect(platform.members).toEqual([{ operatorId: w.owner, role: "owner" }]);
  const member = w.as(w.member), lead = w.as(w.lead), guest = w.as(w.guest);

  const joined = await member(`/teams/${platform.id}/join`, "POST", {});
  expect(joined.status).toBe(200);
  expect((await teams(joined)).find((t) => t.id === platform.id)!.members).toContainEqual({ operatorId: w.member.id, role: "member" });
  const left = await member(`/teams/${platform.id}/leave`, "POST", {});
  expect(left.status).toBe(200);
  expect((await teams(left)).find((t) => t.id === platform.id)!.members).toEqual([{ operatorId: w.owner, role: "owner" }]);

  // A Guest joins nothing by themselves, and only a team owner or Admin manages
  // members; refusals change nothing.
  const tables = ["team_members", "team_departures", "audit_records"];
  const before = await snapshot(tables);
  expect((await guest(`/teams/${platform.id}/join`, "POST", {})).status).toBe(403);
  expect((await member(`/settings/teams/${platform.id}/members/${w.member.id}`, "PUT", { role: "owner" })).status).toBe(403);
  expect(await snapshot(tables)).toEqual(before);
  // A team owner removes members, but only an Owner or Admin adds a Guest (ROLE-003).
  expect((await lead(`/settings/teams/${w.team.id}/members/${w.guest.id}`, "DELETE")).status).toBe(200);
  expect((await lead(`/settings/teams/${w.team.id}/members/${w.guest.id}`, "PUT", { role: "member" })).status).toBe(403);
  expect((await w.as(w.admin)(`/settings/teams/${w.team.id}/members/${w.guest.id}`, "PUT", { role: "member" })).status).toBe(200);

  // The last team owner stays until another is named; an Admin always may act.
  expect(await (await w.call(`/teams/${platform.id}/leave`, "POST", {})).json()).toMatchObject({ error: "last_team_owner" });
  expect((await w.as(w.admin)(`/settings/teams/${platform.id}/members/${w.lead.id}`, "PUT", { role: "owner" })).status).toBe(200);
  expect((await w.call(`/teams/${platform.id}/leave`, "POST", {})).status).toBe(200);
  expect((await lead(`/teams/${platform.id}/leave`, "POST", {})).status).toBe(409);

  // Leaving keeps assigned work assigned and listed for the team's owners.
  expect((await member(`/teams/${platform.id}/join`, "POST", {})).status).toBe(200);
  const started = platform.statuses.find((status) => status.category === "started")!.id;
  const assigned = await w.call("/issues", "POST", { title: "Rotate the platform keys", teamId: platform.id, statusId: started, assigneeOperatorId: w.member.id });
  expect(assigned.status).toBe(201);
  const issue = (await assigned.json()) as { identifier: string };
  expect((await member(`/teams/${platform.id}/leave`, "POST", {})).status).toBe(200);
  const listed = (await teams(await lead("/settings/administration"))).find((t) => t.id === platform.id)!;
  expect(listed.departedAssignments).toEqual([{ identifier: issue.identifier, title: "Rotate the platform keys", assigneeOperatorId: w.member.id }]);
  // A public team's membership never narrows what a member sees.
  expect(((await (await member(`/issues/${issue.identifier}`)).json()) as { assignee: { id: string } | null }).assignee?.id).toBe(w.member.id);
  const work = JSON.stringify(await (await member("/my-work")).json());
  expect(work).toContain(issue.identifier);
  expect(JSON.stringify(await (await member("/current")).json())).toContain(issue.identifier);
  expect(JSON.stringify(await (await member("/search?q=" + encodeURIComponent("platform keys"))).json())).toContain(issue.identifier);
  expect(JSON.stringify(await (await member("/notifications")).json())).toContain(issue.identifier);

  // Every change is audited once, with its actor and the membership before and after.
  expect((await audits("team.member_joined")).map((row) => row.actor)).toEqual([w.member.id, w.member.id]);
  // Entries made within one millisecond order by their random identifiers, so compare them as sets.
  expect((await audits("team.member_left")).map((row) => row.actor).sort()).toEqual([w.member.id, w.owner, w.member.id].sort());
  expect((await audits("team.member_removed")).map((row) => [row.actor, JSON.parse(String(row.previous))])).toEqual([[w.lead.id, { operatorId: w.guest.id, role: "member" }]]);
  expect(await audits("team.member_role_changed")).toEqual([]);
  expect((await audits("team.member_added")).map((row) => JSON.parse(String(row.next)))).toContainEqual({ operatorId: w.lead.id, role: "owner" });
}
