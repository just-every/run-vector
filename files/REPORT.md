# sd-vector-c-f203 results

Repository: just-every/run-vector. Branch: cloud/sd-vector-c-f203.
Candidate: 5fd3e3aa1131abe2a3b003f2c29c47f3d148b9df. Base main: 0e8a686c06eddd55943ed1d2690df32a8fc82213.
Product save: 6d2447f18e2159b9e6500af813cd757f6cd89bc4.
PR: none required; push Verify accepts the named cloud branch.

DESIGN-001 is claimed PARTIAL. The contract source and every Status, Gap and
Evidence cell remain byte-identical to main. Stored status remains MISSING for
the lander to judge. Counts before and after are 136 DONE, 72 PARTIAL, 64 MISSING,
272 total; no count promotion is claimed. The campaign row requiring update is
DESIGN-001 only: native protocol proved, selected interface still outstanding.
All other campaign rows and supplied holds remain unchanged. PLAN.md records
the full work plan and its disposition.

The native backend now provides Owner and Admin app registration, actor- and
session-bound one-use OAuth, sealed member grants with expiry and explicit
reconnection, explicit-load isolated frame metadata and bounded same-origin PNG
images, generated installation-specific manifests and atomic personal-token issue
capture. Captures retain a named Figma backlink, activity, audit and a durable
receipt. Replays return the existing issue, including after an independent HTTP
archive restore; a deleted issue cannot be resurrected. OAuth consent credentials
are refused at the plugin endpoint. Figma sandbox CORS admits only its known
origins and this installation, with an explicit bearer and no credentialed CORS.

## Acceptance and selected setup proof

All rows below run through the real mounted API in tests/worker/link-cascade.test.ts
under the test named “Figma member connections isolate frame previews and personal-token captures survive replay and credential-free restore”. Its helpers are actual network-edge fixture journeys,
not application substitutes. Push Verify reaches the existing Worker glob and
six existing partitions. Exact-candidate Verify event and conclusion are recorded
in checks.json; local proof alone is not claimed as green Verify.

| Item | Source and observed result | Disposition |
| --- | --- | --- |
| INTEG-001 selected Figma setup | tests/worker/figma-journey.ts:247 registers Owner and Admin with client ID and secret only, rejects Member 403 with unchanged domain and vault storage; generated callback and scope are checked | Native PASS; rendered Settings setup remains owed |
| DESIGN-001 acceptance group 1: OAuth and connected versus unconnected frame preview | tests/worker/figma-journey.ts:193 and :299 exchange a real authorization-code form at the fixed Figma token endpoint; state binds actor, session and app; replay, wrong actor, wrong session and expired state refuse without provider calls; frame title, timestamp and PNG return for the connected member; unconnected member causes no provider request | Native PASS; issue rendering is not implemented, so point 1 is not claimed closed |
| DESIGN-001 acceptance group 2: generated manifest | tests/worker/figma-journey.ts:278 downloads the manifest and checks its only allowed domain equals the runtime installation origin | PASS, point 2 |
| DESIGN-001 acceptance group 3: plugin capture | tests/worker/figma-journey.ts:514 exercises opaque-origin CORS and personal-token intake, one native issue and named backlink, identical replay, changed capture, concurrent replay and deletion retirement | PASS, point 3 |
| Current member authority and provider boundary | tests/worker/figma-journey.ts:333, :338, :353, :389 and :427 prove distinct member bearers, visible provider errors, oversized and invalid PNG refusals, no foreign or redirected host, disconnect during image delivery, current private-team withdrawal, Guest and Viewer connection refusal and link-only response | PASS |
| Scoped capture authority and unchanged refusal | tests/worker/figma-journey.ts:579 proves changed capture, insufficient scope, revoked credential, hidden private team, Viewer refusal, invited Guest write and other-team refusal, and explicit rejection of a real API-004 consent token; snapshots include issues, links, activity, capture/configuration rows and the vault and compare hashes | PASS |
| Removed person and app rotation | tests/worker/figma-journey.ts:708 removes the connecting actor at the token edge and checks refusal and no retained grant; :723 rotates the app and proves pending state and old previews are inert without provider calls | PASS within the native removal door; broader SEC-003 erasure remains held |
| Credential exclusion and restore re-entry | tests/worker/figma-archive.ts:18 downloads an actual HTTP archive, excludes all Figma secrets and ciphertext, commits into an independent target, retains capture receipts, requires app re-entry and fresh member OAuth; :108 reissues a fresh personal token and replays an archived capture with no new issue | PASS |
| Populated upgrade | tests/worker/project-fields-upgrade.test.ts crosses the populated 0133 previous schema, preserves existing identities, releases, credentials, sessions and content, creates empty Figma tables and exports the upgraded inventory | PASS |
| ROLE-008 door coverage | tests/worker/role-matrix.test.ts retains the existing registered Settings sweep and Viewer census; tests/worker/role-viewer-census.ts:200 and :288 supply the new management, personal connection, callback and scoped capture doors | PASS |
| Selected interface implementation and browser proof | Settings app controls, personal connection controls, issue frame component and integration-runtime.mjs helper are not implemented | NOT RUN; supplied Claude Opus executor is unavailable in this session |

## DONE riders

