import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '../core/app/public/sign-in-page'
import { normalizeEmail } from '../../vendor/base/operator-auth/policy.mjs'
import { loadSignIn } from '../core/app/public/sign-in-loader'
export const Route = createFileRoute('/signin')({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string; login_hint?: string } => {
    let login_hint: string | undefined
    try { login_hint = normalizeEmail(search.login_hint) } catch {}
    return { returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined, login_hint }
  },
  loaderDeps: ({ search }) => ({ returnTo: search.returnTo }),
  loader: ({ deps }) => loadSignIn({ data: deps }),
  component: editorLeaf(SignIn),
})
function SignIn() {
  return <SignInPage loginHint={Route.useSearch().login_hint} providerLinks={Route.useLoaderData().providerLinks} />
}
