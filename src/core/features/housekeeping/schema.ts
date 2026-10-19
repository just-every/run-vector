import { z } from "zod";

const days = z.number().int().min(1).max(3650).nullable();
export const housekeepingSchema = z
  .object({ closeAfterDays: days, archiveAfterDays: days, exemptBugs: z.boolean() })
  .strict();
export type Housekeeping = z.infer<typeof housekeepingSchema>;
export const housekeepingCandidateSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  version: z.number(),
  teamId: z.string(),
  statusId: z.string(),
  days: z.number(),
});
export type HousekeepingCandidate = z.infer<typeof housekeepingCandidateSchema>;
export const housekeepingPreviewSchema = z.object({
  close: z.array(housekeepingCandidateSchema),
  archive: z.array(housekeepingCandidateSchema),
});
