import { z } from 'zod';

export const commentDraftSchema = z.object({
  id: z.string(), revision: z.number().int().positive(), body: z.string(),
  identifier: z.string(), parentId: z.string().nullable(), team: z.string(), updatedAt: z.string(),
});
export const commentDraftsSchema = z.object({ drafts: z.array(commentDraftSchema) });
export const commentDraftReceiptSchema = z.object({ draft: commentDraftSchema.nullable() });
export const draftIdSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export const commentDraftWriteSchema = z.object({ body: z.string().max(100_000), revision: z.number().int().positive() }).strict();
export const commentDraftCreateSchema = z.object({ id: draftIdSchema, body: z.string().max(100_000), parentId: draftIdSchema.optional() }).strict();
export type CommentDraft = z.output<typeof commentDraftSchema>;
