import { z } from "zod";
const id = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export const workloadQuerySchema = z
  .object({
    cycleId: id.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .superRefine((q, ctx) => {
    const cycle = !!q.cycleId && !q.from && !q.to;
    const range = !q.cycleId && !!q.from && !!q.to && q.from <= q.to;
    if (!cycle && !range)
      ctx.addIssue({
        code: "custom",
        message: "Choose a cycle or an ordered date range.",
      });
  });
export type WorkloadQuery = z.infer<typeof workloadQuerySchema>;
export const capacityInputSchema = z.object({
  capacity: z.number().int().min(0).max(100000).nullable(),
  expectedVersion: z.number().int().nonnegative(),
});
export const workloadSchema = z.object({
  operatorId: z.string(),
  scope: z.string(),
  title: z.string(),
  timezone: z.string(),
  rows: z.array(
    z.object({
      operatorId: z.string().nullable(),
      name: z.string(),
      points: z.number(),
      issueCount: z.number(),
      unestimated: z.number(),
      capacity: z.number().nullable(),
      version: z.number(),
      state: z.enum(["unknown", "over-capacity", "within-capacity"]),
      issues: z.array(
        z.object({
          identifier: z.string(),
          title: z.string(),
          estimate: z.number().nullable(),
        }),
      ),
    }),
  ),
});
export type Workload = z.infer<typeof workloadSchema>;
