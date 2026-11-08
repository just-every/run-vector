import { z } from 'zod';
export const leadershipPreferencesSchema = z.object({email: z.boolean(), slack: z.boolean()}).strict();
