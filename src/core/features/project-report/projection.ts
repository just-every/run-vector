import type { DailyReportCount, ProjectReport } from "./schema";
import { shiftDay, workspaceDays } from "./chronology";

/** Only immutable closed-day completion counts enter the rate. Same-day events
 * are deduplicated at capture; no cross-day issue identity is retained. */
export function projectProjection(days: DailyReportCount[], timezone: string, through: string,
  remaining: number, final: boolean): ProjectReport["projection"] {
  const today = workspaceDays(timezone)(through), end = shiftDay(today, -1), start = shiftDay(end, -27);
  const completions = days.filter(d => d.date >= start && d.date <= end)
    .reduce((sum, day) => sum + (day.completions ?? 0), 0);
  const status = final ? "final" : remaining === 0 ? "nothing-remaining" : completions < 3 ? "not-enough-history" : "projected";
  return { status, date: status === "projected" ? shiftDay(today, Math.ceil(remaining * 28 / completions)) : null,
    remaining, completions, windowStart: start, windowEnd: end };
}
