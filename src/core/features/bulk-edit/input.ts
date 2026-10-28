import { z } from "zod";
import seed from "../../../../seed.json";
export const bulkIssueInputSchema = z
  .object({
    issues: z
      .array(
        z
          .object({
            identifier: z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/),
            expectedVersion: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1)
      .max(seed.limits.bulkEditIssuesPerOperation)
      .refine(
        (rows) =>
          new Set(rows.map((row) => row.identifier)).size === rows.length,
        "Select each issue only once.",
      ),
    changes: z
      .object({
        statusId: z.string().length(26).optional(),
        assigneeOperatorId: z.string().length(26).nullable().optional(),
        priority: z
          .enum(["urgent", "high", "medium", "low", "none"])
          .optional(),
        projectId: z.string().length(26).nullable().optional(),
    milestoneId: z.string().length(26).nullable().optional(),
        cycleId: z.string().length(26).nullable().optional(),
        labelIds: z.array(z.string().length(26)).optional(),
        estimate: z.number().int().min(1).max(100).nullable().optional(),
        startDate: z.string().date().nullable().optional(),
        dueDate: z.string().date().nullable().optional(),
      })
      .strict()
      .refine(
        (value) => Object.keys(value).length > 0,
        "At least one change is required.",
      ),
  })
  .strict();
export type BulkIssueInput = z.infer<typeof bulkIssueInputSchema>;
