import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  // The native Lobby owns this document, including client-side navigation home.
  beforeLoad: () => { throw redirect({ href: '/', reloadDocument: true }) },
})
