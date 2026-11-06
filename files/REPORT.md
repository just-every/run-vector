# Vector f195 FIX1: generated live-sync inventory repair

Repository: just-every/run-vector
Branch: cloud/sd-vector-c-f195-fix1
Product HEAD: 9e4b16f8d1b9a3c68aacf77f2f73ef074fdb01ce
Original195: cloud/sd-vector-c-f195 @ 1a454502b9af6b959adccb8d55010f3dbcbb36f4
Fresh main: e6010126cf33eeb7e70368b741bf89ba9dae2672
PR: none; this repository's supplied rules use fleet landing from the candidate branch.

The reproduced blocker is repaired and the product branch is pushed. This repair changes exactly two files: `management/integration/deployment-spec.json` (+10 lines) and `sources.lock.json` (one digest substitution). No product source, test, SQL, Wrangler declaration, immutable migration, workflow, rer pin, contract text, acceptance, status, Gap, evidence or provenance bytes changed relative to the original product. The deployment spec was generated from the actual production Worker output, without hand edits.

## Original195 -> FIX1 mapping

The shallow/blob-filtered owned clone started at the exact original HEAD. Its three original commits are preserved unchanged in ancestry:

- 7e0faa672751201443246e862923b8cf03adf5e3
- 1d8bf8e93672099b28d6b3783141539d827ab785
- 1a454502b9af6b959adccb8d55010f3dbcbb36f4

FIX1 adds one commit: 9e4b16f8d1b9a3c68aacf77f2f73ef074fdb01ce (`Regenerate live-sync deployment inventory`). Fresh main was fetched twice; the last fetch and merge immediately before lock generation reported already up to date. Main e6010126cf33eeb7e70368b741bf89ba9dae2672 is an ancestor of both the original product and the repair. No rebase, rewrite, force push or main push occurred; no merge conflict required a decision.

## Plan and execution

1. Read the supplied RULES, launcher AGENTS, repository AGENTS, product/verification/contract instructions. Refresh the launcher, install its decrypted-bundle Git helper, preserve repository hooks through the fleet commit hook and set fleet identity. Clone only the declared repository and create the requested branch at the exact original.
2. Install frozen dependencies through the published rer command. The dependency/pnpm/rer pins were retained. No owner setup, application server, browser, provider operation or deployment was needed for a generated-inventory repair.
3. Build the original production Worker, then reproduce the stale spec using only `pnpm integration:check` before editing. Original retained private receipts are unavailable in this cloud; this run has its own actual before/after command receipts instead. No repeat main comparison or hosted-artifact/browser suite ran.
4. Regenerate the complete integration set using `pnpm integration:sync`, then run the same `pnpm integration:check`. Only the spec's missing live-sync DO binding and migration were added; generated project descriptor and workflow remained byte-identical.
5. Run typecheck, audit generated inventory against both parent inventories and actual emitted declarations, and run the existing focused migration-ledger check. All 125 SQL names/digests/SQL bodies match both parents and the current migration files; all parent resources, bindings and DO migration entries are retained.
6. Run the documented `node scripts/contract-docs.mjs write SYNC-001` and corresponding `check SYNC-001`. Both exit 0. Restore ACCEPTANCE.md and docs/CLAIMS.md whole from fresh main; neither is committed. CONTRACT.md remains byte-identical to the original; no status, summary or Gap edit results.
7. Stage the inventory, run `pnpm sources:lock` LAST, then `pnpm sources:check`. The lock changes exactly the deployment spec's hash, from `4f4239cf6ab52b2ae63b0a018d919f074d7641c7d67ac3311a77f90e6537bbf1` to `b73a9ea12dddb76c4d9b9a3c32ae7da2115e830371b59097d9407db99caa5094`. Every source pin and other file entry is unchanged.
8. Commit with explicit fleet author and committer environment and active hooks, inspect every candidate commit including side parents, and push only the named branch through cloud-push.py. First attempt succeeds; remote branch SHA is independently confirmed with ls-remote. Publish the explicitly selected report/receipt packet to the separate evidence ref.

## Actual before/after proof

The supplied toolchain initially left direct pnpm commands on VM Node 24.19.0, despite rer provisioning Node 22.20.0. Initial receipts are retained honestly. The complete narrow proof was then repeated with the provisioned Node 22.20.0 explicitly ahead of PATH and pinned pnpm 10.12.4. The authoritative pinned receipts are:

