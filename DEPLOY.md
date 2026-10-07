# Deploying Vector

The seed-owned adapters use Base deploy-kit at
`8556679074cf47fed64648235bda4447ee16e2fb`, copied under
`vendor/base/deploy-kit` with one focused migration-validator correction recorded
in `scripts/deployment/provenance.json` alongside companion operations/authoring
sources. `migrations.mjs` delegates SQL control validation to `migration-sql.mjs`:
tokenized CREATE TRIGGER bodies admit their BEGIN/END delimiters and nested CASE
expressions while top-level transactions (including END/RELEASE), ledger access,
ATTACH/DETACH/VACUUM and unterminated tokens remain refused. Quotes and comments
cannot mask appended control statements. SQL migrations 0001–0011 and Base
operator-auth/mail bytes are unchanged by this correction. The seed-owned provider
adapter uses the
[documented R2 start_after pagination](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/methods/list/)
with explicit sorted pages because the provider omits optional result_info on
terminal pages. An example installation target is:
`vector-demo`, D1 `vector-demo-db`, R2
`vector-demo-files`, binding names DB/FILES and a one-minute Cron.
workers.dev is explicitly enabled in the controller plan; disabling it or
custom domains requires another reviewed integration.

Use Node 26.8.1 and pnpm 8.15.6. `pnpm run setup` is the first complete
provision/migrate/upload/health operation; `pnpm run deploy` performs the same
reconciliation. These commands use provider API credentials only, never ambient
Wrangler login or `.env`. They do not provision mail domains or authorize inboxes.
Existing opaque secrets are inherited, never rotated implicitly. Preserve the
receipt when health fails: it records deployment identity before the final probe
and allows an explicit subsequent repeat without uploading again.

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
node scripts/setup.mjs
node scripts/deploy.mjs
node scripts/deployment/controller.mjs health
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
node --test scripts/deployment/tests/*.test.mjs vendor/base/deploy-kit/tests/deploy.test.mjs vendor/base/deploy-kit/tests/build-contract.test.mjs vendor/base/deploy-kit/tests/cron-contract.test.mjs
pnpm verify
# In another terminal, start pnpm dev, wait for /health, then:
pnpm test:dev
```

New tests use provider fixtures and real SQLite only in test code. They check
Vector plan restrictions, credential rejection, emitted module selection and
zero-write repeat with retained D1/R2 data. Migration regressions also validate and
apply all eleven actual SQL files through the controller to real SQLite, enforce
last-owner triggers and prove zero-write migration repeat. These local checks do
not prove hosted
provider behavior, Cron delivery or email arrival. Hosted smoke must retain exact
source SHA, provider version/deployment IDs, resource IDs, hashed receipt, public
health identity, repeated-deploy API audit and real controlled-inbox sign-in,
invite/revocation and empty-installation journeys. Keep live validation and any disposable-resource cleanup explicitly scoped to the installation.

`.github/workflows/ci.yml` runs on main pushes and pull requests with Node 26.8.1,
frozen install, headless Chromium, deployment tests, full `pnpm verify`, and an
actual `pnpm dev` readiness check plus `pnpm test:dev`. The process group is cleaned
up even after readiness or journey failure. It has no deployment secret inputs.