| Row | Result and evidence |
| --- | --- |
| 1 | PARTIAL: native acceptance groups 2 and 3 pass in the named journey; group 1 has no rendered frame or selected Settings UI proof |
| 2 | PASS for implemented native behavior: populated data, supported results and dangerous refusals with unchanged storage; same named Worker journey |
| 3 | PENDING exact-SHA push Verify; normal Worker glob includes the journey; no browser proof is claimed |
| 4 | PASS for local receipt binding: source and test bytes were committed before the final Node 22.20.0 touched run; final lock check is on this SHA |
| 5 | INSPECTED: acceptance text is unchanged; setup follows the clause's existing INTEG-001 table reference; no new inherited-duty completion is claimed |
| 6 | MECHANICAL PASS: touched-clause generator write and check pass; generated views restored whole from main; Status and counts remain lander-owned |
| 7 | PASS: no acceptance text, coverage map or Status row changed |
| 8 | PASS for native doors: Owner/Admin registration, Member refusal, current personal identity, Guest/Viewer behavior, scope and revocation, private-team withdrawal and unchanged refused storage |
| 9 | HELD: no real Figma app registration, hosted commissioning, private organization plugin publication or real-account plugin operation is claimed |
| 10 | INSPECTED: existing integrations.manage, identity.personal and issues.write rows decide authority; personal tokens and fixed provider boundaries follow the supplied brief; no DONE policy claim |
| 11 | PENDING guarded lander: main does not equal the candidate; candidate scan and Run site are not cloud receipts |

## Pre-READY check and custody

The named fixture and native journeys cover the implemented backend behavior.
No existing assertion was removed, narrowed, skipped or moved behind a width
condition. One Figma registration was added; no test was deleted. The source
registration lexical census was 172; this is not substituted for a semantic gate
budget. Session removal, scoped revocation, retired capture and current private
access are exercised both ways. No screen was changed, so text size, icon tooltips,
keyboard, overflow, accessibility and hydration proof for the selected new screens
remain unqualified. Existing Loom and YouTube assertions are preserved and pass.

Contract views: node scripts/contract-docs.mjs write DESIGN-001, then check
DESIGN-001, both exit 0; restored ACCEPTANCE.md and docs/CLAIMS.md from origin/main.
Lock: pnpm sources:lock and pnpm sources:check exit 0. Structural check:
pnpm exec rer check --profile first-party exits 0. Migration ledger:
node --test scripts/deployment/tests/migration-head.test.mjs exits 0.
Production build: cloud_run npx -y @runeditrun/rer build exits 0.
The final receipts use Node 22.20.0 and pnpm 10.12.4. Early development checks used
the VM's newer Node; the final pinned touched run supersedes them.

Main base Verify 42503991437 and Run site 42503991458 are successful at 0e8a686c06eddd55943ed1d2690df32a8fc82213;
those results are not candidate CI. Candidate CI and push provenance are recorded
in checks.json. No PR was opened. No workflow was edited, rerun or dispatched.

Publication scan: commit=5fd3e3aa1131abe2a3b003f2c29c47f3d148b9df; complete=NOT_RUN;
historyScanned=NOT_RUN; findings=NOT_ESTABLISHED. The cloud branch push does not
run the fleet publication scanner; the maintained Mac lander owns that scan,
exact-SHA green Verify, guarded landing and Run site. Nothing here claims a
COMPLETE scan, acceptance, landing or hosted provider commissioning.

CLAIM DESIGN-001 PARTIAL points=2,3 tests=tests/worker/link-cascade.test.ts#Figma member connections isolate frame previews and personal-token captures survive replay and credential-free restore
GAP DESIGN-001: Selected Settings setup, personal connection controls, rendered issue frame and 1440 and 390 browser qualification still require the supplied Claude Opus executor; it is unavailable here. Document and prototype previews, real-account comment/plugin operation, private organization publication, hosted commissioning, SEC-003 preview-cache erasure and remaining INTEG-001 provider acceptance remain held.

PROBE DESIGN-001 setup: native app Settings POST with only client ID and secret -> Owner and Admin 200, Member 403, unchanged refused storage.
PROBE DESIGN-001 1: native connect and callback plus explicit issue preview -> bound one-use code exchange, isolated frame metadata and PNG, unconnected null preview with zero provider requests; rendered UI not claimed.
PROBE DESIGN-001 2: authenticated manifest GET -> exactly the installation origin in allowedDomains.
PROBE DESIGN-001 3: personal bearer capture POST -> one issue and backlink, replay 200 with original identifier, unsafe requests refused unchanged, concurrent replay yields 201 and 200.
PROBE DESIGN-001 restore: HTTP archive export and independent finalize -> no credentials, app re-entry required, fresh token replays retained capture without another issue.
MECHANICAL lock=pnpm sources:lock and pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write DESIGN-001 and check DESIGN-001 exit=0; ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0.

## Terminal product receipt

Product PUSH_OK branch=cloud/sd-vector-c-f203 head=5fd3e3aa1131abe2a3b003f2c29c47f3d148b9df; first attempt, no force push.
Final pinned touched run: 3 files, 9 tests passed, exit 0.
CI Verify run=42510175033 event=push status=in_progress conclusion=None head=5fd3e3aa1131abe2a3b003f2c29c47f3d148b9df https://github.com/just-every/run-vector/actions/runs/42510175033
GitHub API calls: 2, including exact-base and exact-candidate discovery. No short polling or duplicate dispatch.
Candidate main equality: false; main remains 0e8a686c06eddd55943ed1d2690df32a8fc82213. Branch stays with the fleet for guarded landing.
No product test failure or push blocker remains. Selected interface dependency and all supplied holds remain named above.
