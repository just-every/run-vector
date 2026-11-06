# Vector additive ordinary contract generation

Task: sd-vector-contract-additive-generator-1
Repository: just-every/run-vector
Branch: cloud/sd-vector-contract-additive-generator-1
Product head: 5cf3649a1dddb2c2774bae51121b156518bd7b69
Fresh main before publication: e6010126cf33eeb7e70368b741bf89ba9dae2672
PR: none created; this repository's instructions retain guarded fleet landing.
CI run IDs: none queried, dispatched, rerun or awaited, as the task-specific brief directs.
Product custody: pushed successfully and advertised remote head verified.
Landing custody: independent affected gate and maintained Mac lander. No landed receipt or CI success is claimed.

## Result

The original CT contract-writer prerequisite is repaired in the edition-owned adapter. An explicitly selected valid ordinary source clause can now append its generated acceptance entry without a BASE-AGENT prefix. Unknown requests and invalid source still refuse before any writes. CONTRACT.md remains the sole source of acceptance and status.

The change removes only the prefix restriction at scripts/contract-docs.mjs:42. Existing selection logic is unchanged: explicit IDs select touched clauses; no-argument runs select previously marked clauses plus the existing BASE-AGENT family. A newly generated ordinary clause carries the existing marker and is then maintained by default write/check. Untouched legacy narratives and published/target/push-further grouping are preserved. This is not a broad migration of all legacy prose.

Exactly three product paths changed:
- scripts/contract-docs.mjs: remove the prefix-only append refusal.
- tests/installer/adapter.test.mjs: one new public-command regression in the existing discovered harness; its synthetic source addition exists only in a temporary tree and is removed afterward.
- sources.lock.json: regenerate last; only the two touched file hashes change.

No product clause, ruling, acceptance, status, gap, evidence, hold, pin, workflow, application, privacy, actor, migration, UI or discovery registration was changed. Product CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md equal fresh main byte for byte; neither view is in the commit. No CT draft or new product obligation was applied.

## Ownership and plan execution

The clone was shallow/blob-filtered from current main. Its main SHA and adapter blob c994b97893bc00ca09af4c742090820272555bb3 exactly match GR's qualified ownership return. Actual AGENTS.md declares scripts/contract-docs.mjs as Lander-Regenerate. base-copies.json has no copy record for that adapter; the imported parser remains recorded separately at src/base/seed-contract.mjs (foundation/runtime/seed-contract.mjs). No shared Base publication, adoption or source-pin change was made or required.

The full execution plan is in PLAN.md. Fleet identity and preserving commit hooks were installed before the first commit. Only the declared product repository was cloned. Source/parser/declarations and the existing public-command harness were inspected before editing. The same diagnostic source addition and public-command regression were exercised before and after the one-line repair. Current main was fetched again before commit/publication; the unpublished rebase reported the branch up to date. Source lock was generated after final product/test edits and after restoring views. The candidate was committed once with explicit fleet author/committer environment and immediately pushed through cloud-push.py. Every candidate commit (including side-parent traversal) was audited; there is one, with fleet author/committer and no trailers. Remote custody was then checked with git ls-remote.

The final packet is published separately to evidence/sd-vector-contract-additive-generator-1. It contains reports/receipts only and never signals acceptance or landing.

## Before/after proof

The diagnostic chooses an unused SYNTHETIC-VECTOR-NNN ID from the actual parsed source. It adds an ordinary clause under Issues, its actual source acceptance, and one complete published/missing Status row to a temporary source tree. Generated views are copied unchanged, never hand-inserted. The existing parser independently accepts that diagnostic source with the stale generated summary omitted.

On unchanged main, these actual argv both exit 1 with "No legacy acceptance entry for SYNTHETIC-VECTOR-001" at line 42:
- node scripts/contract-docs.mjs write SYNTHETIC-VECTOR-001
- node scripts/contract-docs.mjs check SYNTHETIC-VECTOR-001

On the repaired adapter, the identical source case and argv both exit 0. Complete stdout/stderr and parsed source data are retained in additive-before.log and additive-after.log.

The affected regression command is:
node --test --test-name-pattern='contract authoring generates an ordinary additive clause' tests/installer/adapter.test.mjs

It fails before the repair at the same missing-legacy-entry refusal, and passes afterward: 1 selected test, 1 pass, 0 failures. It verifies:
- A stale check refuses and writes nothing before write generation.
- Write then check succeeds for the ordinary source addition; requirement, acceptance, missing status and Gap appear in generated acceptance/claims.
- Every original clause's parsed content and full original Status row remain intact, including complete Evidence and Gap cells and grouping.
- Every existing non-summary legacy narrative/claim line is retained.
- Counts increase by exactly one missing clause, with all existing clause data unchanged.
- Repeated explicit write/check is byte-deterministic.
- Default check selects the marked ordinary clause; changing its source acceptance makes check fail until default write regenerates it. Repeated default write/check is deterministic.
- Both write and check reject an unknown source request and a clause missing its Status row, without modifying any of the three files.

Affected command-harness registrations: 2 before, 3 after; one new meaningful behavior registration. Existing assertions were neither removed nor weakened; test discovery was unchanged.

## Counts and statuses

Product before and after:
- Published: 98 done, 6 partial, 0 missing, 104 total.
- Target and push further: 38 done, 63 partial, 67 missing, 168 total.
- All: 136 done, 69 partial, 67 missing, 272 total.

Temporary diagnostic only:
- Published: 98 done, 6 partial, 1 missing, 105 total.
- Target and push further remains unchanged.
- All: 136 done, 69 partial, 68 missing, 273 total.

Clause status changes: none. No DONE grant or source judgment is implied.

## Other touched validation

All following commands exit 0; exact argv, timestamps, exits and full output filenames are in commands.jsonl and receipt.json:
- node scripts/contract-docs.mjs write HOME-001
- node scripts/contract-docs.mjs check HOME-001
- node scripts/contract-docs.mjs write
- node scripts/contract-docs.mjs check
- node --check scripts/contract-docs.mjs
- node --check tests/installer/adapter.test.mjs
- pnpm sources:lock
- pnpm sources:check

After each real-source generation proof, views were restored with git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md. CONTRACT.md was unchanged throughout. Final source lock was generated LAST and checked; its complete actual output is retained in sources-lock.log and sources-check.log.

Typecheck is not applicable to these .mjs changes: tsconfig.app.json sets allowJs false and includes src, and tsconfig.node.json includes only Vite's two TypeScript configs. No TypeScript file changed. No dependencies or application setup/build were needed. The supplied cloud toolchain retained the newer VM Node v24.19.0 with pnpm 10.12.4 rather than installing an older Node 22.20.0; pnpm's engine warning is preserved in the lock/check logs. The affected runtime command and syntax checks passed on that actual runtime. No repository toolchain pin changed.

No full suite, baseline, Verify, browser, publication scan, deployment, tag or release was run. These are explicitly outside this prerequisite brief; independent gates retain exact-final runtime Verify, complete full-history publication scan, guarded main equality and exact-main Run site.

## Custody and remaining work

The product push guard succeeded on its first attempt. The published remote ref advertises product head 5cf3649a1dddb2c2774bae51121b156518bd7b69. The working tree was clean, with only the three authorized paths changed from main. Receipt hashes prove authority/view equality and lock scope. candidate.patch preserves the exact product diff outside the clone.

Blockers to this repair: none observed. CT remains held until a qualified guarded landing receipt for this generator repair is returned; a pushed candidate and this report do not unblock or apply the original writer's draft.
