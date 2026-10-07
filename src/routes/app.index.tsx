import { createFileRoute } from '@tanstack/react-router'
import { StreamWorkspace } from '../core/features/streams/ui/stream-workspace'
export const Route = createFileRoute('/app/')({
  component: () => <StreamWorkspace surface="current" />,
})
