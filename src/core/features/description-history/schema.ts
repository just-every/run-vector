import { z } from "zod";

const item = {
  index: z.number().int().nonnegative(),
  text: z.string().max(100000),
  checked: z.boolean(),
};
export const checklistSchema = z.object({ expectedVersion: z.number().int().positive(), ...item }).strict();
export const commentChecklistSchema = z.object({ expectedBody: z.string().max(100000), ...item }).strict();
export const descriptionRestoreSchema = z.object({
  expectedVersion: z.number().int().positive(),
  revisionId: z.string().min(1).max(200),
}).strict();
export const descriptionHistorySchema = z.object({
  revisions: z.array(z.object({
    id: z.string(),
    description: z.string(),
    actor: z.string().nullable(),
    createdAt: z.string(),
    version: z.number().int().positive().nullable(),
  })),
});
export type ChecklistInput = z.infer<typeof checklistSchema>;
export type CommentChecklistInput = z.infer<typeof commentChecklistSchema>;
export type DescriptionRestoreInput = z.infer<typeof descriptionRestoreSchema>;
