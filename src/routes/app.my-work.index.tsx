import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from '@tanstack/react-router'
import { StreamWorkspace } from '../core/features/streams/ui/stream-workspace'
export const Route = createFileRoute('/app/my-work/')({
  component: editorLeaf(MyWorkStream),
})

function MyWorkStream() {
  return <StreamWorkspace surface="my-work" />
}
