# Vector DATA-017 privacy FIX1

The introduced nonmember-Admin leak was reproduced and repaired through the mounted native Worker HTTP doors and real local D1. The product branch is pushed. Local touched checks pass; full exact-final runtime Verify and the original-family independent affected re-gate remain separate obligations. No acceptance or landing is claimed.

## Provenance and scope

- Tag: sd-vector-c-f191-local1-fix1. Lifetime: FIX1 of cap 2, original family sd-vector-c-f191 / authorized local1. This is the sole commissioned B repair, privacy standing bar/R4.
- Repository: just-every/run-vector. Branch: cloud/sd-vector-c-f191-local1-fix1.
- Frozen input branch/head: cloud/sd-vector-c-f191-local1 at 6ede4ca7a38c98f23cc2c33e54e1a189d85cf79b; fetched and verified exactly.
- Current main used: e6010126cf33eeb7e70368b741bf89ba9dae2672. It is already an ancestor of that input. The ordinary pre-edit rebase onto origin/main completed as up to date; the final fetch retained that same main. No published history was rewritten and there was no force push.
- Product fix/head: d3c868c3f4464226f647303981bea7e27677469a, DATA-017 protect migration custody with native private-team visibility.
- No PR created: the declared branch feeds the existing fleet lander; no repository rule requires a PR for this task.
- The 3 inherited feature commits remain unchanged with their original authorized owner identity. The new fix uses Run Edit Run fleet <fleet@runeditrun.com> as author and committer. Every candidate, including side parents, and all trailers/messages passed the required identity inspection before the guarded push; no AI co-author trailers are present.

## Actual before/after

Command for both: `cloud_run pnpm exec vitest run --config vitest.config.ts tests/worker/file-migration.test.ts`, after sourcing `/tmp/rer-cloud-toolchain.sh` from the checkout root. The official repository Worker harness invokes the real mounted server routes, D1 migrations, native invitations, role changes, import planning/apply/resume and report/finish doors. No application mock or fallback was added. No built-browser probe was needed for this server-only repair.

Before production edits: original exact production source at 6ede4ca7a38c98f23cc2c33e54e1a189d85cf79b plus the added regression block. Exit 1; the original assertion body ran through, then the privacy probe recorded the same failure as the blocking brief. The failure was `migrationListedForAdmin` expected false, received true. See privacy-before.log.

After repair: exit 0, one file and one registration passed, 47.53 s total / 38.85 s test execution. See privacy-after.log. The successful harness log does not print the captured console line; the after values below are established by the passing explicit response/body assertions, not claimed as a second captured console line.

| Public observation | Before | After |
| --- | --- | --- |
| Private migration listed to nonmember Admin | true | false |
| Same private native issue | 404 | 404 |
| Existing creator-bound per-run report | 409 | 409 |
| Migration JSON | 200 | 409 |
| Migration CSV | 200 | 409 |
| Private team name in returned JSON | true | false |
| Absent private source endpoint in returned JSON | true | false |
| Absent private source endpoint in returned CSV | true | false |

Authorized and custody controls in the same registration pass: Owner report and CSV; Admin access to a public migration while an unrelated private team remains hidden; membership grant making the private JSON exactly equal to the Owner's full report, including counts and exact pending list; authorized private CSV containing the actual missing endpoint; unchanged creator-bound old per-run report refusal; withdrawal immediately refusing JSON/CSV/finish; refused requests leaving the existing custody snapshot unchanged; re-granted Admin accepting exactly the pending IDs once; repeated finish returning unchanged custody; post-finish withdrawal hiding accepted omissions as well. The existing role demotion, member refusal, foreign-workspace, revocation, explicit/stale-list, concurrency, restart, native-edit, erasure and archive/restore assertions remain intact and passed in this touched test.

## Implementation and complete changed paths

Relative to frozen local1, exactly five paths changed:

- `src/core/features/data/migrations/model.ts`: retained import plans are read using Base's existing verified loader and the native adapter. Native planned destination teams and native issue references are checked with the existing `roles/visibility-sql.ts:visibleTeam` predicate, together with current issue locations. Historical source rows are treated as an indivisible report: unreadable content refuses the entire migration with the same generic 409 as an unavailable migration. Existing session/leadership/workspace checks remain.
- `src/core/features/data/migrations/report.ts`: recheck the migration's current content admission before returning report data, after the existing version/session guard. Both JSON and CSV use this one report service.
- `src/core/features/data/migrations/service.ts`: the necessary direct dependency outside the two named production modules. The list entry point lives here, so its eight-line diff imports and applies the same native-content helper before returning list rows, then repeats current leadership admission. Without this call, private migration existence/source/version would still leak in the list. The create/finish implementation is byte-identical to local1.
- `tests/worker/file-migration.test.ts`: append 36 lines to the existing native journey for the commissioned nonmember Admin case and authorized/current-membership controls. No registration added, removed, skipped or weakened.
- `sources.lock.json`: regenerate four source/test hashes after all edits and view restoration. No unrelated lock or pin changes.

No UI, homepage, style, workflow, provider, dependency pin, Base copy, migration, identifier, lifecycle or source-hold change was made by this fix. The original candidate's feature delta is retained as required; its pre-existing UI and migration changes are not new FIX work. No change was made to CONTRACT.md or its acceptance/status/evidence/gap cells by FIX1.

## Validation and counts

