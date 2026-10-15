# Base adoption

Runtime selections come from Base revision `e3467bf282312cc46c36a57145e054757b6031f5`. Recorded byte copies remain unchanged; product adaptations are identified below. Base test files and fixtures are omitted from every seed distribution; Vector retains tests of its own commands and business flows.

| Local selection | Source or role |
| --- | --- |
| @runeditrun/rer 0.2.19 | exact package pin for the public `rer` command and shared lifecycle runtime |
| scripts/installer | Vector's existing installer adapter using package exports |
| src/base | unchanged Lobby, setup-state and run-site runtime from Base `8981bc2c4d9e61feca5787c83b4ed44056659dd9` |
| vendor/base/operator-auth | native operator authentication, including the `rer signin` owner link, from Base `e17843562355e1b6e5068289c8e037951fbc8d3d` (rer 0.2.19) |
| migrations/core/0048_owner_signin.sql | the owner sign-in grant table, from the same Base revision |
| vendor/base/mail | transactional mail and development outbox |
| @runeditrun/rer 0.2.19 | published CLI, owner-account deploy, portability and operations |
| scripts/edition-authoring | one authoring implementation |
| vendor/base/schema | release/seed/setup validation |
| migrations/core/0022_portability.sql | native portability schema |

`base-copies.json` and edition origins describe the selections. Run `sources:verify-base`, `sources:check`, and `verify-base --base PATH` when refreshing them. Historical SQL 0001–0021 is unchanged. Product adapters own bindings, equal-operator authority, route selection, native mutations and archive policy. Three import-kit D1 files remove unused type imports for Vector’s compiler; those adaptations remain in the edition origin mappings and are excluded from byte-copy claims. The registry schema is also an explicitly mapped product adaptation. Mail’s `src/inbound/headers.mjs` is a security adaptation: header parsing removes overlapping whitespace repetition, and message IDs validate intervening text without deletion-based sanitization, preserving parsing behavior. Its edition origin mapping remains; split mail copy records retain the original revision, digests and modes for every other mail file and exclude only this adaptation.

Public lifecycle commands dispatch through `rer` and the existing installer adapter. Root `rer-setup.json` is the single field/secret model. Node 22.20.0 and pnpm 10.12.4 are pinned. Setup preserves private settings and accepted data; development exposes health-gated readiness and ordinary outbox confirmation. Reset requires confirmation and removes only inventoried local state. See README.md and docs/LOCAL-RECOVERY.md before moving ambiguous old state.

Local archives use one Base portability engine. Vector's inventory rejects unknown tables/columns and missing live files. Nonsecret auth identity mappings preserve history; sessions and secrets are excluded. Import publishes records, FTS rebuild, owner-only fresh access and effect quarantine in one native commit. Native records, attachment bytes and metadata round-trip without new activity or timestamps. See docs/DATA-OWNERSHIP.md for exclusions and review routes. Hosted archive transport remains unverified.

Apply 0022/0023 forward after preserving D1/R2 backups, settings and source. Keep additive schema, historical deliveries and migration records on compatible-source rollback. Old local-mail readers and pre-0018 rowid search readers are incompatible. Validate recovery in isolated resources with matching source and private file checks before switching traffic.

Owner-account deployment and the reviewed artifact controller remain separate. SENDGRID_API_KEY maps once to MAIL_API_KEY. Local/native tests prove no hosted installation, live email, provider backup or public release.


Wave B source preparation: see [managed source and recovery](MANAGED-SOURCE.md). The generated private-source descriptor/workflow, Base delivery producer, signed native owner claim and owner-gated editor are source adoption; hosted installation/service acceptance, live accounts and public publishing remain owner work. Apply 0024 additively and retain permanent admission ledgers. Native/browser verification status is recorded in the current task evidence, not inferred from packaging.

## Lobby and run site

The public command is package-mode `@runeditrun/rer` 0.2.2, pinned exactly in package.json and pnpm-lock.yaml. Base `8981bc2c4d9e61feca5787c83b4ed44056659dd9` supplies the unchanged `src/base` runtime. Operations inspectors now come from the published package; `base-copies.json` records those bytes and the refreshed command/adoption documents. Historical migrations and the other copied application modules retain their recorded pins. The removed CLI and onboarding trees no longer appear as local edition components.

The installed Worker serves Base’s Lobby and setup-state response using Vector’s persisted first-run completion. The deployment name comes from the server-only `WORKSPACE_NAME` setting. The static site uses edition data only, keeps the approved homepage and fonts, and offers Run Vector at `/run`; its docs use the existing Markdown manifest and components. The installer adapter no longer supplies the undeclared `target` setup answer.

`rer build --site` writes `dist/site`; `rer deploy --site --dry-run --json` describes the separate `vector-projects-production--site` Worker and its apex and www domains without a provider request. Deployment and the run-site workflow remain separate owner-controlled steps.

The seed now maintains RUN-LOCALLY.md and SEED-COMMAND-CONTRACT.md as package-mode guidance rather than verbatim Base copies. The deploy-kit and operations copies are removed; the published package supplies those runtimes. Product validation and archive inventory remain seed adapters. Inventory uses the published portability policy’s shared ledger exclusions so both migration ledger formats remain recoverable.
