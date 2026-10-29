import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/documents/')({
  beforeLoad: () => {
    throw redirect({ to: '/app/search', replace: true })
  },
})