- Changed Worker public-door registration: before 1 failed / after 1 passed; registration count 1 -> 1, net 0. The original registration body is exactly preserved after removing only the appended privacy block, verified programmatically.
- `pnpm typecheck`: exit 0.
- `cloud_run pnpm check` (native `rer check` mechanics): exit 0.
- `node scripts/contract-docs.mjs write DATA-017` and `check DATA-017`: both exit 0. Generated ACCEPTANCE.md and docs/CLAIMS.md restored whole from origin/main and neither committed.
- Stage touched source/test paths, then `pnpm sources:lock` and `pnpm sources:check`: exit 0. Source lock is last product generation; the diff contains only four hash updates.
- `git diff --check` and staged diff check: exit 0. Final product worktree clean.
- Official setup completed once, exit 0. Supplied cloud toolchain selected Node v24.19.0 and pinned pnpm 10.12.4; package engine warnings identify Node 22.20.0 as the repository request. No pin was changed. Setup/build output is not asserted as an independent candidate build proof. Raw setup output is excluded from the public packet because setup may contain private local installation/runtime data.
- Clause counts unchanged from input/current source: published 98 done / 6 partial / 0 missing / 104 total; target 38 / 63 / 67 / 168; all 136 / 69 / 67 / 272. DATA-017 remains PARTIAL -> PARTIAL. ROLE-002 and OPS-001 cells remain unchanged. No new clause or acceptance/gap promotion.

## Preserving the original passed evidence

SOURCE_EQUALITY.json records SHA-256 for all 32 paths in the inherited feature delta: 27 remain exactly equal; the only unequal paths are the five FIX paths listed above. It also verifies the full original test body, the create-through-finish service suffix, and migrationAuthority, requireMigrationAuthority, importMigration and migrationBatch remain byte-identical where applicable.

| Frozen rubric row | Preserved relevant bytes / bounded change |
| --- | --- |
| R1 reviewed files and durable exact references/CSV | Import service/mapper/native report and migration pending/routes unchanged; report serialization body unchanged; original exact list/CSV assertions retained and passed |
| R2 implicit/stale finish refusal | Entire finish implementation and pending collector unchanged; all original no-write/version/list assertions retained and passed |
| R3 once-only explicit omission custody | Entire finish implementation unchanged, original replay/concurrency/restart/restore assertions retained; new authorized Admin acceptance/replay also passed |
| R4 current authority and foreign workspace | Authority/session/batch functions unchanged; only additional current native content admission and list omission; original role/workspace/revocation cells passed plus the new privacy case |
| R5 erasure and native edits | Erasure/import source modules unchanged; exact retained assertions passed; separate pre-existing archive payload retention not repaired or reclassified |
| R6 upgrade and archive custody | Applied migration, archive inventory/policy and file-migration-upgrade.test.ts unchanged; existing touched journey archive/restore assertions retained; no rerun of the separately passed upgrade body |
| R7 UI1440/390 and import assertions | Original UI modules, file-migration browser journey and data runtime entry point byte-identical; original independent gate's built UI proof retained by byte equality; no UI edits or new browser qualification |

The original gate's eight affected Worker tests, types/build/mechanics and built UI1440/390 passes are inherited evidence, not presented as new runs. The broader rubric was not replayed.

## Remaining custody and dependencies

The sole independent original gate actually ended 2026-11-06T05:03:20Z GATE FIX1 with one BLOCKING B. The disconnected original cloud191 is not qualifying evidence. The next decision remains the same original-family independent affected re-gate of B and plausible regressions, not a new full-clause judge.

The original runtime Verify 42152804143, worker2 job 127680188637, remains its original red evidence: one failed 2-of-6 partition replay. The same-runner main role control did not finish within its outer 1800 s. There is no additional BAR finding, infrastructure inference or green/flake waiver. No retry, full-wall rerun, timeout increase, workflow dispatch or unrelated CI repair was performed. The candidate's full exact-SHA green runtime Verify is still an explicit guarded-lander obligation; status is separately recorded in CI evidence and must not be inferred from the local touched checks or evidence publication.

The omitted 50k Linear / six-team / comments-bytes-history / 5k links / 2k cross-run / 13 out-of-order runs, all-kind late binding, mapping reuse, exact 100-change pass, full aggregate reconciliation and whole-migration rollback remain omitted and PARTIAL. DATA-007, importer/customer custody, FIELD-001, interface/source/stack/provider/release holds, the original frozen lifetime and all other existing prerequisites remain unchanged. C hydration/helper race, F role-fixture census, G startup/unrelated CI failures and the separately held pre-existing erasure archive payload retention remain outside this FIX.

The cloud cannot run the fleet's final publication scan. The Mac retains that scan, independent affected gate, exact-final runtime Verify and landing custody. No main/default-branch push, self-submission, deployment or release was attempted. Evidence-only publication is report transport and does not establish READY, acceptance or landing.

## Terminal CI and product custody

Exact-SHA REST discovery at 2026-11-06T05:25:08.679369+00:00 returned Verify run 42167787360, in_progress, conclusion null, on d3c868c3f4464226f647303981bea7e27677469a: https://github.com/just-every/run-vector/actions/runs/42167787360 . Two total GitHub API budget calls were used. The first abbreviated-SHA empty query is retained in CI_INITIAL_REQUEST.json and establishes no result; the final qualifying request uses the full SHA and respects the 300-second discovery cadence. No CI log archive was read because no failing run had completed.

Per this bounded cloud brief, there is no CI wait or full-wall rerun. Terminal product custody is PUSHED, with the exact-SHA Verify still running and the independent affected privacy re-gate pending. No green Verify or completed independent acceptance is claimed, and pending CI is not labelled a product blocker. The Mac must obtain its required exact-final runtime green and publication scan before landing.
