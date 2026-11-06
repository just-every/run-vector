# Done — Vector generator ownership

Exact routing answer: **edition-owned repair by SD**. GR should relay this qualified ownership result to SD/CT so SD can launch its existing prepared narrow brief once. This is the ownership prerequisite only. No successor writer, shared repair, product acceptance, landing or release request is opened here.

## Current advertised source

Fresh, independent scratch clones used `git clone --depth 1 --filter=blob:none --single-branch --branch main https://github.com/<repository>.git <owned-scratch>`. Each clone received fleet-local identity and the local `cloud/gr-vector-generator-ownership-1` branch. `git ls-remote origin refs/heads/main` matched both checkout heads again when the receipt was collected.

| Repository | Advertised main / checkout | Main tree |
| --- | --- | --- |
| runeditrun/base | `601a56e0a5e8e21507003b902949e12723036148` | `d237a77ae5e490fdea89d6909894500f695665f3` |
| just-every/run-vector | `e6010126cf33eeb7e70368b741bf89ba9dae2672` | `112eeafb5eae00d4f776f00e578d9658eff239d2` |

These snapshots, not any pre-existing workspace, establish the result. Vector main is still the reported original blocker SHA. Main was not fetched into or integrated with any product branch after publication; no product commits or pushes occurred. Both indexes equaled their main trees and both complete porcelain statuses were empty at receipt collection.

## Actual declaration and call chain

Vector's current `AGENTS.md:41–52` declares `node scripts/contract-docs.mjs write CLAUSE...`, followed by `node scripts/contract-docs.mjs check CLAUSE...`, and the no-argument Lander-Regenerate form. The documented behavior preserves untouched clause narratives.

`scripts/contract-docs.mjs` is a 53-line, edition-owned incremental legacy-view adapter. It is not a forwarding wrapper around Base's generator. Its only implementation import is `../src/base/seed-contract.mjs` (`:2`). It reads `CONTRACT.md`, parses all source clauses (`:9–18`), computes summaries, and reads the existing legacy `ACCEPTANCE.md` and `docs/CLAIMS.md` (`:19`). Explicit IDs are used as given; without IDs it selects already marked entries plus `BASE-AGENT-*` clauses (`:20–21`). Each selected clause's requirement, acceptance, status, evidence and gap come from the parsed contract (`:30–40`). The parser validates the source; it does not write views or enforce the prefix exception.

The actual blocker is the adapter's missing-entry branch at **line 42**:

```js
if(index<0){if(!id.startsWith('BASE-AGENT-'))throw Error('No legacy acceptance entry for '+id);acceptanceLines.push(generated);}else acceptanceLines[index]=generated;
```

An ordinary, explicitly requested, valid additive clause with no existing acceptance bullet is rejected in both write and check before outputs are written. Claims already have an ordinary missing-row append branch (`:43–45`). The final write/check dispatch is `:48–51`; it runs the same transformation in both modes. This is separate from clause/status authority: the helper neither reserves AUTO-007 nor awards any status.

`AUTO-007` is absent from advertised main. We did not reconstruct CT's unpublished candidate, add the clause, or rerun its failing write. The historical failure is consistent with the current line-42 source, but this report does not claim a fresh execution of that unpublished candidate.

## Concrete selection, lock and provenance

`edition.json` identifies `just-every/vector-projects`, has `parent: null`, and selects the product `src` tree as local edition source. Its other components identify specific imported modules and authoring tools. None selects `scripts/contract-docs.mjs` from a Base origin. All remaining tracked source remains authoritative edition source under Base's current `edition-authoring/README.md:40–47`.

`base-copies.json` has **no** record for `scripts/contract-docs.mjs` or any Base contract-docs generator. In contrast it explicitly records `src/base/seed-contract.mjs` as `foundation/runtime/seed-contract.mjs` from Base revision `e881e6f66ce7cd737d17dbeb945995aab83c30d8`, with SHA-256 `7beada5d271beaaf63d76e1f8cf2712ba906ec7d430f8312f4abedfad57428b4`. The copied parser's Git blob and SHA-256 equal maintained Base current main exactly. The historical origin revision is a declared baseline; it was not separately fetched or historically requalified.

`sources.lock.json:2660` independently locks the Vector adapter's SHA-256 to `17598668017202efe065dae49e102df9dcfe44d983edae50f3db39c1d1865c03`. Its parser lock at `:3668` matches the explicit copy and both current parser byte streams. A source-lock file entry means committed edition source is inventoried; it does not make the adapter Base-owned. Package scripts `sources:lock` and `sources:check` dispatch to `scripts/edition-authoring/cli.mjs lock|check`. The actual package pin is `@runeditrun/rer` **0.2.94**. Older 0.2.40 wording in `docs/BASE-ADOPTION.md` is contextual legacy prose, not authority for current generator selection; no prose was changed.

