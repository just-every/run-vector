import { z } from 'zod'

export const workspaceOptionsSchema = z.object({
  workspace: z.object({ id: z.string(), name: z.string() }),
  operator: z.object({ id: z.string() }),
  teams: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      identifierPrefix: z.string(),
    }),
  ),
  operators: z.array(z.object({ id: z.string(), name: z.string() })),
  labels: z.array(
    z.object({ id: z.string(), name: z.string(), color: z.string() }),
  ),
  projects: z.array(
    z.object({ id: z.string(), name: z.string(), lifecycle: z.string() }),
  ),
  statuses: z.array(
    z.object({
      id: z.string(),
      teamId: z.string(),
      name: z.string(),
      category: z.string(),
      position: z.number(),
    }),
  ),
  cycles: z.array(
    z.object({
      id: z.string(),
      teamId: z.string(),
      name: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
    }),
  ),
  savedViews: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      isShared: z.boolean(),
      surface: z.string(),
    }),
  ),
})

export type WorkspaceOptions = z.output<typeof workspaceOptionsSchema>
