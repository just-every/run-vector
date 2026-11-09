# sd-vector-c-f205-harness-1

Status: **BLOCKED for READY**. The requested confirmation-budget repair is committed and pushed. Three complete consecutive core-runtime passes were not established: both complete attempts failed at the separate Boolean saved-view readiness assertion in `tests/e2e/core-boolean-filter-journey.mjs:49`, called at line 106. That helper is outside this round's lease. No READY, acceptance or landing claim is made.

## Product custody and scope

- Repository: `just-every/run-vector`.
- Branch: `cloud/sd-vector-c-f205-harness-1`.
- Pushed commit: `f9c085216b307ca884a4303b32095abc2496f5fc`.
- Required landing source: `372dad07fbc6bd9b8245f9431e2f650a8a54f102`, fetched from `cloud/sd-vector-c-f205-fix4-land2-693c3b487c`; `git rev-parse HEAD` printed that exact value before creating this branch.
- Fresh full-history clone; initial fresh main was `0b10199c8e0e680447e15291dd8d5b622d5d18c1`. Merging `origin/main` reported already up to date because the landing source already contains it.
- This round changes only `tests/e2e/core-confirmation-budget.mjs`, `tests/e2e/core-operator-journey.mjs`, `tests/e2e/core-runtime.mjs`, and generated `sources.lock.json`: 43 insertions, 3 deletions.
- Migration remains `0139_sub_teams.sql`. Main's SEC-3-safe template-literal bindings in `tests/worker/member-suspension.test.ts` remain unchanged.
- No product, limiter, CONTRACT.md, ACCEPTANCE.md or docs/CLAIMS.md edits in this round. No test was deleted, disabled or weakened. Targeted Vitest invocations select the named cases without changing test definitions.
- Commit identity is `Run Edit Run fleet <fleet@runeditrun.com>` for author and committer. The preserved-hooks publication wrapper stayed active. All 11 candidate commits, including side parents, passed the identity/trailer audit before the guarded push. No OpenAI/Codex co-author remains. Push succeeded on the first attempt. No PR was created; no default branch was pushed or advanced.

## Plan and execution

1. Configure fleet identity; refresh the fleet launcher; install decrypted-bundle Git authentication, preserved commit hooks, guarded product transport and separate report transport.
2. Clone only the declared product repository with full history, verify the supplied landing head, create the named branch and reconcile fresh main. Read repository instructions and the prior worker-2 failure evidence.
3. Trace client identity and use the seed-supported test seam. Preserve the native limit and the unconditional invitation 303 assertion. Demonstrate the 30/31 boundary before the repair and low confirmation counts after it.
4. Reproduce the exact worker-2 test at the candidate and main. Leave a timeout also present on main unchanged. Run TEAM-006 and invitation tests, typecheck, production build, and mechanical source lock/check.
5. Attempt the entire serial core-runtime sequence three times under hard outer command deadlines, stopping the sequence when an attempt fails. Diagnose a failure without weakening assertions or extending the lease.
6. Commit only the leased repair and source lock; audit all candidate identities/trailers; preserve the commit on the named cloud branch. Read exact-SHA Verify through the bounded REST watcher. Publish this actual non-secret packet only through the separate evidence ref, then remove the disposable clone/dependencies after successful transport.

`PLAN.md` retains the original full working plan. The completed work and the unfulfilled three-run requirement are distinguished below.

## Confirmation identity and repair

`src/core/features/auth/base.server.ts:51` maps every local-outbox auth client to the literal `loopback`; it ignores `CF-Connecting-IP` in this mode. Base's email-link lifecycle derives the confirmation IP bucket from `confirmation:ip:<client>` and enforces its unchanged default limit of 30 per 900-second window. A browser header therefore cannot create distinct native-auth IP buckets in this harness without a product change.

The brief explicitly permits resetting the confirmation bucket between independent journeys through an existing test seam. The new test helper uses the same local Wrangler D1 command seam already used by core-runtime. It derives the exact confirmation IP key with Base's existing `hashToken` and the fixture's existing local auth secret, then deletes **only that one oa_limits row** at the beginning of `withInvitedOperator`. It does not clear per-token/email, magic-link, operator or other buckets. Confirmation is never retried. The existing browser POST status assertion remains exactly 303.

