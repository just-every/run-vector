import { z } from 'zod'

const timestamps = z.object({ createdAt: z.string().datetime(), updatedAt: z.string().datetime() })
const id = z.string().length(26)

export const sampleDataSchema = z.object({
  workspace: z.object({ id, name: z.string().min(1), timezone: z.string().min(1) }).merge(timestamps),
  operators: z.array(z.object({ id, workspaceId: id, name: z.string().min(1), email: z.string().email(), removedAt: z.string().datetime().nullable() }).merge(timestamps)),
  sessions: z.array(z.object({ id, operatorId: id, tokenHash: z.string().min(1), expiresAt: z.string().datetime(), revokedAt: z.string().datetime().nullable() }).merge(timestamps)),
  teams: z.array(z.object({ id, workspaceId: id, name: z.string().min(1), identifierPrefix: z.string().regex(/^[A-Z]{2,10}$/), archivedAt: z.string().datetime().nullable() }).merge(timestamps)),
  workflowStatuses: z.array(z.object({ id, teamId: id, name: z.string().min(1), category: z.enum(['intake', 'backlog', 'unstarted', 'started', 'completed', 'canceled', 'duplicate']), position: z.number().int().nonnegative() }).merge(timestamps)),
  projects: z.array(z.object({ id, workspaceId: id, name: z.string().min(1), description: z.string(), leadOperatorId: id, targetDate: z.string().date().nullable(), lifecycle: z.enum(['planned', 'active', 'completed', 'canceled']), color: z.string().nullable(), icon: z.string().nullable(), archivedAt: z.string().datetime().nullable() }).merge(timestamps)),
  cycles: z.array(z.object({ id, teamId: id, name: z.string().min(1), startsAt: z.string().datetime(), endsAt: z.string().datetime(), capacity: z.number().int().nonnegative().nullable(), closedAt: z.string().datetime().nullable() }).merge(timestamps)),
  labels: z.array(z.object({ id, workspaceId: id, name: z.string().min(1), color: z.string().min(1) }).merge(timestamps)),
  issues: z.array(z.object({ id, identifier: z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/), originPrefix: z.string().regex(/^[A-Z]{2,10}$/), sequenceNumber: z.number().int().positive(), teamId: id, title: z.string().min(1), description: z.string(), statusId: id, priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']), assigneeOperatorId: id.nullable(), projectId: id.nullable(), cycleId: id.nullable(), startDate: z.string().date().nullable().default(null), dueDate: z.string().date().nullable(), estimate: z.number().int().min(1).max(100).nullable(), expectedOutcome: z.string().nullable(), customerImpact: z.string().nullable(), customFieldsJson: z.string(), deferredUntil: z.string().datetime().nullable(), version: z.number().int().positive(), completedAt: z.string().datetime().nullable(), canceledAt: z.string().datetime().nullable() }).merge(timestamps)),
  issueLabels: z.array(z.object({ issueId: id, labelId: id, createdAt: z.string().datetime() })),
  dependencies: z.array(z.object({ blockedIssueId: id, blockingIssueId: id, createdAt: z.string().datetime() })),
  evidence: z.array(z.object({ id, issueId: id, sourceName: z.string().min(1), observedAt: z.string().datetime(), receivedAt: z.string().datetime(), summary: z.string(), measurementsJson: z.string(), assertionsJson: z.string() }).merge(timestamps)),
  decisions: z.array(z.object({ id, issueId: id, actorOperatorId: id, kind: z.enum(['accepted', 'deferred', 'declined']), reason: z.string().nullable(), returnAt: z.string().datetime().nullable() }).merge(timestamps)),
  activity: z.array(z.object({ id, issueId: id, actorOperatorId: id.nullable(), kind: z.string().min(1), previousValueJson: z.string().nullable(), nextValueJson: z.string().nullable() }).merge(timestamps)),
  savedViews: z.array(z.object({ id, workspaceId: id, ownerOperatorId: id, name: z.string().min(1), surface: z.string().min(1), isShared: z.boolean(), filtersJson: z.string(), sort: z.string(), grouping: z.string() }).merge(timestamps)),
  listPreferences: z.array(z.object({ id, operatorId: id, surface: z.string().min(1), filtersJson: z.string(), sort: z.string(), grouping: z.string() }).merge(timestamps)),
})

export type SampleData = z.infer<typeof sampleDataSchema>
