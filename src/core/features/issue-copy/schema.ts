import { z } from "zod";

export const copyIssueSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    issueTypeId: z.string().length(26).nullable().optional(),
    customFields: z.record(z.string(),z.json()).optional(),
    teamId: z.string().length(26).optional(),
    includeSubissues: z.boolean().default(false),
    includeLinks: z.boolean().default(false),
  })
  .strict();
export type CopyIssueInput = z.infer<typeof copyIssueSchema>;
export type DroppedCopyValue = {
  identifier: string;
  field: string;
  value: unknown;
  reason: string;
};
export class CopyConflict extends Error {
  constructor() {
    super(
      "The source issue or its selected contents changed. Reload before copying.",
    );
  }
}
