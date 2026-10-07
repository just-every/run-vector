# Vector operations

Vector runs one TanStack Start/Hono Cloudflare Worker with D1 and R2.
OPERATIONS.json records the actual local commands and effects. Its optional v2
inspector is copied from Base operations; this is neither an admission contract
nor a claim of hosted acceptance. `node scripts/operations.mjs describe` and
`check` inspect the local description without executing commands or contacting
providers. The reviewed disposable setup/deploy controller is documented in DEPLOY.md; full portable export/restore remains unavailable.

Install with Node 26.8.1 and `pnpm install --frozen-lockfile`. `pnpm dev` migrates
and serves `.wrangler/vector-dev` at http://127.0.0.1:15928. `pnpm build` creates
the emitted artifact. `pnpm verify` executes the documented local verification.
Wrangler and Chromium need local listener permissions. The pinned test plugin's
Miniflare override matches Wrangler 4.129.1's 5.20260907.0-alpha runtime; it avoids
changing production compatibility to suit an older test binary.

`pnpm verify` runs Node, safe Markdown and Worker suites, typecheck/build, then the emitted
Worker/Chromium journey on 15924–15925 with fresh `.wrangler/vector-e2e/runs`
state for each run and a restart within that same state and the clause reporter. Its check journal
and registered baseline matrix are retained under `.artifacts/verification`.
Run `pnpm test:dev` separately while `pnpm dev` serves 15928; this captures the
development scripts/styles and verifies hydration, native sessions, navigation
and responsive layout. The production build never admits development modules.
The development asset predicate lists observed module paths exactly; dependency
or client-module changes must refresh that reviewed list from the browser capture.

For review, after building:

```sh
pnpm exec wrangler d1 migrations apply vector-local --local --config wrangler.jsonc --persist-to .wrangler/vector-review
pnpm review:serve
pnpm review:signin sarah@vector.test
```

The last command prints a local single-use link valid for 15 minutes. Operators
Sarah, Maya and Alex are synthetic `@vector.test` records. `LOCAL_OPERATOR_ID`
and `x-vector-operator-id` grant no access. The local-outbox adapter is admitted
only for loopback/test origins and never returns a link in the public HTTP response.
Production installation requires the maintained Base auth/mail environment contract in DEPLOY.md. Local-outbox review does not prove hosted email delivery.

The application uses APP_ORIGIN from the local Wrangler config. Vite's serve-only
customizer chooses 15928; `VECTOR_DEV_ORIGIN` can explicitly select another local
origin when the developer also changes Vite's port. Build does not use this
customizer. Review and e2e pass their explicit origin to the emitted runtime.
Vite preview uses the built origin on port 15920 and must not race review:serve.

Preserve 0001/0002 unchanged. Apply 0003 native access, 0004 comments/files/audit,
0005 file-state expansion, 0006 named links, and 0007 durable file-removal intents
in order. Existing file rows remain ready. New uploads reserve metadata/quota before
R2 and retain incomplete/failed states. Removal records its intent before storage
work; downloads immediately deny that file. Only a settled writer and confirmed
blob absence allow a tombstone, identifying-metadata erasure and one audit record.
A pending removal returns 202 and remains visible; use Retry removal on the same
file. Storage/metadata failures return 503 and retain retryable intent. The genuine
Worker scheduled handler sweeps at most 50 intents per minute; local Wrangler
`--test-scheduled` verification invokes it through the installed runtime
`/cdn-cgi/local/scheduled` trigger without contacting providers. That local runtime
surface is not a product endpoint and production requests do not admit it.

A successful PUT receipt, or an exact immutable-key/size/checksum object receipt,
settles a writer. No-object absence or age alone cannot fence an in-flight upload.
A crash before PUT or ambiguous failed PUT without a stored receipt therefore
retains visible pending cleanup and quota; this version does not claim bounded
physical-erasure time for that case or complete baseline/provider acceptance. Old
tombstones are reconciled without rewriting their timestamps or duplicate history.
Named links are never fetched by the server; deleting their comment erases their
content in the same D1 transaction. Remote Markdown images require an explicit
per-URL load action and send no referrer. Back up D1/R2 before changing
a deployed installation; full portable restore remains an unmet release obligation.
The local build alone is not hosted acceptance; DEPLOY.md describes the separate reviewed disposable deployment proof.


### Local operator intake and deferral return

Apply migrations0008 and0009 after the immutable earlier history. Native
`POST /api/intake` commits an Intake issue, attributed evidence and creation
activity together; optional summary/observed time default to title/receipt time.
Only the native session supplies actor identity. Evidence contains submitted
measurements and customer reports; core invents no source/policy assertions.
Failure returns503 without a partial issue/evidence/activity batch; an already
allocated identifier stays consumed. An ambiguous response can require checking
Current before retrying; operator creation does not claim source idempotency.

`POST /api/issues/:identifier/return` ends a deferral with the last-read version.
The real scheduled export and native Current read run bounded due-return work
(max50 per pass), using actual server time for real reads. Its atomic CAS clears
the deferral, increments version and records `Deferral return automation` once,
keeping prior decisions. An as-of Current query never changes scheduling time.
Current exposes only durably cleared Intake. D1 failures propagate and cannot
acknowledge a successful scheduled return. Local event/browser verification
does not establish provider Cron delivery, five-minute capacity or new-source
evidence return, which remain full contract obligations.

`node tests/e2e/intake-api-runtime.mjs` checks native HTTP/Cron/restart behavior with isolated local state, without launching a browser. Full verification and development checks also exercise the browser journeys.

## Local first-owner foundation

`pnpm build && pnpm test:foundation` runs a separate empty-installation journey
on loopback 41866, using synthetic installation inputs and the native local
outbox. It checks owner/team/seven-category bootstrap, timezone save, last-owner
removal guard, responsive Settings at 1440 and 390 and persistence after restart.
It owns and closes its Worker and browser. Its default local receipts are under
`.wrangler/foundation-evidence`; `VECTOR_FOUNDATION_EVIDENCE` selects another
local output directory. This is separate from a deployed smoke or real email.

See [the installation guide](docs/FOUNDATION-STAGE.md) for bootstrap inputs, prior-installation owner mapping and operator lifecycle. Preserve all applied migrations.

`pnpm sources:check` verifies the effective source lock. Stage intentional source edits, run `pnpm sources:lock`, then commit the generated lock. Fresh reports are written to ignored output directories and never rewrite tracked source.

## Disposable setup and deployment

See [DEPLOY.md](DEPLOY.md) for credential-free artifact preparation, the reviewed
controller plan, exact D1/R2 names, SendGrid/session bindings, repeated no-write
deployment and independent health. `pnpm run setup` performs the first complete
provision/migrate/upload/health operation and `pnpm run deploy` repeats reconciliation.
The existing local Wrangler config remains local. Provider credentials and mail
keys belong only in the trusted controller job; never in the build checkout.
