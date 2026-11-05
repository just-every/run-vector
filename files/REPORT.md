# sd-vector-c-f189 — GitLab setup

Product branch: cloud/sd-vector-c-f189
Candidate: dc2688516daa1c31503a405c9327277d056d4ab0
Base main: 7c811313e446ae19630f387f2ac927dafba3dbe5
Implementation save: 6de99b93e44d6e5a508f5ca83ed66bca12e37e5e
PR: none required; Verify accepts pushes to the named cloud branch.

GITLAB-001 moves MISSING → PARTIAL. The selected setup half is implemented and locally proved. Full clause DONE is not claimed. All 272 parent Status rows remain; counts move from 136 DONE, 69 PARTIAL, 67 MISSING to 136 DONE, 70 PARTIAL, 66 MISSING.

## Plan and completed work

1. Read the live clause, setup-provider table, status Gap, repository instructions and supplied campaign, rulings and DONE riders. Map the selected setup behavior to native Settings, current Owner and Admin authority, sealed integration credentials, archive inventory and the existing Worker and integration browser paths.
2. Add focused connection, project-list, hook-registration and configuration modules. Validate a public HTTPS GitLab origin and a grant with only api scope, discover Maintainer project identities, and admit only selected returned identities. Generate installation callbacks and separate signing secrets server-side. Fence current authority and credential generation before provider writes. Persist a registration claim before each single provider write; preserve per-project registered, rejected and unknown results. Interrupted or unknown claims remain inert. Re-entry updates a known hook identity using PUT rather than creating a duplicate.
3. Mount the native management routes and existing Settings controls. Keep management Owner and Admin only. Add forward-only migration 0126 and archive inventory classification; tokens and signing secrets use the already excluded sealed store. Prove populated upgrade, full native archive download and restore, absent restored credentials, explicit re-entry, unchanged unsafe refusals and continued uncertainty after restart. Register the browser helper through the existing integration runtime and inspect the actual Settings section at 1440 and 390.
4. Synchronize only the clause status, evidence, honest Gap and management-row citation. Run generator write and check, restore generated views from main, regenerate and check the source lock, retain all parent rows, use fleet identities and hooks, publish the named product branch and separate public-safe evidence packet. The fleet retains publication scan and landing custody.

## Selected proof rubric

R1: Native token entry and project discovery on GitLab.com and a self-managed origin. The mounted journey in ./tests/worker/gitlab-setup.test.ts, lines 32–41 and 54–60, confirms the actual API edge, Maintainer filtering and both selected project identities. Both origins first register two hooks successfully. Browser helper: ./tests/e2e/gitlab-setup-journey.mjs, exerciseGitlabSetup.

R2: Actual selected hook registration with this installation's callback and distinct generated secrets, without hand-entered callback values. The same Worker journey inspects provider POST bodies, exact paths, callback identities, generated secrets and replay without another write. Re-entry uses the known provider hook IDs. The browser edge records only synthetic secret digests; its helper verifies distinct identities and exact callbacks.

R3: Current authority, selection and custody. The Worker journey attempts malformed, duplicate and foreign project selections; Member, Guest and Viewer management; and an Admin's authority withdrawal between provider reads and the write claim. Refusals preserve integration rows, sealed keys and audits and make no unauthorized provider write. The six existing role-matrix journeys pass with valid seeded GitLab census requests. Unsupported event processing is explicitly reported and cannot create issues.

R4: Honest partial and unknown results. A self-managed connection first succeeds, then one explicit known-hook update is refused and another loses its acknowledgement. Only the confirmed project is shown registered. Reload, restart and repeated registration never blindly repeat an unknown write. Browser proof shows the persisted partial state.

R5: Upgrade, archives and credential re-entry. The populated upgrade journey in ./tests/worker/gitlab-upgrade.test.ts preserves prior rows and schema. The native export and restore phase in ./tests/worker/gitlab-setup.test.ts opens the populated archive, confirms token, ciphertext and signing-secret exclusion, restores safe identities and outcomes, refuses use before re-entry, and explicitly updates known hooks with fresh secrets. Local credential removal erases stored keys and stops use.

R6: Native interface. The committed browser helper exercises the rendered Settings controls and token clearing, keyboard operation, overflow, text size, serious and critical accessibility results and hydration. Assertions run at 1440; proof captures are ./browser/gitlab/setup-1440.png and ./browser/gitlab/setup-390.png. Existing Settings styles and components are reused. No new icon-only control exists.

## Commands and results

