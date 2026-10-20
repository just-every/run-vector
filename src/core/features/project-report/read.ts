import { buildProjectReport } from "./build";
import { projectReportFactsSchema, type ProjectFinalCounts } from "./schema";
import { projectReportFactsSql } from "./facts-sql";
import { readDailyReportCounts } from "./daily-records";

export async function readProjectReport(db: D1Database, projectId: string, now = new Date()) {
  const row = await db.prepare(`SELECT live.body,s.through_at AS throughAt,s.timezone,
    s.final_state AS finalState,s.scope,s.completed FROM (${projectReportFactsSql}) live
    LEFT JOIN project_report_snapshots s ON s.project_id=?`).bind(projectId,projectId)
    .first<{ body: string } & Partial<ProjectFinalCounts>>();
  if (!row) throw new Error("Project disappeared while reading its report.");
  const final = row.throughAt ? { throughAt: row.throughAt, timezone: row.timezone!,
    finalState: row.finalState!, scope: row.scope!, completed: row.completed! } : null;
  return buildProjectReport(projectReportFactsSchema.parse(JSON.parse(row.body)),
    await readDailyReportCounts(db,"project",projectId),final,now);
}
