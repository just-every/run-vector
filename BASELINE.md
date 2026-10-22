# BASELINE.md

Shared baseline requirements defined in Base. Editions ship their own copy and
baseline evidence; their reports distinguish implemented checks from planned
coverage. An intentional override identifies the baseline clause and the owner's
authorized replacement requirement, including changed security consequences,
with appropriate verification. Existing owner authorization is sufficient;
ordinary fixes to meet a requirement need no additional acknowledgement.
A product supersession names the baseline ID
in its contract and explains the replacement behavior. Keep these records in the
edition's useful requirements, intent or override documents. Use the override
schema and reporting that the edition actually implements; neither a particular
file path nor automatic `rer verify` supersession reporting is universal. Where
reporting is absent, state that gap and verify the replacement directly. Do not
silently weaken a guarantee or report an untested override as passing. Times are
p95 at the limits in `seed.json`.

## Access

- **BASE-ACCESS-001 — Sign-in.** Operators sign in by magic link to an allow-listed email address; passkeys may be offered in addition. No passwords are stored. Separately, member-selected immediate notification mail and email digests under NOTIFY-006/007 can carry issue titles, identifiers, readable actors and authenticated app links outside the deployment through the declared transactional-email external.
- **BASE-ACCESS-002 — Sessions.** A session expires after at most 30 days of inactivity; sign-out revokes that session. A valid session is required before an operator request reads private product data or performs its requested action. A protected operator document and each private generated server-function handler validate the session independently; a document gate does not authorize a function call. For an otherwise-admissible request that reaches session validation, a protected operator HTTP API returns 401 when the session is missing, expired, or revoked; a protected document returns its native sign-in response; and a generated transport may encode an identifiable session denial or sign-in redirect in its framework protocol, including a 200 serialized redirect. No such denial response exposes private product data or performs the requested mutation. Declared public exceptions remain governed by BASE-ACCESS-003, and host, method, Origin/CSRF, input, and runtime guards retain their normal order.
- **BASE-ACCESS-003 — Public endpoints.** Only paths declared in `seed.json → deploy.publicPaths` are reachable without a session. Entries are exact paths or prefixes and must cover the sign-in flow and the operator app's static assets. Each is rate-limited at the limits in `seed.json` and returns 429 when exceeded.
- **BASE-ACCESS-004 — Server-side authorisation.** Every mutation checks the caller's session and ownership on the server. Client-supplied identity, role, or ownership claims are never trusted.

## Input

- **BASE-INPUT-001 — Validation.** Every request body, query, and path parameter is validated against a schema at the boundary. Invalid input returns 400 in the standard error format and reaches no service.
- **BASE-INPUT-002 — HTML.** User-supplied HTML is sanitised before display: scripts, forms, and tracking pixels are removed; remote images load only on operator request. Channels that carry text are rendered as text.
- **BASE-INPUT-003 — Uploads.** Uploads are accepted only within the size and type limits in `seed.json`, stored in R2, served with their declared content type and a download disposition, and readable only by an authorised session or through a delivery channel the product contract names.

## Secrets and configuration

- **BASE-SECRET-001 — No leakage.** No secret appears in the client bundle, in logs, or in an error response.
- **BASE-SECRET-002 — Startup.** Missing required configuration fails at startup naming the variable. The product never runs in a degraded mode.

## Data ownership

- **BASE-DATA-001 — Export and import.** `rer export` produces every record and attachment; `rer import` restores it into an empty deployment; export, import, export yields an archive with equivalent contents.
- **BASE-DATA-002 — Retention.** No user data is deleted automatically. Only sessions and rate-limit state expire.
- **BASE-DATA-003 — Erasure.** Every entity that holds personal data can be deleted by an operator. Deletion cascades to dependent records and attachments within 5 minutes and is confirmed when complete. Audit entries are kept with the reference anonymised.
- **BASE-DATA-004 — Outbound flows.** User data leaves the deployment only through externals declared in `seed.json → externals`. No other outbound request carries user data.
- **BASE-DATA-005 — Independence.** The deployment makes no request to the marketplace or the seed author. There is no telemetry, phone-home, licence check, or kill switch.

## Public surfaces

- **BASE-PUBLIC-001 — Privacy.** Public surfaces (widgets, booking pages, forms, status pages) set no cookies, load nothing from third-party domains, and send no visitor data before the visitor's first interaction.
- **BASE-PUBLIC-002 — Origins.** Embeddable surfaces can be embedded only on host origins listed in settings.
- **BASE-PUBLIC-003 — Accessibility.** The operator app and every public surface are keyboard operable and labelled for assistive technology, passing the automated accessibility check at the level in `seed.json`.

## Operations

- **BASE-OPS-001 — Health.** `/health` returns 200 within 1 second when the database, storage, and queues are reachable, and 503 otherwise.
- **BASE-OPS-002 — Migrations.** Migrating from the previous released tag to the current one succeeds on sample data. Destructive changes are expand → migrate → contract with a documented recovery step.
- **BASE-OPS-003 — Idempotency.** Queue consumers and webhook handlers produce the same result when a message is delivered twice.
- **BASE-OPS-004 — Failure is visible.** A job that fails after its retries is marked failed where an operator can see it. Nothing is dropped silently.
- **BASE-OPS-005 — Audit.** Every destructive action and every automated action that reaches a user records the actor, or the feature that acted, and the time. Audit records survive deletion of what they describe.

