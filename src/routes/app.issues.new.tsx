import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/issues/new')({
  beforeLoad: () => {
    throw redirect({ to: '/app/new-issue', replace: true })
  },
})
