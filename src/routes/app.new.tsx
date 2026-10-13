import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/new')({
  beforeLoad: () => {
    throw redirect({ to: '/app/new-issue', replace: true })
  },
})
