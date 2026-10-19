import { z } from "zod";
import { timezoneSchema } from "../../shared/timezone.ts";

export const reminderTimeSchema = z
  .string()
  .regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/);
export const personalTimeInputSchema = z
  .object({
    timezone: timezoneSchema.nullable(),
    workingHoursStart: reminderTimeSchema,
    workingHoursEnd: reminderTimeSchema,
    // ISO weekdays: Monday=1, Sunday=7. Canonical order also stabilizes claim fences.
    workingDays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .refine(
        (days) => new Set(days).size === days.length,
        "Choose each weekday once.",
      )
      .transform((days) => [...days].sort((a, b) => a - b)),
  })
  .strict()
  .refine((value) => value.workingHoursStart < value.workingHoursEnd, {
    message: "Working hours must end after they start.",
    path: ["workingHoursEnd"],
  });
export const personalTimeSchema = z.object({
  timezone: z.string().nullable(),
  effectiveTimezone: z.string(),
  workingHoursStart: reminderTimeSchema,
  workingHoursEnd: reminderTimeSchema,
  workingDays: z.array(z.number().int().min(1).max(7)),
});
export type PersonalTimeInput = z.infer<typeof personalTimeInputSchema>;
export type PersonalTime = z.infer<typeof personalTimeSchema>;
