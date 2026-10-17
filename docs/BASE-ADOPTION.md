# Base adoption

Runtime selections come from Base revision `e3467bf282312cc46c36a57145e054757b6031f5`. Recorded byte copies track their declared source revisions; product adaptations are identified below. Base test files and fixtures are omitted from every seed distribution; Vector retains tests of its own commands and business flows.

| Local selection | Source or role |
| --- | --- |
| @runeditrun/rer 0.2.40 | exact package pin for the public `rer` command and shared lifecycle runtime |
| scripts/installer | Vector's existing installer adapter using package exports |
| src/base | unchanged Lobby, setup-state and run-site runtime from Base rer 0.2.40 (`9eb83c8`) |
| vendor/base/operator-auth, owner-claim, demo, mail, dependencies, editor, egress-service, integrations, import-kit, d1-transport | every recorded module copy, refreshed together from Base rer 0.2.40 (`9eb83c8`) |
| migrations/core/0050_import_steps.sql | import-kit's resumable preparation-step and erasure-progress tables, verbatim from Base rer 0.2.24 schema constants |
| @runeditrun/rer 0.2.40 | published CLI, owner-account deploy, portability and operations |
| scripts/edition-authoring | one authoring implementation |
| vendor/base/schema | release/seed/setup validation |
| migrations/core/0022_portability.sql | native portability schema |

`base-copies.json` and edition origins describe the selections. Run `sources:verify-base`, `sources:check`, and `verify-base --base PATH` when refreshing them. Historical SQL 0001–0021 is unchanged. `src/core/platform/mail.ts` selects the native Base sender and passes `Retry-After` seconds to Vector’s queue. Base owns header validation, request serialization, Worker-compatible `redirect: manual` and refusal of relay redirects. The sign-in selection is refreshed to `b4b372b`; Vector’s branded form uses Base’s `normalizeEmail` for complete `login_hint` values and never auto-submits. Product adapters own bindings, equal-operator authority, route selection, native mutations and archive policy. The registry schema is also an explicitly mapped product adaptation. Mail’s `src/inbound/headers.mjs` is a security adaptation: header parsing removes overlapping whitespace repetition, and message IDs validate intervening text without deletion-based sanitization, preserving parsing behavior. It is the only vendored file outside `base-copies.json`; every other mail file is recorded at the refreshed revision.

Public lifecycle commands dispatch through `rer` and the existing installer adapter. Root `rer-setup.json` is the single field/secret model. Node 22.20.0 and pnpm 10.12.4 are pinned. Setup preserves private settings and accepted data; development exposes health-gated readiness and automatic owner entry through `RER_OPEN`, including legacy `--login`. Local titles and the app name carry a Dev suffix. It has no toolbar or captured-mail UI; preview serves production output without captured-mail sign-in. Production requires declared outbound email or an approved Auth SSO setup dependency. Reset requires confirmation and removes only inventoried local state. See README.md and docs/LOCAL-RECOVERY.md before moving ambiguous old state.

Local archives use one Base portability engine. Vector's inventory rejects unknown tables/columns and missing live files. Nonsecret auth identity mappings preserve history; sessions and secrets are excluded. Import publishes records, FTS rebuild, owner-only fresh access and effect quarantine in one native commit. Native records, attachment bytes and metadata round-trip without new activity or timestamps. See docs/DATA-OWNERSHIP.md for exclusions and review routes. Hosted archive transport remains unverified.

Apply 0022/0023 forward after preserving D1/R2 backups, settings and source. Keep additive schema, historical deliveries and migration records on compatible-source rollback. Old local-mail readers and pre-0018 rowid search readers are incompatible. Validate recovery in isolated resources with matching source and private file checks before switching traffic.

Owner-account deployment and the reviewed artifact controller remain separate. SENDGRID_API_KEY maps once to MAIL_API_KEY. Local/native tests prove no hosted installation, live email, provider backup or public release.


Wave B source preparation: see [managed source and recovery](MANAGED-SOURCE.md). The generated private-source descriptor/workflow, Base delivery producer, signed native owner claim and owner-gated editor are source adoption; hosted installation/service acceptance, live accounts and public publishing remain owner work. Apply 0024 additively and retain permanent admission ledgers. Native/browser verification status is recorded in the current task evidence, not inferred from packaging.

## Lobby and run site

The public command is package-mode `@runeditrun/rer` 0.2.40, pinned exactly in package.json and pnpm-lock.yaml. Base rer 0.2.40 (`9eb83c8`) supplies the unchanged `src/base` runtime. Operations inspectors now come from the published package; `base-copies.json` records those bytes and the refreshed command/adoption documents. Applied migrations are never rewritten by a refresh; schema Base adds arrives as a new numbered migration. The removed CLI and onboarding trees no longer appear as local edition components.

The installed Worker serves Base’s Lobby and setup-state response using Vector’s persisted first-run completion. The deployment name comes from the server-only `WORKSPACE_NAME` setting. The static site uses edition data only, keeps the approved homepage and fonts, and offers Run Vector at `/run`; its docs use the existing Markdown manifest and components. The installer adapter no longer supplies the undeclared `target` setup answer.

`rer build --site` writes `dist/site`; `rer deploy --site --dry-run --json` describes the separate `vector-projects-production--site` Worker and its apex and www domains without a provider request. Deployment and the run-site workflow remain separate owner-controlled steps.

The seed now maintains RUN-LOCALLY.md and SEED-COMMAND-CONTRACT.md as package-mode guidance rather than verbatim Base copies. The deploy-kit and operations copies are removed; the published package supplies those runtimes. Product validation and archive inventory remain seed adapters. Inventory uses the published portability policy’s shared ledger exclusions so both migration ledger formats remain recoverable.

Demo mode uses the verbatim Base demo module beside operator-auth. The former `vendor/demo/demo` blocking guard and captured-mail bar are removed. Demo mail returns accepted without capture; webhook RPC delivery uses `demoEffect` with a 204 provider response, including when no production egress binding is configured. Ordinary installations retain their real configured transport and its egress checks. The existing sample-data hook is unchanged.
