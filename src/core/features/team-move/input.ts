import { z } from "zod";
export const moveIssueTeamInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    teamId: z.string().length(26),
    statusId: z.string().length(26),
  })
  .strict();
export type MoveIssueTeamInput = z.infer<typeof moveIssueTeamInputSchema>;
