# Vector

Vector is a deployable, self-hosted issue tracker for one business. Evidence-led intake supports explicit accept, defer and decline decisions. Current explains what needs attention; My work, projects and dependencies organize execution. Issues include comments, safe Markdown, named links, private files and an immutable activity history.

The application runs on a Cloudflare Worker with TanStack Start, React and Hono, D1 for records and R2 for files. Operators sign in by email; Settings provides invitations, removal and workspace timezone controls. The source is MIT licensed at [just-every/vector-projects](https://github.com/just-every/vector-projects).

## Local development

Use Node 26.8.1 and pnpm 8.15.6:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Development applies local migrations and serves http://127.0.0.1:15928 with synthetic data isolated under `.wrangler/vector-dev`. Sign-in uses the explicit loopback-only outbox. [OPERATIONS.md](OPERATIONS.md) documents local sign-in and production-build review. Real deployments use configured email delivery.

```sh
pnpm exec playwright install chromium
pnpm verify
# With pnpm dev running in another terminal:
pnpm test:dev
```

Verification checks source integrity, Node/Markdown/Worker tests, deployment behavior, types, the build, emitted Worker/browser journeys, Base invitation behavior and clause registration. Fresh reports are ignored under `.artifacts/verification`. Optional focused commands include `pnpm test:foundation` and `pnpm test:removal` after a build.

## Setup and deployment

Follow [DEPLOY.md](DEPLOY.md) to supply explicit source/run identities, a reviewed plan, Cloudflare credentials and mail/session secrets. Prepare the build in a credential-free environment, then use a separate trusted controller:

```sh
pnpm deploy:prepare
# In the trusted controller, with the prepared artifact and required inputs:
pnpm run setup
pnpm run deploy
pnpm deploy:health
```

`pnpm run setup` provisions or reuses the Worker, D1 and R2 resources, applies migrations, uploads the prepared artifact, configures Cron and checks health. `pnpm run deploy` reconciles that installation; an identical artifact, plan and receipt produces no provider mutation. Use `pnpm run setup` and `pnpm run deploy` to select the package scripts explicitly; bare `pnpm setup` / `pnpm deploy` are pnpm’s own commands. The committed Wrangler configuration is for local development.

## Data and updates

There is currently no application export or restore command, including no `pnpm export` or `pnpm restore` script. Back up D1 and R2 using your provider tooling before an upgrade, retain source revisions and migration history, and validate recovery in isolated resources. Complete portable export/restore remains an open product requirement.

Stage intentional source edits, run `pnpm sources:lock`, then `pnpm sources:check` and `pnpm verify`. See [HANDOVER.md](HANDOVER.md) for implemented scope and limitations, [CHANGELOG.md](CHANGELOG.md) for release changes, and [CONTRACT.md](CONTRACT.md) / [BASELINE.md](BASELINE.md) for requirements. Passing local checks does not establish every wider product, capacity or hosted-delivery guarantee.
