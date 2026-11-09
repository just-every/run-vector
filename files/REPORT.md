# fv-vector-stream-1

Repository: just-every/run-vector
Product branch: cloud/fv-vector-stream-1
Base: ea77c904 (main at clone)

## Plan

1. Read the stream-controls journey, its browser/fixture helpers, route loaders, list-preference state, detail return, and ordinary API limiter.
2. Reproduce the suspected ordering failure against the emitted production Worker by delaying the actual route-loader response and reset receipt through Playwright; retain only safe observations.
3. Harden only CURR-009's journey at the user-visible boundary established by the reproduction. Preserve assertions, normal deadlines, rate limits, workflow shape, and all other clause judgments.
4. Exercise the delayed return repeatedly at 1440px, run the complete touched journey, capture desktop and phone evidence, typecheck, regenerate/check the touched contract views and restore those generated views to main, then regenerate/check the source lock last.
5. Inspect all unpublished commit identities, messages and trailers; push cloud/fv-vector-stream-1 through the fleet guard. Watch only the exact-SHA Verify using one REST watcher within ten calls and at most one call per run per 300 seconds.
6. Publish this actual report and safe receipts only to evidence/fv-vector-stream-1. Return terminal product custody, CI identity, clause counts and lane POST instructions.

## Initial findings

The old post-detail sequence waits for the URL and all rendered selects to be enabled. It does not establish that the destination route has committed, that its filtered fixture list is rendered, or that the Reset filters control belongs to that route.

Vector's ordinary authenticated API limit is 600 requests per calendar minute, keyed by operator ID (`operator:<id>`), not client IP. Server document projection reads bypass that HTTP limiter. The core runtime already assigns the two stream viewport journeys separate genuinely invited Owners. No evidence supplied here establishes Slate's limiter identity or a shared bucket, and no other repository was cloned.

## Results

### Cause and deterministic before/after

The reproduced failure is an ordering race in the test (cases a and c in the brief). TanStack changes the browser URL to `/app` before the pending `loadOperator` receipt commits. The old `.stream-filters` locator and enabled-select predicate still match the outgoing selected-detail route. Reset optimistically clears that route and DELETE returns 200, but the incoming route then mounts its independent preference hook from a receipt containing the earlier combined filters. The successful DELETE cannot update the newly mounted hook. The old wait sees six non-default values and reaches its unchanged 30-second deadline. No missing handler or 30-second slow fetch is needed to explain the failure.

The controlled reproduction delays the real return-loader receipt by two seconds and the real DELETE receipt by 2.5 seconds; it fabricates no application data or API response. `reproduction.json` records the old sequence timing out at five seconds; `reproduction-original30.json` independently records the original 30-second timeout under Node 22.20.0. Both show the old readiness condition passing while `.has-mobile-detail` is still present, a reset on that outgoing route, the return receipt replacing it, and the six combined filters surviving the successful DELETE receipt.

The fix scopes the journey's controls to `.stream-workspace:not(.has-mobile-detail)`, waits for that returned list, and checks the expected filtered fixture row before reset. Playwright's ordinary button click also waits for the scoped reset button to be visible and enabled. The existing durable reload and all-filter-default assertions stay intact. There is no timeout increase, retry, skip, product change or workflow change.

The first validation completed the actual full stream-controls journey at 1440px with a delayed return, then five further delayed-return/reset cycles. All six resets occurred after the return completed, with no outgoing detail route, no HTTP errors and no browser errors. Request peak was 369/600 for one real operator, leaving 231 requests (38.5%) of margin even with extra repeated fixtures. No rate state was reset during the journey. The existing core harness already separates viewport actors, so no additional request fan-out change is justified for this minimal fix. The final Node 22.20.0 validation on the pushed SHA also passed the actual full journey plus five further delayed returns: six of six resets after return, zero browser/HTTP errors, peak 361/600 (239 requests of margin), and 638 total requests across two ordinary calendar-minute buckets. Across both runs, 12 delayed returns passed. `validation-node22.json` records the exact product head and runtime version.

This proves the reported reset-timeout signature deterministically. A saveControl HTTP 429 is a separate rate-admission failure: Vector's bucket is per operator, not client IP. Nothing in this run proves Slate shares it, and the older 429 cannot be assigned this route race without its own trace. The dedicated cloud VM replaces m1 execution for this assignment; no m1 run is claimed.

### Scope and checks

Product changes are limited to the journey (six added/changed lines), CURR-009's acceptance sentence, and the generated source hashes. CURR-009 remains done → done. Counts are unchanged before and after: Published 98 done / 6 partial / 0 missing / 104 total; Target 38 / 66 / 64 / 168; All 136 / 72 / 64 / 272. WORK-003 and CURR-007 judgments are unchanged.

Setup, production build, pinned-Node typecheck, touched-clause generation/check, source lock generation/check and whitespace checks passed. Generated ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main after the positive generator check and were not committed. The source lock was regenerated last. The exact product commit has fleet author/committer identity, no trailers, and was pushed once successfully through cloud-push.py. No PR was required by the repository instructions and none was opened. No main/default branch was pushed.

Screenshots show the combined controls and returned filtered list at 1440px and 390px. Browser assertions use 1440px; the phone capture is visual evidence, not a second full journey assertion run. The journey's pre-existing record text mentions both widths, so the receipts must be read with this explicit actual-width qualification.

### Product and CI custody

Product head: `dde3ea2e9ba87f139281fb7e87aad7335e73853d`.
Verify run: `42543653243`, https://github.com/just-every/run-vector/actions/runs/42543653243.
CI was discovered on the exact product SHA and completed successfully on that SHA. The single watcher used seven GitHub API calls total: discovery and six polls, spaced at least 300 seconds apart. No failed-job logs or reruns were needed. `ci-final.json`, the six actual poll receipts and `github-call-receipt.json` record the result and call budget. Evidence publication is separate from product readiness and landing. The Mac publication scan and final landing remain fleet work.


## Final result

READY for fleet review on the named product branch and SHA. No builder blocker remains. The product was pushed once; there was no merge/rebase, force push, main push, PR, deployment or publication claim beyond branch custody. The report-only evidence ref is separate and does not establish acceptance or landing. All owned browsers, test Workers and the CI watcher have stopped.
