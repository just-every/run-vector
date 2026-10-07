import { createFileRoute } from '@tanstack/react-router'
import { StreamWorkspace } from '../core/features/streams/ui/stream-workspace'
export const Route = createFileRoute('/app/current/$identifier')({
  component: Page,
})
function Page() {
  return (
    <StreamWorkspace
      surface="current"
      selectedIdentifier={Route.useParams().identifier}
    />
  )
}
