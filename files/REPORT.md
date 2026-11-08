# sd-vector-c-f202-fix1 — Vector roadmap Verify repair

Repository: just-every/run-vector. Product branch: cloud/sd-vector-c-f202-fix1.
Source: cloud/sd-vector-c-f202 at 52ddd29d9b1099ee45aec00fd0c8e2a6bb964f4b.
Initial fresh main: 0e8a686c06eddd55943ed1d2690df32a8fc82213.

## Scope and source discrepancies

The full-history, blob-filtered clone fetched the required source branch, printed and verified its exact head, created the requested fix branch and merged fresh origin/main with `--no-commit`. Git reported `Already up to date`: main is already an ancestor. No published commit was rebased or rewritten. All original CONTRACT Status rows and ID-MAP are retained.

The current branch's sole listed Verify is 42505077963 at the required full source SHA. Its actual failed assertions are two, not seven. Failed jobs are 128856066280 (imports) and 128856066143 (worker-2). Each failed job archive was read once using the prescribed `gh run view ... --job ... --log-failed`. These logs, the run list and job inventory are actual packet files.

The brief's other abbreviated commit, 806b1715d89a5383b5722b1b6c37a615b0665763, is titled “Prove suspension retains personal history while clearing revoked Inbox pages.” It belongs to different work and adds `0134_member_suspension.sql`; it is not the required roadmap source. Neither the required source nor fresh main contains any 0134 migration. Both end at `0133_release_notes.sql`, which the existing deployment specification already includes. No migration from another candidate was imported, altered or renumbered. The deployment spec and migration ledger are regenerated/checked for the actual leased source rather than inventing an unrelated migration.

The actual source CONTRACT INIT-003 definition and Status row both say `missing`, not `partial`. Its totals are 136 done, 72 partial, 64 missing, 272 total. This repair preserves every judgment and does not promote INIT-003. The Opus interface work and broader roadmap acceptance remain owed; this fix claims verification only. The described PARTIAL claim and owed interface work are not treated as authorization to raise the source judgment.

## Plan

1. Install the fleet launcher, Git credential helper, cloud push guard and commit hooks. Clone full history and verify the required source and current main.
2. Read exact-SHA failed job archives once, then reproduce the failed API consistency and Viewer census assertions alongside roadmap planning and populated-upgrade tests with a hard timeout. Compare unchanged tests on main. Identify whether the foreign-key rollback diagnostics are assertion failures or expected negative-fixture behavior.
3. Keep roadmap optimistic concurrency in its native input and internal service options. Add the roadmap mutation to the existing valid-fixture Viewer census and validate its body with the real handler schema; preserve all refusal, provider-call and unchanged-storage assertions.
4. Repeat the focused command and typecheck. Generate/check the touched contract view, restore views from main, check the migration ledger, rebuild/regenerate/check the integration specification, regenerate/check the SDK, then stage, regenerate sources.lock.json last and check it.
5. Check all candidate identities and trailers, commit with the fleet identity and push only the named branch through the guard. Watch exact-SHA Verify through REST with one watcher and at least 300 seconds between calls per run, within ten gh invocations.
6. Publish this complete non-secret packet and actual receipts only on the evidence ref. Report custody and discrepancies without claiming acceptance or landing. Remove the disposable clone/node_modules once preservation and transfer have completed.

## Findings and repairs

### API-003 schema consistency

REPRO API-003: head -> FAIL. `tests/worker/integration-api.test.ts`, “the versioned schema is published through the real app”, compares the shared project-update validator to the public schema. The roadmap change added `expectedVersion` to that shared validator, silently expanding the versioned API while its published document remained unchanged.

Repair: keep the existing published project-update input unchanged. The roadmap input declares and requires its own 64-character version; its handler passes the parsed version to internal `updateProject` options. The service still checks the same project-field fingerprint and durable activity revision, and still fences the transaction. No API schema, SDK type or test assertion is edited by hand.

### Viewer mounted-route census

REPRO Viewer census: head -> FAIL. `tests/worker/role-matrix.test.ts` reaches the complete mutation inventory and finds `PATCH /roadmap/projects/:id` missing from its concrete fixtures.

Repair: obtain the real project's current version through the Member roadmap read, register a valid priority-change request for the added native mutation and validate that body against the actual `roadmapChange` schema. The existing journey then demotes that Member to Viewer and requires 403, unchanged storage and no provider call for the new route along with every existing route. No test is deleted, skipped or weakened.

### Foreign-key reset diagnostic

The source worker-2 log shows the actor-sqlite reset during `data-http-audit-recovery.test.ts`, which deliberately sets an archived file's actor to `absent-native-operator`, expects finalization to return 500, and proves native authority, files and append-only audit history survive. That test passes in the source workflow. The same unmodified test on main passes and emits the same reset diagnostics. No roadmap schema migration is involved. The unrelated `IssueAccessError` diagnostic is in the passing description-history test's revoked-native-authority path; it is not the failed API schema assertion.

## Actual checks and terminal custody

Final check results, commands, exit codes, exact product SHA and CI provenance are recorded in RESULTS.json and the matching individual receipt/log files. The initial focused source run has 17 tests: 15 pass and the two documented assertions fail. Subsequent results are appended when complete. There is no hosted acceptance or landing claim.