| Command | Actual exit | Receipt |
| --- | --- | --- |
| npx -y @runeditrun/rer build | 0 | pinned-production-build.log |
| pnpm integration:check before sync | 1, expected | pinned-before-integration-check.log |
| pnpm integration:sync | 0 | pinned-integration-sync.log |
| pnpm integration:check after sync | 0 | pinned-after-integration-check.log |
| pnpm typecheck | 0 | pinned-typecheck.log |
| node scripts/contract-docs.mjs write SYNC-001 | 0 | contract-write.log |
| node scripts/contract-docs.mjs check SYNC-001 | 0 | contract-check.log |
| One-off external inventory/source audit | 0 | inventory-audit.log and inventory-audit.json |
| node --test --test-concurrency=1 scripts/deployment/tests/migration-head.test.mjs | 0; 1 passed | migration-ledger-check.log |
| pnpm sources:lock, last source-generating command | 0 | sources-lock-last.log |
| pnpm sources:check | 0 | sources-check.log |
| Fleet guarded product push | 0; attempt 1/5 | product-push.log |

The actual before failure is: `Stale integration management/integration/deployment-spec.json; build the application and regenerate with pnpm integration:sync`. The matching after command prints `Integration deployment spec, setup digest and producer workflow match.`

The production build transiently appended generated TanStack registration types to src/routeTree.gen.ts. Those incidental build bytes were restored from the original before the authoritative standalone typecheck and are absent from the committed diff. No permanent one-off test was added.

## Inventory and counts

| Measure | Original195 | FIX1 |
| --- | --- | --- |
| DO bindings | 1 | 2 |
| DO migration entries | 1 | 2 |
| SQL migrations | 125 | 125, byte-identical |
| Contract done / partial / missing / total | 136 / 69 / 67 / 272 | 136 / 69 / 67 / 272 |
| Published done / partial / missing / total | 98 / 6 / 0 / 104 | 98 / 6 / 0 / 104 |
| Target done / partial / missing / total | 38 / 63 / 67 / 168 | 38 / 63 / 67 / 168 |
| Test registrations added / removed | 0 / 0 | 0 / 0 |

Generated DO inventory now contains LIVE_SYNC -> VectorLiveSync and RESTORE_COORDINATOR -> VectorRestoreCoordinator. DO migrations retain vector-http-restore-v1 -> VectorRestoreCoordinator and add vector-live-sync-v1 -> VectorLiveSync, in the emitted artifact's declared order. The complete before/after migration identities and preservation assertions are in inventory-audit.json.

## Clause and qualification custody

SYNC-001 remains PARTIAL. Its full broader-human-producer, automation/integration/agent, remaining-view, reaction, transport, latency and reconnect remainder is unchanged, along with SYNC-002/SYNC-003 and held checklist/agent/mobile/interface/custody duties. No acceptance, cap, evidence, status or Gap promotion occurred. Frozen original-family runtime proofs and all of their committed test bytes are preserved; they were not replayed or newly claimed by this run.

Original blocking Verify run from the supplied brief: 42143888765, hosted-artifact job 127651459943. No CI rerun, dispatch, query or wait was performed, as directed by this narrow repair brief. No new run ID or exact-SHA CI-green claim is asserted here. Independent original-family re-gate remains required; the Mac lander still owes full runtime-green exact-FINAL Verify, generated views, final lock/counts, COMPLETE full-history publication scan NEW0, guarded main equality and exact-main Run site. This cloud does not perform the fleet publication scan or claim acceptance/landing. No submission, admission, readmission, hold release, source pin mutation, tag, release or provider operation ran.

All four product candidate commits passed author/committer/trailer review; all use Run Edit Run fleet <fleet@runeditrun.com> and have no co-author trailers. The product checkout is clean. There are no repair blockers. Evidence publication is a separate report-only transport and conveys no product acceptance or landing signal.

## Files and receipts

The full plan is also in PLAN.md. Actual per-command exits, timestamps and durations are in command-receipts.jsonl. Frozen dependency installation has dependency-install.log and dependency-install-receipt.json. The exact two-file diff is product.patch; candidate messages/identities, source-lock audit, generated inventory audit, remote product ref and terminal product provenance are included as separate actual files. Only those explicit non-secret files are selected for evidence publication; no credentials, environment dumps, symlinks, runtime data or held-out gate material are selected.