## Current local lifecycle — rer 0.2.20

For local entry under BASE-ACCESS-001, `rer dev` uses the private `RER_OPEN` link to create a real, key-gated owner session; legacy `--login` uses the same flow. `--as` selects another declared dev persona or signed-out entry. Development has no badge, toolbar or captured-mail UI. Preview serves production output and prints its ready address without captured-mail sign-in. These instructions replace the earlier outbox-based local-entry instructions below. Existing mail storage, erasure guards and applied migrations remain intact. Production requires declared outbound email or an approved Auth SSO setup dependency; Vector’s documented path uses SendGrid, with `rer signin` retained for Cloudflare-credential owner recovery.

## Shared installation and source custody (9 October 2026)

Use Node 22.20.0 and the published `rer` command. `rer install` provisions the pinned pnpm automatically. The shared `rer setup --owner-email EMAIL` paths preserve configured FIRST_OWNER bootstrap, private `.dev.vars` and saved origin/owner/data; `rer dev` hydrates that installation. `/__dev/outbox` uses Base mail with explicit exact loopback admission and ordinary Base native sessions. Confirmation GET is inert; POST signs in. Owner-account setup/deploy/health uses explicit account inputs and SENDGRID_API_KEY mapped to MAIL_API_KEY. The reviewed artifact controller has separate artifact:setup/deploy/health commands.

Exact Base copy/schema/source checks, installer/settings/outbox/hosting tests, populated previous-head migrations and native 1440/390 journeys form local acceptance. CI slow startup and literal README clone/own-frozen-install proof retain only safe receipts and captures. These do not establish hosted acceptance. Preserve 0001–0021, apply 0022/0023, keep additive schema and terminal delivery/migration ledgers on compatible-source rollback, and validate isolated recovery with matching source and D1/R2 backups. See docs/BASE-ADOPTION.md. Local archives preserve native records and FILES bytes with destination access/effect review. Mapped imports and native integrations are described below; authenticated HTTP restore into a pristine bootstrap is locally proven with fresh native authority after commit. Hosted HTTPS acceptance remains separate.


Wave B source preparation: see [managed source and recovery](docs/MANAGED-SOURCE.md). The generated private-source descriptor/workflow, Base delivery producer, signed native owner claim and owner-gated editor are source adoption; hosted installation/service acceptance, live accounts and public publishing remain owner work. Apply 0024 additively and retain permanent admission ledgers. Native/browser verification status is recorded in the current task evidence, not inferred from packaging.


## Mapped imports and local archives

Mapped CSV/JSON issue imports and the Linear importer (documented CSV format and owner-made API file, tested at 2,000 issues with a generator) use the same reviewed native Base import-kit path in Settings and the terminal. See docs/MOVE-IN.md, docs/IMPORT-EVIDENCE.md and docs/ARCHIVES.md for limits, exact originals, command spelling and the authenticated HTTP restore admission and recovery requirements. Replacement claims remain empty; no owner export or hosted acceptance is asserted.

Apply 0025/0026 additively after 0024. Retain original bytes, import journals/provenance, revisions, identifier reservations and authorization guards on compatible-source rollback. Archive export excludes credentials, delivery claims and import lease capabilities. Stop local runtimes before archive commands; restore into empty D1/FILES, configure fresh destination authority, and review access/effects. Never replay historical deliveries. Native cycle data and immutable closure snapshots are retained. Automatic closure and default rollover are implemented with local transactional proof; provider Cron timing remains unproved. Due reminders are implemented as Inbox-only, with an editable daily time (default 09:00) and workspace timezone, a delivered ledger, durable feature audit and recipient-specific mute suppression; hosted Cron delivery and capacity remain separate acceptance. Native cookie-only, version-checked issue deletion and duplicate decisions are implemented with local D1/R2 evidence; see ACCEPTANCE.md. Complete baseline and hosted acceptance remain separate.

## Native integrations

Settings manages scoped Base tokens with safe usage, signed sources, outbound destinations and GitHub PR webhook configuration. See docs/API.md and docs/INTEGRATIONS.md. Apply 0027/0028 additively after 0026; retain source/deletion and replay identities, attempts and terminal results on compatible-source rollback. Restore excludes credentials and transient claims, quarantines historical mail/webhook events, and requires fresh access/effect review and signing-key re-entry. Outbound delivery stays visibly unconfigured until Settings identifies the hosting account’s excluded domains, or a deployment-owned enforcing transport is bound. The built-in Base transport checks public DNS and pins TLS for non-Cloudflare destinations; all-Cloudflare destinations use its platform-fetch route, with re-resolution and destination-zone origin TLS limitations documented in docs/INTEGRATIONS.md. There is no retry through a different transport after a send fails. Local native and loopback-TLS evidence does not establish hosted egress, a live source/account, stage installation or public publication.

Migration 0033 expands the two source-table primary keys with an explicit live/erased discriminator using create/copy/swap. Old column values and every unaffected table/index/trigger remain intact; source identities are anonymized only on confirmed issue deletion. Preserve this expanded schema and erasure ledgers on compatible-source rollback; do not run old source code that ignores the discriminator.
