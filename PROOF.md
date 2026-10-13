# UI correction proof

The issue description and outcome open by default in the direct issue page and Current inspector. All authored text remains in normal document flow. The smaller phone layout removes repeated status metadata and reduces header, picker and section spacing; it does not remove written content. Issue writing edits only title and description. Labels, estimate, due date, expected outcome and customer impact have dedicated inline controls; the existing assignee, priority, status, project and cycle pickers retain their separate, version-checked mutations.

## Review correction receipts — 2026-10-08

The correction adds inline editing for labels, estimate, due date, expected outcome and customer impact through the existing version-checked issue PATCH. The writing editor remains limited to title and description. Project creation starts from the portfolio, project administration is on the project detail page, Settings has section links, administration disclosures show chevrons, and setup guidance explains the next step when email or operator removal is unavailable. Mention suggestions show names without internal IDs, mentions render as chips, comment and Inbox rows show relative times, and mobile Inbox identifiers stay together. Cycle commitment uses a bounded keyboard picker; decision tabs, routing controls and the compact mobile decision sheet have consistent sizing and spacing.

At 1440 px and 390 px, browser journeys cover all five inline properties with an `expectedVersion` and exactly one changed field per PATCH. Across those journeys, saved values are checked after reload, values can be cleared, stale versions are rejected, and client-side issue navigation is exercised. The `inline-navigation-*` captures record issue navigation state; they do not establish keyboard or focus behavior. Cycle-picker and phone Search keyboard/navigation checks remain. The optional change to remove the phone Search button's boxed surface was deferred because removing it fails the preserved control-affordance assertion; the existing surface remains.

The ordinary UI runtime passed 118 route/state audits and 4,013 control checks. Its regression report records 63 of 63 passing cases. Six ordinary UI-runtime stylesheet reversions, run with capture flags unset, were each rejected by the computed-contrast assertion: one per selector per width for decision labels, empty-section text and selected-row details. Restoring the stylesheet returned the recorded CSS hashes to their prior values. The current project-detail cases are green at both widths. The paired baseline reproduction reached both widths and failed the Back-to-header spacing assertion at −3.59375 px against the required 8 px gap.

The first collaboration-browser run failed the 390 px authored-issue height assertion: 1,422 px exceeded the unchanged 1,393 px limit. After the CSS correction, the height receipt measured the authored issue at 1,365 px with all eight disclosures open. The unchanged FLW-842 sample at 390 × 844 measured a 1,351 px document, a 1,245.703125 px issue and 390 px width. Its 44 px compact Accept action ends at 775.015625 px, above the navigation top at 783.8125 px.

| Collaboration run | Command | Result | Elapsed | Sampled natural load |
| --- | --- | --- | ---: | ---: |
| 1 | `nice -n15 node --experimental-strip-types tests/e2e/collaboration-runtime.mjs` | Failed at `[ISSUE-008] 390`: 1,422 px > 1,393 px | 97.19 s | See run receipt |
| 2 | `nice -n15 node --experimental-strip-types tests/e2e/collaboration-runtime.mjs` | Passed 48 clauses, 86 captures and 10 live timings | 144.93 s | 11.44–25.56 |
| 3 | `nice -n 15 pnpm test:collaboration` | Passed 48 clauses, 86 captures and 10 live timings | 145.04 s | 12.27–20.15 |
| 4 | `nice -n 15 pnpm test:collaboration` | Passed 48 clauses, 86 captures and 10 live timings | 142.22 s | 12.38–16.94 |

The matching records are `.artifacts/verification/collaboration-busy/run-{1,2,3,4}/receipt.json` and `.artifacts/verification/collaboration-busy/three-green-results.json`. The three green runs were recorded before this final documentation and source-lock refresh; each receipt binds its own run. They are not a substitute for reports generated against the final committed source.

The current native candidate corrects rendered-row waits in four administration test journeys: team/status, archive-team, label and access, including waiting for the default Team row before the Settings navigation audit. The second local full verification attempt failed when Team Edit Research targeted a form inside a closed, newly rendered row; the first targeted administration rerun passed desktop but failed the preserved mobile Settings assertion while the default Team navigation row was closed. Both failed runs remain retained. The correction changes tests only; product source, helpers and guards remain unchanged, and the compiled Worker and client assets match the retained failed build. An independent preservation check confirmed all 39 existing assertions, 35 SQL calls, clause names and capture names remain intact.

The corrected, uncommitted candidate passed these native runs on Node 26.8.1 at 1440 px and 390 px. Every run recorded zero serious or critical axe violations, horizontal overflow, unexpected page or console errors, failed requests and failed modules. All admission load samples were at or below 36; the table records sampled natural load during each run.

| Native candidate run | Command | Result | Elapsed | Sampled natural load |
| --- | --- | --- | ---: | ---: |
| Administration | `nice -n15 pnpm test:admin` | Passed 36 clauses and 70 captures | 122.033 s | 12.78–21.76 |
| Collaboration 1 | `nice -n15 pnpm test:collaboration` | Passed 48 clauses, 86 captures and 10 live timings | 155.616 s | 12.40–14.61 |
| Collaboration 2 | `nice -n15 pnpm test:collaboration` | Passed 48 clauses, 86 captures and 10 live timings | 155.858 s | 11.90–24.87 |
| Collaboration 3 | `nice -n15 pnpm test:collaboration` | Passed 48 clauses, 86 captures and 10 live timings | 185.674 s | 15.91–24.57 |

