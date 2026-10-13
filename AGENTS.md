# Working on Vector

## Run it locally

Use Node 22.20.0 and pnpm 10.12.4. From this checkout:

```sh
pnpm exec rer install
pnpm exec rer setup --owner-email owner@example.test --non-interactive
pnpm exec rer dev
```

Dev prints its health-ready URL. `rer dev` opens signed in: it prints `RER_SIGNED_IN` (the owner) and `RER_OPEN`, a link that carries this checkout's private dev key in its fragment. Open `RER_OPEN` in a browser on this computer and you land signed in as the owner; a small dev badge switches to the `teammate` persona (a second operator in the same workspace; Vector has no product roles) or signs out. The first switch in a fresh checkout answers `step_up_required`: Base creates an owner-role persona only after the owner's fresh sign-in, so sign out from the badge, sign in at `/signin` as the owner and follow the newest outbox link once; later switches need nothing. Never share the link: the key is what keeps the outbox and dev sign-in closed to anything that reaches this port through a proxy or tunnel, and `reset` removes the key so every earlier browser session stops working. `--as teammate` (or `--as signed-out`) starts as another persona, and `--login` turns dev identity off so dev prints `RER_SIGN_IN` and a key-carrying `RER_OPEN` for the outbox instead: choose the newest message and follow its one-use link (no email is sent). Previews open the outbox the same way. `RER_OPEN` is for people at this terminal; scripts use `rer dev --json` or the key header. API tokens minted in a dev session are recorded as dev-minted and work only on a request that holds the key; mint them with `dev --login` for a client outside this checkout. Finish your first workspace review at `/setup` before entering the app. Stop development before resetting or restoring. Use `pnpm exec rer verify` for full verification, `pnpm exec rer reset --yes` for a confirmed local reset, and `pnpm exec rer export --output exports/vector.jsonl` / `pnpm exec rer import --input exports/vector.jsonl --yes` for local archives. Deploy only when requested with `pnpm exec rer deploy --environment production`. `pnpm exec rer describe` lists the remaining commands.

## Product and ownership

Vector is a self-hosted issue tracker. Read README.md, CONTRACT.md, BASELINE.md, HANDOVER.md and the actual package scripts. TanStack Start and Hono share one Cloudflare Worker, D1 records and private R2 files. Every private route and generated server function independently checks its session, Origin and ownership. Keep server secrets out of browser modules and evidence.

Keep files small, remove dead code and preserve owner customizations. No application mocks, silent failures or semantic fallbacks. Synthetic fixtures belong in tests. Recorded Base selections remain exact at the declared pin; product adapters are explicitly identified.

## Verification and recovery

Test the owner-visible flows you changed through public doors, plus typecheck. Keep the suite small. No pin tests or tests of copy, hashes, versions, lists or wording. Prove one-off corrections in external evidence. Delete obsolete tests and report them; never weaken assertions to hide a failure. CI runs the full verification wall and the real README/development/slow-installer journeys.

Stage changes before `pnpm sources:lock`, then run `pnpm sources:check`. Preserve applied migrations and data; upgrades are forward-only. Validate matching source and D1/R2 backups in isolated resources before changing traffic. Keep terminal delivery ledgers and additive schema on compatible-source rollback.

Use rer for setup, development, build, verification, reset and data movement. Source artifact preparation and its reviewed deployment controller have a separate credential boundary described in DEPLOY.md. Local proof establishes neither hosted provider delivery nor commissioning. Do not publish, tag or deploy without explicit owner instruction. Stop every server, browser and watcher you start. Never upload settings, runtime databases, outbox bodies, cookies or credentials as evidence.

Managed source uses the vendored Base delivery producer and the declared setup manifest/digest. Its pinned workflow is manual. Signed native owner claim refuses a second claim; editor configuration belongs to the recorded installation owner and uses the configured frame-ancestors policy. Apply 0024 additively and retain claim ledgers. See docs/MANAGED-SOURCE.md; hosted installation and accounts remain owner work.

Mapped CSV/JSON issue imports and the Linear importer (documented CSV format and owner-made API file, tested at 2,000 issues with a generator) use the reviewed native Base import-kit path in Settings and the terminal. Review mapping, errors and omissions, then apply a run of up to 4,000 rows in staged batches; durable IDs support status, repeat, resume, a reconciliation report and whole-run rollback. See docs/MOVE-IN.md and docs/IMPORT-EVIDENCE.md. Local and authenticated HTTP archives use Base portability. HTTP restore requires the 0034 pristine-bootstrap admission and real coordinator binding; ordinary owner sign-in precedes setup or edits, and fresh historical-owner sign-in follows commit. Stopped, confirmed local restore into empty resources remains supported; hosted HTTPS acceptance is separate. See docs/ARCHIVES.md. Replacements remain empty; no owner export or hosted acceptance is claimed.

Scoped API tokens use native Base authority and existing issue/comment mutations. Signed source ingest commits issue/evidence/replay together; signed GitHub pull-request events persist links without a provider token or API call. Outbound webhooks retain accepted, rejected and uncertain states with finite retries and require an enforcing INTEGRATION_EGRESS service binding. Source adoption does not provision hosted egress. Restore excludes credentials and quarantines historical effects; re-enter secrets and review future effects. See docs/API.md and docs/INTEGRATIONS.md. Apply 0027/0028 additively and retain every replay and terminal-delivery ledger.

Vector owns its fonts: `public/fonts/fonts.css`, linked by `src/core/app/fonts.ts` from the root head, holds the app's system stack and the public site's self-hosted brand faces (Instrument Sans and IBM Plex Mono, OFL, in `public/fonts/brand/` with their licences); native auth documents keep their own system stack. The public site's brand tokens are defined once in `src/core/app/site/brand/` and documented in docs/BRAND.md. Both are outside Base's copy records, so a Base refresh must not bring back Base's Outfit default or its `public/fonts` copy.
