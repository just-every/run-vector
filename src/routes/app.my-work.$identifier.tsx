import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from '@tanstack/react-router'
import { StreamWorkspace } from '../core/features/streams/ui/stream-workspace'
export const Route = createFileRoute('/app/my-work/$identifier')({
  component: editorLeaf(Page),
})

function Page() {
  const { identifier } = Route.useParams()
  return <StreamWorkspace surface="my-work" selectedIdentifier={identifier} />
}
