import { z } from "zod";
import { namedLinksSchema } from "../links/schema";

export const discussionSchema = z.object({
  links: namedLinksSchema.shape.links,
  comments: z.array(
    z.object({
      id: z.string(),
      body: z.string().nullable(),
      actor: z.string(),
      imported: z.union([z.boolean(), z.number()]).transform(Boolean).optional(),
      editedAt: z.string().nullable(),
      deletedAt: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  files: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      contentType: z.string(),
      bytes: z.number(),
      state: z.enum(["pending", "ready", "failed"]),
      removalPending: z.string().nullable(),
      cleanupError: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