The current candidate receipt is `.artifacts/verification/review-admin-render-wait-summary.json`. It records candidate bindings, preserved checks and successful process cleanup. These passes establish native candidate evidence. They do not establish final merge, full verification, development check, fresh 69-state captures and personal image review, or CI completion; those checks require their own exact source-commit, source-input, emitted-asset, capture-manifest and CI receipts.

An ordinary full verification attempt passed its preceding nine stages but failed in the canceled-status UI fixture with native `SQLITE_BUSY_SNAPSHOT`: fixture access launched a second Wrangler/workerd owner against the active Worker's D1 file. UI reads now use the existing read-only native inspector; the four unchanged fixture SQL scripts use an explicit test-only writer on the single hashed application store, excluding metadata. The writer enables foreign keys, reserves its lock with `BEGIN IMMEDIATE` before executing the complete script, commits atomically, rolls back and propagates errors, closes its connection, and limits native lock waiting to one second.

Focused Node tests passed 7/7 after the new entrypoint's recorded red, covering complete scripts with quoted and trigger semicolons, trailing SQL and constraint rollback, foreign-key enforcement and cascades, commit failure, held WAL snapshots, bounded lock failure and cleanup, exact store selection, and read-only SELECT parity. Independent probes passed all four original SQL scripts against the actual migration schema; the 22 existing static preservation checks and three review-stage orchestration tests passed. With capture flags unset, `node tests/e2e/ui-runtime.mjs` passed 118 route/state audits and all six unconditional review families. Its fresh `.artifacts/verification/ui-runtime-results.json` and `.artifacts/verification/review-proof/audits.json` bind actual source inputs and emitted assets. Owned browsers and Workers closed, with both runtime ports verified closed. This focused correction does not establish final merge, full verification, development hydration or CI completion.

Applied migrations 0001–0014 remain byte-identical. Deployment tests freeze the ordered names and bytes of 0012–0014. In the mutation controls, a byte change to each migration failed and each restored file passed. A coordinated rename of 0014 and matching `RELEASE.json` id passed before mutation, failed while changed, and passed after restoration. The correction remains version 0.1.0, adds no migration and does not recopy Base. Receipts are `.artifacts/verification/migration-freeze-proof/results.json` and `.artifacts/verification/migration-freeze-proof/rename-results.json`.

The first merge candidate passed all ten full-verification stages, then the unchanged development-runtime check failed on six React duplicate-key warnings: `IssueEditor` and `IssueSubscriptionControls` shared one key in the issue header. Each now has its own issue-scoped key. A later development run failed on one aborted `/api/issues/PLT-102/subscription` read: issue following polls every two seconds, and the document navigation to sign-in started while a poll was in flight. A full verification then failed the same way in `test:runtime`, which aborted PLT-102 subscription and discussion reads when the journey left Current. The shared navigation helper now tracks reads in flight; the runtime and development journeys wait for them before leaving Current and before any document navigation. The zero-failed-request assertions are unchanged. Three consecutive `nice -n 15 pnpm test:dev` runs then passed.

The candidate capture manifest records 69 entries across these state families:

| Capture family | Names recorded in the manifest |
| --- | --- |
| Inline property editing and conflicts, both widths | `inline-{estimate,dueDate,expectedOutcome,customerImpact,labels}-{editing,conflict}` |
| Client-side issue navigation state, both widths | `inline-navigation-{estimate,dueDate,expectedOutcome,customerImpact,labelIds}` |
| Portfolio, administration, Settings and setup, both widths | `portfolio-first`, `admin-disclosures`, `settings-navigation`, `setup-guidance`, `project-detail-layout` |
| Decision and issue layout, both widths | `decision-tab-row-issues`, `decision-tab-row-current`, `routing-alignment`, `picker-text-fit`, `issue-controls`, `mobile-decision-sheet` |
| Phone Search keyboard state | `phone-search-keyboard` |
| Contrast, both widths | `contrast-states-verified` |
| Cycle picker, both widths | `cycle-search-results`, `cycle-commit-saved` |
| Mentions and readable Inbox rows, both widths | `mention-picker`, `posted-mention`, `inbox-readable-row` |
| Empty and loading Inbox states, both widths | `empty-inbox-count-loading`, `inbox-empty` |

“Both widths” means 1440 × 900 and 390 × 844 captures for each state. The phone Search state exists only at 390 × 844. All 69 earlier candidate captures were personally inspected at full resolution across 46 native-sized sheets, with their hashes checked against the retained review journal. The retained images are under `.artifacts/verification/review-final-product-captures/`. This is evidence for that earlier candidate only. After the empty-projects correction, final merge verification still requires fresh captures for all 69 states, a refreshed manifest and a separate personal image review.

The first local full verification attempt failed at the preserved administration journey's “Create your first project” heading in a genuinely empty portfolio; the failure diagnostics are retained locally. The correction restores that invitation while keeping project creation behind `New project`. The empty-workspace decision must account for the complete project count, including archived projects, and for loading state: a filtered active-project list alone cannot establish that this is the first project. Focused rendering checks do not establish completion of the archive-only or native browser journeys; their results belong in the generated reports for the final source.