Three bounded GitHub REST source reads preserved in the packet establish Vector path history:

1. `gh api 'repos/just-every/run-vector/commits?path=scripts/contract-docs.mjs&per_page=5'` with a projection of SHA/message only returned four path commits.
2. `gh api repos/just-every/run-vector/commits/57d4bd0d84ea61978d9ed9d028061fce28ef339c` projected to this path shows it **added** as a 47-line incremental adapter (blob `8cb0d16d30d5519846f18f1c2b3bf80082799f56`). The initial missing-entry branch refused every absent acceptance entry.
3. `gh api repos/just-every/run-vector/commits/2dfb04b9ed1f21915da117b058563f37ef1d52b2` projected to this path shows the Vector change that added default BASE-AGENT selection and the prefix-only append exception. Its resulting blob `c994b97893bc00ca09af4c742090820272555bb3` is still the exact current adapter blob.

These are source reads, not provider acceptance calls. The requests explicitly loaded the fleet GH_TOKEN into the child environment from the decrypted bundle without printing it. No other credential was sought.

Ownership distinctions:

- **Exact Base copy:** the imported parser is one, and its current bytes match current maintained Base.
- **Derived legacy Base generator copy:** no declared selection, mapping or path-history evidence establishes that classification for the adapter. “Legacy” in its comment describes the views it incrementally updates. We do not infer a copied generator from a shared parser or a filename.
- **Independently maintained edition source:** the generator adapter was added and changed in Vector, is locked as Vector source, has no Base generator copy record, and is the entrypoint Vector currently declares. The evidence establishes current maintenance ownership, not an assertion of independent conceptual invention or an exhaustive history outside this path.

## Maintained Base comparison

Base currently maintains `foundation/runtime/contract-docs.mjs`, 66,403 bytes, blob `7c6ab9f2acb1a23d4e952758906efcf0b1a5c95c`. Its bundled copy at `default-seed/scripts/base-cli/foundation/runtime/contract-docs.mjs` is exactly equal. Neither is Vector's adapter; no file in the entire current Base main tree has Vector adapter blob `c994b97893bc00ca09af4c742090820272555bb3`. A bounded current Base code search found no “No legacy acceptance entry” branch.

Base's `generatedFiles` builds acceptance directly from current parsed contract clauses (`foundation/runtime/contract-docs.mjs:113–138`), without the adapter's requirement for an existing acceptance entry. It requires level-four clause headings, Tier metadata, **Requirement.** bodies, a primary-journey declaration and a field-proof register (`:94–120`). Its CLI `write|check` does not accept touched-ID arguments (`:943–958`). Thus Base's generator is a different maintained implementation with a different contract format and operation surface. Its all-current-clause rendering is not evidence that Vector has adopted a repair, nor authority to convert Vector's contract.

The existing public CLI journey is `foundation/contract-docs.test.mjs`, especially “contract docs convert handwritten contracts and keep generated documents and migration maps accountable” (`:301`), using the installed `src/base/contract-docs.mjs write|check` door (`:14–38`) and asserting output for every original clause (`:316–318`). It was read, not run. No shared Base defect has been established by this Vector-specific prefix branch, so neither this test nor Base source needs a prerequisite repair for SD's narrow change. Do not transplant Base's full generator or run convert as this fix.

## Smallest next authorized change and adoption surface

SD can use its existing prepared narrow brief once to repair **Vector `scripts/contract-docs.mjs:42`**. Allow a missing generated acceptance entry for an explicitly requested, parser-validated ordinary additive clause, retaining current existing-entry updates, deterministic output, summary calculation and generated claim handling. Preserve the explicit/default selection distinction; do not broaden no-argument generation to rewrite every legacy narrative. Preserve refusal of unknown or malformed source. Use the existing parser and operations; introduce no new parser, framework or status logic.

The narrow behavior proof should exercise the existing write/check command in an isolated temporary fixture: absent ordinary clause entry, repeat generation, stale-view refusal and invalid-source refusal, with original source definitions/Status/Gap/Evidence and untouched narratives preserved. These are behavior expectations for SD's existing brief, not tests or code created by this investigation. No copy/pin/hash/wording test is proposed.

The downstream operations remain:

```sh
node scripts/contract-docs.mjs write <TOUCHED_IDS>
node scripts/contract-docs.mjs check <TOUCHED_IDS>
# Stage intentional source changes before the documented lock operation.
pnpm sources:lock
pnpm sources:check
```

