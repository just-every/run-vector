import { z } from "zod";

export const projectForecastSchema = z.object({
  method: z.literal("daily-throughput-bootstrap-v1"),
  through: z.string(), timezone: z.string(),
  status: z.enum(["forecast", "insufficient-evidence", "nothing-remaining", "inactive"]),
  dates: z.object({ p50: z.string().nullable(), p85: z.string().nullable() }),
  history: z.object({ from: z.string(), to: z.string(), dailyCompletions: z.array(z.number()), completions: z.number() }),
  capacityWindow: z.object({ from: z.string(), to: z.string(), serialDays: z.number().nullable(), competingPoints: z.number(), unestimatedCompeting: z.number() }),
  scope: z.object({ projectIssues: z.number(), prerequisiteIssues: z.number(), estimatedPoints: z.number(), unestimated: z.number(), unknownCapacity: z.number() }),
  reasons: z.array(z.string()), assumptions: z.array(z.string()),
});
export type ProjectForecast = z.infer<typeof projectForecastSchema>;