The administration journey adds pre-click invitation assertions, axe checks, authored-control audits and horizontal-overflow checks at both widths. Its new capture state is separate from the 69 earlier candidate captures:

| State | Capture paths | Viewports |
| --- | --- | --- |
| Empty projects invitation before creation | `.artifacts/verification/admin-browser/1440-empty-projects-invitation.png`, `.artifacts/verification/admin-browser/390-empty-projects-invitation.png` | 1440 × 1000 and 390 × 844 |

The administration desktop capture height is 1000 px; the review candidate desktop captures above use 900 px. The candidate native administration journey passed as recorded above. These candidate results do not establish native checks and full verification against the final merge, the development check, fresh 69-state captures and personal image review, or CI completion; those checks require their own exact source-commit, source-input, emitted-asset, capture-manifest and CI receipts. Their generated `.artifacts/verification/admin-browser/admin-runtime-results.json` and `captures.json` must bind to the final source input and emitted assets before completion is claimed.

Generated UI and collaboration reports record their own source-input digest; the relevant emitted Worker, client assets and capture images are identified by their report or manifest hashes. This document is covered by `sources.lock.json`, so copying a digest or hash into this file would change the locked input. Use the generated report or manifest for exact binding and file-level hash checks. The 118-audit runtime receipt is `.artifacts/verification/ui-runtime-results.json`; the 63-case regression report, 69-state audit records and candidate image manifest are under `.artifacts/verification/review-proof/`; contrast mutation and navigation-clearance records are under `.artifacts/verification/contrast-mutations/` and `.artifacts/verification/clearance-diagnostic/`.

## Historical earlier correction checks

The maintained toolchain is Node 22.20.0 and pnpm 10.12.4. The initial correction at `fb197079848a2d91672b78b28bd84c71a6729e88` passed these focused checks against the emitted local Worker and genuine local sign-in outbox:

- `pnpm build`: types and production Worker/browser build passed.
- `pnpm test:runtime`: 14 runtime checks passed, including persistence, Markdown safety, authenticated mutations, intake decisions and unsaved title/description retention through refresh and a rejected stale write. Explicit validated reload replaces both writing drafts.
- `node --experimental-strip-types --test --test-concurrency=2 tests/home.contract.test.ts tests/api-resource-recovery.test.ts tests/intake-recommendation.test.ts tests/ui-helpers.test.ts tests/command-helpers.test.ts`: 17 checks passed.
- `node tests/e2e/ui-runtime.mjs`: route, control, navigation-clearance, exact property payload/version/persistence/conflict, terminal-cycle and measured-layout checks passed. The original assertions and layout fixture remain intact. New checks exercise the writing-only payload and unchanged other properties, readable selected desktop values, recommendation descriptions, full-width return datetime, button gaps and keyboard file-picker focus.

The palette follow-up reran `pnpm build` and the maintained UI runtime: 40 route/state audits and 857 control checks passed. Capturing genuine search results exposed invalid listbox child semantics and insufficient selected-result detail contrast. Named result groups now provide the required group/option hierarchy; their visual headings remain the groups' accessible labels without introducing heading children into the listbox. Brighter detail text passes the same contrast audit in the selected state. The focused assertions also require the named Issues group and every option's group parent.

The mobile chrome follow-up rebuilt the production Worker and reran the maintained UI runtime. The 41 route/state audits and 857 control checks passed, including an added navigation check requiring the current destinations and Search action to remain available while allowing additional destinations. Every actual mobile target must remain at least 44 px high and hit-testable, and the shell must reserve the full measured navigation height. The current targets are 48 px high. Back and issue metadata share a row on phones, evidence panel padding and primary summary spacing are smaller, and the shell and fixed decision sheet use the same navigation clearance including the safe-area inset. Desktop layout and authored content font sizes are unchanged.

The capture run enables `VECTOR_REVIEW_CAPTURE=1` and supplies a local axe browser bundle with `VECTOR_REVIEW_AXE_SOURCE`. Capture is optional in ordinary verification; the behavioral and geometry assertions always run. The expanded review used axe 4.13.0 and checked 52 responsive states (104 viewport/full-page images), each with zero serious or critical violations and no horizontal overflow. This includes the immediate ended-deferral confirmation and genuine command search results at both widths. The post-commit run records their checks in `results.json`. This is bounded automated evidence for these states, not complete manual WCAG acceptance or hosted deployment evidence.

```sh
VECTOR_REVIEW_CAPTURE=1 VECTOR_REVIEW_AXE_SOURCE="$AXE_SOURCE" node tests/e2e/ui-runtime.mjs
```

The final capture run follows the source commit with no further source edits. `.artifacts/verification/ui-correction/results.json` records that exact `sourceCommit`, working diff digest, axe version, viewport, document/issue geometry, internal fields scroll position and runtime Worker digest for every state. The rebuilt `dist/server/index.js` SHA-256 for this review is `68e352363377a1187cbb096546b8bee51b250922d1b890ceb746d67e69f6a2fd`. Fresh diagnostic artifacts remain ignored and can be reproduced with the command above.

