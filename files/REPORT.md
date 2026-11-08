# Vector roadmap build plan and results

Tag: sd-vector-c-f202. Repository: just-every/run-vector. Product branch: cloud/sd-vector-c-f202.

Starting clause: INIT-003 MISSING, with the unchanged source Gap “No implementation yet”. Contract Status, Gap and Evidence cells belong to the lander and are not edited by this builder.

Plan:
1. Inspect the current project record, date mutation, visibility boundary, issue timeline, role matrix and mounted journeys. Map the selected roadmap duties to missing public-door proof.
2. Add a focused roadmap projection and placement model. Preserve absent dates, derive initiative spans from visible projects only, expose read-only milestones and reuse issue-timeline date primitives.
3. Reuse the existing project-field writer with a durable snapshot revision check and one activity for a single date gesture. Preserve ordinary per-field activity on other project editors.
4. Add the native page, navigation, accessible week, month and quarter zoom, date gestures, keyboard movement, planning fields and a phone list. Reuse the seed theme and components.
5. Add one mounted Worker journey covering projection and safe mutation, and a browser journey called by the existing project membership and core runtime chain. Prove the selected screens at 1440 and 390, contrast, read-only roles and privacy.
6. Run touched Worker checks, typecheck, browser proof, contract generation and check, first-party validation and source lock freshness. Restore generated contract views and commit no fleet evidence into product history.
7. Merge current main before the final candidate, push only the named branch with the guarded helper, inspect exact-SHA Verify via REST within the API budget and publish the full non-secret evidence packet separately.

Initial gap map: the roadmap public page, all four placements, visible initiative spans, milestone projection, zoom, gestures, keyboard movement, inherited planning fields, phone list, role admission and theme contrast had no existing roadmap assertion. Existing project-field and issue-timeline assertions are retained.

Scope retained: configurable category styling and Paused behavior belong to PROJ-016; direct and issue-derived connectors and date conflict flags belong to held PROJ-015; INIT-002 roll-up and DATA-014 imported dates are not selected. Interface implementation and independent qualification retain the supplied Claude Opus requirement. No model override or independent gate is available in this Codex builder session, so that qualification cannot be claimed here.

Design tooling: the required 12ui skill was read and its CLI installed. A draft attempt refused before generation because the CLI requires account sign-in. No design was generated, no account connection was requested, and no credentials were sought. Implementation follows the existing Vector app tokens and components.

Final validation and exact candidate receipts follow below.

## Validation record

The product claim is PARTIAL. The selected four-project acceptance is the single numbered acceptance point, point 1. Broader held obligations and supplied interface qualification remain named below. No contract judgment cells are authored by this builder.

