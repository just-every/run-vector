import { z } from 'zod';
export const leadershipChoiceSchema = z.object({email: z.boolean(), slack: z.boolean()}).strict();
export const leadershipPreferencesSchema = leadershipChoiceSchema.extend({deliveries:z.array(z.object({
  id:z.string(),channel:z.enum(['email','slack']),status:z.enum(['failed','uncertain']),attempts:z.number().int().nonnegative(),updatedAt:z.string(),
}))});
