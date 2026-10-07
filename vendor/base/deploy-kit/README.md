# Base deploy kit

Dependency-free ESM provisioning, migration, upload and authenticated health checks for declared Cloudflare Workers targets. Node 22.12+. This module does not read Wrangler login, `.env`, git credentials or provider configuration. Actual hosted qualification remains pending owner inputs; local tests use provider fixtures only under `tests/` and real SQLite for migration/data behavior.

## Stage interface: IF-057-STAGE-v1

The fixed commands run with Base checkout root as cwd:

```
node modules/deploy-kit/prepare.mjs
node modules/deploy-kit/cli.mjs deploy
node modules/deploy-kit/cli.mjs health
```

`default-stage.mjs` exports these arrays. Prepare runs in a separate ephemeral **credential-free Linux job**. Deploy and health run from a reviewed trusted controller checkout in a fresh job. The project checkout, dependencies, scripts, build process, parent processes and filesystem must never coexist with provider/mail/evidence credentials or controller configuration. Environment clearing alone cannot enforce this. The workflow must use `persist-credentials: false`, have no provider/mail/evidence secrets or OIDC in prepare, not mount controller directories, and not place controller code in the project checkout. The prepare isolation environment marker is a workflow assertion, not a security sandbox.

Prepare runs `pnpm install --frozen-lockfile` then `pnpm --dir default-seed build`. It packages the actual Vite `./dist/server` modules/main, `./dist/client` assets and D1 SQL. It verifies clean source before and after, rejects links/special files, and writes one bounded inert JSON artifact outside the source tree. It never reads provider inputs. Unsupported module formats fail explicitly.

The packer supports the pinned Cloudflare Vite plugin 1.54.5 legacy `wrangler.json` output: `no_bundle: true` and `rules: [{type: "ESModule", globs: ["**/*.js", "**/*.mjs"]}]`. It follows Wrangler 4.129.1's module discovery for those rules plus its default Text (`.txt`, `.html`, `.sql`), Data (`.bin`) and CompiledWasm (`.wasm`) rules. This retains lazy JavaScript chunks and additional runtime modules. `.vite/manifest.json`, `wrangler.json`, source maps and other files outside those rules are build metadata, not upload modules. The full build tree still undergoes regular-file and size checks. Bundled output, alternate rules/module roots and disabled module discovery are refused; adapting a new build contract is explicit. JSON remains an unsupported artifact module type.

Inputs to prepare (allowlist these, do not spread runner environment):

- `RER_DEPLOY_SOURCE_SHA`: trusted exact 40-hex checkout SHA.
- `RER_DEPLOY_RUN_ID`, `RER_DEPLOY_RUN_ATTEMPT`: trusted decimal strings.
- `RER_DEPLOY_ARTIFACT`: absent absolute output filename outside checkout.
- `RER_PREPARE_HOME`: absent private directory outside checkout.
- `RER_PREPARE_ISOLATION=ephemeral-credential-free-job` and PATH.

The trusted controller must verify artifact-service run/source custody and obtain the SHA-256 digest independently. An artifact's identity fields or prepare stdout do not attest themselves. Deploy and health accept those same four identity/artifact inputs plus `RER_DEPLOY_ARTIFACT_SHA256`, `RER_DEPLOY_RECEIPT`, and **only** `CF_THROWAWAY_ACCOUNT_ID`/`CF_THROWAWAY_API_TOKEN` as provider inputs. They parse artifact bytes; they do not execute or import candidate code. The evidence token belongs only to a separate fixed persistence step. `NODE_OPTIONS`/`NODE_PATH` must be absent before Node starts, not merely checked afterward.

Worker names are `rer-base-stage-<run-id>`, with `-db` D1 and `-jobs` Queue. The exact account's authenticated workers.dev subdomain defines the origin. There is no arbitrary URL/command/name workflow input. Default-seed requires D1, JOBS and its ten-minute Cron only. No unrelated mail credential is required.

Parent integration must extend actual default-seed `/health` after a real D1 readiness check:

