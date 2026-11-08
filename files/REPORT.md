# sd-vector-c-f207 — ROLE-011 native suspension

Candidate: `806b1715d89a5383b5722b1b6c37a615b0665763` on `cloud/sd-vector-c-f207` in `just-every/run-vector`.

Claim: PARTIAL. The native lifecycle, protected HTTP reads, revocation, recovery and portable state are implemented. The selected Settings assignment dialog, Suspended filter, profile interface and full Assignee suspended presentation are unfinished. The supplied Claude Opus implementation and independent interface qualification remain required. This execution cannot provide that model. No DONE, landing, provider commissioning or publication-scan completion is claimed.

Before and after: ROLE-011 remains PARTIAL. Contract totals remain 136 DONE, 72 PARTIAL and 64 MISSING, 272 Status rows. CONTRACT.md, its Status, Gap and Evidence cells, ACCEPTANCE.md and docs/CLAIMS.md are unchanged. No acceptance sentence or supplied hold was removed. Only this target's plan row advances to native backend implementation with interface work outstanding.

## Product behavior

Suspension now preserves native names, comments, revision authors, activity, private saved views, preferences, follows and team memberships. One transaction records the suspension or self-leave, revokes native credentials, optionally unassigns non-terminal issues, transfers project leads and shared saved views using the existing successor rules, and writes one actor-attributed audit entry. The last workspace Owner, installation owner, unsettled file operation and transaction rollback safeguards remain.

The inactive timestamp remains the shared admission fence; explicit suspension metadata distinguishes reversible suspension from older anonymized removals. Former anonymized rows are unchanged and cannot be reactivated. A generic imported-person erase is refused for both active and suspended native members, preserving ROLE-012's separate explicit-erasure boundary.

Suspended-directory and activity-profile HTTP doors are workspace and current-role protected and omit private-team work the requesting Admin cannot see. Reopening a Member, Guest or Viewer requires an Owner or Admin; reopening a former Owner or Admin requires an Owner. Re-invitation uses the original record and role rather than the requested replacement name or role. Reactivation changes no revoked credential. Fresh magic-link sign-in returns to the retained identity and private views.

Sessions, personal tokens, authorized OAuth grants, pending OAuth codes, sponsored local agent records and calendar feeds are revoked. Signed issuer credentials from before suspension are also refused, including a credential never previously presented locally. The conservative cutoff includes Base's existing 30-second issuer clock allowance; a newly issued credential after that cutoff can be admitted under current authority. Passkeys, devices and delegated coding-agent sessions remain under the supplied holds.

Native and versioned issue and comment reads project retained Suspended attribution. Issue list and Current reads retain kept assignees, while active picker and member-count projections omit the person. Retained team owners do not count as active replacements in the last-team-owner guard. Admins still manage a team whose retained owner is inactive.

Slack links are deleted on suspension. A later mention produces no direct message; signed actions from the unlinked account are refused. Reactivation reconstructs no Slack link, sends no queued direct message and leaves those actions refused. These are signed protocol and network-edge fixtures, not a live Slack account receipt.

The protected audit response and CSV now expose the lifecycle method. Native HTTP export and restore retain the suspended state, actor, history and memberships while restoring no session or personal token. The additive 0134 migration preserves populated older stores and legacy removals.

## Frozen acceptance rubric and actual proof

The narrative clause has no numbered acceptance list. R1 through R16 below identify its checkable outcomes for this report; they do not invent new contract points. The terminal claim uses points=none because the full combined browser and HTTP acceptance journey is incomplete. PASS LOCAL does not assert exact-SHA hosted Verify success.

