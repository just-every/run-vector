import { z } from 'zod';
const time = z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/);
export const slaInput = z.object({
  enabled: z.boolean(),
  priority: z.enum(['none','low','medium','high','urgent']).nullable(),
  labelId: z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/).nullable(),
  targetMinutes: z.number().int().min(2).max(525600),
  warnBeforeMinutes: z.number().int().min(1).max(525599),
  workingDays: z.array(z.number().int().min(1).max(7)).min(1).max(7).refine(v => new Set(v).size === v.length),
  startsAt: time, endsAt: time,
}).strict().refine(v => v.priority !== null || v.labelId !== null, 'Choose a priority or label.')
  .refine(v => v.warnBeforeMinutes < v.targetMinutes, 'The warning must precede the target.')
  .refine(v => v.startsAt < v.endsAt, 'Business hours must end after they start.');
export type SlaInput = z.infer<typeof slaInput>;
export const slaSettings = z.object({ rule: slaInput.nullable(), timezone: z.string() });
export const slaProjection = z.object({
  state: z.enum(['running','resolved','stopped','breached']),
  remainingMinutes: z.number(), targetMinutes: z.number(),
  warnedAt: z.string().nullable(), breachedAt: z.string().nullable(),
  stoppedAt: z.string().nullable(), timezone: z.string(),
});
