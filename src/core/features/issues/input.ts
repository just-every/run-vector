import seed from '../../../../seed.json'
import { z } from 'zod'

const id = z.string().length(26)
const nullableId = id.nullable()
const optionalText = z.string().trim().max(20_000).nullable().transform((value) => value || null).optional()

export const createIssueInputSchema = z.object({
  title: z.string().trim().min(1).max(500),
  teamId: id,
  description: z.string().max(100_000).optional().default(''),
  statusId: id.optional(),
  assigneeOperatorId: nullableId.optional().default(null),
  projectId: nullableId.optional().default(null),
  milestoneId: nullableId.optional().default(null),
  cycleId: nullableId.optional().default(null),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional().default('none'),
  labelIds: z.array(id).max(seed.limits.labelsPerIssue).default([]).refine((values) => new Set(values).size === values.length, 'Label IDs must be unique.'),
  estimate: z.number().int().min(1).max(100).nullable().optional().default(null),
  startDate: z.string().date().nullable().optional().default(null),
  dueDate: z.string().date().nullable().optional().default(null),
  expectedOutcome: optionalText.default(null),
  customerImpact: optionalText.default(null),
  customFields: z.record(z.string(), z.unknown()).default({}),
}).strict().refine((value) => !value.startDate || !value.dueDate || value.startDate <= value.dueDate, {
  message: 'Start date must be on or before due date.', path: ['startDate'],
})

const decisionBase = z.object({
  expectedVersion: z.number().int().positive(),
})

export const acceptIssueInputSchema = decisionBase.extend({
  reason: optionalText.default(null),
  assigneeOperatorId: nullableId.optional().default(null),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional().default('none'),
  cycleId: nullableId.optional().default(null),
  statusId: id.optional(),
}).strict()

export const deferIssueInputSchema = decisionBase.extend({
  reason: optionalText.default(null),
  returnAt: z.string().datetime({ offset: true }),
}).strict()

export const declineIssueInputSchema = decisionBase.extend({
  reason: z.string().trim().min(1).max(20_000),
}).strict()

export type CreateIssueInput = z.infer<typeof createIssueInputSchema>
export type AcceptIssueInput = z.infer<typeof acceptIssueInputSchema>
export type DeferIssueInput = z.infer<typeof deferIssueInputSchema>
export type DeclineIssueInput = z.infer<typeof declineIssueInputSchema>