## Historical earlier layout sample

The existing layout helper measures the unchanged FLW-842 sample at 390 × 844, direct issue route, default disclosures. Description and outcome are open, while secondary disclosures stay closed.

| Measurement | Retained baseline | Required maximum | Corrected layout |
| --- | ---: | ---: | ---: |
| Document height | 2786 px | 1393 px | 1332 px |
| Issue height | 2659.390625 px | 1329.6953125 px | 1220.890625 px |
| Horizontal width | 390 px | 390 px | 390 px |

These measurements are from macOS. The previous chrome measured exactly 1393 px locally but 1411 px in Linux CI and failed the unchanged half-baseline assertion there. The compact chrome leaves 61 px below that document-height limit locally, with all authored content still in normal flow and both primary disclosures open. The correction merge `0df0dedd97637bc8f25f513f5a9d104319aeccf9` passed verification and development hydration in Linux CI run 37640041414. Its artifact records the same document height 1332 px, issue height 1220.890625 px and scroll width 390 px. These results bind the correction merge; the capture source, Worker and diff identities above remain unchanged.

Expanded routing has a distinct scrollable fields area. The test asserts that its content overflows, that scrolling changes `scrollTop`, and that the Accept action remains visible, hit-testable, at the same vertical position and above mobile navigation both before and after that scroll. `.artifacts/verification/ui-runtime-results.json` retains the before/after action and navigation geometry plus the scroll area dimensions. `routing-scrolled-390.png` also records the actual internal scroll position.

## Historical earlier capture map

Every filename below is under `.artifacts/verification/ui-correction/`. Except the additional phone reading views, each state has a `-1440.png` viewport capture at 1440 × 900 and a `-390.png` viewport capture at 390 × 844. Every viewport capture also has a `-full.png` companion, such as `direct-detail-390-full.png`. Inspect both variants for layout, complete readable writing, distinct controls and fixed-navigation clearance.

| Finding / state | Exact capture names before the width suffix | Runtime evidence |
| --- | --- | --- |
| Default-open description and outcome | `direct-detail`, `current-detail`, `work-detail` | Primary sections start open; visible authored paragraphs have no vertical clipping or line clamp. |
| Phone reading beneath the fixed decision sheet | `direct-reading-390.png`, `current-reading-390.png` | Scroll reaches the full outcome and customer-impact content. |
| Focused writing editor | `direct-editor`, `current-editor`, `work-editor` | The writing fields are exactly title and description; PATCH carries only those fields and expectedVersion. Other properties are unchanged. |
| Current selected details and full desktop property text | `current`, `current-index`, `current-detail` | All selected property strings fit their controls at 1440 px; selected details and decision labels pass the recorded axe check. |
| Expanded routing, pinned Accept and genuine fields scroll | `routing-expanded`, `routing-scrolled` | Overflow, changed scroll position, fixed action geometry and hit testing are asserted. Recommendations are at least 11 px and describe their associated fields. |
| Deferral input | `defer-before` | Return datetime spans the form width at both viewports. |
| Successful deferral and durable confirmation | `defer-success`, `defer-reload` | Submitted Defer form closes, Accept becomes selected, and the saved reason and return time survive reload. |
| End deferral and another decision | `end-deferral`, `end-deferral-success` | Desktop label stays on one line; the immediate ended confirmation is captured before Accept, after a separate persisted read confirms the returned version and cleared deferral. The submitted form closes; version-checked Accept then succeeds and persists. |
| Genuine command-palette search results | `command-palette-results` | Native authenticated search returns multiple FLW issues. Rendered options match the response within a named Issues group, exactly one is selected, the input identifies that active result, and all result buttons pass the authored-surface audit. Valid listbox/group/option semantics and selected-result detail contrast pass axe at both widths. |
| Comment display and edit | `discussion-display`, `discussion-edit` | Edit/Delete and Save/Cancel have at least 8 px separation; existing Markdown rendering assertions remain. |
| Actual file upload and attachment affordance | `discussion-file` | Real local file is uploaded and displayed; Attach file has an authored surface, border and keyboard focus outline. |
| Empty Current and My work | `current-empty`, `work-empty` | Empty-state creation/navigation remain reachable; text passes the recorded axe check. |
| Missing page in both session states | `404-signed-in`, `404-signed-out` | Both destinations remain distinct, with at least 8 px separation and the existing link-affordance assertions. |
| Public pages after removal of dead art | `welcome`, `signin` | Existing portal illustration remains; the unused mail-unavailable variant, its props and exclusive style are removed. |

The control audit now requires an actual visible background, background image or visible border for buttons. Padding and height cannot stand in for an affordance. The exposed stream rows, command results and mobile Search button have authored surfaces/borders, alongside the corrected file control.

Complete merge verification, CI and hosted commissioning are separate checks. No deployment or publication was performed for this correction.

## Historical workspace administration candidate proof

