import { z } from "zod";
export const settingsSchema = z.object({
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    timezone: z.string(),
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
