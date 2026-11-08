# sd-vector-c-f177-fix1

Mechanical repair of the deployment-spec pre-gate refusal on the published release-notes candidate. This is a stale-gate repair, not a new product FIX or a new clause judgment. The complete plan is in PLAN.md.

Repository: just-every/run-vector
Product branch: cloud/sd-vector-c-f177-fix1
Product head: 14b8e8a430a5011d2d605a052a94d3e1c297bce3
Published candidate parent: e8afc82af42c6722da5a3820e19d46b40399e014
Fresh main merged as second parent: 243b843de99e0ed460e736a27aa2622c13a52ddd
Staged/final tree: 35cb96485a8489c8a43f514a304707f9adcd06e2
Product commit: Refresh release-note deployment spec against current main
PR: none created; the brief requests the named cloud branch, and the repository's AGENTS.md imposes no PR landing step.
Landing: no landing or hosted acceptance claimed. The fleet's publication scan and main landing remain on its machine.

## Repair and preservation

The repository was freshly cloned with git clone --filter=blob:none and no depth. git rev-parse --is-shallow-repository returned false. The fetched original candidate's checked-out head was printed and equalled e8afc82af42c6722da5a3820e19d46b40399e014 before the fix1 branch was created. Fresh main was merged, never rebased; no published history was rewritten.

CONTRACT.md was resolved first, line by line. Only the generated summary conflicted. The documented generator rewrote its summary from the merged Status rows. All 272 Status rows survive. The existing candidate's RELEASE-003 row remains byte-identical and partial; all other 271 rows equal main byte for byte, retaining its newer AUTO-004 and BASE-AGENT-010 partial judgments. There was no clause-status decision or promotion by this repair. No ID-MAP was edited.

Main already owns migration numbers 0126 through 0131. The candidate-only 0126_release_notes.sql therefore moved to 0132_release_notes.sql. SQL bytes are identical: SHA-256 1e28223f389f988bf1da1a847e8a528a152716d44230a4f88b3e93fe7ad150a2. All 131 main migrations remain byte-identical under their original names. No duplicate migration numbers remain, and no old literal filename references remained outside the generated lock/spec.

The merge's remaining conflicts were additive and needed no semantic ruling:
- archive-inventory.json retains main's eight added tables plus the candidate's draft/revision tables and its releases.owner_operator_id column.
- archive-policy.mjs retains both independent explanatory comment blocks.
- native-targets.ts retains main's legacyWithSlaSnapshotExpression comparison and the candidate's separate releaseNoteReferences rollback guard.
- data-http.test.ts retains both independent fixture blocks and every assertion, proving both project graph receipts and release-note histories through archive restore.
- sources.lock.json was restored from main and regenerated from the final staged sources, rather than hand-resolved.

The first inventory merge assertion caught the candidate's releases column addition; the inventory was then joined at table level with an overlap check. An initial setup attempt while other merge files were unresolved exited 2; rerunning setup after all resolutions succeeded. These attempts produced no product commit. No test source was deleted, skipped or weakened.

## Mechanical commands and counts

MECHANICAL deployment-spec=pnpm integration:sync + pnpm integration:check exit=0; lock=pnpm sources:lock + pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write RELEASE-003 + node scripts/contract-docs.mjs check RELEASE-003 exit=0; ledger=pnpm exec node --test scripts/deployment/tests/migration-head.test.mjs exit=0

The deployment-spec write/check used the documented package scripts. Hashing every tracked regular file immediately before and after the write proved management/integration/deployment-spec.json was the only changed file in that generator step. The refused candidate's spec contained 125 migrations; main's contained 131; the repaired spec contains 132 including 0132_release_notes.sql.

The migration-head test applies the complete source migration history, checks every exact name/hash/applied-state ledger entry, verifies guards and foreign keys, and proves a second migrate performs zero writes. It passed, one test with zero skips.

Contract generation and check passed with touched ID RELEASE-003. ACCEPTANCE.md and docs/CLAIMS.md were then restored wholly from origin/main and match that parent exactly; no generated view change is introduced by this repair. The Mac lander owns their merged regeneration. Sources were staged, sources.lock.json was regenerated LAST, and sources:check passed.