| Item | Acceptance sentence, rider or inherited duty | Public-door proof | Result |
|---|---|---|---|
| A1 | Timeline projects and initiatives, dates, today marker, read-only milestones and week, month and quarter zoom | `tests/e2e/roadmap-journey.mjs:5` — roadmapJourney; `tests/worker/roadmap.test.ts:9` — roadmap places visible projects and initiatives and fences every planning change with one activity | Browser PASS on exact candidate |
| A2 | Fixed Planned, Active, Completed and Canceled lifecycle styling; configurable categories and Paused remain held | Fixed lifecycle classes in the page and stylesheet; browser asserts the active mark. PROJ-016 held scope is unchanged. | INSPECTED; held remainder not claimed |
| A3 | Both dates as a bar, target only as a diamond, start only open to today, future start open to itself, neither Unscheduled | `tests/worker/roadmap.test.ts:9` — roadmap places visible projects and initiatives and fences every planning change with one activity; `tests/e2e/roadmap-journey.mjs:5` — roadmapJourney | Worker and browser PASS on exact candidate |
| A4 | Initiative earliest visible start and latest visible target; own target diamond when no visible project is dated | `tests/worker/roadmap.test.ts:9` — roadmap places visible projects and initiatives and fences every planning change with one activity; `tests/e2e/roadmap-journey.mjs:5` — roadmapJourney | Worker and browser PASS on exact candidate |
| A5 | Body moves both dates, either endpoint changes only that date, diamond and Unscheduled drags persist one activity | `tests/worker/roadmap.test.ts:9` — roadmap places visible projects and initiatives and fences every planning change with one activity; `tests/e2e/roadmap-journey.mjs:5` — roadmapJourney | Worker and browser PASS on exact candidate |
| A6 | Arrow keys move by the selected zoom unit, and 390px offers a usable list equivalent | `tests/e2e/roadmap-journey.mjs:5` — roadmapJourney | Browser PASS on exact candidate |
| A7 | Light, Dark and System; AA text, controls and marks; distinguishable today and milestones | `tests/e2e/roadmap-journey.mjs:5` — roadmapJourney through `./tests/e2e/theme-contrast.mjs` and its existing non-text checker | Browser PASS on exact candidate |
| A8 | PROJ-001 start and target dates, priority and labels editable on the roadmap, one activity per accepted change | `tests/worker/roadmap.test.ts:9` — roadmap places visible projects and initiatives and fences every planning change with one activity; `tests/e2e/roadmap-journey.mjs:5` — roadmapJourney | Worker and browser PASS on exact candidate |
| A9 | Named four-project browser acceptance: four placements, diamond and Unscheduled activity, keyboard and phone list | `tests/e2e/roadmap-journey.mjs:5` — roadmapJourney | Browser PASS on exact candidate |
| I1 | Existing project-field role row: Owner, Admin and Member edit; Guest and Viewer read only | `tests/worker/roadmap.test.ts:9` — roadmap places visible projects and initiatives and fences every planning change with one activity; `tests/e2e/roadmap-journey.mjs:5` — roadmapJourney | Worker and browser PASS on exact candidate |
| I2 | Current private-team visibility hides project title and identity and excludes its dates from initiative spans | `tests/worker/roadmap.test.ts:9` — roadmap places visible projects and initiatives and fences every planning change with one activity; `tests/e2e/roadmap-journey.mjs:5` — roadmapJourney | Worker and browser PASS on exact candidate |
| I3 | Stale, foreign, missing, private and removed-session refusals preserve projects, labels and activity | `tests/worker/roadmap.test.ts:9` — roadmap places visible projects and initiatives and fences every planning change with one activity; browser also attempts a stale field edit | Worker and browser PASS on exact candidate |
| I4 | Reuse issue timeline placement primitives without changing VIEW-007 | The roadmap imports dayNumber and dayAt from `./src/core/features/calendar-view/timeline-dates.ts`. No existing calendar-view source or timeline journey assertion changes. | INSPECTED |
| H1 | Direct and issue-derived connectors and conflict flags, configurable categories, Paused hatch and no-slip semantics | Remain with held PROJ-015 and PROJ-016. No acceptance point or held scope was removed. | NOT CLAIMED |
| H2 | Supplied Claude Opus interface implementation and independent gate qualification | This session is a Codex builder. The retained qualification is not available here and is not claimed. | PENDING EXTERNAL QUALIFICATION |

### DONE-RIDERS

| Row | Result and evidence |
|---|---|
| 1 | Selected native outcomes covered by the mounted Worker journey and roadmapJourney. Full clause DONE is not claimed; held connectors, configurable statuses and supplied interface qualification remain owed. Exact-SHA Verify pending. |
| 2 | PASS for Worker and browser seeded data, dangerous-path denials and unchanged-storage checks. No empty-result or computed-from-implementation expected value substitutes for an outcome. |
| 3 | PENDING exact-SHA Verify. Worker test is discovered by the existing Vitest glob. Browser helper is unconditionally called from core-project-membership-journey, through core-runtime projects, which the current partition invokes. |
| 4 | PASS: Worker and browser receipts name the full candidate SHA. The browser receipt additionally hashes every relevant source and journey file; all hashes were checked after the run. |
| 5 | INSPECTED: INIT-003 names PROJ-001 planning edits and VIEW-011 themes. Existing project role and privacy obligations are followed without changing their source text. |
| 6 | PASS generator write and check for INIT-003, followed by restoration of main's generated views. Source Status, Gap and Evidence cells remain main's. Final source lock check PASS on the candidate. |
| 7 | PASS: no acceptance point, Status row or coverage obligation was edited; main's newer release-note clause judgments are retained. |
| 8 | PASS Worker: Owner, Admin and Member writes are accepted and attributed; Guest, Viewer, private, foreign, missing, stale and removed-session attempts are denied with unchanged planning storage. Browser Guest and Viewer read-only checks PASS. |
| 9 | NOT APPLICABLE: no provider, legal, hosted commissioning, native-device or scale boundary is claimed. |
| 10 | PASS: no new policy default. Admission follows the supplied existing PROJ-001 row and existing private-team visibility. No ct scope request is needed. |
| 11 | PENDING guarded lander: main equality, exact-SHA branch Verify, complete full-history publication scan with zero new findings and candidate Run site remain fleet gates. No such receipt is invented here. |

