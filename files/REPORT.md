# sd-vector-c-f192-pc1 results

Product branch: cloud/sd-vector-c-f192-pc1 in just-every/run-vector.
Final pushed head: 0074a30dfda830f613542820aec6ea9c589d47cb.
Terminal custody: PUSHED. Exact-SHA Verify green is not established for this head because the ten-call GitHub API budget is exhausted. No READY, DONE, publication-scan or landing claim is made.

ROLE-006 remains PARTIAL → PARTIAL in this continuation. The original campaign had moved MISSING → PARTIAL before this continuation. Counts remain 136 DONE, 70 PARTIAL, 66 MISSING, 272 total. All parent Status rows remain. The campaign plan return changes only ROLE-006's continuation result; no acceptance sentence, held obligation or unrelated plan row changes. The implementation plan is PLAN.md.

## Product and CI provenance

The two supplied published commits remain ancestors of the final head. This continuation adds two forward commits:

- 939525d461cfef7418f8563e5b05904179b98938: repair the deployment inventory and the first discovered historical-upgrade and projection-race expectations.
- 0074a30dfda830f613542820aec6ea9c589d47cb: retain personal audit receipt fields and the remaining dependency projection race, and improve the unchanged SDK error assertion's diagnostics.

Both pushes used the fleet guard and succeeded on their first attempts. Main was fetched and merged before each candidate; it was already an ancestor, so no merge commit was needed. No published history was rewritten and no default branch was pushed. No pull request is required: this repository's cloud branch pushes start Verify.

Verify 42142856859 failed on supplied head 123353741b39efe08ff471d7ae04c90c353c9154. Its failed shard jobs were worker-2 127647613875, imports 127647613996 and hosted-artifact 127647614031. Each required archive log command was called once; all returned exit zero and empty stdout. Actual command reproductions, not inferred archive content, established the failures below.

Push Verify 42159071007 ran on 939525d461cfef7418f8563e5b05904179b98938 and completed with failure. Discovery plus five permitted status reads used the remaining API budget, for ten calls total including the prior job and archive reads. Its final response is ci-final.json. No new failing job IDs or logs were obtained after exhaustion. The named shard commands were then reproduced locally on that exact SHA before the second repair. The final head's CI run ID and conclusion were not queried. Receipts distinguish the prior failed run from the unqueried final candidate.

## Reproduced failures and repairs

The full command, head, test, real nonzero exit and failure records are in VERIFY_REPRODUCED.json.

1. Historical upgrade expectations in triage-upgrade.ts compared old personal audit and activity rows against objects without the three additive actor fields. The supported actor migration correctly adds null fields. The repaired expectation retains every original value and explicitly requires null provenance on historical people.
2. The stale issue projection and dependency projection race hooks matched the former activity SELECT list. The new attribution expression bypassed those hooks. Both hooks now identify the same activity read by its source and predicate; projection, actual authority withdrawal, refusal and unchanged-storage assertions remain intact.
3. The generated deployment specification omitted migration 0126. The documented integration:sync generator added that migration and digest. Integration checking and native delivery-artifact production pass. No workflow or Base pin changed.
4. The deletion-admission receipt expected a personal sign-in audit row without the three new nullable fields. Its full equality assertion now requires all three to be null, preserving personal attribution and every existing field.
5. A full hosted shard attempt encountered the SDK error-type assertion. The original assertion remains. Its diagnostic now distinguishes an unexpected successful request from a non-API error without printing request credentials. SDK intake passed alone, after the actual actor browser journey, and on observed main; the subsequent complete integration command also passed. No product response, error check or storage assertion was weakened.

An initial second-round hosted run also encountered this task's own previously produced artifact directory. That local output was removed and the shard was retried from a fresh destination; it then passed rer verify and artifact production. This environment collision is not claimed as a CI diagnosis or product defect.

## Actual validation

- Nine affected Worker files pass, 35 tests in total: the initial seven files and 23 tests, then dependencies.test.ts and parent-deletion-admission.test.ts with all 12 tests passing. No registration was added or removed.
- Both worker-2 Vitest partitions passed in the exact-SHA rerun. The imports partition 4 passed all 45 tests; partition 5 exposed the two remaining fixture files above, whose corrected full files pass.
- The complete integration command passes, including the mounted actor journey, SDK example, OAuth consent and personal-grant isolation, Settings journeys at both widths, and native queue and egress loopback. All original assertions remain.
- Development navigation failed with shared, symlinked dependencies on both candidate and observed main. After installing the candidate checkout's frozen dependencies locally, its complete public development command passes hydration, native sessions, client navigation and responsive capture. No navigation assertion or application code was changed for this environment correction.
- The imports shard's remaining data runtime, related-issue runtime and issue-copy runtime all pass. The data runtime includes native Settings and public CLI flows and the staged 2,000-record fixture.
- Typecheck, first-party rer check, integration:check, production build, source lock checking and the migration-ledger journey pass.

The final production build and actor browser proof were rerun at 0074a30dfda830f613542820aec6ea9c589d47cb. Browser-proof.json names that exact head. Eight actual captures cover installed management, attributed issue, populated workspace audit and revoked Admin readback at 1440 and 390. The one-time credential was closed before capture and was absent after reload. The journey checks keyboard focus, serious and critical accessibility findings, overflow and hydration. System Chromium ran with the required sandbox flag; all owned browsers and servers were stopped.

