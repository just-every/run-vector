import { z } from "zod";

const membership = z.object({
  id: z.string(), identifier: z.string(), direction: z.enum(["added", "removed"]), at: z.string(),
});
export const cycleReportFactsSchema = z.object({
  memberships: z.array(membership),
  issues: z.array(z.object({
    identifier: z.string(), category: z.string(), createdAt: z.string(),
    assigneeId: z.string().nullable(), assigneeName: z.string().nullable(),
    transitions: z.array(z.object({
      id: z.string(), at: z.string(), previousCategory: z.string().nullable(),
    })),
  })),
});
export const cycleReportSchema = z.object({
  source: z.enum(["live", "snapshot", "legacy-snapshot"]),
  timezone: z.string(), through: z.string(),
  days: z.array(z.object({
    date: z.string(), scope: z.number().nullable(), completed: z.number().nullable(),
    added: z.array(z.string()), removed: z.array(z.string()),
  })),
  completed: z.array(z.string()), carried: z.array(z.string()), other: z.array(z.string()),
  addedMidcycle: z.array(z.string()),
  byAssignee: z.array(z.object({
    id: z.string().nullable(), name: z.string(), completed: z.number(), carried: z.number(),
    other: z.number(), addedMidcycle: z.number(),
  })),
  limitations: z.array(z.string()),
});
export type CycleReportFacts = z.infer<typeof cycleReportFactsSchema>;
export type CycleReport = z.infer<typeof cycleReportSchema>;
