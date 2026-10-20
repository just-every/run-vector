import { readDailyReportCounts } from "../project-report/daily-records";
import type { CycleSnapshot } from "../cycle-closure/schema";
import { buildCycleReport } from "./build";
import { cycleReportFactsSchema } from "./schema";
import { cycleReportFactsSql } from "./facts-sql";

export async function readCycleReport(db: D1Database,
  cycle: { id: string; startsAt: string; endsAt: string; timezone: string },
  issues: { identifier: string; category: string }[], snapshot: CycleSnapshot | null) {
  const recorded = await readDailyReportCounts(db,"cycle",cycle.id);
  if (snapshot) return buildCycleReport(cycle, snapshot.reportFacts ?? null, snapshot.committed, snapshot,new Date(),recorded.length ? recorded : undefined);
  const row = await db.prepare(`SELECT ${cycleReportFactsSql} AS body FROM cycles c WHERE c.id=?`)
    .bind(cycle.id).first<{ body: string }>();
  if (!row) throw new Error("Cycle disappeared while reading its report.");
  return buildCycleReport(cycle, cycleReportFactsSchema.parse(JSON.parse(row.body)), issues, null,new Date(),recorded);
}