The helper records the counts at each reset boundary and the final segment; complete runtime success would include that ledger in runtime-results.json and assert its peak is below 30. The focused native proof exercised that ledger successfully. These are reset intervals for the one forced loopback IP, not a claim that the product accepted synthetic IP headers.

| Actual local native proof | Count/status |
| --- | --- |
| Before, one shared confirmation IP bucket | 1–30: 303; 31: 429 |
| Same unconsumed invitation after the scoped reset | 1: 303 |
| After, fresh migrated fixture: owner plus 30 genuinely invited operators | 31/31 confirmations: 303; observed segment peak: 1 |

`confirmation-boundary.json` and `confirmation-after.json` contain every actual count/status. The corresponding `.mjs` files retain the executable probe methods. The after-proof starts a fresh migrated fixture, signs the owner in once, issues 30 genuine invitations, and applies the exact harness reset between those invited journeys. It performs no confirmation retry and no other bucket reset during that proof.

PROBE harness: focused confirmation repair PASS — before 30->303 / 31->429; after 31/31->303 with peak 1. Complete core-runtime three-run proof BLOCKED (0 completed passing runs).

## Local validation

Final Vitest validation ran with setup's generated private `.dev.vars` moved out of the checkout, without reading its contents, matching clean CI configuration. Initial Vitest runs that loaded those settings are explicitly discarded as product evidence. No private settings or runtime state are in this packet.

| Check | Actual result |
| --- | --- |
| `cloud_run timeout 600 npx -y @runeditrun/rer build` | exit 0 |
| `cloud_run timeout 300 pnpm typecheck` | exit 0 |
| `pnpm test:worker tests/worker/sub-teams.test.ts tests/worker/sub-team-filter.test.ts tests/worker/base-auth.test.ts --reporter=verbose` | exit 0; 16 tests, 3 files passed |
| Required confirmation boundary probe | exit 0; 30->303, 31->429 |
| Fresh invited-operator reset probe | exit 0; all 31 confirmations 303, peak 1 |
| Complete core-runtime, initial concurrent attempt | exit 1 after 956.89 s; Boolean saved-view rows assertion |
| Complete core-runtime, serial attempt without competing validation | exit 1 after 515.60 s; same Boolean saved-view rows assertion |
| `pnpm sources:lock` | exit 0 |
| `pnpm sources:check` | exit 0 |

MECHANICAL lock=pnpm sources:lock exit=0; check=pnpm sources:check exit=0. No contract views were regenerated. The lock changes only the three harness file entries. `local-source-receipt.json` verifies the tested bytes of all four leased files match the committed bytes and that the product checkout was clean after committing.

The initial required `rer setup --owner-email fleet@runeditrun.com --non-interactive` installed dependencies, built, and applied migrations, then exited 1 at its temporary dev-listener readiness handshake. The explicit subsequent build and direct emitted-Worker probes passed. This installer failure is recorded separately in `setup-receipt.json`; no installer/product changes were made.

An auxiliary repeated magic-link probe hit the separate unchanged five-per-15-minute loopback request cap. It is not used as passing confirmation evidence. The final after-proof uses actual invitations and one owner magic-link request; that independent request cap and every other limiter remain intact.

## Full-runtime blocker

Both complete attempts failed at `core-boolean-filter-journey.mjs:106 -> rows():49`, immediately after saving the Boolean-expression view. Expected: the two synthetic issue identifiers. Actual: `[]`. Captures show the saved-view page still displaying “Loading filter choices…” and “Loading issues…”; no hydration errors were recorded. The current ready-row helper can observe readiness before the new saved-view load has settled; this needs separate investigation/synchronization in that unleased helper. The same failure occurred with no competing test process.

All invitation 303 assertions reached before that failure passed, but the whole journey sequence did not pass. The two remaining runs were not represented as passes or bypassed. The failing assertion, saved-view journey and every other test remain intact. The next required lease is the Boolean saved-view readiness seam in `tests/e2e/core-boolean-filter-journey.mjs:43–49/106`; then the complete sequence must actually pass three consecutive times. This repair does not claim that result.

## Worker-2 comparison

Prior hosted Verify `42575132750`, job `129021332202`, head `372dad07fbc6bd9b8245f9431e2f650a8a54f102`, failed the private/invited-team read-scope test in `tests/worker/role-matrix.test.ts:408` with `Test timed out in 120000ms`. The check-run annotations identify the exact test. The one prescribed `gh run view ... --job 129021332202 --log-failed` returned exit 0 with empty output. A fallback artifact download was rejected with Forbidden; signed URL queries were omitted and no blocked blob download was retried.

