import { z } from "zod";

export const myActivitySchema = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      at: z.string(),
      issue: z.object({ identifier: z.string(), title: z.string() }),
      previousValue: z.unknown(),
      nextValue: z.unknown(),
      comment: z.string().nullable(),
    }),
  ),
});
