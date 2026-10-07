import { createFileRoute } from '@tanstack/react-router'
import { StreamWorkspace } from '../core/features/streams/ui/stream-workspace'
export const Route = createFileRoute('/app/my-work/')({
  component: () => <StreamWorkspace surface="my-work" />,
})
