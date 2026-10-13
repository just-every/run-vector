import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from '@tanstack/react-router'
import { StreamWorkspace } from '../core/features/streams/ui/stream-workspace'
export const Route = createFileRoute('/app/')({
  component: editorLeaf(CurrentStream),
})

function CurrentStream() {
  return <StreamWorkspace surface="current" />
}
