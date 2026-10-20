import { historicalCycleSchema } from "../../cycle-closure/schema";
import { z } from "zod";

const healthSchema = z.enum([
  "blocked",
  "at-risk",
  "on-track",
  "unknown",
  "none",
]);
const personSchema = z.object({ id: z.string(), name: z.string() });
const statusSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  category: z.string(),
});

export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  lifecycle: z.string(),
  archived: z.boolean(),
  startDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  priority: z.string(),
  labels: z.array(z.object({id:z.string(),name:z.string(),color:z.string()})),
  teamIds: z.array(z.string()),
  lead: personSchema,
  health: healthSchema,
  healthExplanation: z.string().nullable(),
  progress: z.object({
    completed: z.number(),
    total: z.number(),
    percentage: z.number().nullable(),
  }),
  risks: z.array(
    z.object({
      kind: z.string(),
      issueIdentifiers: z.array(z.string()).optional(),
      message: z.string(),
      dependencyLinks: z
        .array(
          z.object({
            blockedIdentifier: z.string(),
            blockingIdentifier: z.string(),
          }),
        )
        .optional(),
      capacity: z
        .object({
          cycleId: z.string(),
          estimatedPoints: z.number(),
          capacityPoints: z.number(),
          unestimatedIssueCount: z.number(),
        })
        .optional(),
    }),
  ),
});

export const projectPortfolioSchema = z.object({
  generatedAt: z.string(),
  counts: z.record(z.string(), z.number()),
  projects: z.array(projectSummarySchema),
});

export const projectDetailSchema = projectSummarySchema.extend({
  cycleHistory: z.array(historicalCycleSchema),
  activity: z.array(z.object({id:z.string(),kind:z.string(),previousValue:z.json(),nextValue:z.json(),createdAt:z.string(),actorName:z.string().nullable()})),
  teams: z.array(personSchema),
  cycles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      team: personSchema,
      startsAt: z.string(),
      endsAt: z.string(),
      capacity: z.number().nullable(),
      issueCount: z.number(),
      remainingEstimatedPoints: z.number(),
      unestimatedIssueCount: z.number(),
    }),
  ),
  dependencies: z.array(
    z.object({
      blockedIssue: z.object({
        identifier: z.string(),
        title: z.string(),
        status: statusSchema,
      }),
      blockingIssue: z.object({
        identifier: z.string(),
        title: z.string(),
        status: statusSchema,
      }),
      unresolved: z.boolean(),
    }),
  ),
  issues: z.array(
    z.object({
      id: z.string(),
      identifier: z.string(),
      title: z.string(),
      status: z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
      }),
      priority: z.string(),
      assignee: personSchema.nullable(),
      team: personSchema,
      cycle: z
        .object({
          id: z.string(),
          name: z.string(),
          startsAt: z.string(),
          endsAt: z.string(),
          capacity: z.number().nullable(),
        })
        .nullable(),
      estimate: z.number().nullable(),
      dueDate: z.string().nullable(),
      blockedBy: z.array(
        z.object({
          identifier: z.string(),
          title: z.string(),
          status: statusSchema,
          unresolved: z.boolean(),
        }),
      ),
    }),
  ),
});

export type ProjectSummaryData = z.output<typeof projectSummarySchema>;
export type ProjectPortfolioData = z.output<typeof projectPortfolioSchema>;
export type ProjectDetailData = z.output<typeof projectDetailSchema>;
export type ProjectHealthData = z.output<typeof healthSchema>;
