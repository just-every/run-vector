import {z} from 'zod';

/** A team's production follow-up window in hours; null turns it off. */
export const followupWindowSchema=z.object({windowHours:z.number().int().min(1).max(720).nullable(),version:z.number(),enabledAt:z.string().nullable()});
export type FollowupWindow=z.infer<typeof followupWindowSchema>;
export const followupInput=z.object({deploymentFollowup:z.object({windowHours:z.number().int().min(1).max(720).nullable(),expectedVersion:z.number().int().min(0)}).strict()}).strict();
/** One recorded merge of a linked PR and how far it got: production, or the one question. */
export const productionFollowupSchema=z.object({
 repository:z.string(),pullNumber:z.number(),sha:z.string(),mergedAt:z.string(),
 productionAt:z.string().nullable(),askedAt:z.string().nullable(),recipient:z.string().nullable(),answeredAt:z.string().nullable(),
});
export type ProductionFollowup=z.infer<typeof productionFollowupSchema>;
