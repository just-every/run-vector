import { cycleReportFactsSchema } from "../cycle-report/schema";
import { cycleReportFactsSql } from "../cycle-report/facts-sql";
import { projectReportFactsSchema, type ProjectReportFacts } from "./schema";
import { projectReportFactsSql } from "./facts-sql";
import { countReportDay } from "./day-counts";
import { shiftDay, workspaceDays } from "./chronology";

/** Runs before cycle rollover. Each closed workspace day is inserted once, so
 * later edits/deletions cannot change its counts. After recording starts, delayed
 * closes are recovered from live chronology before deletion can erase it. */
export async function captureDailyReports(env: { DB: D1Database }, now = new Date(), workspaceId?: string) {
  const db = env.DB, at = now.toISOString();
  const workspaces = (await db.prepare("SELECT id,timezone FROM workspace_settings WHERE id=COALESCE(?,id)").bind(workspaceId ?? null).all<{ id: string; timezone: string }>()).results;
  for (const workspace of workspaces) {
    const dayOf = workspaceDays(workspace.timezone), date = shiftDay(dayOf(at), -1);
    const projects = (await db.prepare(`SELECT p.id,p.created_at AS createdAt,(SELECT max(day) FROM project_report_days WHERE project_id=p.id) AS lastDay FROM projects p
      WHERE p.workspace_id=? AND p.lifecycle NOT IN ('completed','canceled') AND p.archived_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM project_report_days d WHERE d.project_id=p.id AND d.day=?)`)
      .bind(workspace.id, date).all<{ id: string; createdAt: string; lastDay: string | null }>()).results;
    for (const project of projects) {
      if (dayOf(project.createdAt) > date) continue;
      const row = await db.prepare(projectReportFactsSql).bind(project.id).first<{ body: string }>();
      if (!row) continue; // A concurrently removed project has no report to record.
      const facts = projectReportFactsSchema.parse(JSON.parse(row.body));
      for (let captureDate = project.lastDay ? shiftDay(project.lastDay,1) : date; captureDate <= date; captureDate = shiftDay(captureDate,1)) {
      const counts = countReportDay(facts, captureDate);
      await db.prepare(`INSERT OR IGNORE INTO project_report_days(project_id,day,timezone,scope,completed,completions,recorded_at)
        SELECT id,?,?,?,?,?,? FROM projects WHERE id=? AND lifecycle NOT IN ('completed','canceled') AND archived_at IS NULL`)
        .bind(captureDate, workspace.timezone, counts.scope, counts.completed, counts.completions, at, project.id).run();
      }
    }
    const cycles = (await db.prepare(`SELECT c.id,c.starts_at AS startsAt,c.ends_at AS endsAt,(SELECT max(day) FROM cycle_report_days WHERE cycle_id=c.id) AS lastDay,${cycleReportFactsSql} AS body
      FROM cycles c JOIN teams t ON t.id=c.team_id WHERE t.workspace_id=? AND c.closed_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM cycle_report_days d WHERE d.cycle_id=c.id AND d.day=?)`)
      .bind(workspace.id, date).all<{ id: string; startsAt: string; endsAt: string; lastDay: string | null; body: string }>()).results;
    for (const cycle of cycles) {
      if (date < dayOf(cycle.startsAt)) continue;
      const lastDate = date < dayOf(Date.parse(cycle.endsAt) - 1) ? date : dayOf(Date.parse(cycle.endsAt) - 1);
      const source = cycleReportFactsSchema.parse(JSON.parse(cycle.body));
      // The cycle read contains current members and earlier members together.
      // Read current membership explicitly; category/assignee facts stay ephemeral.
      const members = new Set((await db.prepare("SELECT identifier FROM issues WHERE cycle_id=?").bind(cycle.id)
        .all<{ identifier: string }>()).results.map(i => i.identifier));
      const facts: ProjectReportFacts = {
        createdAt: cycle.startsAt, recoveredAt: null, timezone: workspace.timezone, lifecycle: "active", archived: false,
        memberships: source.memberships.map((e, index) => ({ ...e, id: index + 1 })),
        issues: source.issues.map(issue => {
          const transitions = [...issue.transitions].sort((a,b) => Date.parse(b.at)-Date.parse(a.at) || b.id.localeCompare(a.id));
          return { identifier: issue.identifier, member: members.has(issue.identifier), category: issue.category,
            createdAt: issue.createdAt, transitions: transitions.map((t,index) => ({ ...t,
              category: index === 0 ? issue.category : transitions[index - 1].previousCategory })) };
        }),
      };
      for (let captureDate = cycle.lastDay ? shiftDay(cycle.lastDay,1) : lastDate; captureDate <= lastDate; captureDate = shiftDay(captureDate,1)) {
      const counts = countReportDay(facts, captureDate);
      await db.prepare(`INSERT OR IGNORE INTO cycle_report_days(cycle_id,day,timezone,scope,completed,completions,recorded_at)
        SELECT id,?,?,?,?,?,? FROM cycles WHERE id=? AND closed_at IS NULL`)
        .bind(captureDate, workspace.timezone, counts.scope, counts.completed, counts.completions, at, cycle.id).run();
      }
    }
  }
}
