import { z } from "zod";
export const cycleProgressSchema = z.object({
  completed: z.number(),
  total: z.number(),
  unit: z.enum(["points", "issue-count"]),
  percentage: z.number().nullable(),
  capacity: z.number().nullable(),
  capacityRisk: z.enum(["unknown", "at-risk", "within-capacity"]),
  remainingPoints: z.number().nullable(),
  unestimatedRemaining: z.number(),
});
export const cycleSnapshotSchema = z.object({
  closedAt: z.string(),
  timezone: z.string(),
  capacity: z.number().nullable(),
  estimateTotal: z.number(),
  completedEstimateTotal: z.number(),
  committed: z.array(
    z.object({
      identifier: z.string(),
      projectId: z.string().nullable(),
      // Older immutable snapshots did not record a readable project name.
      projectName: z.string().nullable().optional(),
      estimate: z.number().nullable(),
      category: z.string(),
    }),
  ),
  completed: z.array(z.string()),
  progress: cycleProgressSchema,
  changes: z.array(
    z.object({
      identifier: z.string(),
      direction: z.enum(["added", "removed"]),
      at: z.string(),
    }),
  ),
});
export const cycleFailureSchema = z.object({
  identifiers: z.array(z.string()),
  createdAt: z.string(),
});
export const historicalCycleSchema = z.object({
  cycleId: z.string(),
  name: z.string(),
  snapshot: cycleSnapshotSchema,
});
export type CycleSnapshot = z.infer<typeof cycleSnapshotSchema>;