## Terminal result

**PUSHED, pending exact-SHA Verify.** Product head 4881b2069146819298fe5f7672bcea2d71a93704 is confirmed on cloud/sd-vector-c-f202-fix1. Verify run 42525382204 was observed only through REST, one watcher, with 300-second intervals. Six watch calls plus four source-diagnostic gh invocations exhaust the ten-call budget. Its last observation is `queued`, conclusion null, on this exact SHA; no successful Verify or READY is claimed. The fleet must observe completed/success before landing. No PR was created. There is no product push blocker.

The focused worker suite passes all 17 tests, with the source’s two failed assertions repaired. All 60 checks in the existing project browser entry point pass, including the roadmap interaction journey; actual captures at 1440 and 390 and the full runtime report are in this packet. The optional full local planning entry point hit its 900-second cap and is recorded as exit 124, not a successful full local run. Its processes, browsers and servers exited; the focused project run also cleaned up. Typecheck, source lock, contract generator, deployment ledger, integration spec and SDK checks pass.

<!-- actual-results -->

## Results receipts

| Check | Exit | Seconds |
| --- | ---: | ---: |
| repro-worker | 1 | 173.2 |
| comparison-main | 0 | 265.66 |
| comparison-main-rollback | 0 | 137.87 |
| repro-authority-rollback | 0 | 149.19 |
| repro-typecheck | 0 | 22.08 |
| repro-ledger | 0 | 1.08 |
| repro-spec | 0 | 0.47 |
| repro-sdk | 0 | 0.07 |
| probe-worker | 0 | 293.87 |
| probe-authority-rollback | 0 | 160.9 |
| probe-typecheck | 0 | 22.26 |
| views-write | 0 | 0.1 |
| views-check | 0 | 0.1 |
| ledger | 0 | 1.02 |
| sdk-generate | 0 | 0.07 |
| sdk-check | 0 | 0.06 |
| build | 0 | 38.31 |
| spec-write | 0 | 0.65 |
| spec-check | 0 | 0.46 |
| lock-write | 0 | 1.23 |
| lock-check | 0 | 1.25 |
| browser-planning | 124 | 930.08 |
| browser-projects | 0 | 457.81 |

PROBE API-003: fixed -> PASS. PROBE Viewer census: fixed -> PASS. The identical focused command passes all 17 tests (source: 15 pass / 2 fail; main comparison: 16 pass / 0 fail). REPRO rollback/authority: head -> PASS with expected rejection diagnostics; PROBE rollback/authority: fixed -> PASS. Typecheck passes before and after.

Local limitation: The optional full planning browser command reached its 900-second timeout; the focused project journey and exact-SHA CI provide the relevant browser verdict. The timeout is reported as exit 124, not a passing local full-planning run.

Counts before/after: **136 done / 72 partial / 64 missing / 272 total**, unchanged. No clause status changes. INIT-003 remains the actual source judgment **missing**; the brief’s PARTIAL wording was not used to promote it.

Product custody:

```json
{
  "repository": "just-every/run-vector",
  "branch": "cloud/sd-vector-c-f202-fix1",
  "head": "4881b2069146819298fe5f7672bcea2d71a93704",
  "source": "52ddd29d9b1099ee45aec00fd0c8e2a6bb964f4b",
  "main": "0e8a686c06eddd55943ed1d2690df32a8fc82213",
  "status": "",
  "push_status": "pushed",
  "pr": null,
  "contract_unchanged": true,
  "views_unchanged": true,
  "parent_source_preserved": true,
  "remote_head": "4881b2069146819298fe5f7672bcea2d71a93704",
  "terminal_status": "PUSHED",
  "ci_run_id": 42525382204,
  "ci_status": "queued",
  "ci_conclusion": null,
  "ci_url": "https://github.com/just-every/run-vector/actions/runs/42525382204",
  "github_budget_exhausted": true,
  "ready": false
}
```

Exact-SHA CI:

```json
{
  "id": 42525382204,
  "name": "Verify",
  "head_sha": "4881b2069146819298fe5f7672bcea2d71a93704",
  "head_branch": "cloud/sd-vector-c-f202-fix1",
  "status": "queued",
  "conclusion": null,
  "html_url": "https://github.com/just-every/run-vector/actions/runs/42525382204",
  "at": "2026-11-08T21:53:43.661710+00:00",
  "watcher_call": 6,
  "gh_calls_total": 10
}
```

MECHANICAL ledger=`node --test scripts/deployment/tests/migration-head.test.mjs`; spec=`pnpm integration:sync && pnpm integration:check`; lock=`pnpm sources:lock && pnpm sources:check`; views=`node scripts/contract-docs.mjs write INIT-003 && node scripts/contract-docs.mjs check INIT-003`, followed by `git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md`. MECHANICAL ledger exit=0; spec write/check exit=0/0; lock write/check exit=0/0; views write/check exit=0/0. Exit codes and complete commands are in the named receipts above. The documented SDK generator was run without changing the current generated output. No migration or deployment-spec change was required at the verified source.