Clean focused comparison, using the same unchanged 120-second native test limit:

- Candidate/base `372dad07fbc6bd9b8245f9431e2f650a8a54f102`, line 408: same timeout; Vitest case 123803 ms, total 179.82 s.
- Main `0b10199c8e0e680447e15291dd8d5b622d5d18c1`, corresponding line 527: same timeout; Vitest case 123162 ms, total 182.08 s.

The test is `[ROLE-002 ROLE-003 ROLE-013 OPS-001 OPS-002 WORK-004] current private and invited teams scope native, bearer, search, project, notification and document reads; Viewers remain read-only`. Per the brief, a timeout also on main is named and left unchanged. No timeout was raised. The separate full worker partition hit its 20-minute outer deadline without per-file results; that is not misreported as the native assertion reproduction. An earlier full-file main comparison was cancelled in favor of the exact case; its cancellation is not a main test pass/fail.

## Clauses and acceptance counts

- Accepted DONE: **136/272 -> 136/272**.
- Clause status changes: **none**.
- Canonical TEAM-006 status remains **missing**, as recorded in CONTRACT.md; this round claims no PARTIAL points and no promotion.

CLAIM TEAM-006: none — tests-only harness repair; no clause judgment, acceptance or landing claim.

## Hosted verification and evidence transport

The product branch was pushed successfully through the fleet guard after the all-parent identity/trailer audit. Exact-SHA Verify was read through REST for `f9c085216b307ca884a4303b32095abc2496f5fc`; its actual final status and run IDs follow below. Five GitHub calls were used for prior-run diagnostics; the watcher and any completed-run failure diagnostics stay within the ten-call budget and minimum polling interval. No green status from another SHA is used.

The complete selected report/receipt packet is published only to `refs/heads/evidence/sd-vector-c-f205-harness-1`, independently of product readiness. Evidence transfer is not READY, acceptance, publication-scan proof or landing. The final terminal EVIDENCE line identifies the report ref/head. The fleet's independent gates and publication scan remain their own work.


## Final exact-SHA CI result

Verify [42597325035](https://github.com/just-every/run-vector/actions/runs/42597325035) at `f9c085216b307ca884a4303b32095abc2496f5fc`: **completed / failure**.

| Job | ID | Observed conclusion |
| --- | --- | --- |
| Build | 129093106356 | success |
| Core-runtime | 129093509217 | success |
| Core-runtime planning | 129093509237 | success |
| Imports | 129093509194 | success |
| Portability | 129093509210 | success |
| Collaboration | 129093509251 | success |
| Hosted artifact | 129093509287 | success |
| Administration | 129093509198 | cancelled |
| Worker-2 | 129093509390 | failure |
| Aggregate verify | 129103815953 | failure |

The completed-run archive was read once using:

`gh run view 42597325035 --repo just-every/run-vector --job 129093509390 --log-failed`

Exit 0, nonempty archive output. It confirms exactly the same role-matrix private/invited-team read-scope test timed out at 120000 ms (`tests/worker/role-matrix.test.ts:408`). This is the timeout also reproduced on main; it remains unchanged as directed. The shard's failing invocation reports one failed and 19 passed test files. The aggregate verify gate consequently failed.

Administration's metadata records cancellation during “Verify the independent shard”, from 09:59:27 to 10:24:01 UTC; job lifetime was 09:58:48–10:24:06 UTC (25 minutes 18 seconds). No administration archive was requested, and no more specific cause is claimed. A cancelled job is not reported as green.

Ten GitHub calls were consumed in total. One initial discovery response was unusable because the task-side URL sanitizer damaged compact JSON; that call was counted, the sanitizer was corrected and checked locally without a network call, and the watcher resumed after a conservative 300-second interval. The final run-status read, job metadata and one failed-job archive respect that interval. No blocked blob download was retried and no other credential was sought.

The exact-SHA hosted core-runtime shards passed, establishing the repaired confirmation path in those CI groups. This does not replace the missing three consecutive complete local runs. The candidate is **PUSHED, not READY**: the local full-runtime proof remains blocked outside the lease, Worker-2 remains red, and administration is cancelled. No clause acceptance or landing is claimed.
