import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/app/current/')({
  beforeLoad: () => {
    throw redirect({ to: '/app' })
  },
})