The pre-final candidate review used the emitted local Worker, native D1 and first-owner Base confirmation with sample runtime data disabled. Its browser report recorded 35 passing tests, 34 browser contract callbacks, 3,956 styled-control records, zero axe violations, no horizontal overflow, and no unexpected page errors, failed requests or failed script responses. The invalid cycle-end validation response was the expected 400. Native D1 invariants passed in both viewport runs. The 68 screenshot hashes in the capture manifest matched their files. Review covered all 68 captures across nine contact sheets, with a closer inspection of the Settings states.

The same candidate passed the existing UI runtime checks: 41 route/state checks and 1,260 controls. Its mobile document measured 1,341 px against the 1,393 px limit. The development-mode check covered 228 paths with empty error and failed-request lists.

These are candidate results from before the final prefix-reservation ledger and security fixes. They do not attest to the final merge input or output. Each verification run writes fresh reports under `.artifacts/verification/admin-browser/`; use that run's `admin-runtime-results.json` and `captures.json` for evidence. Check their `sourceCommit` and `sourceInputDigest`, emitted Worker and client hashes, and per-capture screenshot hashes to bind the results to the code and images from that run. The artifact directory is reused, so a later run replaces the earlier reports and captures.

For every state below, the capture manifest records both `1440-<state>.png` (1440 × 1000) and `390-<state>.png` (390 × 844).

| Journey | Capture states |
| --- | --- |
| Empty workspace and Settings | `empty-projects-create-cta`, `empty-cycles-create-cta`, `empty-settings-six-sections`, `settings-final-signout-reachable` |
| Teams and workflows | `team-seven-categories`, `team-workflow-authored`, `status-remap-last-category-refusal`, `team-archived-preserved-workflow`, `archived-team-authoring-exclusion`, `archived-team-existing-issue`, `team-restored-authoring` |
| Labels | `label-created`, `label-renamed-recoloured`, `issue-label-application`, `label-delete-confirmation`, `label-cascade-issue-history` |
| Projects | `project-planned-no-target`, `project-markdown-detail`, `project-invited-lead-transfer`, `projects-include-archived`, `archived-project-retained-issue-edit`, `project-unarchived` |
| Manual cycles | `cycle-end-validation`, `cycles-two-manual-windows`, `inline-cycle-commit`, `inline-cycle-move`, `inline-cycle-uncommit`, `cycle-list-committed`, `cycle-list-moved-source-empty`, `cycle-list-moved-destination`, `cycle-list-uncommitted` |
| Issue authoring | `issue-authoring`, `issue-writing-only-editor`, `issue-authored-detail` |

The exact merge verification and CI results are separate evidence. Their generated reports must bind to the final merge input and emitted Worker, and the verification must include these administration journeys alongside the existing regression checks before completion is claimed. This local candidate review does not establish hosted/provider behavior or commissioning.

## Historical collaboration candidate proof

The emitted local Worker and native D1 run passed 49 browser tests covering 48 clause cases. It recorded 86 screenshots across 43 states at 1440 × 1000 and 390 × 844, 48 native D1 readbacks, four database snapshots and ten two-operator delivery timings. The timings ran from 821 ms to 1,842 ms, measured before submit until the recipient's Inbox row and unread count appeared. Both viewport diagnostics had no unexpected page errors, failed requests or bad modules; expected validation and unauthenticated-route responses are recorded separately. At 390 × 844, the authored issue detail is 1,330 px tall with its content in normal document flow.

Independent visual review covered all 86 captures in 22 contact sheets and full-size inspection of all 14 Notifications Settings footer details; no visual gaps were found. The run used separate native sessions, no sample data and Base development mail only. It does not establish delivery through a real provider or arrival in a mailbox. Failed and uncertain Settings rows are test-only native D1 presentation fixtures attached to fresh, real UI notifications; they do not claim transport outcomes. Pagination used actual UI-authored comments and did not inject Inbox rows or responses. Separate email-disabled installations at both widths passed native authentication, retained one Inbox row, and created zero delivery intents and zero development captures.

Each state below has both `1440-<state>.png` and `390-<state>.png` captures under `.artifacts/verification/collaboration-browser/`. `captures.json` records a SHA-256 for each image.

| Journey | Capture states |
| --- | --- |
| Workspace administration context | `actor-team-seven-categories`, `actor-team-workflow-authored`, `actor-label-created`, `actor-label-renamed-recoloured`, `actor-issue-label-application`, `actor-project-planned-no-target`, `actor-project-markdown-detail`, `actor-cycle-end-validation`, `actor-cycles-two-manual-windows`, `actor-operator-removal-confirmation` |
| Issue authoring | `actor-issue-authoring`, `actor-issue-outcome-authoring`, `actor-issue-writing-only-editor`, `actor-issue-authored-detail` |
| Description mention editor | `actor-description-mention-options`, `actor-description-selected-mention`, `actor-description-unknown-mention-empty-options`, `actor-description-retained-mention-unknown-literal`, `actor-description-mention-removed`, `actor-description-new-edit-mention` |
| Inbox events and reading | `recipient-inbox-empty`, `recipient-inbox-assignment`, `recipient-inbox-assignment-email-disabled-installation`, `recipient-inbox-description-mention`, `recipient-inbox-comment-mention-overlap`, `recipient-inbox-followed-comment`, `recipient-inbox-new-description-edit-mention`, `recipient-recipient-comment-self-suppressed`, `recipient-inbox-all-read`, `recipient-inbox-email-optout-retained`, `recipient-inbox-email-reenabled`, `recipient-inbox-pagination-first-page`, `recipient-inbox-pagination-loaded-older-page`, `recipient-inbox-revoked-session-clears-all-pages` |
| Follow and mute preferences | `recipient-issue-follow-restored`, `recipient-issue-muted`, `recipient-settings-unmuted-no-backfill`, `recipient-settings-event-mutes`, `recipient-settings-event-unmuted-no-backfill` |
| Email Settings | `recipient-settings-email-optout`, `recipient-settings-failed-uncertain-fixtures`, `recipient-settings-email-reenabled`, `actor-settings-email-unavailable-disabled-installation` |

