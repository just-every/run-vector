import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '../core/app/public/sign-in-page'
export const Route = createFileRoute('/signin')({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({
    returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
  }),
  component: SignInPage,
})
