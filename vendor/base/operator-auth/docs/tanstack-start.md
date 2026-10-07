# TanStack Start integration in Vector

Vector uses the checked-in operator-auth and mail modules with TanStack Start
1.168.50. This guide describes the integration in this source tree. Keep auth,
D1, mail construction and Worker bindings in server-owned modules. A route's
parent session check protects its document; every server function that reads or
changes private data must check the session on each invocation before its first
private operation.

## Configure the installation

Use Node 26.8.1 and pnpm 8.15.6. From the repository root, run
`pnpm install --frozen-lockfile`. `pnpm dev` applies local migrations and serves
the explicit synthetic local environment on http://127.0.0.1:15928.

A production installation requires D1 as `DB`, R2 as `FILES`, and these bindings:

- `APP_ORIGIN`: the fixed canonical HTTPS origin, never derived from incoming
  Host or forwarded headers.
- `FIRST_OWNER_EMAIL`, `FIRST_OWNER_NAME`, `WORKSPACE_NAME`,
  `WORKSPACE_TIMEZONE`, `DEFAULT_TEAM_NAME`, and `DEFAULT_TEAM_PREFIX`: explicit
  installation inputs. Use an IANA timezone and a 2–10-letter uppercase prefix.
- `SESSION_SECRET`: a random secret of at least 32 characters.
- `MAIL_PROVIDER=sendgrid`, `MAIL_MODE=sendgrid`, `MAIL_FROM` (a verified sender),
  and secret `MAIL_API_KEY`.
- `SEED_SAMPLE_DATA=false`.

[base.server.ts](../../../../src/core/features/auth/base.server.ts) constructs
`createOperatorAuth` and `createMailSender` from `vendor/base/operator-auth` and
`vendor/base/mail`. It maps `FIRST_OWNER_EMAIL` to Base's `OWNER_EMAIL`, selects
SendGrid for production, and supplies Vector's equal-operator policy. Every
Vector operator has Base owner authority internally; product actions still
enforce their own session and transaction policy. Cloudflare's
`CF-Connecting-IP` is the production client-address source.

Keep configuration and secrets in server bindings, never `VITE_*`, route data or
client RPC arguments. Missing mail configuration fails; there is no automatic
provider substitution. A provider accepting a message does not prove delivery
to the recipient's inbox.

Apply all migrations in `migrations/core` in order, preserving existing SQL and
installation data. Migration 0011 installs Base auth and maps existing product
operators. Vector's atomic workspace bootstrap creates the explicitly configured
first owner, team and seven workflow categories before health/auth/API handling.
It does not provision an owner from a sign-in email. This integration does not
mount Base's `/auth/bootstrap` endpoint or require `SETUP_TOKEN`.

For deployment, `pnpm deploy:prepare` builds the inert artifact in a separate
credential-free environment. The trusted controller runs `pnpm run setup` or
`pnpm run deploy` with the prepared artifact and reviewed installation inputs.
The exact controller environment and plan format are in
[DEPLOY.md](../../../../DEPLOY.md); the committed Wrangler configuration is local.

## Keep the Worker and HTTP boundaries

[vite.config.ts](../../../../vite.config.ts) combines the Cloudflare Vite plugin
with `tanstackStart`, React and Tailwind. The Cloudflare SSR environment uses
[worker.ts](../../../../src/core/app/worker.ts) as the entry through
`wrangler.jsonc`. Preserve its explicit dispatch:

- Static assets go to the `ASSETS` binding.
- `/health`, `/api`, `/api/*` and `/auth/*` go to Hono.
- `/app` and its child documents require an operator before Start renders them.
- Generated `/_serverFn/*` requests retain their Origin and Fetch-Metadata
  checks before dispatch to Start. Private documents and functions use
  `Cache-Control: no-store`.

Keep the `scheduled` export when changing the fetch handler: it runs file-removal
cleanup and deferred-intake return. Keep Start's default server-function CSRF
middleware when customizing Start configuration.

[routes.ts](../../../../src/core/features/auth/routes.ts) mounts the selected
auth endpoints. `/auth/request` delegates to `/auth/magic-link`; GET/HEAD
confirmation displays a form, and POST consumes the link. Preserve redirect and
cookie headers from Base's response, plus Vector's JSON signout response.
Raw Base bootstrap, invitation, role and status endpoints are not mounted.
Settings implements invitations and removal through protected product APIs.

## Protect documents and server functions

Keep a client-importable `createServerFn` wrapper in a normal `.ts` file and
dynamically import its server implementation inside the handler. The current
[loaders.ts](../../../../src/core/app/loaders.ts) follows this pattern:

```ts
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const loadOperator = createServerFn({ method: 'GET' }).handler(async () => {
  const { currentOperator } = await import('./request.server')
  const operator = await currentOperator()
  if (!operator) throw redirect({ to: '/signin' })
  return { id: operator.id, name: operator.name }
})
```

[request.server.ts](../../../../src/core/app/request.server.ts) reads `env` from
`cloudflare:workers`, obtains the actual request with Start's `getRequest()`, and
calls Vector's `requireOperator(env, request)`. This validates the Base session
and resolves the active product operator. Preserve the original request rather
than constructing one from a caller-supplied origin or cookie argument.

[app.tsx](../../../../src/routes/app.tsx) invokes `loadOperator()` in
`beforeLoad`. A new private function must perform its own authorization even
when its caller is below that route. A generated RPC ID grants no access. Return
only the needed product fields, never session cookies, binding objects, mail
configuration or secrets.

Current product mutations use Hono APIs in
[api.ts](../../../../src/core/app/api.ts). Their shared guard requires a native
operator session, exact Origin for mutations and rate-limit admission. It wraps
D1 with `mutationDatabase`, carrying the session ID and operator version into
the transaction's authority check. Preserve that guard and input validation when
adding an API. Any new mutating server function needs equivalent session,
same-origin, input and transaction checks before private writes; a parent route
check alone is insufficient.

## Local review and verification

The committed development configuration explicitly selects synthetic data and
`MAIL_MODE=local-outbox`, without `SESSION_SECRET`. It uses Vector's retained
local credential dialect. To exercise Base authentication locally, supply the
installation and auth bindings above with a literal loopback `APP_ORIGIN` and
`MAIL_MODE=local-outbox`. Supplying `SESSION_SECRET` selects Base; confirmation
then requires POST and the cookie is `operator_session_local`. Bind the listener
to loopback. The D1 outbox is local sensitive data, with no public outbox route.

From the repository root, `pnpm verify` runs the local source, test, build and
emitted-runtime checks. After building, `pnpm test:base-auth` exercises Base
sign-in and invitations, and `pnpm test:foundation` exercises an empty
installation. With `pnpm dev` running, `pnpm test:dev` checks development
hydration and navigation. These local checks do not establish hosted email or
Cron delivery. See [OPERATIONS.md](../../../../OPERATIONS.md) for the review
commands and [authentication details](../../../../docs/AUTHENTICATION.md) for
cookie, identity-mapping and recovery behavior.