### Pre-ready self-check

1. Worker public doors pass. The exact-SHA browser run passes real drags, date edits, priority and label saves, role downgrades and privacy withdrawal. Existing assertions are retained.
2. No existing assertion was deleted, skipped, narrowed or put behind a width or branch condition. One mounted Worker sanity journey is added and a helper is called by an existing runtime.
3. Current role, private-team and removed-session admission remains authoritative. A stale captured intent and replay are refused without planning writes. The feature creates no provider effects, person records or restoration path.
4. Roadmap text is at least 13px. Every new icon-only timeline control uses the seed tooltip. Planning fields have enclosing borders. No configuration screen or public homepage was changed.
5. Source lock, first-party validation and generated-view receipts will be bound below. Cloud publication scanning, landing and candidate Run site remain unestablished until the maintained fleet runs them.

### Integration and initial verification

The initial main was `162434f06698b04c918d3e3e1d060aa4ae5f6ec0`, with successful Verify `42497690239` and Run site `42497690236`. The branch then merged main `0e8a686c06eddd55943ed1d2690df32a8fc82213`, preserving release-note changes, migration 0133 and all clause judgments. That main has successful Verify `42503991437` and Run site `42503991458`. These are main receipts, not candidate receipts.

The first save `abd0cfd8` was pushed with skip-ci preservation. The final merge conflict was only the generated source lock; it was taken from main, regenerated by the documented command and checked, without hand-editing any hash. The newer contract source was resolved first and all generated views were taken whole from main.

Local touched Worker command: `pnpm exec vitest run --config vitest.config.ts tests/worker/roadmap.test.ts tests/worker/project-fields.test.ts tests/worker/project-membership.test.ts` — 3 files and 7 tests passed after integrating main. Typecheck runs in the successful `npx -y @runeditrun/rer build`. No whole local verification suite was run.

Local development setup initially supplied an owner configuration to the runtime fixture; its root and copied dev-variable files were moved outside the product tree before browser proof. The test runtime uses only synthetic fixture accounts. Early local checks found and corrected a refined-schema pick, a missing error import, implicit priority-select labeling, low-contrast date-handle boundaries and a missing image role on the initiative marker. No test or landing guard was weakened.

### Final product result

Product head: `52ddd29d9b1099ee45aec00fd0c8e2a6bb964f4b` on `cloud/sd-vector-c-f202`, pushed successfully. No PR is required: the existing Verify workflow admits pushes to cloud branches. No PR was opened and no main or default branch was pushed.

Exact-SHA Worker proof: three files, seven tests, exit 0. Exact-SHA browser proof: roadmapJourney exit 0, passing all selected native outcomes at the prescribed desktop assertion width and the phone-list width. The screenshots show the roadmap at 1440 and 390. Light and Dark text and enabled controls pass the existing AA checker; the journey also checks roadmap marks at 3:1 and serious accessibility violations, and observes System changing live. The independent supplied Opus qualification is not claimed by this Codex build.

Source Status counts at initial main were 136 DONE, 71 PARTIAL and 65 MISSING, 272 total. The newer main brought RELEASE-003 from MISSING to PARTIAL, giving 136 DONE, 72 PARTIAL and 64 MISSING. This builder changed no Status row; counts remain identical to that integrated main. INIT-003 remains MISSING in the source; the handoff claims PARTIAL for the implemented and proven selected native point. No acceptance text, gap cell or generated view was narrowed or edited by this builder.

