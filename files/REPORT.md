# Blocked: Vector contract-only privacy follow-up

Tag: `ct-vector-auto001-defer-text-20261106-0230`  
Repository: `just-every/run-vector`  
Branch: `cloud/ct-vector-auto001-defer-text-20261106-0230`  
Fresh main base and unchanged product HEAD: `e6010126cf33eeb7e70368b741bf89ba9dae2672`.

## Outcome and blocker

The complete proposed source change is retained in `proposed.patch`, together with the actual rubric, ruling, plan and check receipts. There are **zero product commits**, **no product push**, **no PR**, **no CI run IDs** and **zero GitHub API calls**. The draft is not READY or PUSHED. Only the report packet is published to the separate evidence ref. It does not confer acceptance or product custody.

Both documented commands, `node scripts/contract-docs.mjs write AUTO-007` and `node scripts/contract-docs.mjs check AUTO-007`, fail with exit 1 at `scripts/contract-docs.mjs:42:53`:

```
Error: No legacy acceptance entry for AUTO-007
```

The maintained generator updates an existing legacy acceptance entry. It only appends an absent entry when the identifier starts with `BASE-AGENT-`; a fresh AUTO clause cannot be represented. It throws before writing any output, including the generated summary rows. Per the brief, the parser, generator and generated views were not changed. A manually inserted acceptance entry or summary would violate the source-only generation requirement. This is a generator capability blocker, not the permitted generated-view-only candidate failure exception.

The lane needs a separately authorized generator capability or an explicit revised contract procedure before this proposal can become a valid product candidate. Neither is included in this task's write scope. Any later round must fetch current main, re-evaluate AUTO/RL IDs and preserve all newer judgments before applying the proposal.

## Proposed product change

Fresh-main inspection of current/retained tracked Markdown and JSON finds AUTO-001 through AUTO-006 and no higher AUTO identifier. RULINGS.md, ID-MAP.json and COVERAGE.json are absent on this main. The proposed IDs are **AUTO-007** and **RL-101**, not reservations against future main changes.

- `CONTRACT.md`: one Core target clause, From new, titled **Private occurrence history after access changes**, under Automation and follow-through; four acceptance points cover current-access non-disclosure, hidden-open/completed indistinguishability, currently authorized positive controls and no authority widening, and native/Settings parity at 1440/390 with durable restart/replay and once-only effects. Its Status is missing, Evidence is empty and Gap explicitly names the unbuilt/unproved behavior.
- `RULINGS.md`: dated CT RL-101 records AUTO-001 DEFER after two lifetime FIX verdicts, original `352cadb54aad54198b16ba0c245079555d7d923a` and corrected `133901fe0c6b727a95df326dfbf2d3b58869ca45`, A resolved and the same B reproduced in the supplied independent Opus FIX1 ruling. It retains the cap, no reopening or third repair, no proof transfer, and all source/stack/review/provider/release holds. Only the supplied public ruling summary is included; no private held-out gate files are present.
- `docs/contract/AUTO-007-rubric.md`: the supplied R1–R4 wording is preserved exactly as future-build requirements, never passing evidence. `AUTO-007-rubric.md` in this packet is an exact copy.
- `sources.lock.json`: regenerated last after staging the three source documents; only those three source identities change or are added. The lock and its check pass for the draft, which still has the blocked, stale generated summary.

No application, UI, tests, provider, runtime, workflow, release, homepage claim, map or prior ruling was edited. The original AUTO-001 definition, missing Status, empty Evidence and full Gap remain unchanged. Inventory notes, 0126 migration collision and CI failures stay provenance only. The CT review hold remains as instructed pending independent Opus exact-head review; nothing was released, submitted or landed.

## Preservation and count delta

All **272 existing clause definitions** and **272 complete Status rows**, including every old Gap and Evidence cell, are unchanged. Removing only the new definition block and new Status row reproduces origin/main's CONTRACT.md byte for byte. Generated ACCEPTANCE.md and docs/CLAIMS.md equal main and were explicitly restored from origin/main. Existing summary rows were never edited by hand. The parser reads the draft when the optional stale summary table is omitted in memory for diagnostic counting; that does not constitute a passing candidate check or persisted generator success.

