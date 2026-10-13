# Base adoption

Runtime selections come from Base revision `e3467bf282312cc46c36a57145e054757b6031f5`. Copied runtime bytes remain unchanged. Base test files and fixtures are omitted from every seed distribution; Vector retains tests of its own commands and business flows.

| Local selection | Base source |
| --- | --- |
| scripts/base-onboarding | onboarding runtime and browser UI |
| scripts/base-cli | portable CLI export, queue/release/deploy/mail/portability dependencies |
| vendor/base/operator-auth | native operator authentication |
| vendor/base/mail | transactional mail and development outbox |
| vendor/base/deploy-kit | owner-account deployment |
| vendor/operations | operations inspectors |
| scripts/edition-authoring | one authoring implementation |
| vendor/base/schema | release/seed/setup validation |
| migrations/core/0022_portability.sql | native portability schema |

`base-copies.json` and edition origins describe the selections. Run `sources:verify-base`, `sources:check`, and `verify-base --base PATH` when refreshing them. Historical SQL 0001–0021 is unchanged. Product adapters own bindings, equal-operator authority, route selection, native mutations and archive policy. Copied runtime behavior is unchanged. Three import-kit D1 files remove unused type imports for Vector’s compiler; those adaptations remain in the edition origin mappings and are excluded from byte-copy claims. The registry schema is also an explicitly mapped product adaptation.

Public lifecycle commands dispatch through `node scripts/rer.mjs` and the existing installer adapter. Root `rer-setup.json` is the single field/secret model. Node 22.20.0 and pnpm 10.12.4 are pinned. Setup preserves private settings and accepted data; development exposes health-gated readiness and ordinary outbox confirmation. Reset requires confirmation and removes only inventoried local state. See README.md and docs/LOCAL-RECOVERY.md before moving ambiguous old state.

Local archives use one Base portability engine. Vector's inventory rejects unknown tables/columns and missing live files. Nonsecret auth identity mappings preserve history; sessions and secrets are excluded. Import publishes records, FTS rebuild, owner-only fresh access and effect quarantine in one native commit. Native records, attachment bytes and metadata round-trip without new activity or timestamps. See docs/DATA-OWNERSHIP.md for exclusions and review routes. Hosted archive transport remains unverified.

Apply 0022/0023 forward after preserving D1/R2 backups, settings and source. Keep additive schema, historical deliveries and migration records on compatible-source rollback. Old local-mail readers and pre-0018 rowid search readers are incompatible. Validate recovery in isolated resources with matching source and private file checks before switching traffic.

Owner-account deployment and the reviewed artifact controller remain separate. SENDGRID_API_KEY maps once to MAIL_API_KEY. Local/native tests prove no hosted installation, live email, provider backup or public release.


Wave B source preparation: see [managed source and recovery](MANAGED-SOURCE.md). The generated private-source descriptor/workflow, Base delivery producer, signed native owner claim and owner-gated editor are source adoption; hosted installation/service acceptance, live accounts and public publishing remain owner work. Apply 0024 additively and retain permanent admission ledgers. Native/browser verification status is recorded in the current task evidence, not inferred from packaging.