The run's immutable bindings are recorded in `.artifacts/verification/collaboration-browser/collaboration-runtime-results.json` (SHA-256 `9c3fbd91981e6c2604d0da4a04c8aa94117b0bdf9ed58ffc70d4a5d51b9e3e5c`) and its `captures.json` manifest (SHA-256 `cb53c5ca5ccef5ef2c2cf731e909f48f9181d0bbb8112d9026ec9cc5153de3c7`). The report binds source commit `1c3c70dcb677fc1b9cb39c81d104a79b6b9cf19e`, source tree `6b70e122fbf98ff6313e970e419792215970c0c2`, and source input digest `74b345cf3b182d3928eb54fd67351cd36f3bc7a32b8bde1d6b118537782d4c4c`. The candidate included uncommitted source changes relative to that commit, so the commit alone is not its identity; the source tree, input digest and emitted asset hashes in the report bind the tested candidate. The emitted Worker entry `index.js` has SHA-256 `6d2b5958d957b2aa28067873af46da1e98112653d6d909c4633db1a214cafddf`; the Inbox client `assets/app.inbox-0lUQOO85.js` has SHA-256 `33714601d19052dd955c09dcf8403e4cbb7a4a24f69ee111e5caee6cf768568d`, and the Settings client `assets/app.settings-Fy7r2Hmp.js` has SHA-256 `9fa29f54c797a38448366cbd1441041374b0214326d774e280917b829888f5c0`.

The four native D1 snapshots are bound by these hashes:

| Installation | Snapshot | SHA-256 |
| --- | --- | --- |
| Email available, 1440 px | `database-1440.json` | `b2756357a6c34720f16293a7e36305dc291788c242c2bdc3c3c108be910d16ab` |
| Email disabled, 1440 px | `database-1440-disabled.json` | `dd358f106a1befdbadadf80db40044ee959e541ed7ea20a774c619c3677596ec` |
| Email available, 390 px | `database-390.json` | `2bcbaaf20f6dd1fd07df58ed72d5d8c0f04866bd9a3667214a845a9e7d5eccf4` |
| Email disabled, 390 px | `database-390-disabled.json` | `99d50d675d7856f7ffbab6e51dc98c554139f74ec8e5d75af5eee113daaa4d9d` |

This is candidate-run evidence, not a final merge verification receipt. The final merge verification and CI must bind their own exact source input, emitted Worker and fresh reports before final completion is claimed. The artifact directory is reused by later runs, so retain each run's report and capture manifest together when keeping its evidence.

## Daily browsing, board, bulk edit, search and parents

Ordinary `pnpm verify` runs these journeys at 1440 × 900 and 390 × 844 through `tests/e2e/issue-controls-journeys.mjs`, called from `tests/e2e/ui-runtime.mjs`. Every state below is audited at both widths: computed control styling, zero serious or critical axe findings, no horizontal page overflow, and a full-page capture listed with its SHA-256 in `.artifacts/verification/issue-controls/manifest.json`.

| Family | States |
| --- | --- |
| Issue list controls | default with completed hidden, combined filter/sort/group, combined empty, date range, completed, second page, each filter (assignee, project, cycle, label, parent), each sort (newest, oldest, priority, status, due, updated), each grouping (none, status, assignee, priority, project, cycle, team), exact parent filter and its invalid draft |
| Keyboard list | focus moves to the next row, X selects, Enter opens, Escape returns to the row |
| Saved views | create form, shared view as owner, updated, board layout, opened issue and return, peer view, peer duplicate, private view for owner, private view unavailable to peer, private view absent from the peer's palette, delete confirmation |
| Stored controls | Issues, Board, Current, My work and Projects: restored in a second browser context, isolated from another operator, reset |
| Board | team required, workflow columns, phone column, opened issue and return, keyboard move persisted after reload, Intake move refused, stale conflict |
| Bulk edit | selection, success for status, assignee, priority, project, cycle and labels, atomic mixed failure |
| Parents | empty editor, own issue excluded, search selected, set, children with status, changed to a completed parent, cleared, cycle refused, stale choice retained, refreshed and reloaded |
| Search | resting, comment written, fresh comment found, comment edited, edited text found, archived project excluded, include archived, no results |
| Routes | resting and expanded states of every app route, including `/app/board` and `/app/search`, and the command palette |

