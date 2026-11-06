# sd-vector-c-f192 — ROLE-006

Product branch: `cloud/sd-vector-c-f192`  
Candidate: `123353741b39efe08ff471d7ae04c90c353c9154`  
Repository: just-every/run-vector  
PR: none; the existing push entry point starts Verify for this branch.

ROLE-006 moves **MISSING → PARTIAL**. Counts move **136 DONE, 69 PARTIAL, 67 MISSING → 136 DONE, 70 PARTIAL, 66 MISSING**. All 272 parent Status rows remain in every candidate commit. Only the ROLE-006 campaign row changes. The complete executed build plan is in PLAN.md.

## Result

A native Owner or Admin installs one genuine named non-person agent under Settings → Developers. It receives a distinct, show-once credential stored only as a hash in an excluded installation table. Installation explicitly selects one visible team, issue reads and optional title writes. Personal grants do not acquire those scopes. The app has no person or authentication-operator record and its credential cannot create a browser session or administer itself.

Admission explicitly recognizes the app credential at the versioned issue API. Only an individual issue read or a title edit is admitted. A title edit uses the existing version-checked native mutation. Its transaction rechecks the current actor state, credential, installer, role, workspace, scope, selected team and current private visibility before and after the writes. A native Admin pause that wins before commit refuses the entire edit; a stop injected after activity insertion rolls back the activity, audit and title together. Native management also fences its current native session and role inside its transaction.

Issue activity saves the app's own ID and name and the installer ID and saved name, with no human actor link. Workspace audit saves the same safe attribution independently of the issue activity's lifetime. Human edits stay human. Pause and terminal revocation retain history. Existing native installer erasure removes remaining credentials and saved installer names while retaining the app's safe identity. Current erased-installer calls and stale captures cannot restore authority. Full ROLE-011 and ROLE-012 lifecycle obligations remain held.

Native archives retain the safe identity and attribution and exclude the credential table's data. Restored identities have no usable credential, even if their saved state was active. Native historical reads preserve the agent label and installer; old calls are refused. Populated upgrade proof retains every prior row and column.

The added nullable fields exposed two existing-schema integration requirements during local proof: intake INSERT selection must include every Drizzle field, and deletion postconditions must include the new null fields. The growing deletion snapshot also exceeded D1's SQL statement byte limit. Its initial read now uses the same bounded full-relation queries as its existing commit checks, in one D1 transaction. No preimage, cardinality or postcondition assertion was removed. Existing custody and import regressions pass.

## Selected POINTS and public-door proof

| Rubric | Selected outcome | Proof and observed result |
|---|---|---|
| R1 | Install named non-person identity with explicit read and title authority and accountable installer | `tests/worker/app-actor-journey.ts` appActorJourney, lines 10–37; mounted native installation returns a distinct credential, secret-free inventory and own app activity with null human author; read-only authority refuses a write. `tests/e2e/integrations/app-actors.mjs` exerciseAppActors, lines 17–27, installs through rendered controls and closes the one-time secret. |
| R2 | Native version-checked title mutation with own activity and workspace audit | appActorJourney, lines 23–43 and 126–130; permitted edit persists, stale replay changes nothing, agent attribution survives a later human edit. exerciseAppActors, lines 28–39, reads activity after reload and opens the native audit screen. |
| R3 | Immediate native Owner or Admin pause and revoke, next-call refusal and in-flight commit fence | appActorJourney, lines 77–118; native session and role races refuse installation unchanged, a real Admin pause wins before edit commit, a post-activity stop rolls back all domain effects, and revoked calls and replay are refused after restart. exerciseAppActors, lines 40–56, uses an Admin's native keyboard and click controls and verifies refused read and write calls. |
| R4 | Preserve current scope, person and team visibility, foreign, session and role boundaries | appActorJourney, lines 38–98; unselected operations and fields, another team, a foreign workspace fixture, private membership withdrawal, Viewer and Guest authority, missing and ended sessions, foreign origin and personal-token management are refused without product changes. `tests/worker/role-viewer-census.ts` prepares valid installation and pause fixtures for the complete Viewer census. |
| R5 | Restart, retained history, installer erasure, upgrade and archive custody | appActorJourney, lines 112–130; attributed history remains after stops and erasure, another identity remains usable until its installer is erased. `tests/worker/app-actor-archive.ts` seedAppActorArchive and restoredAppActorArchive, lines 9–36, use actual native HTTP export and pristine restore. `tests/worker/viewer-role-upgrade.ts` crosses the populated previous schema while retaining every old column. |
| R6 | Actual native management and readback at desktop and phone widths | exerciseAppActors and the eight PNGs under `browser/roles/`; installation, attributed issue, workspace audit and Admin-revoked management are each shown at 1440 and 390. Acceptance assertions execute at 1440. The existing roleScreens proof also checks overflow and serious or critical accessibility findings. Keyboard labels, focus, reload and page-error checks pass. |

These helpers are invoked by existing Worker registrations and the existing integration runtime. Push Verify loads them through those existing commands. No workflow was edited and no registration was added. No existing user-visible assertion was removed, narrowed, skipped or moved behind a viewport condition. The extra local focused commands do not change which tests Verify runs.

