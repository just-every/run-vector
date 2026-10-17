import { z } from "zod";
import seed from "../../../../seed.json";

export const issueIdentifier = z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
const selectedIssue = z.object({
  identifier: issueIdentifier,
  expectedVersion: z.number().int().positive(),
}).strict();
const selection = <T extends z.ZodType<{ identifier: string }>>(row: T) =>
  z.array(row).min(1).max(seed.limits.bulkEditIssuesPerOperation).refine(
    (rows) => new Set(rows.map((value) => value.identifier)).size === rows.length,
    "Select each issue only once.",
  );

export const bulkTeamInputSchema = z.object({
  issues: selection(selectedIssue.extend({ statusId: z.string().length(26) })),
  teamId: z.string().length(26),
}).strict();
export const bulkDuplicateInputSchema = z.object({
  issues: selection(selectedIssue),
  canonicalIdentifier: issueIdentifier.nullable(),
}).strict();
export type BulkTeamInput = z.infer<typeof bulkTeamInputSchema>;
export type BulkDuplicateInput = z.infer<typeof bulkDuplicateInputSchema>;
