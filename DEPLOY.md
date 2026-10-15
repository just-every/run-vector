# Deploying Vector

You need Git and the published `rer` command (Node 22 or later to install it); `rer` provides the exact Node and pnpm this source pins. The CLI and deploy kit come from pinned `@runeditrun/rer` 0.2.19; see [Base adoption](docs/BASE-ADOPTION.md).

## Owner account

`rer build` completes in a credential-free command environment with `.dev.vars` excluded. Commit source before the provider operation. Supply explicit `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, `FIRST_OWNER_EMAIL` for the hosted owner and public `FIRST_OWNER_NAME`, `WORKSPACE_NAME`, `WORKSPACE_TIMEZONE`, `DEFAULT_TEAM_NAME`, `DEFAULT_TEAM_PREFIX`, and a sender `MAIL_FROM`. Supply `MAIL_API_KEY` (or the existing `SENDGRID_API_KEY` input) to enable SendGrid sign-in links and invitations; use a verified sender for delivery. Owner claim and linked identity work without mail. No ambient Wrangler login is used.

Run `FIRST_OWNER_EMAIL="$OWNER_EMAIL" rer deploy`. Without `--environment NAME` it deploys the `production` environment, which is also what `rer signin` and `rer deploy --remove --yes` act on; pass the same `--environment NAME` to all three when you use another. This explicit mapping is needed because the current Vector adapter (`scripts/installer/local.mjs` → `scripts/installer/hosting.mjs`) validates and writes `FIRST_OWNER_EMAIL`; the CLI does not automatically rename `OWNER_EMAIL` on this path. The owner is selected by the deployment input, independently of local setup. The artifact controller below also retains `FIRST_OWNER_EMAIL` in its reviewed plan.

The command runs the published package’s deploy and health checks on the same durable declaration/state. It builds before deployment. `deploy.json` declares DB, FILES, minute Cron and APP_ORIGIN. Names derive from Vector's public identity and environment: `vector-projects-production`, its `-db` database and `-files` bucket. APP_ORIGIN is resolved from the explicit account's workers.dev subdomain; offline operations checks use the intended HTTPS origin, then runtime health verifies the actual deployment origin. Unrelated named resources are refused, never adopted or deleted.

The product materializes public values in private `.rer/deploy/declaration.json`. `.rer/deploy/secrets.env` is 0600, generates SESSION_SECRET once and stores the supplied mail credential. Existing values win on rerun; neither secret is implicitly rotated. The owner input SENDGRID_API_KEY maps to the established Worker binding MAIL_API_KEY, with no deployed binding rename. An absent mail credential is omitted from the declaration. Base generates the one-time SETUP_TOKEN, claims it through `/auth/bootstrap`, and retires it after success. Retain `.rer/deploy/production.json` and the secret file.

The owner signs in by email. Without mail, run `rer signin` from the deploying checkout with the same Cloudflare credentials: it writes a one-time grant (only its SHA-256) into the installation's D1 database and prints a sign-in link once. The link works once, only for the recorded owner, within 15 minutes; the Worker records its use. Vector adopts this from Base operator-auth (migration `0048_owner_signin.sql`).

To take the installation down, run `rer deploy --remove --yes` from the deploying checkout with the same credentials. It deletes the Worker, D1 database and R2 bucket this checkout's `.rer/deploy` record says rer created, confirms each is gone and touches nothing else. rer 0.2.19 stops with `provider-incomplete-pagination` when the bucket still holds files; delete those objects in the Cloudflare dashboard and run the same command again. Only the explicit provider command receives these credentials; dependency/build commands never inherit them. Missing public inputs refuse before resource writes. These commands do not provision a mail domain or verify mailbox arrival.

The browser installer supports local installation only. Owner-account deployment runs separately through `rer deploy`; setup does not deploy. Local development needs only `rer install` and `rer dev`. Optional `rer setup --owner-email EMAIL` before first development chooses the local owner and uses `.dev.vars` plus `/__dev/outbox` without a provider credential. Once initialized, that local owner is preserved; choosing another mailbox requires a deliberately reset disposable installation, as described in README.md. Follow README.md to approve installation and confirm a captured sign-in message. Estimated infrastructure cost is USD 0–15 per month under seed.json assumptions, plus transactional email; this is not capacity or live-provider acceptance.

## Artifact controller

Credential-free preparation and the reviewed artifact controller remain separate: `pnpm deploy:prepare`, `pnpm artifact:setup`, `pnpm artifact:deploy`, `pnpm artifact:health`. Their source/run/hash/receipt identities, strict plan, resource collision/drift refusal and byte-identical repeat remain enforced. The artifact mail input is MAIL_API_KEY directly; it does not use the owner-account input mapping.

## Build/controller separation

Run `pnpm deploy:prepare` (`node scripts/deployment/prepare.mjs`) in a separate
credential-free job/check-out with no provider, mail, evidence or repository
credentials, no controller files mounted, and no `.env`/`.dev.vars` files. In
Actions use checkout `persist-credentials: false`, no secrets or OIDC permission,
and a fresh runner. Preparation installs the frozen lock and builds Vector, then
packages the actual legacy Vite `dist/server/wrangler.json` output, its JavaScript
and additional runtime modules, `./dist/client` assets and immutable
`migrations/core` SQL. It creates a bounded inert JSON artifact outside the source.
It rejects secret-bearing environment variables, Node injection, changed tracked
source, links and unsupported module rules. An isolation marker is an assertion
by the trusted caller, not an operating-system sandbox. A local process with a
cleared environment alone does not establish credential isolation.

Prepare receives only PATH and these public inputs:

```text
RER_DEPLOY_SOURCE_SHA=<exact committed 40-hex SHA>
RER_DEPLOY_RUN_ID=<decimal evidence identity>
RER_DEPLOY_RUN_ATTEMPT=1
RER_DEPLOY_ARTIFACT=<new absolute artifact filename outside checkout>
RER_PREPARE_HOME=<new absolute private directory outside checkout>
RER_PREPARE_ISOLATION=ephemeral-credential-free-job
```

Its stdout contains a public SHA-256. The trusted controller obtains the digest
and source/run custody independently through its artifact/evidence service; the
artifact and prepare stdout do not attest themselves. All macOS paths must be
canonical (for example `/private/tmp`, not the `/tmp` symlink).

In a separate reviewed trusted controller checkout/job, Node reads inert artifact
bytes only. It never builds, installs or executes candidate modules. Do not start
Node with NODE_OPTIONS or NODE_PATH. Controller inputs:

```text
CF_THROWAWAY_ACCOUNT_ID=<Cloudflare account ID>
CF_THROWAWAY_API_TOKEN=<Cloudflare API token for this controller job>
RER_DEPLOY_ARTIFACT=<absolute artifact filename>
RER_DEPLOY_ARTIFACT_SHA256=<independently checked digest>
RER_DEPLOY_SOURCE_SHA=<same exact SHA>
RER_DEPLOY_RUN_ID=<same decimal identity>
RER_DEPLOY_RUN_ATTEMPT=1
RER_DEPLOY_RECEIPT=<new absolute receipt filename>
RER_DEPLOY_PLAN=<absolute reviewed JSON file outside candidate checkout>
SESSION_SECRET=<32–1024 characters; first deployment only>
MAIL_API_KEY=<approved SendGrid key, at most 4096 characters, no whitespace or controls; first deployment only>
```

The public reviewed plan is inert JSON with no executable configuration, resource
executable command selection. A reviewed `worker` selects the installation name;
D1/R2 names are deterministically suffixed `-db`/`-files`. The disposable proof
harness independently restricts all names to its authorized prefix. Replace the example values with approved installation
and verified sender inputs before deployment:

```json
{
  "version": 1,
  "workersDev": true,
  "worker": "vector-demo",
  "FIRST_OWNER_EMAIL": "owner@example.com",
  "FIRST_OWNER_NAME": "Vector owner",
  "WORKSPACE_NAME": "Vector workspace",
  "WORKSPACE_TIMEZONE": "Australia/Brisbane",
  "DEFAULT_TEAM_NAME": "Team",
  "DEFAULT_TEAM_PREFIX": "TEAM",
  "MAIL_FROM": "Vector <verified-sender@example.com>"
}
```

APP_ORIGIN comes from the authenticated account workers.dev subdomain;
SEED_SAMPLE_DATA=false and MAIL_PROVIDER/MAIL_MODE=sendgrid are controller-owned.
No SETUP_TOKEN is required: explicit first-owner configuration initializes the
installation. Secret values never enter the artifact, receipt, temporary files
or public variables. Missing secrets fail before resource writes.

Reviewed public inputs are checked before any provider writes: owner, workspace
and team names must contain 1–200 characters after trimming; the timezone must
be a named IANA timezone of at most 100 characters after trimming (fixed offsets
such as `+05:30` are rejected); the team prefix is 2–10 uppercase letters.
The owner email must satisfy bootstrap email syntax, fit within 254 characters,
and be accepted by the sign-in mail adapter. `MAIL_FROM` accepts a mailbox or
`Name <mailbox>` with an ASCII sender address. Mailboxes have at most 64 local-part
characters and 63 characters per domain label. The reviewed JSON retains its
512-character per-field input ceiling. Supplied secret values are validated
before provider access; omitted existing secrets are inherited without readback.
These checks establish syntax only, not verified sender ownership or delivery.

Run the reviewed controller with its explicit environment:

```sh
pnpm artifact:setup
pnpm artifact:deploy
pnpm artifact:health
```

Use the same artifact, plan, run identity and receipt for the repeated deployment.
The second command requires identical provider version, resources, migration
hashes, configuration, Cron and secret names, performs no mutation, and preserves
the receipt byte-for-byte. Read-only D1 SELECTs use POST transport. Drift fails
without repair. Serialize deployment and any out-of-band edits. A changed build
requires a new artifact/run/receipt and separate reviewed upgrade evidence.
Applied Wrangler histories without content hashes cannot be silently adopted;
review/hash adoption is required. Interrupted migration claims require inspection,
not automatic replay. The controller never deletes resources or owner data.

## Evidence and local checks

```sh
node --test scripts/deployment/tests/*.test.mjs
rer verify
# In a disposable checkout, prepare the hydration fixture first:
pnpm test:dev:setup
# Start rer dev in another terminal, wait for /health, then:
pnpm test:dev
```

New tests use provider fixtures and real SQLite only in test code. They check
Vector plan restrictions, credential rejection, emitted module selection and
zero-write repeat with retained D1/R2 data. Migration regressions also validate and
apply the complete actual SQL history through the controller to real SQLite, enforce
last-owner triggers and prove zero-write migration repeat. These local checks do
not prove hosted
provider behavior, Cron delivery or email arrival. Hosted smoke must retain exact
source SHA, provider version/deployment IDs, resource IDs, hashed receipt, public
health identity, repeated-deploy API audit and real controlled-inbox sign-in,
invite/revocation and empty-installation journeys. Keep live validation and any disposable-resource cleanup explicitly scoped to the installation.

`.github/workflows/ci.yml` runs on main pushes and pull requests with Node 22.20.0,
frozen install, headless Chromium, the test suites via `pnpm verify:ci`, test-free `rer verify` build/artifact and hosted boundaries, and an
actual `rer dev` readiness check plus bare `pnpm test:dev` through `pnpm test:dev:ci`. The saved installation origin is read from the private `.seed/development.json` launch receipt without an extra environment variable. The process group is cleaned
up even after readiness or journey failure. It has no deployment secret inputs.

## Upgrade custody

Preserve 0001–0019 bytes and modes. Apply exact Base development schema 0020 and product guards/obsolete local capture retirement 0021. Native auth, source and terminal delivery histories remain; request new local sign-in messages after upgrade. Keep additive schema and ledgers on compatible-source rollback, and restore matching source plus D1/R2 backups into isolated resources for recovery. No destructive down migration or uncertain-send replay is permitted. Application archives and their destination admission requirements are described in docs/ARCHIVES.md. Safe CI artifacts exclude runtime databases, settings, mail bodies and credentials.


Wave B source preparation: see [managed source and recovery](docs/MANAGED-SOURCE.md). The generated private-source descriptor/workflow, Base delivery producer, signed native owner claim and owner-gated editor are source adoption; hosted installation/service acceptance, live accounts and public publishing remain owner work. Apply 0024 additively and retain permanent admission ledgers. Native/browser verification status is recorded in the current task evidence, not inferred from packaging.


## Mapped imports and local archives

Mapped CSV/JSON issue imports and the Linear importer (documented CSV format and owner-made API file, tested at 2,000 issues with a generator) use the same reviewed native Base import-kit path in Settings and the terminal. See docs/MOVE-IN.md, docs/IMPORT-EVIDENCE.md and docs/ARCHIVES.md for limits, exact originals, command spelling and the authenticated HTTP restore admission and recovery requirements. Replacement claims remain empty; no owner export or hosted acceptance is asserted.

Apply 0025/0026 additively after 0024. Retain original bytes, import journals/provenance, revisions, identifier reservations and authorization guards on compatible-source rollback. Archive export excludes credentials, delivery claims and import lease capabilities. Stop local runtimes before archive commands; restore into empty D1/FILES, configure fresh destination authority, and review access/effects. Never replay historical deliveries. Automatic cycle closure and immutable snapshots, Inbox-only due reminders with durable delivery/suppression history, native duplicate decisions and confirmed issue deletion have local transactional proof. Apply 0031–0033 in order and retain frozen history, feature audits, reminder settings, expanded live/erased source keys, deletion receipts and unresolved file custody on compatible-source rollback. Hosted Cron delivery, provider effects and physical erasure timing require separate acceptance evidence.

## Native integrations

Settings manages scoped Base tokens with safe usage, signed sources, outbound destinations and GitHub PR webhook configuration. See docs/API.md and docs/INTEGRATIONS.md. Apply 0027/0028 additively after 0026; retain source/deletion and replay identities, attempts and terminal results on compatible-source rollback. Restore excludes credentials and transient claims, quarantines historical mail/webhook events, and requires fresh access/effect review and signing-key re-entry. Outbound delivery stays visibly unconfigured until a deployment-owned enforcing DNS/pinned-TLS RPC exists; there is no fetch fallback. Local native and loopback-TLS evidence does not establish hosted egress, a live source/account, stage installation or public publication.

## Update

Preserve matching backups and `.rer/deploy`, then run `git pull --ff-only` followed by `rer deploy`. The command provides Node and pnpm itself and installs a changed package pin or lockfile first. Existing migration bytes and identities remain unchanged.

## Remove

From the checkout that deployed it, `rer deploy --remove --yes` deletes the Worker, D1 database and R2 bucket that `.rer/deploy` records `rer` created, with their data, confirms that each is gone and touches nothing else. Export first to keep anything.