PROBE ROLE-006 install: native Settings form with one selected team and title-write consent -> own agent identity and show-once credential, with no secret in inventory or reloaded page.
PROBE ROLE-006 mutation: app credential reads and edits an individual issue at its current version -> persisted title, own name and installer in native activity and workspace audit; stale version and extra fields refused unchanged.
PROBE ROLE-006 authority: read-only, other-team, foreign-workspace, private withdrawal, Viewer, Guest, foreign origin, personal token and absent or ended session inputs -> refusal without domain changes.
PROBE ROLE-006 stop: native Admin pause before commit and post-activity stop inside the edit -> no title, activity or audit publication; native pause and revoke -> next read and write refused after restart.
PROBE ROLE-006 history: revoke, erase installer and then human title edit -> safe app attribution retained, installer name redacted, human edit remains distinct and old credential refused.
PROBE ROLE-006 archive: actual HTTP export and pristine restore -> safe identity, attribution and audit retained; credential rows absent and all historical app calls refused.
PROBE ROLE-006 screens: installed agent, attributed issue, audit and Admin revocation -> usable native controls and retained readback at 1440 and 390, with keyboard, accessibility, overflow and hydration checks.

## Held requirements and scope

The full clause is not DONE. Broader integration, automation and coding-agent actors and other mutations, third-party OAuth actors, AGENT-006 delegation, session and callback transports remain unqualified. Independent interface qualification remains outstanding. No provider account, provider API call, hosted commissioning or external transport is claimed.

The conservative standing scope policy uses the existing native Owner and Admin management cells, current installer authority as a ceiling, explicit single-team grants and terminal revocation. It adds no automatic outbound action. Existing personal-token boundaries, Base Owner-only Business management and Admin refusals, API-004 consent and UI qualification, AGENT-005, AGENT-006, CONNECT-001, ROLE-011, ROLE-012 and Base approval custody remain intact. Neither acceptance wording nor a ct ruling was changed.

## DONE-RIDERS assessment

No DONE claim or judge request is made.

| Row | Assessment on this candidate |
|---|---|
| 1 | PASS for selected native outcomes through the R1–R6 journeys; FAIL for a full-clause DONE because broader actor families remain unqualified. |
| 2 | PASS: real seeded allowed mutations and attempted unsafe paths, with unchanged domain snapshots on refusal. |
| 3 | Exact-SHA push Verify 42142856859 is the recorded entry point; final observation is recorded in CI.json and the closing note below. Full clause coverage is not claimed. |
| 4 | Exact candidate browser receipt names this full SHA. Worker receipt also names it. The native HTTP archive receipt also names this full SHA. Earlier custody and migration receipts ran on unchanged relevant source; the candidate's Verify runs their existing registrations. |
| 5 | PASS for this slice: ROLE-006's own acceptance names explicit scopes, own identity, installer attribution and Admin revocation. Existing Base duties and held receiving clauses are preserved. |
| 6 | PASS for honest PARTIAL Gap and evidence. Touched generator write and check pass locally; generated views are restored from main and intentionally uncommitted. Summary counts are generated and the lock is fresh. |
| 7 | PASS: acceptance sentences unchanged; no rewrite, split, duplicate rider or new acceptance point. |
| 8 | PASS: Owner and Admin management succeeds, weaker or wrong authority is attempted and refused unchanged, including a commit race. |
| 9 | PASS: no live provider or legal boundary claimed; native and fixture qualification is stated precisely. |
| 10 | PASS for honest PARTIAL: the supplied standing conservative scope policy is named in the Gap; it is not counted as ct approval for DONE. |
| 11 | PENDING fleet custody: full-history publication scan, guarded landing, exact landed main equality and candidate Run site are not cloud claims. Baseline main Verify 42137975274 and Run site 42137975260 were successful at e6010126cf33eeb7e70368b741bf89ba9dae2672. |

## Validation and custody

The branch has two fleet-authored commits, no trailers, no rewritten published history and no main push. Parent Status rows are checked for each commit and each parent. No PR is required. Main was fetched immediately before the candidate push; merging origin main was already up to date. Product HEAD and index remain separate from evidence publication.

Local checks: production build with typecheck, first-party contract check, source-lock generation and check, touched contract generator write and check, deployment migration ledger, mounted integration authority and app lifecycle, Base native agent attribution, complete role coverage, populated upgrade, actual native HTTP archive round-trip, deletion preimage and parent custody, import atomicity, and browser proof. The final exact-SHA Worker command and its result are in worker-receipt.json. Actual logs and command receipts are selected explicitly in this packet. The provided cloud toolchain selected Node 24.19.0 and pnpm 10.12.4 locally; the existing CI workflow uses the repository's Node 22.20.0 pin.

MECHANICAL lock=pnpm sources:lock and pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write ROLE-006 and node scripts/contract-docs.mjs check ROLE-006 exit=0, generated views restored from origin main; ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0.

The cloud-side publication scan is not required for branch publication and was not run. The fleet must run its complete full-history scan and guarded landing checks. Evidence publication is report transport only and establishes no product acceptance or landing.

Exact candidate local result: **14 Worker tests passed across five suites**, **one native HTTP archive test passed**, and **exerciseAppActors browser proof passed with all eight captures at 1440 and 390**. First-party check and source-lock check pass on this same committed head.

## Terminal observation

Verify [42142856859](https://github.com/just-every/run-vector/actions/runs/42142856859), event push, was last observed **in_progress**, with no conclusion, at 2026-11-06T01:28:54.595338+00:00 on this exact head. The cloud wait is bounded; product custody is **PUSHED**, with local checks passing. Exact-SHA workflow completion and the fleet publication and landing gates remain outstanding. The selected native flow has no unresolved local test failure. Broader actor coverage and independent interface qualification remain in the PARTIAL Gap.