| Scope | Before done / partial / missing / total | Proposed done / partial / missing / total |
| --- | --- | --- |
| Published | 98 / 6 / 0 / 104 | 98 / 6 / 0 / 104 |
| Target and push further | 38 / 63 / 67 / 168 | 38 / 63 / 68 / 169 |
| Full target | 136 / 69 / 67 / 272 | 136 / 69 / 68 / 273 |
| Core (legacy non-agent grouping) | 136 / 57 / 66 / 259 | 136 / 57 / 67 / 260 |
| Agent surface | 0 / 12 / 1 / 13 | 0 / 12 / 1 / 13 |

Core DONE is **136/259 before, 136/260 proposed**; full-target DONE is **136/272 before, 136/273 proposed**. Only Missing and Total increase by one. These are proposed counts, not committed changes or new implementation proof. The legacy contract has no Later-labeled clauses.

## Actual checks and limits

| Check | Result | Actual receipt |
| --- | --- | --- |
| Touched generator write | FAIL: cannot append AUTO-007 | generator-write.txt |
| Touched generator check | FAIL: same generator capability blocker | generator-check.txt |
| Existing parser with optional summary omitted in memory | PASS: 273 clauses and only one addition; all old definitions/statuses preserved | preservation.json |
| `cloud_run npx -y @runeditrun/rer check` | FAIL: Target summary remains 67 missing/168 total, actual 68/169; All remains 67/272, actual 68/273 | rer-check.txt |
| `pnpm typecheck` | PASS | typecheck.txt |
| `pnpm sources:lock` after staging source | PASS | source-lock.txt |
| `pnpm sources:check` last | PASS | source-check.txt |
| SEED schema validation | FAIL on unchanged seed.json: replaces entries are strings rather than objects | seed-schema.txt |
| RELEASE schema validation | FAIL on unchanged RELEASE.json: changed contract entries lack was/now | release-schema.txt |
| Staged diff whitespace check | PASS | diff-check.txt |
| Draft recovery | PASS: reverse-apply check against current source; complete source diff retained | draft-recovery.txt |

The unchanged seed/release schema failures are existing provenance, not tooling or release repair work for this contract pass. The source documents and parser/generator/seed/release/view byte checks are in terminal-product.json and preservation.json. No new tests or full suite were run. No app/server/browser was launched, and no provider or secret material was read for product work. The provided toolchain selected Node v24.19.0 and pnpm 10.12.4; the Node engine warning against 22.20.0 is retained in actual receipts. The generator's explicit missing-entry guard is independent of that engine warning.

The repository's historical publication acknowledgments exist, but the maintained Mac publication scanner is unavailable in this cloud as the task states. No scanner success is claimed, and no product publication was attempted. The exact proposed public diff was inspected and contains only the permitted source documents and lock hashes; no credential, environment dump, private held-out gate artifact or symlink is selected for evidence. Independent gates retain their checks.

## Plan, custody and recovery

The full plan is `PLAN.md`. Its conditional product commit/push/Verify steps stopped at the generator blocker. Main was fetched again and remained `e6010126cf33eeb7e70368b741bf89ba9dae2672`; no rebase/merge or ID change was needed. Product commit-candidate identity/trailer inspection found an empty `origin/main..HEAD` range. The remote had neither the named product branch nor evidence branch before evidence publication. No product branch exists remotely from this run.

The patch SHA-256 is `a150f6903e0e0b4451bfa7bf41136c08b164496a60687c137bd47c49d32e8194`. The packet stays at `$HOME/rer-consolidation/work/ct-vector-auto001-defer-text-20261106-0230/packet/`. The disposable product clone and its dependencies will be deleted only after the complete evidence packet has been published and verified. The patch and actual receipts remain outside it. No finished unpushed commit is discarded, because no product commit was created.
