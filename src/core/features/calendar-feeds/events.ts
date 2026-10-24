import { browseActor } from "../issues/browse-access";
import { addDays } from "../cycle-schedule/calendar";
import { visibilityDatabase } from "../roles/visibility-database";
import type { CalendarEvent } from "./schema";
export type CalendarScope = { kind: "personal" } | { kind: "team"; teamId: string } | { kind: "visible" };
/** The feed and calendar view share this reader, always projected as the viewer.
 * Personal feeds contain assigned work, own-team cycles and milestones of
 * projects the reader leads or has assigned work in. Team feeds use contributing issues. */
export async function readCalendarEvents(source: D1Database, actor: string, scope: CalendarScope, origin: string, publicOnly=false): Promise<CalendarEvent[]> {
  const db = visibilityDatabase(source, actor), access = await browseActor(db, actor);
  const issueWhere = scope.kind === "team" ? "i.team_id=?" : scope.kind === "personal" ? "i.assignee_operator_id=?" : "1";
  const issueValues = scope.kind === "team" ? [scope.teamId] : scope.kind === "personal" ? [actor] : [];
  const cycleWhere = scope.kind === "team" ? "c.team_id=?" : scope.kind === "personal"
    ? "EXISTS(SELECT 1 FROM team_members member WHERE member.team_id=c.team_id AND member.operator_id=?)" : "1";
  const milestoneWhere = scope.kind === "team"
    ? "EXISTS(SELECT 1 FROM issues i WHERE i.project_id=p.id AND i.team_id=?)"
    : scope.kind === "personal" ? "(p.lead_operator_id=? OR EXISTS(SELECT 1 FROM issues i WHERE i.project_id=p.id AND i.assignee_operator_id=?))" : "1";
  const milestoneValues = scope.kind === "team" ? [scope.teamId] : scope.kind === "personal" ? [actor, actor] : [];
  const releaseWhere=scope.kind==='team'?'r.team_id=?':scope.kind==='personal'?"(r.team_id IS NULL OR EXISTS(SELECT 1 FROM team_members member WHERE member.team_id=r.team_id AND member.operator_id=?))":'1';
  const [issues, cycles, milestones, releases] = await db.batch([
    db.prepare(`SELECT i.id,i.identifier,i.title,i.due_date day,i.version,i.team_id teamId,i.updated_at updatedAt
      FROM issues i JOIN teams t ON t.id=i.team_id WHERE t.workspace_id=? AND i.due_date IS NOT NULL
      AND i.archived_at IS NULL AND ${publicOnly?'t.is_private=0':'1'} AND ${issueWhere} ORDER BY i.due_date,i.identifier`).bind(access.workspace_id, ...issueValues),
    db.prepare(`SELECT c.id,c.name,c.starts_at start,c.ends_at end,c.updated_at updatedAt
      FROM cycles c JOIN teams t ON t.id=c.team_id WHERE t.workspace_id=? AND ${publicOnly?'t.is_private=0':'1'} AND ${cycleWhere} ORDER BY c.starts_at,c.id`)
      .bind(access.workspace_id, ...issueValues),
    db.prepare(`SELECT m.id,m.name,m.target_date day,m.project_id projectId,m.updated_at updatedAt
      FROM project_milestones m JOIN projects p ON p.id=m.project_id WHERE p.workspace_id=?
      AND m.target_date IS NOT NULL AND ${publicOnly?'NOT EXISTS(SELECT 1 FROM main.issues hidden JOIN main.teams private ON private.id=hidden.team_id WHERE hidden.project_id=p.id AND private.is_private=1)':'1'} AND ${milestoneWhere} ORDER BY m.target_date,m.id`).bind(access.workspace_id, ...milestoneValues),
    db.prepare(`SELECT r.id,r.name,r.target_date day,r.updated_at updatedAt FROM releases r
      WHERE r.workspace_id=? AND r.target_date IS NOT NULL
      AND (r.team_id IS NULL OR r.team_id IN(SELECT id FROM teams))
      AND ${publicOnly?"(r.team_id IS NULL OR EXISTS(SELECT 1 FROM teams t WHERE t.id=r.team_id AND (t.is_private=0 OR EXISTS(SELECT 1 FROM team_members member WHERE member.team_id=t.id AND member.operator_id=?))))":'1'}
      AND ${releaseWhere} ORDER BY r.target_date,r.id`).bind(access.workspace_id,...(publicOnly?[actor]:[]),...issueValues),
  ]);
  const events: CalendarEvent[] = [
    ...(issues.results as { id: string; identifier: string; title: string; day: string; version: number; teamId: string; updatedAt: string }[]).map(i => ({
      id: `issue-${i.id}-${i.day}`, kind: "issue" as const, title: i.identifier + " · " + i.title,
      start: i.day, end: addDays(i.day, 1), allDay: true, url: origin + "/app/issues/" + encodeURIComponent(i.identifier),
      updatedAt: i.updatedAt, identifier: i.identifier, version: i.version, teamId: i.teamId,
    })),
    ...(cycles.results as { id: string; name: string; start: string; end: string; updatedAt: string }[]).map(c => ({
      id: "cycle-" + c.id, kind: "cycle" as const, title: c.name, start: c.start, end: c.end,
      allDay: false, url: origin + "/app/cycles/" + c.id, updatedAt: c.updatedAt,
    })),
    ...(milestones.results as { id: string; name: string; day: string; projectId: string; updatedAt: string }[]).map(m => ({
      id: "milestone-" + m.id, kind: "milestone" as const, title: m.name, start: m.day, end: addDays(m.day, 1),
      allDay: true, url: origin + "/app/projects/" + m.projectId, updatedAt: m.updatedAt,
    })),
    ...(releases.results as {id:string;name:string;day:string;updatedAt:string}[]).map(release=>({
      id:'release-'+release.id,kind:'release' as const,title:release.name,start:release.day,end:addDays(release.day,1),
      allDay:true,url:origin+'/app/releases/'+release.id,updatedAt:release.updatedAt,
    })),
  ];
  await browseActor(db, actor, access.workspace_id);
  return events.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}