These are routing instructions only; none of the write/lock operations ran here. Future work must follow the fleet's source-first conflict rules, regenerate before checking, preserve main's newer judgments and unrelated prose, restore `origin/main`'s whole `ACCEPTANCE.md` and `docs/CLAIMS.md`, never commit those generated views, and regenerate/check the source lock last with intended source changes. The Mac lander owns final views. A view-only Verify mismatch has the fleet's stated exception; it is not permission to handwrite views. No Base adoption, recipe/pin change, default-main integration or release change is needed for this bounded adapter repair.

## Actual checks and unchanged state

- `node scripts/contract-docs.mjs check` **exit 0**, once. It checked the inherited marked entries and BASE-AGENT-001…013, invoking the existing parser as documented.
- One direct parser read **exit 0**: **272 total; 136 done, 69 partial, 67 missing; 104 published and 168 target**. Before/after counts are identical because no source or status changed. AUTO-007 is absent.
- Both HEADs, indexes and product worktrees stayed unchanged; candidate product commit ranges are empty. Clause status changes: **none**.
- No product commits/pushes, PRs, CI runs, full tests, builds, app setup, browsers, scans, provider APIs, deployments or releases. No product READY/PUSHED signal or landing request. CI run IDs and PR URLs: **none / not applicable**.
- Existing deferred privacy **two-FIX DEFER / reopen=false**, original rejected candidate holds, all source/gate/release holds and incumbent UI remain unchanged. Release 0.2.100's immutable main binding is independent; Base main was not mutated.
- Blockers to this ownership answer: **none**. This report qualifies ownership and the next custodian only.

## Source identities

Full auxiliary bindings and exact command/read/check receipts are in `ownership.json` and `source-read-receipt.json`.

| Repository | Path | Git blob | SHA-256 |
| --- | --- | --- | --- |
| just-every/run-vector | `scripts/contract-docs.mjs` | `c994b97893bc00ca09af4c742090820272555bb3` | `17598668017202efe065dae49e102df9dcfe44d983edae50f3db39c1d1865c03` |
| just-every/run-vector | `src/base/seed-contract.mjs` | `c832594a274e1a0718228573df57bda415003bdc` | `7beada5d271beaaf63d76e1f8cf2712ba906ec7d430f8312f4abedfad57428b4` |
| just-every/run-vector | `AGENTS.md` | `40fa8cd6544b836b49413fd1100463711d5395f1` | `5c49954ec527f3d0c5454b1d2bb0cc7855b3df56c1bd43847e9444a0d2b18cc4` |
| just-every/run-vector | `edition.json` | `1f41525c6e129a5ea6240d2b2e16ae61d33d617e` | `89309beaf124fb7d8ffcfdc5f7d91ab7addf81b7abd4361d72e935a3d677e0a0` |
| just-every/run-vector | `base-copies.json` | `0f236cff0c338056b1c2ff03de3b98283d48f768` | `aa3eb2c922f8f4ca8f30cde3d3ca69d1bab15d5e79ef7bd7233e927044d3b082` |
| just-every/run-vector | `sources.lock.json` | `03ed60b477fd48ad7d2316cd62b165c1c104cc5b` | `f485f25b12a005b870f120c80353b6066b1496e28c4da955ae0c7730fb655d25` |
| runeditrun/base | `foundation/runtime/contract-docs.mjs` | `7c6ab9f2acb1a23d4e952758906efcf0b1a5c95c` | `0c4e8fc36eb2e327c8744c59f3d8be2bba2070794558a4e6cbdf68e210637b96` |
| runeditrun/base | `foundation/runtime/seed-contract.mjs` | `c832594a274e1a0718228573df57bda415003bdc` | `7beada5d271beaaf63d76e1f8cf2712ba906ec7d430f8312f4abedfad57428b4` |
| runeditrun/base | `foundation/contract-docs.test.mjs` | `d8d1f3bc14e5021a5994fa8a6050fd69ec2850c4` | `8e04bf41027250e07d0af2f581b4aca77ea695799b04f87cb8128b2b964997f0` |

## Plan, report custody and cleanup

The complete plan is `PLAN.md`. The packet explicitly consists of `PLAN.md`, `REPORT.md`, `ownership.json`, `source-read-receipt.json`, `vector-generator-history.json`, `vector-generator-57d4bd0d84ea.json` and `vector-generator-2dfb04b9ed1f.json`. All are actual regular non-secret files outside the product clones; no credentials, environment dumps, private gates or symlinks are selected.

Publish this complete shared packet to `refs/heads/evidence/gr-vector-generator-ownership-1` separately in each declared repository using its own unchanged clone and the supplied report-only `cloud_evidence.py publish` entrypoint. The terminal report returns both exact EVIDENCE lines. Evidence publication conveys report custody only, not product acceptance or readiness. Owned scratch clones are deleted after successful transfer verification; packet files remain under the task's work directory. No product dependencies, helper agents, servers or browsers were created.