Plan row reported: INIT-003 selected native roadmap POINTS implemented and locally proven; retained holds and supplied interface qualification stay owed. No other campaign row was selected, rebuilt or changed.

PROBE INIT-003 1 placement: mounted roadmap page with four visible seeded projects -> bar, target diamond, open-ended start bar and Unscheduled entry; native projection also returns a future start ending at itself and an initiative fallback diamond.
PROBE INIT-003 1 date gestures: diamond, Unscheduled, body and both endpoints on the rendered timeline -> persisted expected dates, exactly one attributed activity per accepted gesture, and one visible Dates changed entry on each dragged project's page.
PROBE INIT-003 1 keyboard and planning: focused bar ArrowRight under Week, date editor, priority save and label save -> one-week movement and persisted edits with one activity per accepted change; stale save returns 409 with retained current dates and activity.
PROBE INIT-003 1 authority and privacy: Owner, Admin and Member planning changes -> accepted; Guest, Viewer, stale, missing, foreign and hidden-project changes -> refused unchanged; removed session -> 401; private membership withdrawal -> hidden title and identifier absent from API and rendered HTML and excluded from initiative span.
PROBE INIT-003 1 phone and themes: 390px roadmap -> list equivalent with all four visible projects and no horizontal overflow; Light, Dark and System -> correct palette, zero AA failures, distinguishable marks and no hydration errors.

MECHANICAL lock=pnpm sources:lock then pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write INIT-003 then node scripts/contract-docs.mjs check INIT-003 exit=0, generated views restored from origin/main; ledger=none, no migration authored exit=0.

No existing assertion was removed, weakened or moved behind a width or branch condition. No duplicate or pin test was added. The native source and existing assertions for VIEW-007 remain byte-identical to integrated main. No new email-shaped fixture text or credential-shaped value was added to the product diff. Fleet evidence is outside the product tree and is published only to its separate evidence branch.

CLAIM INIT-003 PARTIAL points=1 tests=tests/worker/roadmap.test.ts#roadmap places visible projects and initiatives and fences every planning change with one activity; tests/e2e/roadmap-journey.mjs#roadmapJourney
GAP INIT-003: Supplied Claude Opus interface implementation and independent qualification remain unclaimed; configurable statuses and Paused behavior remain held under PROJ-016, and direct and issue-derived connectors and conflict flags remain held under PROJ-015. INIT-002 roll-up and DATA-014 imported dates remain unselected.

### Publication and landing boundary

Candidate Verify run: 42505077963, event push, exact head 52ddd29d9b1099ee45aec00fd0c8e2a6bb964f4b. Latest observed state is recorded in the accompanying actual CI receipt. Full-history publication scan: commit=52ddd29d9b1099ee45aec00fd0c8e2a6bb964f4b complete=unestablished historyScanned=unestablished findings=unestablished. The cloud adaptation assigns that scan to the maintained Mac lander; this report does not invent a COMPLETE or zero-findings receipt. Candidate main equality, guarded landing, candidate Run site and independent interface qualification are pending fleet work. Existing main's successful runs are separately labelled above.

### Terminal custody

At 2026-11-08T17:50:39Z, the fourth status poll still returned in_progress and no conclusion for push Verify 42505077963 on exact candidate 52ddd29d9b1099ee45aec00fd0c8e2a6bb964f4b. Seven of the ten allowed GitHub calls have been used; the remaining calls are retained for failure analysis rather than further status polling. No failed run or assertion has been observed, and no green result from another SHA is substituted. The candidate is handed off as PUSHED, with all local touched checks, typecheck, first-party validation, generated-view checks, source lock and exact-SHA browser proof passing. It is not represented as exact-SHA Verify green or as landed.

The complete relevant packet is published separately to refs/heads/evidence/sd-vector-c-f202. Its initial publication was fetched back and all 18 files were verified against the manifest and local bytes; the terminal receipt is republished after this update. Product checkout, index and head are unchanged by evidence publication. Browsers and local Workers are stopped. The pushed clone is removed only after both remote refs and the final packet have been verified.

PUSHED branch=cloud/sd-vector-c-f202 head=52ddd29d9b1099ee45aec00fd0c8e2a6bb964f4b