The run on merge candidate `00a5dec` recorded 376 route and state audits with 20,535 control checks, 127 issue-control states (254 captures), zero serious or critical axe findings and zero horizontal overflow. The unchanged FLW-842 sample at 390 × 844 measured a 1,387 px document and a 1,280.9 px issue against the 1,393 px limit. The authored collaboration issue at 390 stayed within the same limit with every disclosure open. The captures were reviewed at full size.

Search over 5,000 synthetic issues with 5,000 comments (`tests/worker/search-capacity.test.ts`) returned its 50-result page in 7 ms in the local Worker test, read from the JSON reporter's task metadata. This is a local measurement, not a load test.

Worker tests cover `[VIEW-001]` to `[VIEW-005]`, `[SEARCH-001]` to `[SEARCH-003]` and `[REL-006]`, including prior-data upgrades from the 0014 head for migrations 0015 to 0017. Migrations 0001 to 0014 are unchanged; the deployment test freezes the names and SHA-256 of 0001 to 0017.


## Review follow-up verification procedure — 2026-10-09

Earlier counts, timings, source identities and captures above are historical receipts for their named runs. The correction scope retains issue controls, saved views, operator preferences, board, bulk edits, search and parent authoring. Results for the corrected source belong to newly generated reports; earlier candidate receipts do not establish the new source, a final merge, CI or deployment.

The seed metadata regression was first run against the unchanged seed: two cases passed and the unsupported import declaration case failed. After removing only `limits.importRecordsPerRun` and `extensionPoints.events`’s `import.completed.v1`, `nice -n 15 node --experimental-strip-types --test --test-concurrency=1 tests/followup-metadata.test.ts` passed all three cases on Node 26.8.1. This focused result checks metadata declarations and preservation, not importer behavior, application acceptance or CI.

Use the focused tests below to exercise the review boundaries before the final ordinary verification. Apart from the metadata result just recorded, the test paths identify procedures, not a claim that all of them have passed.

| Boundary | Focused test or journey | Required observation |
| --- | --- | --- |
| Seed claims | `tests/followup-metadata.test.ts` | Empty replacement list, absent portable-data capability, no unimplemented import capacity/completion event, and retained bulk-edit, saved-view and label limits. |
| Grouped paging and board counts | `tests/browse-paging.test.ts`, `tests/worker/browse-paging.test.ts`, `tests/e2e/issue-paging-browse.mjs`, `tests/e2e/issue-paging-board.mjs` | Group order precedes selected sort with stable identifiers; rendered groups contain rows; board count queries use the same SQL predicates as cards and remain true beyond a page. |
| Exact search and identity | `tests/worker/search-exact-ranking.test.ts`, `tests/worker/search-stable-identity.test.ts`, `tests/worker/search-stable-upgrade.test.ts`, `tests/worker/search-stable-transactions.test.ts`, and existing search upgrade/mutation/failure/access tests | Exact primary hit ranks first while other matches remain, index failure still permits an admitted primary hit, and changed source rowids plus FTS rebuild preserve stable issue/project/view identity. Source writes and index entries remain atomic. |
| Writing receipt | `tests/e2e/issue-editor-receipt-journeys.mjs` | Immediate reopen and a second save use the latest successful receipt, older GETs do not downgrade it, a genuine conflict retains the draft, explicit reload replaces it, and another issue cannot inherit that receipt. |
| Saved-view rename and palette | `tests/e2e/issue-controls-views.mjs`, `tests/saved-view-receipt.test.ts`, `tests/saved-view-palette.test.ts` and command-helper tests | PATCH receipt updates the heading with the subsequent GET delayed; accessible saved views open from the palette while another operator’s private view remains absent. |
| Sign-out reads | `tests/signout-read-lifecycle.test.ts`, `tests/e2e/signout-read-lifecycle-runtime.mjs`, `tests/e2e/admin-access-journey.mjs` and collaboration navigation helper | New coordinated private API GETs pause before sign-out, admitted responses finish before revocation, a failed bounded drain allows retry, unexpected earlier server errors remain errors, and navigation fails if reads do not settle. Independent server admission still governs generated transports and private downloads. |
| Document navigation reads | `tests/document-read-lifecycle.test.ts`, `tests/e2e/document-read-lifecycle.mjs`, `tests/e2e/document-read-app-runtime.mjs` and ordinary administration | Provisional native document navigation admits no new private polls; strict request settlement remains unchanged. Navigation cancellation and BFCache release only navigation leases. An explicit Reload requests a fresh authenticated document while keeping old reads fenced, including browser cancellation and 204 responses that supply no page completion receipt. |

The writing journey records `writing-{1440,390}-{receipt-after-stale-get,genuine-conflict-draft,reload-receipt-before-refresh,other-issue-identity,other-issue-saved}` states in the issue-controls capture manifest. It audits each state at 1440 × 900 and 390 × 844; the state name identifies the width at which the save race was driven. The generated `.artifacts/verification/issue-controls/manifest.json` binds captures and their SHA-256 values, and `.artifacts/verification/ui-runtime-results.json` binds the native UI run. Administration keeps `settings-final-signout-reachable` in `.artifacts/verification/admin-browser/captures.json` alongside its runtime report.

The new source registers these capture states in the ordinary UI runtime. The names below come from the actual journey modules; they do not assert a completed run or a new capture count.

