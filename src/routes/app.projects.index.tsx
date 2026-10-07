import { createFileRoute } from '@tanstack/react-router'
import { ProjectsWorkspace } from '../core/features/projects/ui/projects-workspace'
export const Route = createFileRoute('/app/projects/')({
  component: ProjectsWorkspace,
})
