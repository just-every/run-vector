import { z } from "zod";

const id = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const target = z.union([z.literal("all"), id]).default("all");
const nullableTarget = z.union([z.enum(["all", "none"]), id]).default("all");
const date = z.union([z.literal(""), z.iso.date()]).default("");
export const issueListQuerySchema = z
  .object({
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
    status: target,
    priority: z
      .enum(["all", "urgent", "high", "medium", "low", "none"])
      .default("all"),
    assignee: z.union([z.enum(["all", "unassigned"]), id]).default("all"),
    team: target,
    project: nullableTarget,
    cycle: nullableTarget,
    label: nullableTarget,
    due: z.enum(["all", "overdue", "range", "none"]).default("all"),
    dueFrom: date,
    dueTo: date,
    blocked: z.enum(["all", "blocked", "unblocked"]).default("all"),
    parent: z
      .union([
        z.enum(["all", "none"]),
        z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/),
      ])
      .default("all"),
    sort: z
      .enum(["newest", "oldest", "priority", "status", "due", "updated"])
      .default("newest"),
    grouping: z
      .enum([
        "none",
        "status",
        "assignee",
        "priority",
        "project",
        "cycle",
        "team",
      ])
      .default("none"),
    revision: z.string().max(200).default(""),
    offset: z.coerce.number().int().min(0).max(250000).default(0),
    pageSize: z.coerce
      .number()
      .pipe(z.union([z.literal(50), z.literal(100)]))
      .default(50),
  })
  .refine((q) => !q.dueFrom || !q.dueTo || q.dueFrom <= q.dueTo, {
    message: "The due date range must be in order.",
    path: ["dueTo"],
  });
export type IssueListQuery = z.output<typeof issueListQuerySchema>;
const named = z.object({ id: z.string(), name: z.string() });
const groupCount = z.object({
  key: z.string(),
  name: z.string(),
  count: z.number().int().positive(),
});
export const issueListRowSchema = z.object({
  version: z.number(),
  cycleId: z.string().nullable(),
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  status: z.object({ id: z.string(), name: z.string(), category: z.string() }),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]),
  assignee: named.nullable(),
  team: named,
  project: named.nullable(),
  cycle: named.nullable(),
  parent: z.object({ identifier: z.string(), title: z.string() }).nullable(),
  labels: z.array(named.extend({ color: z.string() })),
  blocked: z.boolean(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  groupKey: z.string(),
});
export const issueListSchema = z
  .object({
    revision: z.string().min(1),
    issues: z.array(issueListRowSchema),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    assignees: z.array(named),
    groups: z.array(groupCount),
    // REST groups describes the current page; allGroups retains global metadata.
    allGroups: z.array(groupCount).optional(),
    // Board-sized pages additionally carry counts for every matching status,
    // independently of list grouping. Zero-count workflow columns are omitted.
    statusCounts: z
      .array(
        z.object({
          key: z.string(),
          count: z.number().int().positive(),
        }),
      )
      .optional(),
  })
  .refine(
    (data) =>
      data.pageSize !== 100 ||
      data.statusCounts?.reduce((total, status) => total + status.count, 0) ===
        data.total,
    { message: "Board-sized pages must include complete status totals." },
  );
export type IssueListData = z.output<typeof issueListSchema>;
