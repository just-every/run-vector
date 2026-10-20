import { z } from "zod";

export const projectReportFactsSchema = z.object({
  createdAt: z.string(), recoveredAt: z.string().nullable(), timezone: z.string(),
  lifecycle: z.string(), archived: z.boolean(),
  memberships: z.array(z.object({
    id: z.number(), identifier: z.string(), direction: z.enum(["added", "removed"]), at: z.string(),
  })),
  issues: z.array(z.object({
    identifier: z.string(), member: z.boolean(), category: z.string(), createdAt: z.string(),
    transitions: z.array(z.object({
      id: z.string(), at: z.string(), previousCategory: z.string().nullable(), category: z.string().nullable(),
    })),
  })),
});
export const dailyReportCountSchema = z.object({
  date: z.string(), timezone: z.string(), scope: z.number().nullable(), completed: z.number().nullable(),
  completions: z.number().nullable(), recordedAt: z.string(),
});
export type DailyReportCount = z.infer<typeof dailyReportCountSchema>;
export type ProjectFinalCounts = {
  throughAt: string; timezone: string; finalState: string; scope: number; completed: number;
};
export const projectReportSchema = z.object({
  source: z.enum(["live", "snapshot"]), timezone: z.string(), through: z.string(),
  finalState: z.string().nullable(), recoveredAt: z.string().nullable(),
  days: z.array(z.object({
    date: z.string(), scope: z.number().nullable(), completed: z.number().nullable(),
    added: z.array(z.string()), removed: z.array(z.string()),
  })),
  projection: z.object({
    status: z.enum(["projected", "not-enough-history", "nothing-remaining", "final"]),
    date: z.string().nullable(), remaining: z.number(), completions: z.number(),
    windowStart: z.string(), windowEnd: z.string(),
  }),
  limitations: z.array(z.string()),
});
export type ProjectReportFacts = z.infer<typeof projectReportFactsSchema>;
export type ProjectReport = z.infer<typeof projectReportSchema>;
