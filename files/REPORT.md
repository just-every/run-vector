# sd-vector-c-f186 results

BASE-AGENT-010 moves from MISSING to PARTIAL. The selected native title-event work is implemented and locally proved. No DONE claim is made.

Repository: just-every/run-vector. Branch: cloud/sd-vector-c-f186.
Candidate: b318a69487e0a533729276b95f9c1b7edecf2198.
Base: 7c811313e446ae19630f387f2ac927dafba3dbe5.
Save: 4e65b7969d1dd91e72357a4a2e45efd84e863a52, pushed with CI skipped.
No PR is required: this repository runs branch-push Verify directly.
Counts change from 136 DONE, 69 PARTIAL, 67 MISSING to 136 DONE, 70 PARTIAL, 66 MISSING. All 272 parent Status IDs remain in every candidate commit. The sole plan row changed is BASE-AGENT-010; no campaign was rebuilt.

## Implementation and selected outcomes

The native title planner inserts a minimal typed event before its version-changing statement, inside the existing guarded D1 batch. Its identity and time match the native activity. The payload contains exactly the stable ID, issue.updated type, issue resource URI, trusted human or agent-for-person actor and time. It carries no title or description. No-op and stale edits produce no event. Failure to store the event aborts the title, activity and related effects.

The current pinned Base event capability, retained table and events.list tool are enabled. New read credentials explicitly need events:read and evidence:read; existing grants widen by no automatic migration. Base reuses current issue-resource admission at delivery. No vendor source, pin, identity issuer, subscription transport, acceptance point, applied migration or archive policy changed. The existing event table remains excluded from archives.

The focused Worker journey crosses Settings issuance, the mounted native HTTP mutation and mounted MCP. It covers human and agent attribution under autonomous and standard-review policy, cursor pagination and replay in fresh runtime instances, no-op and stale writes, Guest refusal, native and agent rollback on event persistence failure, missing and narrowed scopes, read-only grant write refusal, current private-team withdrawal, Pause, revoked credentials, deletion and refused replay without storage changes.

The browser journey uses the rendered Settings token form and title editor, followed by mounted MCP edits under both policies. It restarts the actual emitted Worker against the same persisted installation and replays one-item pages from the same cursor. All IDs and ordering are identical. Native history remains correctly attributed after reload. The 1440 and 390 captures passed accessibility and overflow inspection. The screenshots were visually inspected and contain synthetic work only.

## Frozen selected rubric and proof map

- R1: One minimal, trusted and stable event for each real title mutation. MET by ./tests/worker/agent-events.test.ts, journey at line 12, human assertions at lines 48–60 and agent assertions at lines 62–84; native transaction integration is ./src/core/features/issue-edit/plan.ts at line 352 and ./src/core/features/agent-door/title-event.ts at lines 18–27.
- R2: Same cursor returns the same IDs in order through paginated mounted MCP, including restart. MET by ./tests/worker/agent-events.test.ts at lines 85–92 and ./tests/e2e/core-agent-events.mjs at lines 62–81. The browser receipt contains the actual three event IDs.
- R3: Current access withdrawal withholds record events; no read credential grants mutation authority. MET by ./tests/worker/agent-events.test.ts at lines 105–149, including narrowed scopes, private-team removal, Pause and revocation.
- R4: No-op, stale, refused and failed persistence leave no false event or partial mutation. MET by ./tests/worker/agent-events.test.ts at lines 56–60, 76–83, 93–104 and 127–158.
- R5: Existing policies, native attribution, replay, custody, vendor sources and archive boundaries remain intact. MET locally by the three touched Worker journeys, unchanged vendor and migration trees, and the browser history assertions. Full existing Verify remains the independent CI wall.

The browser helper is reached by the existing push Verify planning runtime at ./tests/e2e/core-runtime.mjs lines 757–759; its focused local partition is at lines 718–720. Worker discovery uses the existing test glob. One focused Worker registration was added, with a helper inside an existing browser runtime. No existing assertion was removed, narrowed, moved behind a width condition or skipped. No test deletion was needed.

## Runtime probes

