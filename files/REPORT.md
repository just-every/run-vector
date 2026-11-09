# sd-vector-c-f207-fix3 — ROLE-011 historical-release upgrade

Product repository: just-every/run-vector
Product branch: cloud/sd-vector-c-f207-fix3
Product head: db865aaeaf9a5e327f8128664325d30d408310ed
Prior exact-SHA Verify: 42546312604 at e6c2d21a2dbf998f91bf478566a094876d7e9313 (failure)
Candidate exact-SHA Verify: 42552730255 at db865aaeaf9a5e327f8128664325d30d408310ed (completed / success; exact SHA confirmed through REST)
PR: none; branch handoff to the lane, without landing or deployment.

## Plan and scope

The complete working plan is PLAN.md. This is the single ct SPLIT targeted round for the historical-release fixture versus renumbered migration 0138. The original seven failures mentioned in the historical brief were addressed in prior candidates; this round addresses the fresh migration gate's current-route dependency before 0138. No clause is raised. Native-removal erasure remains admitted and the separate deliberate native member erasure flow stays owed to ROLE-012.

The clone used `git clone --filter=blob:none`, without depth. The fetched fix2 landing head was required to equal e6c2d21a2dbf998f91bf478566a094876d7e9313 and printed by `git rev-parse HEAD`. The named branch was created from that head, then fresh origin/main bf872df8566011be5e46c6b5f777fb46d11b0f27 was merged. No published commit was rewritten. CONTRACT.md merged cleanly; the only conflict was the generated sources.lock.json, replaced from main and regenerated. Main's newer tests, roadmap implementation and clause judgments were preserved. All 272 Status rows from each parent still have exactly their prior status. There is no tracked ID-MAP file in this checkout.

## Cause and fix

The unchanged `provePopulatedUpgrade` helper applies the historical schema, inserts historical sample data, then populates initiatives/subscriptions through current mounted routes before the leadership migrations and later 0138. The new ROLE-011 visibility CTE referenced `r.suspended_at` unconditionally. Initiative creation failed 400 with `D1_ERROR: no such column: r.suspended_at`; the fixture requires 201.

Ruling option (a) was applied in src/core/features/roles/visibility-sql.ts. The operator source now projects the real row first, followed by nullable suspension columns. SQLite resolves the first matching projected column: before 0138 the null columns provide pre-suspension behavior; after 0138 the real suspension time/actor take precedence. The existing workspace/role visibility join and retained identity labels remain in place. The real D1 lifecycle regression confirms suspension labels, assigned work, revoked credentials, reactivation and retained history after migration.

No fixture insertion, route call, migration application order or assertion was deleted, skipped, moved or weakened. The historical sample fixture, populated-upgrade helper and leadership-digest upgrade test are byte-identical to origin/main. The existing targeted role-matrix selector omits unrelated cases only for local diagnosis; the full file remains registered in Verify. The only new product logic in this round is the query projection. CONTRACT.md ROLE-011's row adds boundary evidence without changing its PARTIAL judgment; the lock is regenerated.

## Reproduction and probes

REPRO historical-release/0138: head -> FAIL, one leadership-digest upgrade test; initiative POST returned 400 instead of 201, with missing r.suspended_at. Command: `timeout 240 pnpm exec vitest run --config vitest.config.ts tests/worker/leadership-digest-upgrade.test.ts`. See repro.log.

PROBE historical-release/0138: fixed -> PASS, the exact original `timeout 240 pnpm exec vitest run --config vitest.config.ts tests/worker/leadership-digest-upgrade.test.ts` command passes (1 test; 22.34 seconds total). See probe-exact-command.log. The same test and assertions also passed under a tighter 120-second bound, recorded in probe-upgrade.log.

PROBE lifecycle and erasure regressions: fixed -> PASS, 5 files / 6 tests in 302.33 seconds: leadership-digest-upgrade, member-suspension-upgrade, member-suspension, personal-time and imported-person-erasure. See probe.log. This includes the real pre-0138 route, populated schema preservation, old removals remaining unsuspended, current suspension state and retained names, existing person erasure after native removal, and the separate ROLE-012 debt remaining open.

The prior exact-SHA logs also show the current-private/invited-teams role-matrix case timing out at 120 seconds. Its unchanged local regression passes (31.99-second test duration, 44.85-second total): `timeout 240 pnpm exec vitest run --config vitest.config.ts tests/worker/role-matrix.test.ts -t 'current private and invited teams'`. See role-regression.log. No timeout or assertion was changed.

Typecheck: PASS, `timeout 240 pnpm typecheck`.
Build: PASS, `timeout 600 npx -y @runeditrun/rer build`.
Native rer check: PASS, `timeout 240 npx -y @runeditrun/rer check`.
All setup/build and long-lived commands ran through cloud_run with hard command bounds. The supplied toolchain reported Node v24.19.0 / pnpm 10.12.4 for direct pnpm commands; rer also provisions and uses its own Node 22.20.0 launcher. No dependency pins changed.