| Status counts | Done | Partial | Missing | Total |
|---|---:|---:|---:|---:|
| Original candidate | 136 | 70 | 66 | 272 |
| Fresh main | 136 | 71 | 65 | 272 |
| Repaired merged source | 136 | 72 | 64 | 272 |

These count differences combine existing parent judgments. RELEASE-003 stays partial → partial; this repair changes no judgment.

## Executed proof

Setup and build ran through the cloud subreaper using the supplied toolchain, owner email fleet@runeditrun.com and hard timeouts. Setup and the production build passed. pnpm typecheck, pnpm check, sources:verify-base (offline), integration:check and sources:check all passed.

Candidate-added/changed worker tests were identified from git log/show:
- tests/worker/release-notes.test.ts passed.
- tests/worker/data-http.test.ts passed with both archive fixture blocks.
- tests/worker/project-fields-upgrade.test.ts passed, exercising the candidate's populated-upgrade callback at the old schema and forward migration.
- tests/worker/role-matrix.test.ts exercises the changed role-viewer census helper. Five tests passed initially; its private/invited-team and Viewer census hit the unchanged 120000ms timeout while browser proof ran. Running that single failed test alone, without changing timeout or assertions, passed in 36.78 seconds (50.54 seconds total runner duration). The five already-passed tests were not selected for this retry. All nine distinct worker tests passed across the two invocations. The initial failure and actual retry logs are included.

The candidate's existing tests/e2e/core-runtime.mjs projects entry point passed all 54 checks with Chromium /usr/bin/chromium and --no-sandbox, including its unchanged release-note HTTP and browser journeys. Browser assertions exercise the note editor at 1440; existing capture helpers show it at 1440 and 390. Both selected edited-draft captures were visually inspected and contain synthetic data only.

PROBE release notes: native POST /api/releases/:id/notes with six completed scoped issues and expectedReleaseVersion -> 201 with exactly those six sources, current titles and stable project grouping; PATCH with an exact edited line -> saved draft version 2, retained byte-for-byte by GET and browser reload; repeated generation and stale PATCH -> 409 without overwriting text; changed scope retains the accountable saved draft; source membership withdrawal -> 404 on save and removal of private saved/unsaved browser text without changing stored history. Drafting does not publish the release, contact a provider or change its separate description.

The full emitted probe lines and actual 54-check runtime receipt are included. No hosted provider delivery, performance capacity, complete RELEASE-003 acceptance or publishing claim is made.

## Product and report custody

The sole product push used the fleet guard and succeeded on attempt one. Before pushing, all six candidate commits, including side parents, were checked for author, committer, complete messages and trailers. Every author and committer is Run Edit Run fleet <fleet@runeditrun.com>; no co-author trailers remain. Clone-local cleanup hooks stayed active, with repository hooks preserved. The checkout was clean and origin/cloud/sd-vector-c-f177-fix1 equalled the full product SHA after the push.

Product commits and READY/PUSHED custody are separate from this report's evidence publication. Evidence selects only actual reports, receipts, reviewed synthetic screenshots and non-secret diagnostics under the packet directory. It is sent only to refs/heads/evidence/sd-vector-c-f177-fix1, not a product branch, main or a PR.

CI and final cleanup results are recorded below when complete.

## Final CI and cleanup

Verify run 42493186695 completed successfully on exact product SHA 14b8e8a430a5011d2d605a052a94d3e1c297bce3:
https://github.com/just-every/run-vector/actions/runs/42493186695

Seven GitHub REST calls were used, each run read at least 300 seconds apart. No failed-job log calls or generated-view exception were needed. This is an actual completed/success result, not a result from a different SHA. The product branch is READY for the fleet's independent gate/publication scan; no landing is claimed. There are no unresolved blockers.

Every local browser and Worker started by the proof has exited, and the CI watcher has exited. The clone's node_modules was removed after all proof succeeded. The clean, fully pushed clone is retained only as the report transport handle; it is removed immediately after successful evidence publication, with actual removal reported in the final terminal message.

READY branch=cloud/sd-vector-c-f177-fix1 head=14b8e8a430a5011d2d605a052a94d3e1c297bce3
