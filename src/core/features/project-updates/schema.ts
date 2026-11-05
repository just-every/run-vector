import { z } from "zod";

export const updateId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export const updateStatus = z.enum(["on-track", "at-risk", "off-track"]);
export const projectUpdateInput = z.object({
  id: updateId,
  status: updateStatus,
  body: z.string().min(1).max(50000).refine(value => value.trim().length > 0),
}).strict();
export const projectUpdateSchema = projectUpdateInput.extend({
  projectId: z.string(), authorId: z.string().nullable(), authorName: z.string(), createdAt: z.string(),
});
export type ProjectUpdate = z.output<typeof projectUpdateSchema>;
export const updateStatusLabels = { "on-track": "On track", "at-risk": "At risk", "off-track": "Off track" } as const;