## Mechanical results

MECHANICAL ledger=`timeout 120 node --test scripts/deployment/tests/migration-head.test.mjs` exit=0; spec=`pnpm integration:sync && pnpm integration:check` exit=0; lock=`pnpm sources:lock && pnpm sources:check` exit=0; views=`node scripts/contract-docs.mjs write ROLE-011 && node scripts/contract-docs.mjs check ROLE-011` exit=0.

The ledger test applies all migrations, verifies unchanged owner/invitation/removal guards and foreign keys, then proves repeating migration application performs no writes. Main's highest migration is 0137; candidate 0138 does not collide and no main migration was edited or renumbered. The spec already contains 0138 from the renumbered parent; the documented generator/check reproduces it without a new spec diff.

After successful contract generation/check, both generated views were restored whole with `git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md`. Their final contents exactly match main and are not hand-resolved. A subsequent `node scripts/contract-docs.mjs check ROLE-011` exits 1 only because ACCEPTANCE.md differs from the generated view; this is the documented lander-owned view exemption. The Mac lander regenerates those views from merged CONTRACT.md. The source lock was regenerated last after staging and its check passed. No SDK protocol/generator input changed and no generated SDK file was hand-edited.

Before/after counts, for main and the prior candidate alike: DONE 136 -> 136; PARTIAL 72 -> 72; MISSING 64 -> 64; TOTAL 272 -> 272. ROLE-011 PARTIAL -> PARTIAL. ROLE-012 is unchanged. No status changes, promotions, new accepted points or landing claim.

`git diff --check` on the merge reports an existing extra blank line at EOF in main's src/core/features/administration/project-fields.ts. That upstream file was preserved; the targeted query/contract edits introduce no whitespace finding.

## Publication and custody

The final merge commit was created with explicit Run Edit Run fleet author and committer environment overrides and active co-author cleanup hooks, preserving repository hooks. All 13 candidate commits, including side parents, were audited before the push. Identities are fleet or existing owner James Peter; no disallowed trailers or surviving OpenAI/Codex co-author lines were found. The new commit itself is fleet-authored and fleet-committed, with no trailer.

Only cloud/sd-vector-c-f207-fix3 was pushed, once, without skip-ci, using the required cloud push guard; it succeeded on attempt 1. No main/default branch, other repository, PR or deployment was changed. See push-receipt.txt and identity-audit.txt. Evidence publication is separate, report-only custody and does not establish product readiness or acceptance.

GitHub reads use the launcher-decrypted bundle only, without logging credential values. Prior failing job archives were read once per job; focused public failure excerpts are included. No blocked blob redirect was retried. Exact-SHA candidate Verify was discovered through REST; further reads are throttled to at most one per run per 300 seconds within the ten-invocation budget. CI observations are saved in the packet and checks-receipt.json.

## Browser proof

The existing memberSuspensionJourney was invoked unchanged from an external runner using createAdminRuntime and bootstrapOwner. Chromium /usr/bin/chromium ran headless with --no-sandbox. The candidate journey passed, exercising native suspension, retained rendered names, hidden private views, refused old admission, fresh native reactivation sign-in, the same identity and restored private view, and unchanged comment history. Browser proof captured suspended-history and reactivated-history exactly once at 1440 and 390; overflow and serious/critical axe checks passed. All four images were visually inspected. The browser and its owned Worker were closed. See browser/browser-receipt.json and browser/roles/*.png. The external runner changes no product test file.

## Additional integrity check

Offline Base-copy integrity passed: `timeout 180 pnpm sources:verify-base` (base-copy-check.log). An optional extra `rer verify` invocation was stopped during its bundled Chromium download, before browser launch, because this rer version's hydration launcher does not expose the requested system-Chromium executable override. This is recorded as interrupted (outer command exit 241, native job exit 143), not as a product assertion failure or a passing check. All required brief-local checks and the explicit /usr/bin/chromium browser proof passed. Exact-SHA Verify remains authoritative. See native-verify.log.

## Final observations

Exact-SHA Verify 42552730255 is completed/success at db865aaeaf9a5e327f8128664325d30d408310ed. All 11 jobs, including all eight shards and the final verify job, completed successfully. The prior two failing asserting shards are now both successful; the aggregate Verify is green. No generated-view exemption was needed for readiness. The last REST run response is ci-final.json, and ci-jobs.json contains all job IDs and completion results. The ten-invocation GitHub budget was honored; the single watcher kept status observations at least 300 seconds apart.

READY is product-branch custody for this exact SHA, not clause acceptance or landing. ROLE-011 remains PARTIAL and all 272 statuses are unchanged. There are no product blockers. This cloud made no main/default-branch push or deployment and created no PR.

The complete explicitly selected public-safe packet is published separately to refs/heads/evidence/sd-vector-c-f207-fix3; the terminal EVIDENCE line records its exact commit. Evidence hash verification and disposable clone cleanup follow publication. No finished unpushed work remains.
