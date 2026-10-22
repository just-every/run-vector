import { z } from "zod";
import { reminderTimeSchema, personalTimeSchema } from "./personal-time-schema.ts";
import { roles } from "../roles/matrix";
export { reminderTimeSchema, personalTimeSchema } from "./personal-time-schema.ts";
export const settingsSchema = z.object({
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    timezone: z.string(),
    reminderTime: reminderTimeSchema,
    setupOperatorId: z.string().nullable(),
    memberInvites: z.boolean(),
  }),
  operators: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.enum(roles),
      createdAt: z.string(),
    }),
  ),
  operatorId: z.string(),
  role: z.enum(roles),
  personalTime: personalTimeSchema,
  invitationDelivery: z.enum(["local", "email"]),
});