## POINT probes

PROBE ROLE-006 install: native POST /api/settings/app-actors with a named identity, one team and explicit read and title-write authority → 201 and separate credential; management readback excludes the credential. tests/worker/app-actor-journey.ts lines 12–24.
PROBE ROLE-006 mutation: versioned detail read and title PATCH → 200, saved own actor ID and name plus accountable installer; native activity and workspace audit agree after restart. app-actor-journey.ts lines 25–33; browser helper lines 27–38.
PROBE ROLE-006 pause and revoke: native Admin management → subsequent reads and title writes return 401, with retained attributed history unchanged. app-actor-journey.ts lines 112–119; browser helper lines 44–56.
PROBE ROLE-006 in-flight fence: Admin pause before the edit batch and revocation after activity insertion → 401, no surviving issue, activity or agent-audit write. app-actor-journey.ts lines 99–111.
PROBE ROLE-006 scope and visibility: read-only scope, unsupported operations, foreign team and workspace, private withdrawal, Viewer and Guest roles, missing or ended sessions, personal tokens and foreign Origin → refused with unchanged checked storage. app-actor-journey.ts lines 34–98.
PROBE ROLE-006 erasure: erase installer → remaining credentials refused, installer names redacted and safe actor history retained; a later person edit stays personal. app-actor-journey.ts lines 120–132.
PROBE ROLE-006 archive: native HTTP export and pristine restore → identity and attributed history preserved, credential table and secret excluded, retained credentials unable to read or write. tests/worker/app-actor-archive.ts lines 8–35 through data-http.test.ts.
PROBE ROLE-006 upgrade: populated earlier head → every original value retained, historical actor fields null, archive export completes. Existing viewer-role-upgrade.ts and triage-upgrade.ts registrations.

## Mechanical and publication custody

MECHANICAL lock=pnpm sources:lock then pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write ROLE-006 then check ROLE-006 exit=0; ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0. The complete migration history applies with its guards, retains the recorded ledger and repeats without writes on the final candidate.

Generated ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main and never committed. The source lock was generated last before the final commit and checked again after the final build's temporary route-tree generation was restored. The final product tree is clean. Every parent Status row was retained; the complete contract's 409 pipe-prefixed rows and 272 Status IDs were checked before both commits.

The complete candidate history, including side parents, was inspected before both pushes with the required identity and trailer format. All four candidate commits have fleet author and committer identities and no prohibited coauthor line. No new email-shaped string was added. No existing assertion was deleted, skipped, narrowed or moved behind a width or branch condition. The SDK assertion only gains diagnostic context.

The report packet is outside the product checkout and is published only through the separate evidence ref. Its first publication was round-trip fetched and every manifest hash verified. Final publication contains the updated product head, actual reports and receipts. Credentials, private settings, environment dumps, runtime databases, cookies, held-out gate material and symlinks are excluded. Publication scanning, guarded landing, main equality and Run site remain fleet gates, not established by report transport.

## DONE-RIDERS review

No DONE claim is made. These describe the selected native slice and retain the full-clause boundary.

1. Selected native outcomes are reached by the mounted journeys above. Broader actor classes and mutations remain unqualified; full-clause DONE remains unmet.
2. Allowed operations complete on populated data and unsafe calls and races are refused with unchanged storage. Pass for this slice.
3. Journeys remain in the existing push Verify commands. Final exact-SHA Verify is unqueried because the API budget is exhausted; no green claim.
4. Final actor browser receipt names the final SHA; changed regression tests pass and relevant application bytes remain committed. Pass for local freshness.
5. Existing session, visibility, erasure, archive and Base duties are preserved. No new DONE inheritance claim is made.
6. The PARTIAL Gap retains all missing qualification and policy boundaries. Generator write and check pass, and generated views are restored for the lander. No DONE Gap or new judged claim is asserted.
7. No acceptance point changed. Pass.
8. Authorized and refused authority paths and in-flight fences pass through mounted native doors. Personal grants and Base Owner-only Business management remain unchanged.
9. Only native fixture and local runtime proof is claimed. No live provider, legal or hosted commissioning claim is added.
10. The recorded conservative native installation floor stays PARTIAL. Broader delegation and provider policy are not released; the supplied standing rule needs no new scope ASK.
11. Guarded landing, complete publication scan, main equality and Run site remain pending fleet work. No landing is claimed.

## Held remainder and handoff

Held remainder is unchanged: broader integration, automation and coding-agent actors; other mutations; third-party OAuth app actors; AGENT-006 delegation, session and callback transports; and independent interface qualification. Personal-grant boundaries, Base Owner-only Business administration, API-004 consent and UI gate, AGENT-005, AGENT-006, CONNECT-001, ROLE-011, ROLE-012 and existing Base approval custody remain owed. No held authority is widened.

There is no remaining known local failure in the repaired paths. The final branch is pushed with passing local touched checks and probes. Its exact-SHA Verify outcome remains unestablished, so terminal custody is PUSHED rather than READY under the supplied API-budget rule. The existing fleet must independently verify and scan this exact candidate before landing.
