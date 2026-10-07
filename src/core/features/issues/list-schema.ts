import { z } from "zod";

export const issueListQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  category: z
    .enum([
      "all",
      "intake",
      "backlog",
      "unstarted",
      "started",
      "completed",
      "canceled",
      "duplicate",
    ])
    .default("all"),
  assignee: z
    .union([
      z.enum(["all", "unassigned"]),
      z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
    ])
    .default("all"),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export type IssueListQuery = z.output<typeof issueListQuerySchema>;
export const issueListRowSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  status: z.object({ id: z.string(), name: z.string(), category: z.string() }),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]),
  assignee: z.object({ id: z.string(), name: z.string() }).nullable(),
  team: z.object({ id: z.string(), name: z.string() }),
  updatedAt: z.string(),
});
export const issueListSchema = z.object({
  issues: z.array(issueListRowSchema),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  assignees: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type IssueListData = z.output<typeof issueListSchema>;
