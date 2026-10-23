import { z } from "zod";
import { issueListQuerySchema } from "../issues/list-schema";

export const metrics = ["flow", "throughput", "cycle-time", "lead-time", "status-time", "bug-inflow", "bug-age"] as const;
export const metricNames: Record<typeof metrics[number], string> = {
  flow: "Created vs completed", throughput: "Throughput", "cycle-time": "Cycle time",
  "lead-time": "Lead time", "status-time": "Time in status", "bug-inflow": "Bug inflow", "bug-age": "Open bug age",
};
export const insightQuerySchema = z.object({
  metric: z.enum(metrics).default("flow"),
  group: z.enum(["none", "team", "project", "label", "assignee", "priority"]).default("none"),
  unit: z.enum(["count", "estimate"]).default("count"),
  from: z.union([z.literal(""), z.iso.date()]).default(""),
  to: z.union([z.literal(""), z.iso.date()]).default(""),
  includeCompleted: z.enum(["true", "false"]).default("true"),
  bucket: z.string().max(500).default(""),
}).refine(q => !q.from || !q.to || q.from <= q.to, { message: "Choose dates in order.", path: ["to"] });
export type InsightQuery = z.infer<typeof insightQuerySchema>;
export function parseInsightQuery(value: unknown) {
  return { filters: issueListQuerySchema.parse(value), chart: insightQuerySchema.parse(value) };
}
const issue = z.object({ identifier: z.string(), title: z.string(), estimate: z.number().nullable() });
export const insightRowSchema = z.object({
  key: z.string(), week: z.string(), group: z.string(), series: z.string(),
  count: z.number(), value: z.number(), median: z.number().nullable(),
  p75: z.number().nullable(), p90: z.number().nullable(),
});
export const insightReportSchema = z.object({
  timezone: z.string(), through: z.string(), total: z.number(), unestimated: z.number(),
  duration: z.boolean(), rows: z.array(insightRowSchema), limitations: z.array(z.string()),
  drill: z.object({ key: z.string(), issues: z.array(issue) }).nullable(),
});
export type InsightReport = z.infer<typeof insightReportSchema>;
export type InsightIssue = z.infer<typeof issue>;
export type InsightRow = z.infer<typeof insightRowSchema>;
export type Fact = InsightIssue & {
  createdAt: string; completedAt: string | null; category: string; statusId: string; statusName: string;
  teamId: string; teamName: string; projectId: string | null; projectName: string | null;
  assigneeId: string | null; assigneeName: string | null; priority: string;
  labels: { id: string; name: string }[];
  transitions: { id: string; at: string; previousId: string | null; nextId: string;
    previousName: string | null; nextName: string | null; nextCategory: string | null }[];
};
