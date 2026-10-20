import { dailyReportCountSchema } from "./schema";

export async function readDailyReportCounts(db: D1Database, kind: "project" | "cycle", id: string) {
  const rows = await db.prepare(`SELECT day AS date,timezone,scope,completed,completions,recorded_at AS recordedAt
    FROM ${kind}_report_days WHERE ${kind}_id=? ORDER BY day`).bind(id).all();
  return rows.results.map(row => dailyReportCountSchema.parse(row));
}
