import { z } from "zod";

const personSchema = z.object({ id: z.string(), name: z.string() });
const evidenceSchema = z.object({
  id: z.string(),
  sourceName: z.string(),
  originKind: z.enum(["source", "operator"]),
  actor: z.string().nullable(),
  link: z.string().nullable(),
  customerReports: z.array(
    z.object({
      customer: z.string().optional(),
      summary: z.string(),
      link: z.string().nullable(),
    }),
  ),
  observedAt: z.string(),
  receivedAt: z.string(),
  summary: z.string(),
  measurements: z.record(z.string(), z.unknown()),
  assertions: z.record(z.string(), z.unknown()),
});

export const issueDetailSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.object({ id: z.string(), name: z.string(), category: z.string() }),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]),
  dueDate: z.string().nullable(),
  estimate: z.number().nullable(),
  version: z.number(),
  expectedOutcome: z.string().nullable(),
  customerImpact: z.string().nullable(),
  customFields: z.unknown(),
  team: z.object({
    id: z.string(),
    name: z.string(),
    identifierPrefix: z.string(),
  }),
  assignee: personSchema.nullable(),
  project: z
    .object({ id: z.string(), name: z.string(), health: z.string() })
    .nullable(),
  cycle: z
    .object({
      id: z.string(),
      name: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
    })
    .nullable(),
  labels: z.array(
    z.object({ id: z.string(), name: z.string(), color: z.string() }),
  ),
  dependencies: z.array(
    z.object({
      direction: z.string(),
      identifier: z.string(),
      title: z.string(),
    }),
  ),
  evidence: z.array(evidenceSchema),
  decisions: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      reason: z.string().nullable(),
      returnAt: z.string().nullable(),
      at: z.string(),
      actor: z.string().nullable(),
    }),
  ),
  activity: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      at: z.string(),
      actor: z.string().nullable(),
      previousValue: z.unknown().nullable(),
      nextValue: z.unknown().nullable(),
    }),
  ),
  category: z.string().optional(),
  deferredUntil: z.string().nullable(),
  completedAt: z.string().nullable(),
  canceledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type IssueDetailData = z.output<typeof issueDetailSchema>;