Eight touched Worker registrations pass: one GitLab setup journey, one populated-upgrade journey and six existing role-matrix journeys. Typecheck, first-party check, application build, focused browser journey, generator write and check, source lock generation and check and the local migration-ledger helper pass. Exact commands, actual output files and source-equivalence qualifications are recorded in LOCAL_RECEIPT.json. The product source, migrations and seed metadata are byte-identical to the implementation save; the final commit adds the contract qualification and strengthened setup proof. No existing assertion was removed, narrowed, skipped or placed behind a new width condition. Two focused Worker registrations were added; no cap raise or workflow edit was made.

The local role regression initially identified a management-row label mismatch between code and CONTRACT.md. Both declarations now cite GITLAB-001; all six role tests pass. Earlier setup development exposed an incorrect workspace foreign key, which was corrected before the first product commit. The withdrawal fixture initially tried to demote the protected installation owner; it now withdraws an ordinary Admin and still requires refusal before a provider write. No test was weakened to accept these failures.

PROBE GITLAB-001 discovery: native Settings token entry at both origins → maintained project identities returned; token fields cleared.
PROBE GITLAB-001 registration: choose two returned identities → two actual project-hook registrations with exact installation callbacks and separate generated secrets on each origin.
PROBE GITLAB-001 authority: malformed or foreign selection and Member, Guest or Viewer management; Admin withdrawal during preflight → refused unchanged, no unauthorized provider write.
PROBE GITLAB-001 outcomes: confirmed pair followed by refused and unknown updates → distinct persisted results; unknown capture replay causes no write.
PROBE GITLAB-001 custody: populated native archive download and restore → no token, ciphertext or signing secret exported; management requires re-entry and updates known hook IDs with fresh secrets.
PROBE GITLAB-001 interface: native Settings selection, reload, local credential removal and re-entry → usable controls and retained outcomes, captures at 1440 and 390.

MECHANICAL lock=pnpm sources:lock and pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write GITLAB-001 and check GITLAB-001 exit=0; ledger=scripts/data/ledger.mjs via Node IPC exit=0, platform=false. Generated views were restored whole from main and are not in the product commits.

## DONE riders and held scope

1. Full acceptance remains unmet: MR opened, approved and merged, branches, commits, configured status movement, approvals, pipelines and production deployment remain owed. Selected setup outcomes pass; no DONE claim.
2. Dangerous management paths are exercised both ways with seeded data and unchanged refusal assertions.
3. Exact-candidate Verify is recorded separately below; full acceptance is not inferred from local proof.
4. Relevant source equivalence and actual local output are retained in the receipt. Final setup proof and browser helper are rerun after their last edit.
5. No additional inherited duty is claimed complete. Remaining INTEG-001, RELEASE-002, CI-001 and PUSH-003 duties remain named in the Gap.
6. PARTIAL Gap names the real remainder. Generator write and check pass before generated views are restored for fleet regeneration.
7. Acceptance sentences are unchanged. Only status, evidence, Gap, counts and the existing management-row citation change.
8. Owner and Admin admission and Member, Guest and Viewer refusal, current-authority withdrawal and credential removal are exercised through mounted native doors.
9. Network-edge fixtures only. No real provider or hosted commissioning is claimed.
10. The supplied standing policy permits the conservative interim default while PARTIAL: explicit Owner and Admin management, least-scoped token, selected project writes, no blind retry and no automatic destructive provider cleanup.
11. Guarded landing, complete full-history publication scan and candidate Run site remain fleet gates. Main is not pushed or advanced by this run.

GITLAB-002 issue and comment sync and every unselected provider behavior remain fully owed. The supplied Claude Opus implementation qualification and independent interface gate remain outstanding; this Codex run does not claim either. No account or live-provider key was used. The campaign row changed is only GITLAB-001, MISSING → PARTIAL; no full-plan or inbox file was edited.

## CI and custody

Base main Verify 42014502098 and Run site 42014502043 are completed success on 7c811313e446ae19630f387f2ac927dafba3dbe5; these are baseline results, not candidate results. Candidate observations: [{"conclusion": null, "event": "push", "head_sha": "dc2688516daa1c31503a405c9327277d056d4ab0", "html_url": "https://github.com/just-every/run-vector/actions/runs/42125559127", "id": 42125559127, "name": "Verify", "status": "in_progress"}].

Product push and evidence publication are separate. Evidence does not assert READY, acceptance or landing. The final message names terminal branch custody and the exact evidence ref and head. No publication scan receipt is fabricated.

Terminal custody: PUSHED branch=cloud/sd-vector-c-f189 head=dc2688516daa1c31503a405c9327277d056d4ab0

Verify 42125559127 remains in progress after one discovery and one follow-up separated by at least 300 seconds. No failing candidate run was observed. CI green is not established. Three GitHub API calls were used in total, including the baseline-main discovery. The local cloud CI wait is complete; the fleet keeps independent gate, publication scan and landing custody.