```js
{ ok: true, deployment: {
  sourceSha: env.RER_DEPLOY_SOURCE,
  fingerprint: env.RER_DEPLOY_FINGERPRINT,
  versionId: env.RER_VERSION.id,
} }
```

The controller supplies the two public variables and Cloudflare version-metadata binding. The integrating project owns source/types, package scripts, shared manifests and workflows. Build in isolation from controller credentials and validate the emitted artifact and deployed health.

## Reconciliation and repeats

`deploy({api,plan,artifact,artifactSha256,previousReceipt,env,fetch})` is the shared implementation for deployment controllers. Plans are controller-owned and validated; do not derive a secret-bearing plan from executable project configuration. `defaultStagePlan` demonstrates the full schema. Optional R2 `{binding,name}`, Queue `{binding,name,consumer?}`, DO `{binding,className,storage:'sqlite'|'classic'}`, and secret `{binding,environment}` declarations are supported. New DOs must use SQLite; existing classic namespaces are reusable. Namespace creation occurs through Worker upload migrations, with old/new migration tags, then authenticated namespace readback. No namespace create endpoint is invented. Cron and queue consumers reconcile after Worker creation. Conflicting consumers and resource identities fail; resources/data are never deleted.

Cron reads require the documented `result: {schedules: [...]}` envelope, including valid unique Cron strings; bare arrays and partial/malformed results fail. Before changing an existing Worker, deployment reads its schedules and rejects any Cron outside the requested plan with `cron-drift`, before resource writes, SQL migrations or Worker upload. Trigger reconciliation repeats that read before any trigger write. This applies to ordinary changed-source upgrades with or without a prior receipt. The kit may add requested schedules; it never intentionally removes existing schedules. Removing a Cron from the plan while it still exists remotely requires a separate reviewed removal first. Unchanged deployment and health require the exact desired schedule set and perform no repairs. Callers must serialize deployments and out-of-band schedule edits for a Worker: the provider schedule replacement API offers no conditional update in this interface.

D1/Queue/DO account listings fully paginate with bounded page/request budgets. R2 follows provider cursors. Missing pagination evidence, duplicate names, permission errors, partial success, redirects and transport failures fail visibly. Requests go only to Cloudflare's exact account API. Every read has a 30-second timeout and bounded response size; no request is retried. Asset upload tokens are used only on the documented same-account assets endpoint.

The first receipt binds source SHA and tree, artifact/config SHA-256, effective deployment fingerprint, account/Worker, actual resource IDs, migration hashes, secret names and active provider deployment/version/etag. It contains no secret value. The CLI creates it exclusively at mode 0600 before the final health request; it is an identity receipt, not a claim that health passed. A failed health request still exits nonzero, while the retained identity allows the next explicit invocation to authenticate state without another upload. For the second deployment use the **same artifact, run/attempt and receipt**. Current provider state must match the prior receipt. The kit performs no resource creation, Worker/asset upload, SQL mutation, Cron/consumer update, or secret rewrite when unchanged. Read-only D1 queries use the provider's POST query transport; a POST is not by itself a database mutation. The receipt remains byte-identical. Missing resources, drift or stale state fail without repair during this repeat.

Opaque existing secrets are preserved by name and strict binding inheritance; values are never fetched or compared. Missing declared secrets are supplied in the upload metadata in memory only. Rotation is a separate explicit operation; changing an input value does not overwrite a deployed secret. No temporary secret files are used.

Health independently reads current deployment/version/settings, resources, namespaces, schedules, consumers, secret presence and migration history. It requests only the authenticated account-derived `/health`, without credentials, rejects redirects/malformed/unhealthy/stale identity and reads deployment identity again afterward.

## Migration safety

SQL files have ordered unique names and SHA-256 identities. `_rer_deploy_migrations` is permanent controller-owned history. Applied entries must be an unchanged prefix of the desired set. A new migration gets an `applying` claim before its SQL and completion marker are submitted together to the D1 batch query API. Any interrupted, failed or uncertain outcome remains blocked and must be inspected explicitly; the kit never automatically retries, rolls back user data, or marks an unknown outcome successful. Readback checks every final identity. Transaction/ledger-control SQL is rejected.

