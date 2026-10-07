import { createFileRoute } from '@tanstack/react-router'
import { ProjectDetail } from '../core/features/projects/ui/project-detail'
export const Route = createFileRoute('/app/projects/$projectId')({
  component: Page,
})

function Page() {
  return <ProjectDetail projectId={Route.useParams().projectId} />
}
