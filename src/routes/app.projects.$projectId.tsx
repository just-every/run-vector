import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from '@tanstack/react-router'
import { ProjectDetail } from '../core/features/projects/ui/project-detail'
export const Route = createFileRoute('/app/projects/$projectId')({
  component: editorLeaf(Page),
})

function Page() {
  return <ProjectDetail projectId={Route.useParams().projectId} />
}
