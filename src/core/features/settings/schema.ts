import { z } from "zod";
import { reminderTimeSchema, personalTimeSchema } from "./personal-time-schema";
export { reminderTimeSchema, personalTimeSchema } from "./personal-time-schema";
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
  personalTime: personalTimeSchema,
  invitationDelivery: z.enum(["local", "email"]),
});
