import { z } from 'zod'
import {
  workspaceOptionsSchema,
  type WorkspaceOptions,
} from '../../../shared/workspace-options'

export const streamItemSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  version: z.number().int().positive(),
  estimate: z.number().nullable(),
  cycle: z.object({ id: z.string(), name: z.string() }).nullable(),
  milestoneId: z.string().nullable(),
  milestone: z.object({ id: z.string(), name: z.string(), projectId: z.string() }).nullable(),
  labels: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() })),
  status: z.object({ id: z.string(), name: z.string(), category: z.string() }),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']),
  startDate: z.string().nullable(), dueDate: z.string().nullable(),
  updatedAt: z.string(),
  assignee: z.object({ id: z.string(), name: z.string() }).nullable(),
  project: z
    .object({ id: z.string(), name: z.string(), health: z.string() })
    .nullable(),
  team: z.object({
    id: z.string(),
    name: z.string(),
    identifierPrefix: z.string(),
  }),
  primaryReason: z.string(),
  contextReasons: z.array(z.string()),
})

export const currentStreamSchema = z.object({
  generatedAt: z.string(),
  sections: z.object({
    'needs-decision': z.array(streamItemSchema),
    now: z.array(streamItemSchema),
    next: z.array(streamItemSchema),
    'recently-done': z.array(streamItemSchema),
  }),
})

export const cycleContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  completed: z.number().nonnegative(),
  total: z.number().nonnegative(),
  unit: z.enum(['points', 'issue-count']),
  percentage: z.number().min(0).max(100).nullable(),
  capacity: z.number().nonnegative().nullable(),
  capacityRisk: z.enum(['unknown', 'at-risk', 'within-capacity']),
  remainingPoints: z.number().nonnegative().nullable(),
  unestimatedRemaining: z.number().int().nonnegative(),
  timezone: z.string(),
})

export type CycleContextData = z.output<typeof cycleContextSchema>

export const myWorkSchema = z.object({
  generatedAt: z.string(),
  operator: z.object({ id: z.string(), name: z.string() }),
  sections: z.object({
    waiting: z.array(streamItemSchema),
    now: z.array(streamItemSchema),
    next: z.array(streamItemSchema),
  }),
  cycles: z.array(cycleContextSchema),
})

export const optionsSchema = workspaceOptionsSchema

export type StreamItem = z.output<typeof streamItemSchema>
export type StreamOptions = WorkspaceOptions