| Family | Registered capture state names | Run/manifest |
| --- | --- | --- |
| Grouped pages | `issues-paged-{grouping}-{page}`, `issues-paged-sort-{sort}` | `.artifacts/verification/issue-controls/manifest.json` and `.artifacts/verification/ui-runtime-results.json` |
| Board pages and full counts | `board-paged-{all,completed}-{page}`, `board-paged-exact-completed` | Same issue-controls manifest and UI runtime report |
| Concentrated board columns | `board-concentrated-{newest,oldest,updated,priority,due,status}-page-{1,2}`, `board-concentrated-explicit-completed` | Same issue-controls manifest and UI runtime report; 135 cards in one status |
| Immediate saved-view rename | `view-receipt-before-get-{1440,390}` | Same issue-controls manifest and UI runtime report |
| Saved-view denial after a late receipt | `private-view-receipt-denied` | Same issue-controls manifest and UI runtime report; private content and navigation remain absent |
| Saved-view lifetime and new records | `view-lifetime-{known-denial,remount-late-patch,fresh-denial}-{1440,390}`, `view-{creation,duplicate}-immediate-rename-before-get-{1440,390}`, `view-creation-and-duplicate-persisted-{1440,390}` | Same issue-controls manifest and UI runtime report; each race is driven at both widths |
| Saved-view palette | `palette-saved-view-{shared,private}-{click,keyboard}`, `palette-saved-view-open-{shared,private}-{click,keyboard}` | Same issue-controls manifest and UI runtime report; unique paths and physical capture hashes are checked |
| Immediate issue save and stale reads | `writing-{1440,390}-{receipt-after-stale-get,genuine-conflict-draft,reload-receipt-before-refresh,reload-cannot-rollback-newer-props,other-issue-identity,other-issue-saved}` | Same issue-controls manifest and UI runtime report |
| Sign-out drain and recovery | `{1440,390}-signout-{paused-private-read,read-deadline-retry,complete-private-ui-removed}` | `.artifacts/verification/admin-browser/captures.json` and `admin-runtime-results.json`; actual fresh lifecycle page |
| Document navigation recovery | `{1440,390}-document-navigation-{pending,reloaded,signed-out}` | Same ordinary administration report and capture manifest; an independent native session retains its navigation pause after browser Stop, keyboard Reload obtains a new authenticated document with completed private GETs, and Sign out remains usable from a later pending-navigation state. |

The viewport-prefixed PNG paths and exact hashes come from the run’s manifest, including the paired full-size 1440 × 900 and 390 × 844 audits. The dedicated sign-out runtime writes `.artifacts/verification/signout-read-lifecycle/results.json` or `failure.json` and a six-state capture manifest; ordinary administration captures the same three lifecycle states at each width. Inspect its held-read, bounded-recovery, response-body and diagnostics observations alongside those captures.

After building the reviewed source, these commands reproduce the native correction journeys; each has its own result boundary:

```sh
nice -n 15 node tests/e2e/ui-runtime.mjs
nice -n 15 node tests/e2e/signout-read-lifecycle-runtime.mjs
nice -n 15 pnpm test:admin
nice -n 15 pnpm test:collaboration
```

Run only one heavy command at a time, with the maintained Node 22.20.0 / pnpm 10.12.4 toolchain. The UI runtime generates the state manifest above; administration and collaboration write their existing run-specific reports and capture manifests. Retain candidate results with their source-input and emitted-output identities, then use fresh reports for the final ordinary verification. Exact final source identities and receipts belong in generated artifacts and the final run report, avoiding a self-referential documentation update.

For final acceptance, run ordinary `pnpm verify`, the development check and affected native browser journeys against the exact final source; retain each report’s source-input and emitted-asset bindings and inspect the full-size captures. Record consecutive collaboration runs with their observed load and run-specific results when checking behavior under load. Record final merge and CI separately when performed. No application export/restore, real provider backup restoration, remote mail arrival or deployment is established by these procedures.

## Installation proof runners

The ordinary gate includes `pnpm test:installer:native` and `pnpm test:access`. Safe run-specific receipts are `evidence/installer/proof.json` and `evidence/access/proof.json`; installer captures cover 1440 and 390 widths. The separate `pnpm test:installer:slow` and `pnpm test:readme` commands produce the greater-than-two-minute startup and independent frozen-install receipts, with safe workspace captures under `evidence/readme`. Each receipt identifies its own executed source and outcome; listing these runners does not claim a run has passed. No runtime database, settings, sign-in URL, token or cookie is retained as an acceptance artifact.

The committed-mutation refresh journey (`pnpm test:mutation-refresh`) holds a real native issue response while two comments commit, then proves the admitted read drains without cancellation and one current read follows. Its safe count receipt is `evidence/mutation-refresh/proof.json`; explicit reload/identity cancellation and sign-out draining retain their separate existing tests.


Wave B source preparation: see [managed source and recovery](docs/MANAGED-SOURCE.md). The generated private-source descriptor/workflow, Base delivery producer, signed native owner claim and owner-gated editor are source adoption; hosted installation/service acceptance, live accounts and public publishing remain owner work. Apply 0024 additively and retain permanent admission ledgers. Native/browser verification status is recorded in the current task evidence, not inferred from packaging.
