import { z } from 'zod'

export const workspaceSearchSchema = z.object({
  issues: z.array(
    z.object({ id: z.string(), identifier: z.string(), title: z.string() }),
  ),
  projects: z.array(z.object({ id: z.string(), name: z.string() })),
  savedViews: z.array(
    z.object({ id: z.string(), name: z.string(), isShared: z.boolean() }),
  ),
})

export type PaletteEntry = {
  id: string
  group: 'Issues' | 'Projects' | 'Saved views' | 'Commands'
  title: string
  detail: string
  destination:
    | '/app'
    | '/app/my-work'
    | '/app/projects'
    | '/app/new-issue'
    | '/app/search'
    | '/app/board'
    | '/app/issues/$identifier'
    | '/app/projects/$projectId'
    | '/app/views/$viewId'
  params?: { identifier: string } | { projectId: string } | { viewId: string }
}

const commands: PaletteEntry[] = [
  {
    id: 'command:search',
    group: 'Commands',
    title: 'Open Search',
    detail: 'Issues, projects and saved views, including archived records',
    destination: '/app/search',
  },
  {
    id: 'command:board',
    group: 'Commands',
    title: 'Open Board',
    detail: 'Browse a team workflow',
    destination: '/app/board',
  },
  {
    id: 'command:new-issue',
    group: 'Commands',
    title: 'New issue',
    detail: 'Create a durable issue',
    destination: '/app/new-issue',
  },
  {
    id: 'command:current',
    group: 'Commands',
    title: 'Open Current',
    detail: 'Shared attention stream',
    destination: '/app',
  },
  {
    id: 'command:my-work',
    group: 'Commands',
    title: 'Open My work',
    detail: 'Your execution queue',
    destination: '/app/my-work',
  },
  {
    id: 'command:projects',
    group: 'Commands',
    title: 'Open Projects',
    detail: 'Portfolio health and risks',
    destination: '/app/projects',
  },
]

export function paletteEntries(
  search: z.output<typeof workspaceSearchSchema> | null,
  query: string,
): PaletteEntry[] {
  const term = query.trim().toLocaleLowerCase()
  const commandEntries = commands.filter(
    (command) =>
      !term ||
      `${command.title} ${command.detail}`.toLocaleLowerCase().includes(term),
  )
  if (!term || !search) return commandEntries
  return [
    ...search.issues.map((issue) => ({
      id: `issue:${issue.id}`,
      group: 'Issues' as const,
      title: `${issue.identifier} · ${issue.title}`,
      detail: 'Issue',
      destination: '/app/issues/$identifier' as const,
      params: { identifier: issue.identifier },
    })),
    ...search.projects.map((project) => ({
      id: `project:${project.id}`,
      group: 'Projects' as const,
      title: project.name,
      detail: 'Project',
      destination: '/app/projects/$projectId' as const,
      params: { projectId: project.id },
    })),
    ...commandEntries,
  ]
}