| Row | Outcome or inherited duty | Result and public-door evidence |
| --- | --- | --- |
| R1 | Settings suspension dialog offers keep or unassign | UNMET LOCAL. Native POST input implements both choices; the rendered control currently unassigns. The required dialog remains interface work. |
| R2 | Current Owner and Admin authority; Admin cannot suspend a leader; refused storage unchanged | PASS LOCAL. `tests/worker/member-suspension.test.ts:18`, assertions around lines 61–66 and 179–189; `tests/worker/role-matrix.test.ts:242` probes the two reactivation rows through mounted doors. |
| R3 | Self-leave and Viewer refusal to manage another member | PASS LOCAL. `tests/worker/member-suspension.test.ts:18`, Viewer leave and refused management around lines 120–126; existing Viewer browser leave checks are retained. |
| R4 | Atomic preservation, keep or unassign, successor transfers, last Owner and rollback | PASS LOCAL. `tests/worker/member-suspension.test.ts:18`; `tests/worker/removal-boundary.test.ts:13`, `:48`, `:177` and `:204`; existing transfer and rollback journeys remain in the touched worker runs. |
| R5 | Next authenticated request, sessions, personal tokens, authorized OAuth and sponsored credentials stop; sign-in withheld | PASS LOCAL for native session, versioned API and MCP. `tests/worker/member-suspension.test.ts:18`, lines 68–78 and 127–145; the real browser helper checks its member session request receives 401. No Google, SSO, passkey or device claim. |
| R6 | Kept name and Suspended attribution on comments, revisions, completion activity and audit | PASS LOCAL. `tests/worker/member-suspension.test.ts:18`, lines 79–96 and 159–177. Native and versioned reads are asserted. `tests/e2e/member-suspension-journey.mjs:10` renders both comments at 1440 and 390. Held author surfaces remain owed. |
| R7 | Active pickers and member count exclude; retained memberships stay inactive; Admin management continues | PASS LOCAL for current native projections and additions. `tests/worker/member-suspension.test.ts:18`, lines 81–119. Private-team omission and last-active-team-owner refusal leave storage unchanged. Broader project membership and seat limits remain held. |
| R8 | Notifications and digests exclude suspended recipients while preserving personal choices | PASS LOCAL. `tests/worker/collaboration-mail.test.ts:84`, final admission and suspended-recipient fixture; the signed Slack scenario also covers digest routing and recipient admission. Live INIT-004 recipients remain held. |
| R9 | Directory Suspended filter, profile and issue activity; explicit Assignee suspended flags in lists, Current and Members | PARTIAL LOCAL. Protected directory and profile HTTP responses, privacy fences and issue projections pass in `tests/worker/member-suspension.test.ts:100`. The rendered filter, profile and complete exact flag treatment remain unimplemented. |
| R10 | Settings reactivation or same-address re-invitation preserves ID, role, history, memberships and private view; old credentials stay refused | PASS LOCAL for HTTP and fresh sign-in. `tests/worker/member-suspension.test.ts:127`, including invitation at line 151. The browser helper returns to the same member and private view. Reactivation from a rendered Suspended filter remains interface work. |
| R11 | Exactly one audit entry with actor and method for suspension, leave and reactivation | PASS LOCAL. `tests/worker/member-suspension.test.ts:155`, public audit and CSV assertions at lines 159–177. Protected reads expose settings, self and invitation methods. |
| R12 | Portable export and restore keep suspension and restore no credential | PASS LOCAL. `tests/worker/data-http.test.ts:18`, actual HTTP archive download, staged restore and assertions at lines 227–233; `tests/worker/member-suspension-upgrade.test.ts:5` proves the populated additive upgrade. |
| R13 | Inherited SLACK-004 unlinking, later mention omission and signed-action refusal; unlinking survives reactivation | PASS LOCAL. `tests/worker/slack-dm-scenario.ts:154`, reached by the first test in `tests/worker/outbound-broken-destination.test.ts:13`; signed delivery and actions use the real mounted protocol with a network-edge fixture. |
| R14 | Legacy anonymized removals stay anonymous and never reactivate; no substitute member erase | PASS LOCAL. `tests/worker/member-suspension-upgrade.test.ts:5`; legacy refusal in `tests/worker/member-suspension.test.ts:185`; `tests/worker/imported-person-erasure.test.ts` preserves outsider erasure while refusing native-member erase. |
| R15 | SCIM, Google, SSO, passkeys, device registrations, Teams and GitHub identities | UNMET EXTERNAL OR EXPLICITLY HELD under ROLE-004, ROLE-010, MOBILE-002, MOBILE-005, TEAMS-001 and GITHUB-006. No hold released. |
| R16 | Delegated coding-agent pausing, project-update and customer author labels, favorites, drafts and broader seats | EXPLICITLY HELD under the supplied receiving clauses. Existing native token revocation does not qualify those duties. |

## DONE-RIDERS

