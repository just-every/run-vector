# sd-vector-c-f205-wk2-split-1

Published candidate: `cloud/sd-vector-c-f205-wk2-split-1` at `796399103ffb5de8572661f52ae482f54d4916cc` in `just-every/run-vector`.
Verify [42621810959](https://github.com/just-every/run-vector/actions/runs/42621810959) completed **success** on that exact SHA. All eleven jobs succeeded, including worker-2 and both core-runtime jobs. No PR was created and no landing is claimed.

## Plan and completed work

1. Configured fleet Git identity, refreshed the launcher, installed the decrypted-bundle credential helper and cloud push guard, and followed launcher/repository instructions.
2. Made a fresh full-history clone. Fetched the required harness branch and printed/verified `f9c085216b307ca884a4303b32095abc2496f5fc`. Created the named branch from it. Fresh origin/main was `0b10199c8e0e680447e15291dd8d5b622d5d18c1`, already an ancestor, so no merge was needed. Migration remains `0139_sub_teams.sql`.
3. Read the original registration and its helpers. It called Guest, Viewer **and private-team** journeys. Measured complete-file attempts and then three serial controlled original-target trials at the original source in a detached worktree, reusing the same dependency pins.
4. Split the original registration into Guest, Viewer and private-team registrations, each retaining its own original roleWorkspace call and a **120000 ms** cap. An initial Guest / combined Viewer-private split exceeded its budget; separating the existing private step preserves every call and keeps it after Viewer's erasure-census setup. The original ordering comment remains.
5. Retained Viewer's original fixture and assertion sequence. Its stored-snapshot encoding now records the common D1 result column names once and every row's values, sorted with duplicate rows retained. The same atomic batch still selects all original columns and rows from all original tables. No hashing, sampling, new exclusion or query limit was added. All 110 original expectation call nodes, including nested nodes, remain unchanged. Guest, private and workspace helpers remain byte-for-byte unchanged.
6. Measured three serial split-target trials from the touched file. The four unchanged registrations were name-filtered only for these controlled benchmarks; no source test is skipped, removed or weakened. Hosted Verify ran the complete file and verification wall. Resolved worker-2's actual 2/6 and 3/6 partitions using the installed Vitest sequencer; each contains twenty worker files. The complete worker-2 job, including its development portion, passed within its existing limit.
7. Staged only the leased tests, regenerated sources.lock.json last, and passed lock/check/typecheck. Committed once with explicit fleet author/committer environment variables and active cleanup hooks. Inspected all twelve candidate commits including side parents, then pushed once through cloud-push.py, without a skip-CI marker, force push, main push or history rewrite.
8. Used one REST status watcher, at least five minutes between logical calls, to require exact-SHA completed/success. Read terminal job details and the successful worker-2 log archive once. Seven of ten GitHub calls were used.
9. Finalize and publish this complete non-secret packet through the separate evidence ref. After publication and return verification, remove the cloud checkout, temporary control worktree and their dependencies; the terminal response confirms cleanup.

## Controlled local timings

Milliseconds. Original trials execute the original combined registration; split trials execute all three replacement registrations. All nine split executions passed. Original trials 2 and 3 hit their unchanged 120000 ms cap; their reported durations include timeout/reporting overhead and are not completed successful journeys. Node 22.20.0 and pnpm 10.12.4 were used, with fresh native D1 fixtures and no private local settings. Commands were bounded through cloud_run; no Mac slot helper or load polling was used.

| Run | Original combined | Guest | Viewer | Private teams |
| --- | ---: | ---: | ---: | ---: |
| 1 | 108492 (passed) | 18085 | 70167 | 10977 |
| 2 | 140025 (failed) | 19806 | 52632 | 33873 |
| 3 | 127664 (failed) | 52853 | 84398 | 39840 |

Maximum local split durations: Guest **52853 ms**, Viewer **84398 ms**, private **39840 ms**. Each remains below about 90000 ms and has its own unchanged maximum cap of 120000 ms. Exact per-run TIMING lines are in TIMING.txt and complete selected/filtered status accounting is in controlled-timings.json.

## Complete-file and shard proof

| Evidence | Result |
| --- | --- |
| Hosted file before | 265900 ms, supplied in the assignment; not independently re-read |
| Hosted file after, exact candidate | **265318 ms, all 7 tests passed** |
| Hosted Guest | 8170 ms / 120000 ms |
| Hosted Viewer | 112833 ms / 120000 ms |
| Hosted private teams | 6975 ms / 120000 ms |
| Worker-2 job | **129176165524**, success, **1448 s / 1500 s** |
| Core runtime job | **129176165503**, success, 1216 s |
| Core runtime planning job | **129176165481**, success, 1113 s |

The file's total hosted duration stays about 266 seconds; the work is distributed across independent test budgets. Worker-2 has 52 seconds of observed headroom under its existing job limit. The successful log archive receipt contains the actual file and per-registration timing lines. Hosted Viewer headroom was 7167 ms under its 120000 ms cap.

## Local complete-file limitations and intermediate receipts

Local complete-file runs were red and are not presented as passing proof. Original complete-file runs 1 and 2 had one pass/four failures, totals 610383 and 645276 ms; original run 3 hit its 900-second outer command limit without a JSON receipt. Initial two-part and three-part probes also timed out in Viewer while three unchanged registrations hit their original 30000 / 120000 / 30000 ms limits. Their actual measurements are retained in supplementary-full-file-results.json and the named receipts.

A temporary four-registration visibility/census probe passed its selected cases (22694, 9735, 71396, 19978 ms), but was not published. The final candidate keeps Viewer's original sequence instead, with the lossless snapshot encoding described above.

The published source's complete-file run with local dev settings had three passes/four failures and a 1075770 ms file total: Guest 78161 ms passed, Viewer 440293 ms failed its 120000 ms cap, private 33374 ms passed. A retry without private settings and with hosted-style flags also hit its 1200-second outer command limit, without a completed JSON receipt. This did not establish private settings as the cause. Neither trial is counted as a successful file run or fabricated third complete sample. The controlled benchmark table above supplies the three per-target measurements; exact-SHA hosted Verify supplies the successful complete-file and complete-shard proof. No outside-lease test or timeout was changed to turn local failures green.

## Mechanical, preservation and counts

MECHANICAL lock=pnpm sources:lock exit=0
MECHANICAL check=pnpm sources:check exit=0
MECHANICAL typecheck=pnpm typecheck exit=0


The three new registration caps are Guest 120000 ms, Viewer 120000 ms and private 120000 ms. timeout-guard.txt contains the complete requested `git diff origin/main HEAD -- tests` timeout lines; its inherited member-suspension context is unchanged. No timeout value was raised. assertion-preservation.json records the AST comparison and unchanged helper hashes. mechanical.json records exits and source hashes matching the published commit.

Source changes relative to the required harness base are exactly tests/worker/role-matrix.test.ts, the snapshot encoding inside viewerVisibilityJourney in tests/worker/role-viewer-journey.ts, and sources.lock.json. No product code, CONTRACT.md, generated view, migration or workflow was changed by this round.

Tests: **5 → 7 registrations**. Contract: **136 done / 72 partial / 64 missing; 272 total**, unchanged. Clause status changes: **none**. **TEAM-006 remains missing; none claimed by this tests-only round.** No publication scan, acceptance promotion or landing is claimed.

## Custody

Product push succeeded on its first attempt, to the named cloud branch only. Both new commit identities are `Run Edit Run fleet <fleet@runeditrun.com>` and there is no co-author trailer. All candidate author, committer and trailer checks passed, including side parents; hooks were kept active. publication-receipt.json and product-push.txt contain actual custody evidence.

Reports and receipts are selected explicitly as regular files under packet/. No credentials, environment dumps, private local settings, runtime databases, cookies, signed URLs, private held-out material or symlinks are selected. Evidence publication is separate from product READY and does not constitute acceptance or landing. No product blocker remains under the exact-SHA hosted READY contract; the local complete-file timing limitation above remains disclosed.

CLAIM TEAM-006: none (tests-only; source status remains missing).
