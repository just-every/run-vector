# sd-vector-c-f186 results

BASE-AGENT-010: MISSING → PARTIAL. The selected native title-event points are implemented and locally proved. The held remainder is unchanged; no DONE claim is made.

Repository: just-every/run-vector.
Branch: cloud/sd-vector-c-f186.
Final pushed head: 2371bdcf722a50ac9148bd5c18c3f98ebf2affcf.
Base: 7c811313e446ae19630f387f2ac927dafba3dbe5.
PR: none; this repository runs Verify on branch pushes.
Counts: 136 DONE, 69 PARTIAL, 67 MISSING → 136 DONE, 70 PARTIAL, 66 MISSING. All 272 parent Status IDs and all 409 table rows remain. Only the BASE-AGENT-010 campaign row changed; the supplied campaign was not rebuilt.

## Product result

An actual native title mutation inserts one minimal issue.updated event inside the existing guarded D1 transaction, before the version changes. Its stable ID and time match the activity; its remaining fields are the issue URI and a trusted human or agent-for-person actor. It carries no title, description or credential. No-op, stale and refused mutations create no title event. A failed event INSERT rolls back the title, activity and associated effects.

The current pinned Base retained-event capability and built-in events.list tool are enabled. Settings credentials explicitly need events:read and evidence:read. Existing grants gain no new scopes automatically; read grants cannot mutate issues. The existing issue resource checks current access for each event delivery. Paginated replay returns the same IDs in order from the same cursor after a real Worker restart.

A final privacy probe found that the newly retained human actor name survived native operator removal. The fix joins the existing removal transaction and anonymizes only native human title-event actor names. Event ID, type, URI, time and actor ID remain stable. The journey proves rollback if anonymization fails, successful removal, confirmed person erasure before the first agent admission, and a later mounted Owner event read that contains Removed operator rather than the old name. Existing agent attribution and the separate agent-custody erasure hold remain unchanged.

No vendor source or pin, identity issuer, subscription transport, acceptance sentence, schema, migration or archive policy changed. The existing event table remains excluded from native archives. The operator-removal integration is required to protect the new native event copy, and does not release a held Base duty.

## Selected rubric and public-door evidence

- R1 — Minimal trusted events, stable identity and atomic native title writes: MET by ./tests/worker/agent-events.test.ts, journey “native title events commit atomically and replay through mounted MCP with current authority”, lines 83–119. Integration: ./src/core/features/issue-edit/plan.ts line 352 and ./src/core/features/agent-door/title-event.ts lines 18–27.
- R2 — Cursor pagination and ordered replay after restart: MET by the same Worker journey at lines 120–127 and ./tests/e2e/core-agent-events.mjs agentEventsJourney at lines 62–81. The browser receipt records the actual three IDs and exact candidate SHA provenance.
- R3 — Current record access, grant scope, Pause and revocation: MET by the Worker journey at lines 140–193. Actual Settings grants are issued, a previously usable scope is narrowed, a read grant attempts a mutation, private membership is removed, Pause is exercised and the credential is revoked. Refused domain storage remains unchanged.
- R4 — No false event or partial mutation on no-op, stale, refused and failed persistence: MET by the Worker journey at lines 91–119 and 128–139. Both native HTTP and mounted MCP attempt the failing transaction.
- R5 — NEW privacy check for the new retained human copy: MET by the Worker journey at lines 20–62. Native Settings removal and confirmed person erasure precede first agent admission; the Owner later reads the nonempty retained event through MCP. A failed anonymization leaves operator, removal receipt, native auth and events unchanged. Integration: ./src/core/features/settings/removal.ts line 120 and ./src/core/features/agent-door/title-event.ts lines 30–40.
- R6 — Existing attribution, replay, removal and erasure boundaries: MET locally by five Worker files and eight passing journeys, including the existing populated imported-person erasure and archive-restore journey. No assertion was removed, weakened, skipped or moved behind a new width condition.

The new Worker file is reached by the existing Verify test glob. The browser helper is reached by the existing push planning runtime at ./tests/e2e/core-runtime.mjs lines 757–759; its focused local partition is at lines 718–720. One focused Worker registration and a helper in an existing browser runtime were added. No test deletion or new standalone browser suite was needed.

## Runtime probes

PROBE BASE-AGENT-010 3: Settings-issued credentials, rendered native title mutation and mounted agent edits under autonomous and standard-review policy; events.list with a one-item limit -> three distinct event IDs and identical ordered replay from the same cursor after a real Worker restart.
PROBE BASE-AGENT-010 4: current private-team withdrawal, scope narrowing, Pause and credential revocation -> empty record-event projection, insufficient_scope, agents_paused or HTTP 401; refused storage unchanged.
PROBE BASE-AGENT-010 atomicity: fail event INSERT, then native and MCP title writes -> HTTP 500 or execution_failed and unchanged issue, activity, followers, notifications and events.
PROBE BASE-AGENT-010 erasure: fail native event anonymization, then remove the author successfully, confirm person erasure before first agent admission and read the retained event through Owner MCP -> rollback on failure; stable event ID and anonymized human actor after successful removal and erasure. Existing agent-custody hold remains active after admission.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs check exit=0; views=node scripts/contract-docs.mjs write BASE-AGENT-010 and node scripts/contract-docs.mjs check BASE-AGENT-010 exit=0; ledger=none exit=0.