| Row | Result | Evidence or limitation |
| --- | --- | --- |
| 1 | FAIL for a full DONE claim | R1 and the rendered parts of R9 and R10 are not reached; supplied held requirements also remain. Native sanity journeys pass. |
| 2 | PASS LOCAL | Real seeded issues, two comments, a completed issue, private work and actual credentials; allowed and refused paths with unchanged-storage snapshots in the lifecycle and role journeys. |
| 3 | PENDING | Exact candidate Verify receipt is recorded separately when discovered. A local browser pass alone does not satisfy hosted CI. |
| 4 | PASS LOCAL | Browser rerun uses committed head 83991ac0b0cf798cfdd1b096429d7d48c6611061. A diff to final head 806b1715d89a5383b5722b1b6c37a615b0665763 changes no product source, migration, Worker test or lifecycle browser helper. The final Inbox probe executes the changed retained-history helper; final audit and archive rerun checks the changed projection. |
| 5 | INSPECTED | ROLE-011 already names the inherited session, OAuth, agent, Slack, audit, archive and restoration duties. Contract inheritance was not edited or narrowed. |
| 6 | PASS MECHANICAL; no promotion | Touched contract write and check pass, generated files restored from main, all Status cells retained. Their old Gap text is intentionally left for the lander. |
| 7 | PASS | No contract acceptance, coverage map, ruling or Status row changed. |
| 8 | PASS LOCAL | Admin refusal to suspend or reopen a leader, Member and Viewer refusals, last Owner, unchanged storage, legacy refusal, and current role-matrix public-door probes. |
| 9 | PASS BOUNDARY | Slack and issuer keys are synthetic protocol fixtures; no provider commissioning, live recipients, native device or hosted guarantee is claimed. |
| 10 | PARTIAL DEFAULT | Signed issuer credentials are conservatively refused through the existing clock-skew window after suspension; no new delegation or provider policy is approved by this report. |
| 11 | PENDING LANDER | Candidate is branch-only. Main equality, complete full-history publication scan with zero findings, exact-main Verify and candidate Run site are not claimed. |

## Pre-READY self-check

1. Native outcomes have seeded sanity assertions; the full combined interface journey is incomplete, so ROLE-011 is PARTIAL.
2. Existing dangerous-path and storage assertions remain. Anonymize-on-removal assertions were replaced with kept-identity assertions because suspension must preserve those records. No test registration was removed or permanently skipped, and no assertion was moved behind a width condition. Focused local filters left unrelated cases unselected; CI still runs the existing full globs. The sole-Owner browser check now also refuses a Suspend control.
3. Old personal tokens, OAuth grants, local and signed sponsored credentials remain refused after reactivation; legacy removals cannot reopen; unrelated imported-person erasure, rollback survivors and stale archive fences remain exercised.
4. No new screen or icon-only control was created. Existing suspension terminology was corrected. The incomplete assignment dialog, directory and profile stay named rather than being qualified without the required interface model.
5. Source lock, contract generation and migration checks pass locally. Publication scanning and landing remain fleet gates. The green main baseline is Verify 42503991437 and Run site 42503991458 at 0e8a686c06eddd55943ed1d2690df32a8fc82213; neither is candidate evidence.

## Assertion replacements and local diagnostics

The retained-content tests are named in `tests/worker/removal-history.test.ts` (suspension keeps names and native operator references; suspension transfers projects while keeping actor names), `tests/worker/removal-files.test.ts` (settled uploads and file deletion retain their author), `tests/worker/views-removal.test.ts` (private views and preferences remain hidden and retained), `tests/worker/removal-boundary.test.ts` (native invalidation, rollback and concurrent active actors) and `tests/worker/agent-events.test.ts` (suspended author event history remains named). The existing `tests/e2e/collaboration-pagination.mjs` helper now checks exact retained Inbox and personal rows, cancelled delivery and unchanged cache revocation, replacing only its old erase-on-removal expectations. Current role, audit, mail and integration expectations were changed only where they previously required destructive removal.