PROBE BASE-AGENT-010 3: Settings-issued credentials, native and MCP title edits, then events.list with a one-item limit -> three distinct minimal event IDs, identical ordered replay from the same cursor after a real Worker restart.
PROBE BASE-AGENT-010 4: private-team membership withdrawal, narrowed read scope, Pause and credential revocation through their native doors -> empty event projection, insufficient_scope, agents_paused or HTTP 401 as applicable; refused storage unchanged.
PROBE BASE-AGENT-010 atomicity: fail event INSERT in the actual D1 transaction, then attempt native and MCP title edits -> HTTP 500 or execution_failed, unchanged issue, activity, followers, notifications and events.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs check exit=0; views=node scripts/contract-docs.mjs write BASE-AGENT-010 and node scripts/contract-docs.mjs check BASE-AGENT-010 exit=0; ledger=none exit=0.

## Verification and provenance

Three touched Worker files and three journeys pass on b318a69487e0a533729276b95f9c1b7edecf2198. Typecheck, first-party check and edition-lock freshness pass on that exact SHA. The contract generator write and check pass; its two generated views were restored from main and are absent from both product commits. The lock was generated after staging all final source, test and doc edits.

The browser and build ran on save 4e65b7969d1dd91e72357a4a2e45efd84e863a52. No byte of the relevant runtime or browser source changed afterward; browser-provenance.json records the comparison and SHA-256 values. The candidate adds only grant-admission assertions, product documentation and the finalized partial Gap.

Main at the initial read has successful Verify 42014502098 and Run site 42014502043. Candidate push Verify 42124501904 was discovered on the exact candidate SHA with event push and status in_progress. See ci-receipt.json for the latest observed status. No dispatch, rerun or PR was created. GitHub API calls used so far: two, including the baseline read. No CI failure or repair round has occurred.

The candidate branch was pushed successfully on its first guarded attempt and its remote full SHA was verified. Every author and committer is the fleet identity; no co-author trailers are present. No generated acceptance view, evidence packet, credential, environment dump or private gate material is in the product commits. Added lines contain no email-shaped fixture values. Existing fixture addresses in the reused runtime file were preserved.

## DONE-RIDERS and held work

1. NOT MET for the full clause: selected outcomes pass locally; the explicitly held channels and producers remain unproved. No DONE claimed.
2. MET for the selected work: real populated public-door assertions cover allowed behavior and unchanged-storage refusals, including dangerous transaction failure.
3. PENDING independent exact-SHA Verify. Both journeys are registered in existing push paths.
4. MET locally: exact-head Worker checks and unchanged relevant browser bytes are recorded.
5. UNCHANGED: no receiving-clause inheritance or new acceptance obligation was introduced.
6. MET for this partial update: the Gap names every held category, Evidence resolves, source generation checks pass and all rows are retained. Generated view and global judgment provenance belong to the lander; no fresh ct judgment is claimed.
7. MET: acceptance sentences are unchanged; no rewrite or coverage remapping occurred.
8. MET for the selected authority paths: allowed edits, insufficient and narrowed scopes, current private access, Pause and revocation are exercised through mounted doors with refusal snapshots.
9. MET as an honest boundary: no provider, legal or hosted proof is claimed; webhook and latency qualification remain held.
10. UNCHANGED: existing policy decisions and the standing authority floor are reused. No new policy default or scope release is counted.
11. PENDING fleet landing: publication scan, guarded landing and candidate Run site are independent fleet gates.

Held remainder: point 1 subscription and listen latency; point 2 webhook ID parity; point 5 failed-webhook visibility and replay; point 6 approval, review and policy qualification; all other record producers and other delivery channels of point 4. Existing Base qualification and candidate custody, API-004 independent consent and interface gate, and AGENT-005, AGENT-006 and CONNECT-001 prerequisites remain unchanged. No new identity issuer or agent subscription transport is authorized or adopted. These are scope holds, not a new account blocker.

## Handoff

The full plan is PLAN.md. Actual non-secret receipts are local-receipts.json, browser-receipt.json, browser-provenance.json and ci-receipt.json. The two inspected screenshots are title-events-1440.png and title-events-390.png. Product custody and evidence publication are separate. Main was never pushed or fast-forwarded by this cloud. Publication scanning, independent acceptance, landing and Run site remain fleet work.