## Checks and receipts

Five touched or dependent Worker files passed eight journeys on the final matching source tree before its commit (540.62 seconds). The focused event journey was then run again on the exact final head and passed. The application build, including typecheck, passed. First-party and edition-lock freshness checks passed on the exact final head. The browser journey passed again on that exact final head with a real Worker restart, persisted data, fresh mounted reads, native history and captures at 1440 and 390. Both widths passed accessibility and overflow checks; screenshots were inspected.

The contract generator write and check pass. Its two generated views were restored from main and are absent from every product commit. The source lock was regenerated after staging the final edits and its check passes. All four candidate commits retain all parent Status IDs. Each product push succeeded on the first guarded attempt; the final remote full SHA was verified. All authors and committers use the fleet identity and no co-author trailer is present. Fleet evidence and credentials are absent from product commits. Added source and proof lines contain no email-shaped fixture values; existing fixture addresses were preserved.

The full plan is PLAN.md. Actual local check receipts are local-receipts.json; browser-receipt.json and browser-provenance.json bind the fresh screenshots and source hashes to the final head. privacy-probe.json records the reproduced name-retention defect and its passing correction. Historical CI and repair receipts are retained separately from the final CI observation.

## CI repair and final CI state

Initial candidate b318a69487e0a533729276b95f9c1b7edecf2198 failed Verify 42124501904 in build job 127585195397. The exact command pnpm build reproduced exit 1 on the failed SHA with Node 22.20.0 and pnpm 10.12.4: docs/AGENT-EVENTS.md is neither a page nor in githubOnly; add it to one with a reason. The same command passed on main in this cloud VM. Repair round 1 moved the documentation into the existing registered ./docs/AGENT-DOOR.md and corrected its capability declaration. The repaired build passed. No test or guard was weakened.

Intermediate Verify 42125942768 was observed in progress on 32d5f86f00483f3a2616c2cb95ddbfde6d19673f before the native retention follow-up. Final push Verify 42128426622 was discovered on exact head 2371bdcf722a50ac9148bd5c18c3f98ebf2affcf with event push and initial status pending; the latest permitted observation is in progress on the same exact SHA. See ci-current.json for that observation. Nine GitHub API calls have been used, including one failed-job archive read. No dispatch, rerun or PR was created. No green CI conclusion is claimed for a pending run.

Initial main at 7c811313e446ae19630f387f2ac927dafba3dbe5 had successful Verify 42014502098 and Run site 42014502043. The final candidate's publication scan, independent acceptance, guarded landing and Run site remain fleet gates. Main was never pushed or fast-forwarded by this cloud.

## DONE-RIDERS

1. NOT MET for the full clause: selected outcomes pass locally; all explicitly held channels and producers remain unproved. No DONE claimed.
2. MET for the selected work: populated public-door journeys check allowed behavior and unchanged-storage refusals, including failing title and removal transactions.
3. PENDING exact-SHA Verify. Both journeys are registered in existing push paths.
4. MET locally: exact-head event and browser proofs, full matching-source regression checks and source hashes are recorded.
5. UNCHANGED: no receiving-clause inheritance or new acceptance obligation was introduced.
6. MET for this partial update: honest Gap, resolving Evidence, successful source generation and all retained rows. Generated views and global judgment provenance remain lander work; no fresh ct judgment is claimed.
7. MET: acceptance sentences are unchanged; no rewrite or coverage remapping occurred.
8. MET for selected authority paths: allowed edits, insufficient and narrowed scopes, current private access, Pause, revocation, safe native removal and post-erasure event projection are exercised.
9. MET as an honest boundary: no provider, legal, timing or hosted proof is claimed.
10. UNCHANGED: existing policy, native anonymization and agent-custody boundaries are reused. No new default, authority expansion or hold release is counted.
11. PENDING fleet landing: exact-SHA green Verify, publication scan, guarded main equality and candidate Run site remain independent gates.

Held remainder: point 1 subscription and listen latency; point 2 webhook ID parity; point 5 failed-webhook visibility and replay; point 6 approval, review and policy qualification; all other record producers and other delivery channels of point 4. Existing Base qualification and candidate custody, API-004 independent consent and interface gate, and AGENT-005, AGENT-006 and CONNECT-001 prerequisites remain unchanged. No new identity issuer or agent subscription transport is adopted. These scope holds are not a new account blocker.

VERIFY_REPRODUCED {"command": "pnpm build", "exit": 1, "failure": "docs/AGENT-EVENTS.md is neither a page nor in githubOnly; add it to one with a reason", "head": "b318a69487e0a533729276b95f9c1b7edecf2198", "job": "127585195397", "test": "Build the shared production output"}

Evidence transfer initially encountered two Git push rejections (HTTP status unknown; the sanitized second diagnostic was fatal error in commit_refs_rules). After launcher refresh and fleet Git setup, bounded retry 3 published the complete packet successfully at evidence head 28b0d6f61a68f92f0e33f30678be6a58f97a472b. A final update carries the newer CI observation; its terminal EVIDENCE line identifies the final packet.
