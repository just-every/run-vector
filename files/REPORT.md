# sd-vector-c-f190 results

Product repository: just-every/run-vector
Branch: cloud/sd-vector-c-f190
Product head: e4e7ec012e2ea6184f7b7919ce880547579860ff
Requested base: dc2688516daa1c31503a405c9327277d056d4ab0
Current main used for integration: 7c811313e446ae19630f387f2ac927dafba3dbe5
Product custody: pushed successfully with the fleet guard on its first attempt. This is a [skip ci] save, not a READY candidate. No PR was created or required by the branch workflow. No main ref was changed.

## Scope and plan

This FIX round selected only the gate's exact-SHA Verify failure caused by a stale hosted deployment recipe omitting 0126_gitlab_setup.sql. It did not authorize the original campaign's remaining acceptance work. PLAN.md records the original five-step plan. The completed steps were to reproduce the named failure on its refused SHA, regenerate the deployment recipe using the seed's command, integrate current main, verify the touched behavior and mechanical checks, audit identities, and preserve the repair on the named branch. Report transport is separate from product readiness.

## Product change

Ran pnpm integration:sync against production output. The sole recipe change is the addition of migration 0126_gitlab_setup.sql, with its exact source SQL and digest f183d18883c67ccc2023a798a3166ca26d6207b82991f2ea99052df7309725e5. The recipe now carries 126 migrations instead of 125. No applied migration file or existing migration entry changed. Regenerated sources.lock.json with the documented command. These are the only two files changed by this round.

GITLAB-001 remains PARTIAL to PARTIAL. This round changes no clause acceptance, Status row, Gap, Evidence cell, plan row or count. Before and after: 136 DONE, 70 PARTIAL, 66 MISSING, 272 total. All 272 parent Status rows and 409 total table rows remain. No DONE claim is made. All previously stated GitLab provider, MR, deployment, interface qualification and independent-gate gaps remain fully owed. No test or assertion was removed, skipped or narrowed, and no permanent test was added.

## Reproduction and verification

Refused-head Verify run: 42125559127, push event, completed failure, head dc2688516daa1c31503a405c9327277d056d4ab0.
Named failed job: 127589212069, hosted-artifact.
Reproduced command: pnpm verify:ci --shard hosted-artifact, exit 1, with Node 22.20.0, pnpm 10.12.4, UTC and system Chromium. The exact error was: Error: Stale integration management/integration/deployment-spec.json; build the application and regenerate with pnpm integration:sync. The direct pnpm integration:check command also failed with that error. The first full-shard attempt lacked a Playwright browser; provisioning its expected executable location to system Chromium allowed the same shard to reach and reproduce the actual reported failure. No application source or test was altered for reproduction.

Passing local checks:

- pnpm integration:check, including a rerun on the exact pushed head.
- pnpm typecheck.
- pnpm test:worker tests/worker/gitlab-setup.test.ts tests/worker/gitlab-upgrade.test.ts: two tests passed.
- node --test scripts/deployment/tests/migration-head.test.mjs: one test passed.
- pnpm exec rer check --profile first-party: exit 0.
- Contract generator write and check for GITLAB-001: both exit 0. Restored ACCEPTANCE.md and docs/CLAIMS.md whole from origin/main and committed neither view.
- pnpm sources:lock and pnpm sources:check: exit 0; check rerun after the final successful rebase and on the candidate.
- External deployment probe: all 126 recipe migrations actually applied through the real deployment migration adapter against its provider-network fixture; all three GitLab tables appeared; the applied ledger held the exact migration digest; foreign-key check was empty; repeating deployment applied no migrations and made zero provider writes. The exact pushed-head receipt is deployment-probe.json and is clean.

The typecheck, GitLab journeys and migration test were run before the metadata commit. None of their relevant source, test or migration bytes changed between that run and this head. The final public deployment probe and integration check ran again on the exact committed head. No UI code changed in this round, so no new screen proof was required. No scale or live-provider claim is made.

PROBE GITLAB-001 FIX deployment: pnpm integration:check and the generated recipe through the deployment migration API -> 126 migrations applied, all three GitLab setup tables present, exact source SQL and digest retained, reapply produces zero provider writes.

MECHANICAL lock=pnpm sources:lock then pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write GITLAB-001 then node scripts/contract-docs.mjs check GITLAB-001 exit=0; ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0.

## Additional real Verify blocker

The same refused-head Verify run also has a separate failed administration job, 127589212030. It fails [OPS-003] empty workspace administration through real mobile browser with:

integrations/ui/gitlab-settings.tsx#GitlabSettings form 1 names an unregistered door undefined

This is the existing Settings census asserting that the newly mounted GitLab form has no entry in settingsFormDoors. Its POST route is already declared and enforced; the missing metadata is a one-line entry. pnpm test:admin reproduced exit 1 on the refused head. The exact census assertion also reproduced exit 1 on the pushed head and passed on origin/main on this runner, so this is not reported as a flake. The failed-job log was read exactly once for each of the two failed assertion jobs. No failed log archive was retried.

The FIX section says to fix its blocking list and nothing else, and names only the omitted migration. A scope question for the additional one-line repair remains unanswered. The patch is concrete and reviewable in proposed-registry-repair.patch, but is not applied to the product branch. No further feature work was attempted. Because a real failure is known, the repair was pushed as a skip-ci save and is BLOCKED for readiness on that explicit scope boundary. No READY line is claimed.

## CI, custody and pending fleet gates

The candidate discovery returned no runs, as expected for its skip-ci save. No workflow was dispatched or rerun. The last run with relevant failure evidence remains 42125559127 on the requested base; no green result from another SHA is claimed. Five counted GitHub API or failed-job archive invocations were used. Publication scanning, exact-candidate Verify, guarded landing and Run site remain unestablished. Cloud branch pushes are exempt from the cloud-side scanner; no scan COMPLETE or green Run site claim is made.

All three commits relative to main passed author, committer and trailer inspection, including every side parent. The preserved pre-push hook repeats this inspection on each push attempt. The final save contains no email-shaped or provider-credential-shaped additions. Product push output, actual command receipts, the full reproduction JSON and the proposed unselected registry patch are selected explicitly for the separate evidence ref. No settings, runtime databases, credential files, environment dumps or private held-out material are selected. After verified report transfer, the product clone and its dependencies will be deleted as required; the complete packet remains outside it.