Existing Wrangler `d1_migrations` records lack content hashes. Automatic adoption would fabricate historical certainty, so those installations require separately reviewed history/hash adoption before this kit proceeds. The kit can extend its own previous migrations while retaining existing application rows. Local SQLite tests prove failure rollback in the test transport; the provider's actual failure atomicity, retained data, and two-deploy no-mutation behavior remain live proof obligations. The conservative `applying` claim prevents automatic replay even if a remote batch partially commits.

## Local operations and source templates

`./operations/operations.mjs` retains v1 compatibility and supports declarative v2 `loops`. A required disabled loop fails. Enabled mail loops explicitly select `resend`, `sendgrid` or `cloudflare`; the corresponding nonblank key is required (`RESEND_API_KEY`, `SENDGRID_API_KEY`, or `CLOUDFLARE_EMAIL_API_TOKEN` plus `CLOUDFLARE_EMAIL_ACCOUNT_ID`). A conflicting `MAIL_PROVIDER` fails. Optional disabled features pass. No DNS, mail, build, deployment or provider request occurs in these checks. Existing v1 executable adapters remain the existing reviewed local contract; deploy-kit `check()` refuses executable configuration and accepts declarative v2 only. `mailPlan()` consumes the mail module’s `mailDoctor(...,live:false)`; absence is an explicit import error.

`createTemplates({destination,project,sourcePaths,commands,loops})` creates a new directory only, containing `edition.json`, `OPERATIONS.json` v2, **both** operations modules and the real edition-authoring tool modules. Commands/effects and selected paths must describe actual adopter files. Add actual sources, initialize Git and stage them, then call `lockTemplates(root)`: it invokes actual edition-authoring `lock` and `check`, generating real `sources.lock.json` hashes and retaining any recipe-selected origins. Existing destinations and locks are refused. It never invents source hashes or overwrites an owner edition.

## Validation and provenance

```
node --test modules/deploy-kit/tests/*.test.mjs operations/*.test.mjs
```

The tests cover real SQLite prior data, migration order/hash/failure/replay safety, fixture provider uploads and repeated no mutations across D1/R2/Queue/DO/Cron/secrets, wrong/missing mail inputs, transport boundaries/pagination, stale health/version, artifact links/custody, actual authoring lock/check and unchanged v1 regression tests. They are not live receipts. Live deployment requires explicit account credentials, isolated build preparation and real remote health validation.

The retained Base revision and local adaptations are recorded in Vector's `scripts/deployment/provenance.json`. Follow the repository's `DEPLOY.md` for the actual Vector controller, required inputs and verification boundaries.

Primary protocol references: [Worker upload](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/), [multipart metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/), [asset upload](https://developers.cloudflare.com/workers/static-assets/direct-upload/), [D1 query](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/), [Queue consumers](https://developers.cloudflare.com/api/resources/queues/subresources/consumers/), [R2 pagination](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/methods/list/), [DO namespaces](https://developers.cloudflare.com/api/resources/durable_objects/subresources/namespaces/), [Worker versions](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/get/). Checked 6 October 2026; hosted conformance is not inferred from documentation.

Cron/build repair references: [Cron GET](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/schedules/methods/get/), [Cron PUT](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/schedules/methods/update/), [Cron replacement behavior](https://developers.cloudflare.com/workers/configuration/cron-triggers/), the published [Vite plugin 1.54.5 source](https://www.npmjs.com/package/@cloudflare/vite-plugin/v/1.54.5) (`src/plugins/output-config.ts`, `src/plugins/additional-modules.ts`) and [Wrangler 4.129.1 source](https://www.npmjs.com/package/wrangler/v/4.129.1) (`src/deployment-bundle/rules.ts`, `find-additional-modules.ts`, `no-bundle-worker.ts`).
