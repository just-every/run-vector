import { seedIntakeForTeam, recordedReply } from './email-intake-fixture';
import { expect } from "vitest";
import type { RowId } from "../../src/core/features/roles/matrix";
import type { Kind, Person, roleWorkspace } from "./role-fixture";
import { channelEdge } from "./channel-edge-fixture";

type Workspace = Awaited<ReturnType<typeof roleWorkspace>>;
type Issue = { id: string; identifier: string; version: number };
type Send = () => Promise<Response>;
/** One attempt at a row's action by `who` on a team (for a Guest, possibly a
 * team they are not in): the Owner prepares its subjects, then it returns the
 * one request to send, through the browser door (`call`) or `/api/v1` (`api`). */
export type Attempt = (who: Kind, actor: Person, team: string) => Promise<Send>;
export type Probe = { permission?: "settings" | "planning"; invites?: true; outside?: true; session: Attempt; api?: Attempt };

const json = async <T>(response: Response | Promise<Response>) => {
  const settled = await response;
  expect([200, 201], await settled.clone().text()).toContain(settled.status);
  return (await settled.json()) as T;
};

/** A request for every role-matrix row that has a door today. */
export function probes(w: Workspace): Record<RowId, Probe> {
  let n = 0;
  const unique = () => ++n;
  const prefix = (stem: string) => { const id = unique(); return stem + String.fromCharCode(65 + Math.floor(id / 26) % 26, 65 + (id % 26)); };
  const owner = w.people.owner;
  const issue = (team: string, extra: Record<string, unknown> = {}) =>
    json<Issue>(owner.call("/issues", "POST", { title: `Probe issue ${unique()}`, teamId: team, ...extra }));
  const comment = async (by: Person, identifier: string) =>
    (await json<{ id: string }>(by.call(`/issues/${identifier}/comments`, "POST", { body: `Probe comment ${unique()}` }))).id;
  /** The actor's own comment on a team's issue; a Guest outside the team wrote
   * it while they were still in it. */
  const authored = async (actor: Person, team: string, identifier: string) => {
    const visiting = team !== w.team.id && actor === w.people.guest;
    if (visiting) expect((await owner.call(`/settings/teams/${team}/members/${actor.id}`, "PUT", { role: "member" })).status).toBe(200);
    const id = await comment(actor, identifier);
    if (visiting) expect((await owner.call(`/settings/teams/${team}/members/${actor.id}`, "DELETE")).status).toBe(200);
    return id;
  };
  const commentVersion = async (id: string) => (await json<{ version: number }>(owner.api(`/comments/${id}`))).version;
  const cycle = (team: string) => {
    const week = unique();
    const day = (offset: number) => new Date(Date.UTC(2032, 0, 5 + 7 * week + offset)).toISOString().slice(0, 10) + "T09:00";
    return { teamId: team, name: `Probe cycle ${week}`, startsLocal: day(0), endsLocal: day(5), capacity: null };
  };
  const openCycle = async (team: string) => {
    const created = cycle(team);
    return (await json<{ cycles: { id: string; name: string }[] }>(owner.call("/settings/cycles", "POST", created))).cycles.find((c) => c.name === created.name)!.id;
  };
  const project = async (lead = owner.id) => (await json<{ id: string }>(owner.api("/projects", "POST", { name: `Probe project ${unique()}`, leadOperatorId: lead }))).id;
  const view = async (by: Person, shared: boolean, team: string) => (await json<{ id: string }>(by.call("/views", "POST", {
    name: `Probe view ${unique()}`, isShared: shared, layout: "list", query: { team } }))).id;
  const label = async () => {
    const name = `Probe label ${unique()}`;
    return (await json<{ labels: { id: string; name: string }[] }>(owner.call("/settings/labels", "POST", { name, color: "#2255aa" }))).labels.find((l) => l.name === name)!.id;
  };
  const backlog = async (team: string) => (await w.state()).teams.find((t) => t.id === team)!.statuses.find((s) => s.category === "backlog")!.id;
  const team = async (name: string, stem: string) => {
    const created = await json<{ teams: { id: string; name: string }[] }>(owner.call("/settings/teams", "POST", { name, identifierPrefix: prefix(stem) }));
    return created.teams.find((t) => t.name === name)!.id;
  };

  return {
    "email.reply": { session: async (_who, actor, teamId) => { const intake=await seedIntakeForTeam(teamId,w.cookie); return async () => (await recordedReply(actor.cookie,intake.identifier,"The team is investigating.")).response; } },
    "members.manage": { invites: true, session: async (_who, actor) => () => actor.call("/settings/operators/invite", "POST", { email: `invitee${unique()}@roles.test`, displayName: "Invitee", role: "member" }) },
    "leaders.manage": { invites: true, session: async (_who, actor) => () => actor.call("/settings/operators/invite", "POST", { email: `leader${unique()}@roles.test`, displayName: "Leader", role: "admin" }) },
    "workspace.leave": { session: async (who) => { const leaving = await w.fresh(who); return () => leaving.call(`/settings/operators/${leaving.id}`, "DELETE"); } },
    "workspace.settings": { session: async (_who, actor) => () => actor.call("/settings", "PATCH", { timezone: "UTC" }) },
    "teams.create": { session: async (_who, actor) => { const name = `Probe team ${unique()}`, identifierPrefix = prefix("PRB"); return () => actor.call("/settings/teams", "POST", { name, identifierPrefix }); } },
    "teams.members": { session: async (_who, actor, id) => { const joining = await w.fresh("member", false); return () => actor.call(`/settings/teams/${id}/members/${joining.id}`, "PUT", { role: "member" }); } },
    "teams.permissions": { session: async (_who, actor, id) => {
      const current = (await w.state()).teams.find((t) => t.id === id)!;
      return () => actor.call(`/settings/teams/${id}/permissions`, "PUT", { settings: current.settingsPermission, planning: current.planningPermission }); } },
    "teams.join": { session: async (_who, actor) => { const id = await team(`Directory team ${unique()}`, "DIR"); return () => actor.call(`/teams/${id}/join`, "POST", {}); } },
    "teams.settings": { permission: "settings", session: async (_who, actor, id) => { const value = unique() % 2 === 0; return () => actor.call(`/settings/teams/${id}`, "PATCH", { autoCycleStarted: value }); } },
    "teams.workflow": { permission: "settings", session: async (_who, actor, id) => { const status = await backlog(id), name = `Backlog ${unique()}`; return () => actor.call(`/settings/teams/${id}/statuses/${status}`, "PATCH", { name }); } },
    // Checked under both settings values: All team members never lets a member archive.
    "teams.archive": { permission: "settings", session: async (_who, actor, id) => async () => {
      const response = await actor.call(`/settings/teams/${id}`, "PATCH", { archived: true });
      // The probed team stays in use for the rows that follow.
      if (response.ok) expect((await owner.call(`/settings/teams/${id}`, "PATCH", { archived: false })).status).toBe(200);
      return response; } },
    "issues.write": { outside: true,
      session: async (_who, actor, id) => () => actor.call("/issues", "POST", { title: `Written ${unique()}`, teamId: id }),
      api: async (_who, actor, id) => () => actor.api("/issues", "POST", { title: `Written ${unique()}`, teamId: id }) },
    "issues.copy": { outside: true,
      session: async (_who, actor, id) => { const source = await issue(id); return () => actor.call(`/issues/${source.identifier}/copy`, "POST", { expectedVersion: source.version, teamId: id }); },
      api: async (_who, actor, id) => { const source = await issue(id); return () => actor.api(`/issues/${source.identifier}/copy`, "POST", { expectedVersion: source.version, teamId: id }); } },
    "comments.own": { outside: true,
      session: async (_who, actor, id) => { const target = await issue(id), mine = await authored(actor, id, target.identifier);
        return () => actor.call(`/issues/${target.identifier}/comments/${mine}`, "PATCH", { body: "Edited by its author" }); },
      api: async (_who, actor, id) => { const target = await issue(id), mine = await authored(actor, id, target.identifier), expectedVersion = await commentVersion(mine);
        return () => actor.api(`/comments/${mine}`, "PATCH", { expectedVersion, body: "Edited by its author" }); } },
    "comments.edit-others": {
      session: async (who, actor) => { const target = await issue(w.team.id), theirs = await comment(who === "owner" ? w.people.admin : owner, target.identifier);
        return () => actor.call(`/issues/${target.identifier}/comments/${theirs}`, "PATCH", { body: "Rewritten by someone else" }); },
      api: async (who, actor) => { const target = await issue(w.team.id), theirs = await comment(who === "owner" ? w.people.admin : owner, target.identifier), expectedVersion = await commentVersion(theirs);
        return () => actor.api(`/comments/${theirs}`, "PATCH", { expectedVersion, body: "Rewritten by someone else" }); } },
    "media.write": { outside: true, session: async (_who, actor, id) => {
      const target = await issue(id, { description: "- [ ] Check the backup" });
      return () => actor.call(`/issues/${target.identifier}/checklist`, "POST", { expectedVersion: target.version, index: 0, text: "Check the backup", checked: true }); } },
    "comments.delete-own": {
      session: async (_who, actor) => { const target = await issue(w.team.id), mine = await comment(actor, target.identifier); return () => actor.call(`/issues/${target.identifier}/comments/${mine}`, "DELETE"); },
      api: async (_who, actor) => { const target = await issue(w.team.id), mine = await comment(actor, target.identifier), expectedVersion = await commentVersion(mine);
        return () => actor.api(`/comments/${mine}`, "DELETE", { expectedVersion }); } },
    "comments.delete-others": {
      session: async (who, actor) => { const target = await issue(w.team.id), theirs = await comment(who === "owner" ? w.people.admin : owner, target.identifier);
        return () => actor.call(`/issues/${target.identifier}/comments/${theirs}`, "DELETE"); },
      api: async (who, actor) => { const target = await issue(w.team.id), theirs = await comment(who === "owner" ? w.people.admin : owner, target.identifier), expectedVersion = await commentVersion(theirs);
        return () => actor.api(`/comments/${theirs}`, "DELETE", { expectedVersion }); } },
    "issues.delete-permanent": { session: async (_who, actor) => { const target = await issue(w.team.id); return () => actor.call(`/issues/${target.identifier}`, "DELETE", { expectedVersion: target.version, confirmed: true }); } },
    "labels.create": { session: async (_who, actor) => () => actor.call("/settings/labels", "POST", { name: `Created label ${unique()}`, color: "#aa5522" }) },
    "labels.manage": { session: async (_who, actor) => { const id = await label(), name = `Renamed label ${unique()}`; return () => actor.call(`/settings/labels/${id}`, "PATCH", { name }); } },
    "intake.create": { outside: true, session: async (_who, actor, id) => () => actor.call("/intake", "POST", { title: `Intake ${unique()}`, teamId: id }) },
    "intake.decide": { session: async (_who, actor) => {
      const intake = await json<Issue>(owner.call("/intake", "POST", { title: `Decision ${unique()}`, teamId: w.team.id }));
      return () => actor.call(`/issues/${intake.identifier}/decline`, "POST", { expectedVersion: intake.version, reason: "Not ours" }); } },
    "sources.manage": { session: async (_who, actor) => () => actor.call("/settings/integrations/sources", "POST", { sourceId: `probe-source-${unique()}`, name: "Probe source", teamId: w.team.id }) },
    "cycles.manage": { permission: "planning",
      session: async (_who, actor, id) => { const input = cycle(id); return () => actor.call("/settings/cycles", "POST", input); },
      api: async (_who, actor, id) => { const input = cycle(id); return () => actor.api("/cycles", "POST", input); } },
    "cycles.schedule": { permission: "planning", session: async (_who, actor, id) => () => actor.call(`/settings/teams/${id}/cycle-schedule`, "PUT", { weeks: 2, startWeekday: 1, cooldownWeeks: 0, upcomingCount: 2 }) },
    "cycles.commit": { outside: true,
      session: async (_who, actor, id) => { const target = await issue(id), cycleId = await openCycle(id); return () => actor.call(`/issues/${target.identifier}`, "PATCH", { expectedVersion: target.version, cycleId }); },
      api: async (_who, actor, id) => { const target = await issue(id), cycleId = await openCycle(id); return () => actor.api(`/issues/${target.identifier}`, "PATCH", { expectedVersion: target.version, cycleId }); } },
    "projects.write": {
      session: async (_who, actor) => () => actor.call("/settings/projects", "POST", { name: `Created project ${unique()}`, leadOperatorId: actor.id }),
      api: async (_who, actor) => () => actor.api("/projects", "POST", { name: `Created project ${unique()}`, leadOperatorId: actor.id }) },
    "projects.status": {
      session: async (_who, actor) => { const id = await project(); return () => actor.call(`/settings/projects/${id}`, "PATCH", { lifecycle: "active" }); },
      api: async (_who, actor) => { const id = await project(); return () => actor.api(`/projects/${id}`, "PATCH", { lifecycle: "active" }); } },
    // Leading the project grants no deletion privilege until recoverable deletion ships.
    "projects.delete": {
      session: async (_who, actor) => { const id = await project(w.people.lead.id); return () => actor.call(`/settings/projects/${id}`, "DELETE"); },
      api: async (_who, actor) => { const id = await project(w.people.lead.id); return () => actor.api(`/projects/${id}`, "DELETE"); } },
    "milestones.write": {
      session: async (_who, actor) => { const id = await project(); return () => actor.call(`/settings/projects/${id}/milestones`, "POST", { name: `Milestone ${unique()}` }); },
      api: async (_who, actor) => { const id = await project(); return () => actor.api(`/projects/${id}/milestones`, "POST", { name: `Milestone ${unique()}` }); } },
    "views.private": { session: async (_who, actor) => () => actor.call("/views", "POST", { name: `Private view ${unique()}`, isShared: false, layout: "list", query: {} }) },
    "views.share": { session: async (_who, actor) => () => actor.call("/views", "POST", { name: `Shared view ${unique()}`, isShared: true, layout: "list", query: { team: w.team.id } }) },
    "views.open-shared": { outside: true, session: async (_who, actor, id) => { const shared = await view(owner, true, id); return () => actor.call(`/views/${shared}/duplicate`, "POST", { name: `Copied view ${unique()}` }); } },
    "views.edit-shared": { session: async (who, actor) => { const shared = await view(who === "guest" ? owner : actor, true, w.team.id); return () => actor.call(`/views/${shared}`, "PATCH", { name: `Renamed view ${unique()}` }); } },
    "integrations.manage": { session: async (_who, actor) => () => actor.call("/settings/integrations") },
    // Slack is faked at the network edge; a refused request never reaches it.
    "channels.bind-project": { session: async (_who, actor) => {
      const edge=channelEdge(),id=await project();
      try {
        expect((await owner.call("/settings/integrations/slack","POST",{botToken:edge.token})).status).toBe(200);
        expect((await owner.call("/settings/integrations/channels/allowed","POST",{channelId:"CAPPROVED",channelName:"delivery"})).status).toBe(201);
      } catch(error){edge.restore();throw error;}
      return async()=>{try{
        const before=edge.calls.length;
        const denied=await actor.call(`/projects/${id}/slack-channel`,"POST",{channelId:"CUNAPPROVED"});
        expect(denied.status).toBe(403);expect(edge.calls.length).toBe(before);
        return await actor.call(`/projects/${id}/slack-channel`,"POST",{channelId:"CAPPROVED"});
      }finally{edge.restore();}};
    } },
    "channels.create": { session: async (_who, actor) => {
      const edge = channelEdge(), name = `Channel project ${unique()}`;
      try { expect((await owner.call("/settings/integrations/slack", "POST", { botToken: edge.token })).status).toBe(200); }
      catch (error) { edge.restore(); throw error; }
      return async () => {
        try {
          const response = await actor.call("/settings/projects", "POST", { name, leadOperatorId: actor.id, createSlackChannel: true });
          expect(edge.calls.filter((call) => call.method === "conversations.create")).toHaveLength(response.ok ? 1 : 0);
          return response;
        } finally { edge.restore(); }
      }; } },
    "tokens.personal": { session: async (_who, actor) => () => actor.call("/settings/integrations/tokens", "POST", { name: `Token ${unique()}`, scopes: ["issues:read"] }) },
    "identity.personal": { session: async (_who, actor) => () => actor.call("/settings/notifications/slack/link", "DELETE") },
    "audit.read": { session: async (_who, actor) => () => actor.call("/settings/audit") },
    "data.export": { session: async (_who, actor) => async () => {
      const created = await actor.call("/portability/exports", "POST", {});
      if (created.ok) await owner.call(`/portability/exports/${((await created.clone().json()) as { id: string }).id}/abort`, "POST", {});
      return created; } },
    "data.import": { session: async (_who, actor) => () => actor.call("/data/import/runs") },
    "data.restore": { session: async (_who, actor) => () => actor.call("/data/restore") },
    "data.erase-imported": { session: async (_who, actor) => () => actor.call("/data/erasure/journal") },
  };
}
