import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '../core/app/public/sign-in-page'
import { loadSignIn } from '../core/app/public/sign-in-loader'
export const Route = createFileRoute('/signin')({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({
    returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
  }),
  loader: () => loadSignIn(),
  component: editorLeaf(SignIn),
})
function SignIn() {
  return <SignInPage localOutbox={Route.useLoaderData().localOutbox} providerLinks={Route.useLoaderData().providerLinks} />
}
