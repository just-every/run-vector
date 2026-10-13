import { z } from "zod";
export const reminderTimeSchema = z
  .string()
  .regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/);
export const settingsSchema = z.object({
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    timezone: z.string(),
    reminderTime: reminderTimeSchema,
    setupOperatorId: z.string().nullable(),
  }),
  operators: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      createdAt: z.string(),
    }),
  ),
  operatorId: z.string(),
});