The imported-person regression initially encountered a report-read 404 late in its long fixture, then passed unchanged on recheck. No product fix was guessed for that intermittent result. An administration browser run found the old sole-Owner label and was repaired by updating that selector and strengthening the no-action assertion. A later run timed out in the existing Guest refresh-navigation helper; no assertion was weakened and the clean-build rerun passed all 79 clause journeys and 102 functional checkpoints, 80 registered tests with zero failures. The collaboration harness first refused to launch because its default Playwright browser was absent; it now accepts the same optional system-Chromium selector used by the other harnesses. Its next run reached suspension and exposed the old expectation that notifications and all personal choices be erased. Those count-zero assertions were replaced by exact retained-row equality, while cancelled-delivery, cached-row clearing and 401 checks remain. The focused committed-helper probe passes. These are local runs, not hosted Verify repairs.

The initial ledger IPC helper was mistakenly invoked directly and refused because process.send is unavailable outside its parent. The actual deployment migration test then passed, validating the complete 134-file ledger and repeat-without-writes behavior. This failed exploratory invocation is not counted as a passing check.

## Runtime probes

PROBE ROLE-011 authority: current Admin attempts to suspend the Owner -> 403, retained native graph unchanged.
PROBE ROLE-011 credentials: suspend a populated member with keep -> both sessions, personal and authorized OAuth tokens, local sponsored token and seen or unseen signed issuer credentials return 401; no new magic-link mail is admitted.
PROBE ROLE-011 retention: read native and versioned issues, comments, revisions and Current -> same member ID and kept name with Suspended attribution; open work stays assigned; active pickers omit the member.
PROBE ROLE-011 privacy: Admin opens the suspended profile -> visible issue activity only; private issue identifier and title omitted; Owner sees the two assignments.
PROBE ROLE-011 recovery: Admin reactivates, member signs in afresh, then same-address invitation reactivates again -> same ID, original Member role, history, private view and memberships; old credentials stay refused.
PROBE ROLE-011 Slack: signed action and later mention after suspension and after reactivation -> no member link, no direct message and action refused 403.
PROBE ROLE-011 audit: protected audit JSON and CSV -> one actor-attributed event per lifecycle transition with settings, self or invitation method.
PROBE ROLE-011 archive: download native HTTP archive and restore it -> same suspended metadata and team membership, no session or personal token, sign-in and old bearer refused.
PROBE ROLE-011 interface: none for the assignment choice and Suspended filter; required interface implementation and qualification remain outstanding.

## Custody

The full plan is in PLAN.md. Actual local receipts, browser receipt, four synthetic issue-history captures, final CI discovery, push custody and the selected-file hashes are separate packet files. Credentials, environment dumps, runtime stores, signed URLs, sessions and private gate material are not selected. No PR is required by the existing cloud-branch Verify entry point. No inbox file is read or written; terminal POST lines relay the result.

Product push: cloud/sd-vector-c-f207 at 806b1715d89a5383b5722b1b6c37a615b0665763 is confirmed on the remote. Exact-head push Verify 42513319748 was discovered in progress. No duplicate workflow was dispatched. The administration browser now passes in full; the final collaboration rerun passed 52 clause journeys, 122 functional checkpoints and 10 live timings, 53 registered tests with zero failures, including retained-state and cached-page revocation at 1440 and 390.

CLAIM ROLE-011 PARTIAL points=none tests=tests/worker/member-suspension.test.ts#suspension keeps identity and work, revokes every native credential, and reactivation requires fresh sign-in with unchanged history; tests/worker/member-suspension-upgrade.test.ts#populated pre-suspension stores retain legacy removals, credentials and all history through the additive lifecycle upgrade
DEFAULT ROLE-011: Pre-suspension signed issuer credentials remain denied through Base's existing 30-second clock allowance; fresh credentials and sessions require current authority. No broader provider or delegation approval is claimed.
GAP ROLE-011: The selected assignment-choice dialog, Suspended filter and profile interface, full Assignee suspended presentation and required Claude Opus interface qualification are unfinished; all supplied SCIM, identity, device, delegated-agent, author-surface, favorites, draft, seat, erasure and live-recipient holds remain owed.

Final exact-head Verify observation: in_progress, conclusion None, run 42513319748 at 806b1715d89a5383b5722b1b6c37a615b0665763. Main remains the green baseline; no candidate landing or Run site is claimed.

MECHANICAL lock=pnpm sources:lock then pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write ROLE-011 then check ROLE-011, generated files restored from main exit=0; ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0.
