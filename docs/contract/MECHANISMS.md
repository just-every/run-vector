# Vector provider mechanisms and verification recipes

CONTRACT.md is the only acceptance and status source. This guide preserves command, transport, provider and fixture details moved from the pre-rewrite clauses; each recipe describes verification, not a second status inventory.

## HOME-001 — Public homepage

**Verification recipe.** `tests/e2e/core-runtime.mjs` (tests tagged HOME-001).

**Mechanism context.** The owner-approved public marketing homepage at `/` remains exactly as approved, including its copy and assets and the line “100% free, open source alternative to Linear, Jira and Asana.” That line is product positioning; it does not promise feature parity or importer coverage for every named product. The page presents Vector with its headline, one supporting sentence, and source and docs links, followed by short sections (how Current explains each issue, free and open source, deferral, the rest of the product, trying it beside another tracker, a closing call to action), each drawing the product only from its real labels. The public site's “Run Vector” action remains unchanged and points to `/run`, the installation page. The installed application's root `/` serves the Base Lobby, whose Sign in entry satisfies this clause's sign-in requirement (owner decision, 13 Oct 2026 15:11Z). The page contains no pricing, hosting costs, customer testimonials or invented metrics, reads no installation data and is server-rendered.

## OPS-001 — Workspace access

**Verification recipe.** the existing equal-access tests plus a role-matrix journey that signs in as Admin, Member and Guest and checks every private route, `/api/v1` route, search and export against ROLE-001–003.

## SETUP-001 — First workspace review

**Verification recipe.** `tests/worker/first-run.test.ts` (tests tagged SETUP-001).

**Mechanism context.** Fresh configured owners review their workspace at `/setup` before entering an app route. Signed-out visitors return there after ordinary sign-in. Only the recorded installation owner may complete setup through a same-origin, current-session transaction. Completion survives repeated setup, restart and local restore. Existing configured installations retain completion through the additive upgrade.

## OPS-002 — Member management

**Verification recipe.** the existing invite and removal tests plus the OPS-002 rows of the role-matrix journey (ROLE-001): a Member's invitation is refused 403 by default and admitted after the setting is enabled, a Member's attempt to invite an Admin is refused 403, and an Admin's removal of a Member succeeds.

**Mechanism context.** Members are invited, removed by suspension (OPS-004, ROLE-011), reactivated and erased (ROLE-012) in Settings → Members, and every invitation names the invitee's role (ROLE-001) and, for a Guest, the teams they join (ROLE-003). Owners and Admins invite and remove Members and Guests; only Owners invite, promote to or remove Owners and Admins. The installation owner can be removed only by themselves, and never while they are the last Owner (ROLE-001). Members and Guests cannot remove anyone but themselves. *Policy: `operator.management.v1`; default: Owners and Admins invite and remove; a workspace setting lets Members invite Members (never Admins or Guests).*

## OPS-003 — Workspace time

**Verification recipe.** `tests/e2e/admin-workspace-time-journey.mjs`, `tests/e2e/admin-access-journey.mjs`, `tests/e2e/admin-runtime.mjs` (tests tagged OPS-003).

## OPS-004 — Safe removal

**Verification recipe.** `tests/worker/removal-boundary.test.ts`, `tests/e2e/collaboration-runtime.mjs`, `tests/worker/base-auth.test.ts`, `tests/worker/foundation-rollback.test.ts` (tests tagged OPS-004) for session revocation, transfers, unassignment, the last-operator guard and rollback; plus the ROLE-011 suspension journey, in which a removed member's comments and activity still carry their name, and the ROLE-012 journey, in which only the explicit erase anonymizes.

## TEAM-001 — Team identity

**Verification recipe.** `tests/e2e/admin-team-journey.mjs` (tests tagged TEAM-001).

## TEAM-002 — Team workflow

**Verification recipe.** `tests/e2e/admin-team-journey.mjs`, `tests/worker/base-auth.test.ts` (tests tagged TEAM-002) for the workflow rules, plus the TEAM-002 rows of the role-matrix journey (ROLE-001): a team owner renames a status, and a Member who does not own the team gets 403 under the default permission and succeeds once the permission is All team members.

## TEAM-003 — Team archiving

**Verification recipe.** `tests/e2e/admin-archive-team-journey.mjs` (tests tagged TEAM-003).

## TEAM-004 — Status removal

**Verification recipe.** `tests/e2e/admin-team-journey.mjs` (tests tagged TEAM-004).

## ISSUE-001 — Creation

**Verification recipe.** `tests/e2e/core-runtime.mjs`, `tests/markdown-rendering.test.tsx` (tests tagged ISSUE-001).

**Mechanism context.** An operator can create an issue with a required title and team plus an optional Markdown description (written in the ISSUE-026 editor, with inline images and video under ISSUE-024 and checklists under ISSUE-025), assignee, project, cycle, priority, labels, estimate, due date, expected outcome, customer impact, and values for the custom fields defined for its team (FIELD-001, which carries their types and acceptance). It starts in the team's default Backlog status unless another non-Intake status is explicitly chosen. *Policy: `issue.defaults.v1`; default: unassigned, no priority, no cycle, and no project.*

## ISSUE-002 — Stable identifiers

**Verification recipe.** `tests/worker/issue-deletion-relations.test.ts` (tests tagged ISSUE-002).

**Mechanism context.** An issue identifier is its team's prefix, a hyphen, and an integer one higher than the highest ever allocated under that prefix, so a number is never reused after an issue is deleted. The identifier never changes, including when the issue moves teams (ISSUE-012); a prefix therefore records where an issue started, not where it lives.

## ISSUE-003 — Priority

**Verification recipe.** A test that sets each of the five priorities and checks that No priority is the default and sorts after Low.

## ISSUE-004 — Status transitions

**Verification recipe.** `tests/worker/issue-session-projection.test.ts` (tests tagged ISSUE-004).

**Mechanism context.** A version-checked operator mutation (ISSUE-006) can move an issue in any direction among the Backlog, Unstarted, Started, Completed, and Canceled statuses of its team's workflow. Vector rejects moving any issue into an Intake status. Leaving Intake uses INTAKE-005, INTAKE-007, or REL-003; entering or leaving Duplicate uses REL-003 or REL-005. Entering Completed records the completion time and entering Canceled records the cancellation time; leaving one of those categories clears the time it recorded and removes no activity.

## ISSUE-005 — Assignment

**Verification recipe.** `tests/worker/removal-assignment.test.ts` (tests tagged ISSUE-005).

## ISSUE-006 — Concurrent edits

**Verification recipe.** `tests/e2e/core-runtime.mjs`, `tests/e2e/collaboration-preferences.mjs`, `tests/worker/dependencies.test.ts` (tests tagged ISSUE-006).

**Mechanism context.** Every issue carries an integer version that increases by one on each mutation that appends an activity entry under ISSUE-007. An issue mutation carries the version the client last read; if the stored version is higher, Vector rejects the mutation with 409 and returns the current issue and version, changing nothing. Adding a comment, evidence revision, follower, or notification does not change the version and is never rejected as stale.

## ISSUE-007 — Activity history

**Verification recipe.** `tests/worker/dependencies.test.ts`, `tests/e2e/admin-label-journey.mjs`, `tests/worker/cycle-closure.test.ts` (tests tagged ISSUE-007).
2. `tests/worker/project-fields.test.ts` also proves one combined project/milestone activity entry when an issue leaves its project.

## ISSUE-008 — Comments, threads and resolution

**Verification recipe.** `tests/worker/discussion-access.test.ts`, `tests/e2e/collaboration-runtime.mjs`, `tests/e2e/core-runtime.mjs` (tests tagged ISSUE-008) for comment creation, editing, deletion and tombstones; plus a thread journey that replies twice to a comment, resolves the thread and sees it collapse to one line with the resolver, posts a new reply and sees it reopen, adds an inline comment on highlighted description text and finds it anchored in the margin, and is refused 403 editing another member's comment; plus the SLACK-002 fixture in which one Slack thread's replies land only in its mapped comment thread.

**Mechanism context.** Any member who can see an issue (a Guest only in invited teams) can add a Markdown comment in the ISSUE-026 editor, with inline images and video (ISSUE-024) and checklists (ISSUE-025). Each top-level comment starts a thread: members reply to it, and replies show under it in order. Any member who can comment can resolve a thread when its question is answered, which collapses it to one line naming who resolved it and when, and can reopen it; a new reply reopens a resolved thread. A comment can also quote highlighted text of the issue description or a document (PROJ-013) as an inline comment, which anchors the thread to that text and shows it in the margin; if the text is later removed, the thread stays in the issue with the quoted text shown as removed. Only a comment's author edits it; an edited comment shows its edit time. Authors delete their own comments; Owners, Admins and the team's owners delete anyone's (role matrix, ROLE-001); the entry records who acted. Deleting a comment removes its body, attachments, links, and search entry, leaves a tombstone and an activity entry in the thread, keeps its replies, and does not remove the follower state it created. A synced Slack or Teams thread maps to exactly one Vector comment thread (SLACK-002).

## ISSUE-009 — Attachments and links

**Verification recipe.** `tests/worker/discussion-file-admission.test.ts`, `tests/e2e/core-runtime.mjs`, `tests/worker/link-cascade.test.ts` (tests tagged ISSUE-009).

**Mechanism context.** Operators can attach files and named HTTPS links to an issue or a comment. Removing either records the action; removing a file also deletes its blob under `BASE-DATA-003`. An image or video pasted, dropped or uploaded into a description, comment or document is an attachment under this clause and is shown inline where it was placed (ISSUE-024).

## ISSUE-010 — Deletion

**Verification recipe.** `tests/worker/issue-deletion-cascade.test.ts`, `tests/worker/collaboration-atomicity.test.ts`, `tests/worker/issue-deletion-import.test.ts` (tests tagged ISSUE-010) for the permanent cascade; plus the ISSUE-020 journey and the ISSUE-010 rows of the role-matrix journey: a Member who did not create the issue is refused 403 by default, its creator deletes it to Recently deleted, and a Member's "Delete permanently" is refused 403 while an Admin's succeeds and runs the cascade at once.

**Mechanism context.** Deleting an issue first moves it to Recently deleted (ISSUE-020), from which it can be undone or restored intact for 30 days. Permanent deletion happens when that retention ends, or at once when an Owner or Admin chooses "Delete permanently" (for erasure under SEC-003 and DATA-011): it removes the issue's comments, attachments, links, evidence revisions, dependencies, parent link, follower state, notifications, activity, and search entry; its children become root issues, and a duplicate is removed from its canonical issue's list. Vector rejects deleting a canonical issue that still has duplicates. Closed cycle snapshots (CYCLE-005) and audit entries keep only its identifier, and its source idempotency records (INTAKE-002) are retained so a re-delivery cannot resurrect it. *Policy: `issue.can-delete.v1`; default: Owners, Admins and the issue's creator; a workspace setting extends it to every Member of the issue's team; Guests never delete; only Owners and Admins delete permanently (role matrix, ROLE-001).*

## ISSUE-011 — Estimates

**Verification recipe.** `tests/worker/cycle-closure.test.ts` (tests tagged ISSUE-011).

## ISSUE-012 — Moving teams

**Verification recipe.** `tests/worker/bulk-commands.test.ts` and `tests/e2e/core-stream-planning-journey.mjs` exercise team moves, including Intake and Started issues, stable identifiers, cycle uncommit and one activity entry.

**Mechanism context.** Moving an issue requires a non-archived target team and an explicit target status in the same category as its current status, including Intake so a misrouted intake item reaches the right team without a decision. The move preserves the identifier (ISSUE-002), uncommits the issue from any cycle (CYCLE-002), keeps its project, assignee, labels, custom-field values and history, and writes one activity entry. Labels and custom-field values are preserved unchanged; the native move does not map them. All of it happens or none of it does.

## ISSUE-013 — Mentions

**Verification recipe.** `tests/e2e/collaboration-events.mjs`, `tests/markdown-rendering.test.tsx` (tests tagged ISSUE-013).

**Mechanism context.** Typing `@` in an issue description or comment offers matching operators, and choosing one records a mention of that operator. Text resolving to no operator is stored and shown literally and mentions nobody. A mention adds a follower (NOTIFY-002) and notifies once (NOTIFY-001); editing text to add a mention notifies only the newly mentioned operator, and removing a mention notifies nobody and withdraws no delivered notification.

## ISSUE-014 — Labels

**Verification recipe.** `tests/e2e/admin-issue-journey.mjs`, `tests/e2e/admin-label-journey.mjs`, `tests/e2e/collaboration-issue.mjs` (tests tagged ISSUE-014) for workspace labels; plus a Member journey that opens Settings → Labels read-only and creates through the inline issue picker under both values of the workspace label-creation setting, without gaining workspace label-management controls; plus a journey that creates a team label and a label group, is refused applying two labels of one group, merges two labels and finds every issue relabeled, and the ISSUE-014 rows of the role-matrix journey (a Member's delete of a workspace label refused 403, an Admin's admitted).

**Mechanism context.** A label belongs to the workspace or to one team, has a name unique among the labels visible in that scope and a color, and can sit in a label group (for example Area, Type) whose labels are mutually exclusive on an issue. Owners, Admins and Members create labels and apply them — Members through the inline Create label in the issue label picker, subject to the workspace label-creation setting, while Settings → Labels is written only by Owners and Admins and Members only read labels — and Guests apply existing labels in their invited teams; Owners and Admins rename, recolor, merge and delete workspace labels, and a team's owners — or all its members while its *Who manages team settings* permission is All team members (ROLE-009) — do so for that team's labels (role matrix, ROLE-001). Merging one label into another relabels every issue and saved-view filter in one change. Deleting a label removes it from every issue and from the filters of saved views naming it, and deletes no issue. An issue carries up to the number of labels in `seed.json → limits`. *Policy: `label.manage.v1`; default: as above; a workspace setting restricts label creation to Owners and Admins.*

## ISSUE-015 — Unsent drafts

**Verification recipe.** `tests/e2e/core-draft-journey.mjs` (tests tagged ISSUE-015).

## REL-001 — Dependencies

**Verification recipe.** `tests/worker/dependencies.test.ts` (tests tagged REL-001).

## REL-002 — Blocked state

**Verification recipe.** `tests/worker/dependencies.test.ts` (tests tagged REL-002).

## REL-003 — Duplicate decision

**Verification recipe.** `tests/worker/issue-deletion-relations.test.ts` (tests tagged REL-003).

## REL-004 — Canonical duplicates

**Verification recipe.** `tests/worker/issue-deletion-relations.test.ts` (tests tagged REL-004).

## REL-005 — Undo duplicate

**Verification recipe.** `tests/worker/issue-deletion-relations.test.ts` (tests tagged REL-005).

## REL-006 — Parent and child

**Verification recipe.** `tests/worker/issue-deletion-preimage.test.ts`, `tests/worker/parent-deletion-custody.test.ts` (tests tagged REL-006).

## INTAKE-001 — Intake creation

**Verification recipe.** `tests/worker/source-ingest.test.ts`, `tests/e2e/core-runtime.mjs` (tests tagged INTAKE-001).

**Mechanism context.** A registered signal source (INTAKE-011) creates an intake issue with a title, team, observed time, its source ID, source display name, source record identifier, source revision identifier, summary, link, and optional structured measurements and customer reports. An operator creates one with a title and team and any of the same descriptive fields, attributed to that operator instead of a source. Either way it starts in the team's default Intake status and appears in Needs decision (CURR-002) within 5 seconds.

## INTAKE-002 — Idempotent sources

**Verification recipe.** `tests/worker/source-ingest.test.ts`, `tests/worker/source-erasure-identity.test.ts` (tests tagged INTAKE-002).

**Mechanism context.** Re-delivery of the same source ID, source record identifier, source revision identifier, and normalized payload returns the original result and creates nothing. Re-delivery of an identity whose issue has since been deleted (ISSUE-010) returns 410 and creates nothing. Reusing an identity with a different payload returns 409 and changes nothing.

## INTAKE-003 — Evidence revisions

**Verification recipe.** `tests/worker/source-ingest.test.ts` (tests tagged INTAKE-003).

## INTAKE-004 — Inspectable assessment

**Verification recipe.** the existing source, operator and policy provenance journey; TRIAGE-003 owns the inherited agent-suggestion journey.

**Mechanism context.** An intake issue shows the evidence behind its attention reason, impact measurements, likely cause, recommended assignee, suggested priority, suggested labels and likely duplicates. Each assertion names whether it came from a source, an operator, a policy or an agent; an agent assertion also names the model, the records it read and when, and is shown as a suggestion until a person accepts it. TRIAGE-003 inherits the agent provenance sentence and the agent-suggestion triage journey before agent suggestions ship. Vector never presents an inferred assertion as a fact or applies one silently.

## INTAKE-005 — Accept

**Verification recipe.** `tests/e2e/core-runtime.mjs` (tests tagged INTAKE-005).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** Owners, Admins and Members who can see an intake item's team accept, defer and decline it; Guests cannot (role matrix). Accepting an intake issue atomically records the actor, the time, and an optional reason; applies the chosen assignee, priority, cycle, and Started or Unstarted status; and clears any deferral. It leaves Needs decision and reaches its new Current and My work sections within the CURR-008 window. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## INTAKE-006 — Defer

**Verification recipe.** `tests/e2e/core-runtime.mjs`, `tests/worker/issue-session-projection.test.ts` (tests tagged INTAKE-006).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** Deferring an intake issue (by an Owner, Admin or Member who can see its team; Guests cannot, role matrix) records who deferred it, an absolute return time strictly in the future, and an optional reason, and removes it from Needs decision. It returns there exactly once — within 5 minutes of the return time, or within 5 seconds of a new evidence revision (INTAKE-003), whichever comes first — and the return atomically clears the deferral and leaves the earlier decision visible. The same roles can defer it again or end a deferral early. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## INTAKE-007 — Decline

**Verification recipe.** `tests/worker/source-ingest.test.ts` (tests tagged INTAKE-007) declines without a reason (refused with no writes) and with one, and reads Canceled with evidence and decision history retained after restart.
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** Declining an intake issue — open to Owners, Admins and Members who can see its team, never to Guests (role matrix) — requires a reason, moves it to the team's default Canceled status, and removes it from Needs decision without deleting its evidence or decision history. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## INTAKE-008 — Evidence after a terminal decision

**Verification recipe.** `tests/worker/source-ingest.test.ts` (exercises this behavior; the test does not yet tag INTAKE-008).

## INTAKE-009 — Source failure

**Verification recipe.** `tests/worker/source-ingest.test.ts` (exercises this behavior; the test does not yet tag INTAKE-009).

## INTAKE-010 — Decision policy

**Verification recipe.** A test that delivers two signed items to a registered source's pinned team, one with an explicit assignee recommendation and one without an assignee recommendation, checks both stay unassigned in that team's triage, and checks that assignee, priority and start state recommendations stay editable before acceptance.

**Mechanism context.** Suggested assignee, priority, and start state are selected by the intake recommendation policy and are always editable before acceptance. *Policy: `intake.recommendation.v1`; default: every registered source pins its team; the signed source payload may explicitly recommend an assignee through a source-attributed `assertions.assigneeOperatorId` value. An absent assignee recommendation leaves the issue unassigned in that team's triage, with No priority and Unstarted as the acceptance defaults. The recommendation never assigns the intake item before acceptance.*

## INTAKE-011 — Source registration

**Verification recipe.** `tests/worker/source-ingest.test.ts` (tests tagged INTAKE-011).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** An Owner or Admin registers a signal source (integration management in the role matrix; Members and Guests are refused 403) with a display name, a source ID unique in the workspace, and a signing secret; the `signal.source.v1` adapter normalizes that source's signed request into INTAKE-001. Rotating a secret (by an Owner or Admin) accepts both secrets for a configurable overlap of at most 24 hours and then rejects the previous one. An Owner or Admin revoking a source rejects every later request under INTAKE-009 and deletes no evidence. A secret is shown once at registration or rotation and never again. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## CURR-001 — Disjoint stream

**Verification recipe.** `tests/worker/current-disjoint.test.ts`, `tests/e2e/core-current-disjoint-journey.mjs` place each kind through public routes, assert exact and disjoint membership with overlapping eligibility, exclude canceled/duplicate/deferred/deleted issues, and move Next work to Now through the native status selector at 1440 and 390.

## CURR-002 — Needs decision

**Verification recipe.** A journey that defers, returns and declines intake items and asserts Needs decision membership; it defers 120 issues until all are past due, opens Current and reaches all 120 across pages in CURR-007 order, with the total and remaining issues visible until every issue has been reached.

## CURR-003 — Now

**Verification recipe.** A journey with a Started issue and an overdue Unstarted issue at a workspace-timezone day boundary.

## CURR-004 — Next

**Verification recipe.** A journey with active-cycle and due-in-seven-days Unstarted issues.

**Mechanism context.** Next contains non-terminal issues in an Unstarted status that are committed to their team's active or next cycle (CYCLE-001) or due within the next seven calendar days, excluding anything already in a higher-precedence section.

## CURR-005 — Recently done

**Verification recipe.** A journey that completes issues across an eight-day window and checks the seven-day cut-off and completion-time order, including identifier ties.
2. In the same Current view, two in-progress issues of different priority follow the normal CURR-007 order while two done issues completed at different times appear newest completion first even when their priority, due date or last update would put them in the opposite order.

## CURR-006 — Explainable attention

**Verification recipe.** `tests/worker/dependencies.test.ts` (tests tagged CURR-006).

## CURR-007 — Ranking

**Verification recipe.** A ranking test over priority, due date, update time and identifier ties, plus completion time and identifier ties in Recently done.
2. One Current view shows two in-progress issues of different priority in normal ranking order alongside two done issues completed at different times in newest-completion-first order, with priority, due date and last update opposing the done issues' completion order.

**Mechanism context.** Within every Current section except Recently done, the default order sorts by priority (Urgent first, No priority last), then by due date (overdue first, then earliest first, then issues with no due date), then by most recent update, and finally by stable identifier, so the order is total and stable. Recently done (CURR-005) instead sorts by completion time, newest first, with stable identifier as the tiebreak; priority, due date and last update do not affect that section. *Policy: `current.ranking.v1`.*

## CURR-008 — Freshness

**Verification recipe.** `tests/e2e/core-current-journey.mjs` (tests tagged CURR-008).

## CURR-009 — Stream controls

**Verification recipe.** A browser journey applying each Current filter and its reset.

## WORK-001 — Personal queue

**Verification recipe.** `tests/worker/dependencies.test.ts` (tests tagged WORK-001).

## WORK-002 — Personal defaults

**Verification recipe.** `tests/worker/dependencies.test.ts` (tests tagged WORK-002).

## WORK-003 — Cycle context

**Verification recipe.** A journey with an active cycle containing the operator's issue that checks the cycle row's dates, progress and unit.

**Mechanism context.** My work shows one row for each team that has an active cycle containing an issue assigned to the operator, giving that cycle's name, start and end dates, and progress, with completed and total committed scope labeled in the unit CYCLE-003 used. Inherited from ROLE-007: My work's team rows follow team membership when this clause changes them.

## PROJ-001 — Project record

**Verification recipe.** `tests/e2e/admin-project-cycle-journey.mjs` (tests tagged PROJ-001) for name, description, lead, target date and native lifecycle; `tests/worker/project-fields.test.ts` and `tests/e2e/core-project-fields-journey.mjs` set start and target dates, High priority and two enabled workspace labels through the project page, projects list and scoped `/api/v1` routes, refuse a target before the start with 400, filter by label, sort by priority and check one activity entry per changed planning field at 1440 and 390; `tests/worker/project-fields-upgrade.test.ts` and `tests/worker/data-http.test.ts` retain those fields through populated upgrade and archive restore.
2. Color and icon save, clear and read through page/list and scoped `/api/v1`, with one activity entry per changed field; the named PROJ-001 worker test and browser journey prove this at 1440/390.
3. FIELD-001/002 carry project custom-field values and their surfaces; PROJ-014 carries primary teams; PROJ-016 carries configurable project statuses; INIT-003 carries roadmap planning-field edits; DATA-014 carries Linear project dates, priority and labels; ROLE-003 carries Guest visibility and create/edit refusals.
4. Each obligation is accepted under its inheriting clause before that capability ships.
5. Its role-matrix cells are enforced and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`).

**Mechanism context.** A project has a name unique in the workspace, a Markdown description, exactly one lead who is a workspace member, an optional start date, an optional target date that is on or after the start date when both are set, a priority (Urgent, High, Medium, Low or No priority, as ISSUE-003), project labels (workspace labels marked for projects, filterable by PROJ-007), a status (PROJ-016), an optional color (`#rrggbb`, canonical lowercase), an optional icon (one Unicode emoji, default none), and values for the custom fields that apply to projects (FIELD-001). Its status is one of the project statuses of its primary team or the workspace (PROJ-016), each in one of the categories Backlog, Planned, Started, Paused, Completed and Canceled, and a new project starts in the default Planned status unless another is chosen. Start date, target date, priority and labels are set in the project page, the projects list, the roadmap timeline (INIT-003) and `/api/v1`, and each change is a project activity entry. Linear project start and target dates, priority and labels import onto these fields (DATA-014). Owners, Admins and Members create projects and edit these fields; Guests see the projects their invited teams contribute to and cannot create or edit one (role matrix).

## PROJ-002 — Manual lifecycle

**Verification recipe.** `tests/e2e/admin-project-cycle-journey.mjs`, `tests/e2e/admin-access-journey.mjs` (tests tagged PROJ-002).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** A project's status (PROJ-016) is changed only by a person — an Owner, Admin or Member; Guests are refused (role matrix). Completing or canceling all of its issues never completes or cancels the project. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## PROJ-003 — Project membership

**Verification recipe.** A journey that removes, archives and deletes projects and checks no issue is deleted, including canceling and confirming deletion through the browser at 1440px and 390px.

## PROJ-004 — Progress

**Verification recipe.** `tests/e2e/core-runtime.mjs` (tests tagged PROJ-004).

## PROJ-005 — Health

**Verification recipe.** A health test covering each Blocked, At risk, On track and Unknown rule and the equal-capacity edge.

**Mechanism context.** Health is reported only for projects whose status is in the Started category (PROJ-016); a project in any other category, Paused included, reports no health and is excluded from health filters and counts. A *remaining issue* is a project issue outside the Completed, Canceled, and Duplicate categories. A Started project is Blocked, At risk, On track, or Unknown, evaluated in that order. The default reports Blocked when at least one remaining issue exists and either an Urgent remaining issue has an unresolved blocker (REL-002) or every remaining issue is blocked; At risk when its target date is in the past, a remaining Urgent issue is unassigned, or its remaining estimated points committed to any team's active cycle exceed that cycle's capacity; On track when a target date in the future, every applicable capacity, and every remaining active-cycle estimate exist and no earlier rule matches; and Unknown otherwise. Remaining scope exactly equal to capacity is not At risk. *Policy: `project.health.v1`.*

## PROJ-006 — Risk explanation

**Verification recipe.** A journey that opens a Blocked and an At risk project and finds the triggering issues and measurements.

## PROJ-007 — Portfolio

**Verification recipe.** `tests/worker/project-fields.test.ts` and `tests/e2e/core-project-fields-journey.mjs` apply lifecycle, health, lead, contributing-team, inclusive target-date range and project-label filters individually and together, checking matching health/lifecycle counts and rows at 1440 and 390; the browser journey also sorts by priority and edits a project from the list.
2. `tests/e2e/admin-access-journey.mjs` retains empty-portfolio coverage (tests tagged PROJ-007).

## PROJ-008 — Historical truth

**Verification recipe.** `tests/worker/cycle-closure.test.ts` (tests tagged PROJ-008).

## PROJ-009 — Project archiving

**Verification recipe.** `tests/e2e/admin-project-cycle-journey.mjs` (tests tagged PROJ-009).

## CYCLE-001 — Time box

**Verification recipe.** `tests/e2e/admin-project-cycle-journey.mjs` (tests tagged CYCLE-001).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** A cycle belongs to one team and has a name unique within that team, a start instant, an end instant after the start, and an optional capacity in estimate points, all interpreted in the workspace timezone (OPS-003). Vector rejects a cycle whose dates overlap another cycle of the same team, so a team's *active cycle* — the one whose start is at or before now and whose end is after now — is unique, and its *next cycle* is the cycle of that team with the earliest start at or after the active cycle's end. Owners, Admins and the team's owners create, edit, complete and delete its cycles, and so do all its members while its *Who manages cycles and templates* permission is All team members, the default (ROLE-009); Guests never do (role matrix). Creation enforces team ownership and both ROLE-009 planning values, proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`); cycles have no edit, completion or deletion door yet, and those cells are checked when such doors exist.

## CYCLE-002 — Commitment

**Verification recipe.** `tests/e2e/admin-cycle-list-journey.mjs`, `tests/e2e/admin-issue-journey.mjs` (tests tagged CYCLE-002).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** A non-terminal issue can be committed to at most one cycle, and only to a cycle of its own team. Anyone who can edit the issue commits, moves or uncommits it — Owners, Admins, Members who can see its team, and Guests in an invited team (role matrix). Committing, moving, and uncommitting record both cycle identifiers and update both cycles atomically. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## CYCLE-003 — Progress and capacity

**Verification recipe.** `tests/worker/cycle-closure.test.ts` (tests tagged CYCLE-003).

## CYCLE-004 — Closure and rollover

**Verification recipe.** `tests/worker/cycle-closure.test.ts` (tests tagged CYCLE-004).

**Mechanism context.** Within 5 minutes of a cycle's end instant Vector closes it exactly once however many times the closing job runs, and by default moves committed issues in an Unstarted or Started status to the team's next cycle (CYCLE-001) and uncommits committed issues in an Intake, Backlog, Completed, Canceled, or Duplicate status. A closed cycle's name, dates, capacity, and snapshot cannot be changed, and a closed cycle is never reopened. *Policy: `cycle.rollover.v1`.*

## CYCLE-005 — Closure snapshot

**Verification recipe.** `tests/worker/cycle-closure.test.ts` (tests tagged CYCLE-005).

## CYCLE-006 — Missing next cycle

**Verification recipe.** `tests/worker/cycle-closure.test.ts` (tests tagged CYCLE-006).

## SEARCH-001 — Global search

**Verification recipe.** `tests/worker/search-access.test.ts`, `tests/e2e/dev-runtime.mjs`, `tests/worker/search-exact-admission.test.ts` (tests tagged SEARCH-001).

## SEARCH-002 — Exact identifier

**Verification recipe.** `tests/worker/search-exact-admission.test.ts`, `tests/worker/search-access.test.ts` (tests tagged SEARCH-002).

**Mechanism context.** An exact issue identifier lookup reads the primary record and returns it even while full-text indexing is delayed or unavailable, subject to the archive choice in SEARCH-001. On a successful full-text read, that exact issue ranks first, without duplicating it or dropping other matching issues, projects or accessible saved views; results remain bounded. Primary identity, archive choice and operator/session/workspace admission are rechecked before returning results, including after an index failure.

## SEARCH-003 — Index freshness

**Verification recipe.** `tests/worker/search-access.test.ts` (tests tagged SEARCH-003).

**Mechanism context.** Created or changed searchable text appears in full-text results within 10 seconds. Database triggers maintain the full-text entries in the same transaction as searchable source changes, so a committed source change cannot leave its corresponding entry behind. If an index query fails, the exact primary-record lookup remains available under SEARCH-002; other searches are reported unavailable with the last successful index time; Vector never presents a known index failure as a complete empty result.

## VIEW-001 — Issue controls

**Verification recipe.** `tests/e2e/dev-runtime.mjs` (tests tagged VIEW-001).

**Mechanism context.** Issue lists can filter by status, status category, priority, assignee, team, project, cycle, label, due date, blocked state, and parent (all issues, root issues, or children of one exact parent identifier); sort by newest, oldest, Urgent-to-No-priority, workflow status order, due date, or last update; and group by none, status, assignee, priority, project, cycle, or team. Completed issues are hidden by default outside Current. Grouped pages order by the group key before the selected sort and stable identifier. Only groups with rows on the page are rendered, with counts for the complete filtered result; a group may continue onto another page. The issue-list HTTP response exposes page-present `groups` with full filtered counts and `allGroups` with the complete filtered grouping aggregate. Positive offsets require the response `revision` for the same query and workspace calendar date; invalidated or missing identity returns HTTP 409 `pagination_invalidated` without mixed rows, and browsing restarts visibly at offset zero.

## VIEW-002 — Saved views

**Verification recipe.** `tests/worker/views-removal.test.ts`, `tests/e2e/core-keyboard-journey.mjs`, `tests/worker/search-access.test.ts` (tests tagged VIEW-002).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** Anyone signed in can save a named combination of filters, sort, grouping, and list or board layout as a private view, then update, duplicate, or delete it; Owners, Admins and Members can also save a view as shared with the workspace or a team or switch it to shared, and a Guest's views are always private (role matrix). A private view is visible and editable only by its owner; anyone who can see a shared view's teams can open or duplicate it (a Guest only when it covers only their invited teams), but only its owner can update or delete it, and ownership changes only under OPS-004. Deleting a view never changes an issue. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## VIEW-003 — Control persistence

**Verification recipe.** `tests/worker/views-removal.test.ts` (tests tagged VIEW-003).

## VIEW-004 — Bulk edit

**Verification recipe.** A browser journey selecting issues with X and setting status in one operation, plus a failing selection that writes nothing and names the failing identifiers.

**Mechanism context.** An operator can select several issues in a list and set status, assignee, priority, project, cycle, or labels on all of them in one operation, up to the batch limit in `seed.json → limits`. The operation is atomic: if any selected issue fails ISSUE-004, ISSUE-006, or CYCLE-002, nothing is written and the response names the failing issues by identifier. A successful operation writes one activity entry per issue and is undone as one action by Undo or Command/Ctrl-Z within the ISSUE-020 window.

## VIEW-005 — Team board

**Verification recipe.** A board journey at 1440px and 390px that changes status from a card and recovers from a stale conflict.

**Mechanism context.** The board shows one explicitly selected team's workflow at a time; it never guesses a team in a multi-team workspace. It displays every configured status as a column in that team's workflow order and places the matching issues from the current filtered page in those columns, ordered by the selected derived sort. Each card has a labeled, keyboard-operable status selector. A status change uses the existing version-checked issue mutation (ISSUE-004, ISSUE-006); intake and duplicate decision rules cannot be bypassed, and a stale conflict shows the current server issue and refreshes the board without applying the rejected move. At 390px, a labeled column selector lets the operator choose which status column to view. Board pages explicitly request `pageSize=100` and `grouping=status` through the same issue-list URL and API; ordinary list requests default to 50 and the accepted page sizes are bounded to 50 or 100. Status counts use the same SQL filters as cards across the complete result, with page counts distinguished from totals. Paging reaches cards beyond the first page; completed work remains hidden until explicitly requested.

## CMD-001 — Command palette

**Verification recipe.** `tests/e2e/core-palette-journey.mjs` exercises search, arrow-key highlight, Enter and Escape, alongside `tests/e2e/core-keyboard-journey.mjs`.

## CMD-002 — Keyboard navigation

**Verification recipe.** `tests/e2e/core-keyboard-journey.mjs` (tests tagged CMD-002).

## CMD-003 — Focus and selection

**Verification recipe.** A keyboard journey moving focus with arrows, selecting with X, opening with Enter and returning focus with Escape.

## NOTIFY-001 — Inbox events

**Verification recipe.** the existing collaboration journeys for the original events plus one journey per added event, including: member A creates an issue, member B completes it, and A finds exactly one completion notification naming B within 5 seconds while B finds none; B cancels a second issue A follows and A gets one cancellation notification; B moves a followed issue from Todo to In Progress and raises it to Urgent in one edit and A gets one grouped notification naming both changes; B adds a blocker to it and A gets one blocking notification; a resolved thread's participating follower gets one reopened-thread notification naming the reopener while a nonparticipant, the actor and a repeated reopen get none.
2. GITHUB-003 owns the inherited merged-PR acceptance cell.

**Mechanism context.** Vector creates an in-app notification, visible within 5 seconds, for assignment of an issue to the member, a direct mention (ISSUE-013), a comment on an issue they follow, the return of an intake item they deferred, the resolution of the last blocker on an issue assigned to them, a due reminder (NOTIFY-005), a triage item they are responsible for (TRIAGE-001), a project or initiative update they follow (PROJ-010), a delegated agent's question or completion (AGENT-002), a review request or status change from Git (GITHUB-005) and an SLA warning (AUTO-004). Members who follow an issue (NOTIFY-002) — its creator, assignee, commenters, mentioned members and explicit followers — are also notified when it is completed, when it is canceled or marked duplicate, when its status changes to another status (one notification per change, grouped with any other change made in the same mutation), when its priority is raised to Urgent, when it becomes blocked by a newly added blocker or a blocking relation on it is added or removed, when its due date changes, and when a resolved thread they took part in is reopened (ISSUE-008). Each event notifies each follower once, never the actor (NOTIFY-003), and a completion caused by automation or Git (GITHUB-003) names that automation as actor. The inbox is always delivered; email, Slack, Teams, mobile push and desktop follow NOTIFY-006 and NOTIFY-007. A thread-reopened event reaches current issue followers who authored its top-level comment or any reply, excludes the reopener, and emits once for each actual resolved-to-open transition; reopening an already open thread emits nothing. Explicit reopen and reply-reopens share this rule. Its inbox label and per-type mute are available; it creates no email by default (NOTIFY-006/NOTIFY-007 own channels). TRIAGE-001, PROJ-010, AGENT-002, GITHUB-005, GITHUB-003 and AUTO-004 inherit their unbuilt events and inbox obligations before they ship.

## NOTIFY-002 — Followers

**Verification recipe.** `tests/e2e/collaboration-events.mjs`, `tests/worker/collaboration-atomicity.test.ts`, `tests/worker/discussion-access.test.ts` (tests tagged NOTIFY-002).

## NOTIFY-003 — No self-notification

**Verification recipe.** `tests/worker/due-reminders.test.ts`, `tests/e2e/collaboration-pagination.mjs`, `tests/e2e/collaboration-reads.mjs` (tests tagged NOTIFY-003).

## NOTIFY-004 — Read and mute

**Verification recipe.** `tests/e2e/collaboration-preferences.mjs`, `tests/worker/collaboration-final-admission.test.ts`, `tests/worker/collaboration-mail.test.ts` (tests tagged NOTIFY-004).

## NOTIFY-005 — Due reminders

**Verification recipe.** `tests/worker/due-reminders.test.ts` (tests tagged NOTIFY-005).

## NOTIFY-006 — Assignment and mention email

**Verification recipe.** `tests/e2e/collaboration-delivery-ui.mjs`, `tests/e2e/collaboration-disabled.mjs`, `tests/e2e/collaboration-preferences.mjs` (tests tagged NOTIFY-006).

## GITHUB-001 — Signed PR links

**Verification recipe.** `tests/worker/github-links.test.ts` for signed linking and state, plus GITHUB-003's status journey.

**Mechanism context.** A current registered repository receiver verifies exact GitHub HMAC bytes before parsing an allowlisted pull_request delivery. Native issue identifiers in the PR title or body link stable repository/PR identity, safe HTTPS URL, title and open/closed/merged state. Unknown identifiers record diagnostics. A PR event changes issue status only through the team's Git automation rules (GITHUB-003), recorded as automation activity.

## GITHUB-002 — Durable latest PR state

**Verification recipe.** `tests/worker/github-links.test.ts` (tests tagged GITHUB-002).

## API-001 — Native scoped API

**Verification recipe.** `tests/worker/integration-api.test.ts`, `tests/worker/dev-credentials.test.ts` (tests tagged API-001).

**Mechanism context.** Named reveal-once Base tokens admit only the explicit `/api/v1` routes under route-selected scopes: issue list/detail and description history use `issues:read`; issue create/version-checked update, description restore and description checklist mutations use `issues:write`; comment creation and author-only comment checklist mutations use `comments:write`; metadata uses `metadata:read`; project list/detail use `projects:read`; and project create/update use `projects:write`. The project list applies portfolio filters and returns matching counts; create and update accept native project fields, validate dates and record planning-field activity. Project lists currently return the complete workspace list without pagination (API-003). Token expiry, revocation, active issuer/workspace and resource authority are checked on every request; bearer tokens never admit documents, generated functions, private files or token administration. Existing native mutation and notification rules apply; no deletion API or product role is added.

## API-002 — Token authority and usage

**Verification recipe.** `tests/worker/integration-authority.test.ts`, `tests/worker/integration-api.test.ts` (tests tagged API-002).

**Mechanism context.** Settings exposes safe metadata/usage and revocation. Issuance and each mutation retain current authority inside the same SQL transaction. Usage-write failure denies admission. Removal revokes issued tokens. Stale writes and authority races publish no unauthorized changes; committed native notification intent remains durable after a response denial.

## WEBHOOK-001 — Durable native delivery

**Verification recipe.** `tests/worker/outbound-webhooks.test.ts`, `tests/worker/issue-deletion-webhooks.test.ts` (tests tagged WEBHOOK-001).

**Mechanism context.** Registered public HTTPS destinations receive minimal native created/updated/completed issue events under stable business identities. Base delivery attempts, backoff, cooldown and accepted/rejected/uncertain results survive restart. Ambiguous sends never retry under fresh IDs; explicit reconciliation requires receiver evidence. Mapped imports and restore create no delivery events. Until Settings has verified the hosting account’s domain inventory or an enforcing service is bound, outbound is visibly unconfigured and native events are retained. The built-in Base transport refuses private and account-owned destinations, pins TLS for non-Cloudflare answers, and uses its explicit all-Cloudflare platform-fetch route with the re-resolution and destination-zone TLS limits in docs/INTEGRATIONS.md. Failed sends never switch transports.

## DATA-001 — Export contents

**Verification recipe.** `tests/worker/data-http.test.ts`, `tests/worker/data-archive-failure.test.ts`, `tests/worker/data-http-collision.test.ts` (tests tagged DATA-001).

## DATA-002 — Mapped import preflight

**Verification recipe.** `tests/worker/linear-import.test.ts`, `tests/worker/issue-deletion-import.test.ts` (tests tagged DATA-002).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** Separately from portable restore, an Owner or Admin (role matrix; Members and Guests are refused 403) can preflight an import of issues supplied as CSV rows or as a JSON array of objects with the same field names, before anything is written. The fields are title, description, team, status, priority, assignee, project, cycle, labels, estimate, due date, expected outcome, customer impact, source ID, and source record ID. The preflight validates the mapping, the timestamps, and every team, status, assignee, project, cycle, label, duplicate, and dependency reference, and reports every row that would fail with its row number and reason, and every nonempty value it would not import. One preflight covers the whole file of a run, up to the measured run limits in docs/MOVE-IN.md. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## DATA-003 — Atomic mapped import

**Verification recipe.** `tests/worker/data-import-atomic.test.ts` (tests tagged DATA-003).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** An Owner or Admin (role matrix) applying a successful preflight records an import-run identifier and publishes the run in batches, each written atomically, preserving supplied creation and update times. A failed batch writes none of that batch and leaves earlier batches of the run in place for resume (DATA-006). Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## DATA-004 — Idempotent mapped import

**Verification recipe.** `tests/worker/data-import-atomic.test.ts`, `tests/worker/imported-person-erasure.test.ts`, `tests/worker/issue-deletion-import.test.ts` (tests tagged DATA-004).

## DATA-005 — Exact portable restore

**Verification recipe.** `tests/worker/data-archive-failure.test.ts`, `tests/worker/data-http-collision.test.ts`, `tests/worker/data-http-concurrency.test.ts` (tests tagged DATA-005).

## DATA-006 — Staged import run

**Verification recipe.** `tests/e2e/data-staged-cli.mjs` (tests tagged DATA-006).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** Only an Owner or Admin starts, resumes or repeats a run (role matrix). One reviewed run of up to the measured limits in docs/MOVE-IN.md (tested at 2,000 issues; larger sources are split into the runs of one migration under DATA-017, never truncated) previews once and publishes in staged batches under one run identifier. Status says truthfully how many of its batches are applied and whether the last batch failed. An interrupted run (a stopped client or a failed batch) resumes from its last committed batch, and every source record lands exactly once. Issues already published are visible and marked as part of an unfinished run. Applying the same reviewed run again returns that run with no new rows; a different file under the same source name conflicts. No notification, mail or webhook is sent for an imported issue. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## DATA-007 — Reconciliation report

**Verification recipe.** `tests/e2e/jira-public-journey.mjs` (exercises this behavior; the test does not yet tag DATA-007).

## DATA-008 — Linear API enrichment file

**Verification recipe.** `tests/worker/linear-api-import.test.ts` (tests tagged DATA-008).

**Mechanism context.** A JSON file the owner produces with Linear's GraphQL API (docs/LINEAR-API-FILE.md) merges with a Linear CSV run by source ID. Comments become imported comments with their original time and a read-only author name; attachment links become named HTTPS links that are never fetched; blocks and duplicate relations become dependencies and duplicate links when both issues are in the run, and are reported otherwise. Attachment bytes are reported as not in the file. A malformed file (an unsafe link scheme, an unknown source ID, or a comment for an issue outside the run) is refused with row-level reasons and nothing written.

## DATA-009 — Jira CSV preflight and loss review

**Verification recipe.** `tests/worker/jira-import.test.ts`, `tests/worker/jira-loss-review-fixture.ts` (tests tagged DATA-009).

## DATA-010 — Jira staged apply and reconciliation

**Verification recipe.** `tests/worker/jira-apply.test.ts` (tests tagged DATA-010).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** The reviewed Jira CSV imports preserved issue times (Resolved for completion, or an explicitly confirmed fallback), due dates, estimates, exact labels, confirmed status/priority/operator/sprint mappings, in-file parents and Blocks, canonical Duplicate links and original-author/time comments. Stable source IDs remain authoritative; old keys are visible and searchable. Outside-file and Relates targets are omissions and never bind a same-key native issue. Attachment bytes are never fetched; named HTTPS links require explicit opt-in. Preview, CLI review and stored report share one loss review and configuration fingerprint. Staged apply/replay, SQL reconciliation and whole-run rollback use the existing lifecycle; later native edits refuse the entire rollback without changes. Historical imports dispatch no notifications, mail, webhooks or agents. The public route requires a current Owner or Admin session (role matrix) and same origin; API tokens are not admitted. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## DATA-011 — Erasing an imported person

**Verification recipe.** `tests/worker/imported-person-erasure.test.ts`, `tests/worker/base-refresh-upgrade.test.ts` (tests tagged DATA-011).
2. Role-matrix cells: `tests/worker/role-matrix.test.ts`.

**Mechanism context.** An Owner or Admin (role matrix; Members and Guests are refused 403) can erase a person that imports carried, by exact email and/or up to five exact display names, after a counts-only preview and a typed confirmation. One D1 batch removes the person from every import run, applied or still pending: records that hold them become permanent tombstones that never publish or replay, runs labeled with their email are retired, originals holding them are withdrawn, imported comments they wrote read as deleted with no author name, reconciliation reports lose those cells, and development mail naming them is dropped. Issues already written stay; a pending run still finishes, without the erased records and without links to them. A current or suspended member, or an open invitation, is refused here; a member's native and imported records are erased together by ROLE-012. The erasure journal is append-only, and an archive made before the erasure is refused on restore when a later archive's journal is supplied. Its role-matrix cells are enforced on every door of this clause and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`), Guest cells with a Guest assigned through ROLE-003's native door.

## OWNER-CLAIM-001 — Signed owner claim

**Verification recipe.** `tests/worker/owner-claim.test.ts`, `tests/worker/owner-claim-upgrade.test.ts`.

## EDITOR-001 — Owner-gated editor

**Verification recipe.** `tests/worker/editor.test.ts`.

## ROLE-001 — Workspace roles

**Verification recipe.** a browser and HTTP journey in which an Owner promotes a Member to Admin and demotes them, an Admin's attempt to promote to Admin or Owner is refused 403, the demoted member's next settings request returns 403, and last-Owner demotion is refused; plus a role-matrix journey that signs in as an Owner, an Admin, a Member who owns a team, a Member who does not, and a Guest, attempts every row of the role matrix through the browser and through `/api/v1`, and gets exactly the allowed (2xx) or refused (403, or 404 where the subject is invisible under ROLE-002) result in each cell, checking every "team setting" and "planning setting" cell under both values of the team's ROLE-009 permission.

**Mechanism context.** Each member has exactly one role: Owner, Admin, Member or Guest today; ROLE-013 adds the read-only Viewer target. Owners and Admins invite and remove members, create teams, manage integrations, API tokens, workspace automations, agents and workspace settings; Owners change any role, Admins change Member and Guest roles (Guest assignment follows ROLE-003) and never to or from Owner or Admin; Members create and change work in the teams they can see, manage the teams they own (ROLE-007) and, where a team's permissions allow it (ROLE-009), that team's settings, cycles and templates; Guests act only inside the teams they were invited to (ROLE-003). The installation owner is an Owner and the last Owner cannot be demoted or removed. Every role change is audited (ROLE-005) and takes effect on the member's next request, including open sessions and API tokens. Each action's permitted roles are exactly those in the role matrix below, every clause that names a permission states the same rule, and *operator* in any clause is resolved by ROLE-008. The role-matrix journey carries the cells it inherited from INTAKE-005, INTAKE-006, INTAKE-007, INTAKE-011, PROJ-002, CYCLE-001, CYCLE-002, VIEW-002, DATA-002, DATA-003, DATA-006, DATA-010, DATA-011: Guest accept, defer, end-deferral, decline and project lifecycle changes are refused 403; a Guest commits only in invited teams (404 elsewhere) and cannot share views; another member cannot edit a shared view they do not own; Member/Guest source registration, rotation and revocation, import preflight/apply/start/resume/repeat/rollback and imported-person erasure preview/confirmation are refused 403 with no writes, while Owners/Admins succeed. CYCLE-001 creation/edit/completion/deletion also checks team owners and both ROLE-009 planning permissions, with Guests refused. A row with no door yet is checked by the clause it names when that clause builds the door.

## ROLE-002 — Private teams

**Verification recipe.** a journey that creates a private team, proves a non-member gets 404 on its issue by identifier, sees no search hit, no Current entry and no export rows, then is added and sees all of them.
2. Inherited from WORK-004: after a member loses access to a private-team issue, it is absent from Created, Subscribed and Activity; the private-team journey checks every tab.
3. Inherited from SLACK-003: private-team content posts only to channels an Admin bound to that team; its acceptance journey verifies that project and saved-view bindings cannot bypass this rule.
4. SLACK-003 channel posts and SLACK-004 direct messages for private/restricted items use only a generic notice without actor or text, or a DM to a permitted explicitly mapped member; its acceptance proves this before private teams ship.
5. For private-team creation (ROLE-002), the inherited TEAM-008 duty is quoted verbatim: "Creating a private team still requires Owner/Admin privacy authority (ROLE-002)." For private-team join requests (ROLE-002), the inherited TEAM-007 duty is quoted verbatim: "A private-team request exposes no issue, search hit or membership until approved, and a hidden private team remains 404."

**Mechanism context.** An Admin can make a team private. Its issues, comments, attachments, cycles, triage, project memberships and search entries are visible only to its members and to Owners; a project or initiative that spans a private team shows other viewers only the counts they may see, never titles. Making a team public or private is audited and re-evaluates notifications, followers, Slack channel routes and webhooks. Inherited from WORK-004: after a member loses access to a private-team issue, it is absent from Created, Subscribed and Activity; the private-team journey checks every tab. Inherited from SLACK-003: private-team content posts only to channels an Admin bound to that team; its acceptance journey verifies that project and saved-view bindings cannot bypass this rule. SLACK-003 channel posts and SLACK-004 direct messages for private/restricted items use only a generic notice without actor or text, or a DM to a permitted explicitly mapped member; its acceptance proves this before private teams ship. Inherited from ROLE-007: a Member's self-join of a private team is refused 403, and once its team owner or an Admin adds them they see its issues; the private-team journey checks both.

## ROLE-003 — Guests

**Verification recipe.** a guest journey that reaches only the invited team and is refused every other team, settings and token route.

**Mechanism context.** ISSUE-023 inherits the Guest cell: copying requires source visibility and creation permission in the destination, and Guests may copy only within invited teams, through every browser and API door. A Guest (a contractor, agency or customer engineer) is invited to named teams only, sees only those teams' issues and projects, cannot see the member directory beyond those teams, cannot create API tokens or integrations, and is labeled as a guest wherever they appear. Before Guests ship, inherit INTAKE-005/006/007, PROJ-002, CYCLE-002 and VIEW-002: accept, defer, end-deferral, decline and project lifecycle changes are refused 403; cycle commitment is allowed only in invited teams and refused 404 elsewhere; shared-view creation is refused, and view visibility is limited to invited teams. INTAKE-011 and DATA-002/003/006/010/011 source management, import management and erasure are refused 403 with no writes. CYCLE-001 cycle management is refused under both planning permissions. PROJ-001 inherits Guest project visibility only through invited contributing teams and 403 refusal of Guest project creation and every project edit before Guests ship. Inherited from ROLE-007: a Guest's access follows the teams an Admin added them to.

## ROLE-004 — Single sign-on and provisioning

**Verification recipe.** a journey against a local SAML/OIDC identity-provider fixture at the network edge that signs a member in, then a SCIM `DELETE` that revokes their session within one request and leaves their name on their comments, and a SCIM `active: true` that reactivates the same member ID.

**Mechanism context.** Owners can require SAML 2.0 or OpenID Connect sign-in through Okta, Microsoft Entra ID or Google Workspace, restrict sign-up to verified company domains, and provision and deprovision members through SCIM 2.0; deprovisioning — SCIM `active: false` or `DELETE` — suspends the member under ROLE-011, revoking their sessions and credentials within one request and keeping their name on their work, and never erases them (ROLE-012); SCIM `active: true` reactivates the same member.

## ROLE-005 — Audit log

**Verification recipe.** a journey that performs one action of each kind and finds each in the audit view and the CSV.

## ROLE-006 — Apps and agents as actors

**Verification recipe.** a journey that installs an agent identity, sees its change attributed to it in activity and audit, revokes it and sees its next API call refused.

## ROLE-007 — Team membership and team owners

**Verification recipe.** a journey in which a Member joins and leaves a public team from the directory, is refused 403 joining a private team, is added to it by its team owner and then sees its issues, a Guest's self-join is refused, and the last team owner's attempt to leave is refused until another owner is named.

**Mechanism context.** CYCLE-007 inherits the cycle-schedule role rule: team owners, or all team members while the planning permission is All team members, may set their own team's schedule; workspace Owners and Admins may always act. Every team has a member list and one or more team owners. Owners and Admins create teams and become their first team owner; TEAM-008 carries the future workspace setting that also permits Members to create teams; a team owner or an Admin adds and removes the team's members and team owners and sets the team's two permissions (ROLE-009), which decide whether all team members or only its team owners manage the team's settings (TEAM-002, TEAM-005) and its cycles and templates. Members join and leave open public teams themselves from the team directory; TEAM-007 carries invite-only public teams and join requests; a private team (ROLE-002) is joined only when its team owner or an Admin adds the member; Guests are added to a team only by an Admin (ROLE-003). Team membership decides triage rotations (TRIAGE-001), team notifications and subscriptions (NOTIFY-009), My work's team rows, a project's contributing teams (PROJ-014) and, for private teams and Guests, access; for a public team it never restricts what a workspace Member can see (OPS-001). Leaving or being removed from a team keeps the member's assigned issues assigned and listed for the team owner to reassign; it never deletes work. A team's last team owner cannot leave until another is named, and an Admin can always act as team owner. Every change is audited (ROLE-005). CYCLE-001 inherits team-owner cycle creation, edit, completion and deletion permission: Owners/Admins and team owners succeed; other team members follow ROLE-009 and Guests are refused, checked through browser and HTTP doors. The acceptance's private-team cells (refused 403 joining a private team; added by its team owner, then seeing its issues) are ROLE-002's, and membership's consumers switch in their own clauses: triage rotations (TRIAGE-001), team notifications and subscriptions (NOTIFY-009), My work's team rows (WORK-003), contributing teams (PROJ-014), and private-team and Guest access (ROLE-002, ROLE-003). Cycles have no edit, completion or deletion door yet; CYCLE-001 carries those cells with its doors.

## ROLE-008 — Operator and permission coverage

**Verification recipe.** a coverage check that enumerates the registered mutation routes, server functions, Settings forms and write commands and fails when any door has no role-matrix row or a row names a clause that does not exist; the role-matrix journey (ROLE-001), driven from the same registry so a new row is a new set of checked cells; and a Guest journey that requests every Settings path and gets 403 everywhere but Account.

**Mechanism context.** ISSUE-023 inherits the Guest cell: copying requires source visibility and creation permission in the destination, and Guests may copy only within invited teams, through every browser and API door. Where a clause says *operator*, it means a signed-in person of the workspace, of any role, acting in their own session or through a token they own. The word grants nothing by itself: an operator may take an action only when the role-matrix row naming that action's clause allows their role (and, for a team row, their team ownership and the team's ROLE-009 permission), and only on subjects they can see (OPS-001, ROLE-002, ROLE-003). Every state-changing door — each mutation route under `/api` and `/api/v1`, each private server function, each Settings form and each terminal command that writes — is registered against exactly one role-matrix row. A door with no row is refused to every role but Owner and the refusal is audited (ROLE-005), so a new feature cannot ship open to Members or Guests by omission. Settings pages are reachable as the matrix's "Open Settings pages" row states, and every other Settings page and route returns 403. Integrations, automations and agents act under their own identities and scopes (ROLE-006), never under a person's row. Every browser, HTTP, API and command door of INTAKE-005, INTAKE-006, INTAKE-007, INTAKE-011, PROJ-002, CYCLE-001, CYCLE-002, VIEW-002, DATA-002, DATA-003, DATA-006, DATA-010, DATA-011 is registered and tested under the inherited ROLE-001 matrix cells: Guest intake decisions and project lifecycle refused; Guest commitment scoped to invited teams; Guest view sharing refused and edits owner-only; source/import/erasure management Owner/Admin only; CYCLE-001 management follows team ownership and both ROLE-009 values. Refusals change nothing.

## ROLE-009 — Team-managed permissions

**Verification recipe.** the ROLE-009 rows of the role-matrix journey: under the defaults, a Member who does not own the team creates a cycle and a team issue template (2xx) and is refused a routing rule and a status rename (403); after the team owner sets *Who manages cycles and templates* to Team owners only and *Who manages team settings* to All team members, the same Member is refused the cycle and the template and admitted the routing rule and the rename; a Guest in the team is refused all four under both values; and each permission change appears once in the audit log.

**Mechanism context.** CYCLE-007 inherits the cycle-schedule role rule: team owners, or all team members while the planning permission is All team members, may set their own team's schedule; workspace Owners and Admins may always act. Each team has two permissions, each either *All team members* or *Team owners only*, set by its team owners or an Owner or Admin. *Who manages team settings* governs workflow statuses (TEAM-002, TEAM-004), team settings (TEAM-005), team labels (ISSUE-014), team custom fields (FIELD-001), triage responsibility, routing rules, request forms and email intake (TRIAGE-001, TRIAGE-002, TRIAGE-004, TRIAGE-005), Git automation rules (GITHUB-003), the team's project statuses (PROJ-016), and the team's automation rules, SLAs, auto-close and auto-archive (AUTO-002, AUTO-003, AUTO-004). *Who manages cycles and templates* governs creating, editing, completing and deleting cycles (CYCLE-001), the cycle schedule (CYCLE-007), and the team's issue and project templates (ISSUE-016, PROJ-012). Owners and Admins pass both permissions whatever their value; Guests fail both whatever their value; a sub-team (TEAM-006) inherits its parent's values unless it sets its own. A change is audited (ROLE-005) and takes effect on the next request. *Policy: `team.permissions.v1`; default: *Who manages team settings* is Team owners only, *Who manages cycles and templates* is All team members.* CYCLE-001 inherits cycle creation, edit, completion and deletion under both planning permissions: non-owner Members succeed under All team members and are refused 403 under Team owners only; Owners/Admins and team owners succeed, Guests are refused under both. Objects not built yet follow the permission in the clauses that build them: team labels (ISSUE-014), team custom fields (FIELD-001), triage responsibility, routing rules, request forms and email intake (TRIAGE-001, TRIAGE-002, TRIAGE-004, TRIAGE-005), Git automation rules (GITHUB-003), the team's project statuses (PROJ-016), automation rules and SLAs (AUTO-002, AUTO-004), TEAM-005's remaining settings, issue and project templates (ISSUE-016, PROJ-012) and sub-team inheritance (TEAM-006); the acceptance's template and routing-rule cells are ISSUE-016's, PROJ-012's and TRIAGE-002's. Cycles have no edit, completion or deletion door yet; CYCLE-001 carries those cells with its doors.

## ROLE-010 — Sign in with Google and passkeys

**Verification recipe.** a journey against a Google OpenID Connect fixture at the network edge that enables Google sign-in, signs an invited member in with a verified email and finds the same member record, is refused for an unverified email and for an address outside the members, invitations and allowed domains, and then signs the same member in by magic link with Google still on; plus a browser journey with a virtual WebAuthn authenticator that registers a passkey, signs out, signs in with it and finds a session, and an Admin's attempt to enable Google sign-in refused 403.

**Mechanism context.** Beside the magic link (BASE-ACCESS-001), an Owner can offer "Continue with Google" and passkeys on the sign-in page without requiring either. Google sign-in is OpenID Connect with Google as the identity provider: Settings → Sign-in shows this installation's exact authorized redirect URI and JavaScript origin to enter in a Google Cloud OAuth client, the Owner pastes its client ID and secret, and Vector runs a test sign-in before turning it on. A Google sign-in admits only an email Google reports as verified that already belongs to a member or an open invitation, or that is in a domain the Owner allows for sign-up (ROLE-004); it links to the existing member by that email, stores no password, and never creates a second account for the same person. Once an Owner offers passkeys, every member, Guests included, can register one or more passkeys (WebAuthn, on the device or a security key) under Account and sign in with any of them; removing a passkey, or suspending the member (ROLE-011), revokes it. Enabling, disabling and each sign-in by either method are audited (ROLE-005). The magic link stays available unless an Owner requires SSO under ROLE-004, which then overrides both methods. The mobile apps (MOBILE-001) offer the same methods in the system browser. Viewers may register and remove only their own passkeys and cannot offer or withdraw sign-in methods.

## ROLE-011 — Suspend and reactivate members

**Verification recipe.** a browser and HTTP journey in which an Admin suspends a member who wrote two comments and completed an issue, choosing to keep assignments: the member's next page request and their API token are refused 401, their open issue is still assigned and flagged, both comments and the completion activity entry still show their name marked "Suspended", the mention and assignee pickers no longer offer them, and the member directory's Suspended filter lists them with their activity; the same Admin's attempt to suspend an Owner is refused 403; a SCIM fixture `PATCH /scim/v2/Users/{id}` with `active: false` on a second member produces the same state, and a later `active: true` reactivates them; the Admin reactivates the first member, who signs in by magic link to the same member ID with both comments, their team memberships and their private view intact while the old API token stays refused; an export and restore of a workspace with one suspended member brings them back suspended; and the audit log holds one entry per suspension and reactivation.
2. Inherited from SLACK-004: the suspended member's Slack link is deleted, a later mention of them produces no Slack direct message and a signed Slack action from their Slack account is refused.

**Mechanism context.** Suspension is the default offboarding: Settings → Members' Suspend action (Owners and Admins; only an Owner suspends an Owner or Admin), a member's own Leave workspace, and SCIM `PATCH` with `active: false` or `DELETE` on the user (ROLE-004) all produce the same suspended state, which takes effect on the member's next request. It revokes every session on every device, every personal API token (API-001), every OAuth grant they authorized (API-004) and the MCP sessions under them (AGENT-005), every passkey (ROLE-010), every mobile, desktop and Web Push registration (MOBILE-002, MOBILE-005), and their linked Slack, Teams and GitHub identities (SLACK-001, SLACK-004, TEAMS-001, GITHUB-006), so a suspended member's SLACK-004 link is deleted, no Slack direct message reaches them and a signed Slack action from their account is refused; magic-link, Google and SSO sign-in for that email are refused while they are suspended. A suspended member no longer counts in the member count or any seat limit, cannot be mentioned, assigned, added to a team or project, or delegated work, and receives no notification or digest; their team memberships and team ownerships are kept but inactive, and a team left with no active team owner is managed by Admins until one is named (ROLE-007). Their name stays, labeled "Suspended", on every comment, description revision, activity entry, audit entry (ROLE-005), project update and customer request they wrote and on their profile, which Owners and Admins open from the member directory's Suspended filter to see their issue activity; the directory lists suspended members apart from active ones. In the same dialog the person suspending chooses whether the member's non-terminal issues stay assigned (each flagged "Assignee suspended" in lists, Current and the Members page for reassignment) or are unassigned; projects they led and shared views they owned transfer as OPS-004 states; their private saved views, favorites and drafts are kept hidden and return on reactivation; and coding-agent sessions they delegated (AGENT-001) are paused and listed for an Admin to reassign or cancel. Reactivation — by an Owner or Admin from the Suspended filter (only an Owner reactivates a former Owner or Admin), by SCIM `active: true`, or by inviting the same email again — restores the same member record and ID with its role, history, team memberships and private views; it never restores a revoked session, token, OAuth grant, passkey, push registration or linked identity, so the member signs in afresh. Suspension, leaving and reactivation each write one audit entry with the actor and the method (Settings, self or SCIM), and neither suspension nor any SCIM call anonymizes anything (ROLE-012). The portable export (DATA-001) carries each member's state with the suspension time and actor, and a restore (DATA-005) brings a suspended member back suspended, with no session or credential. Viewers may leave the workspace themselves but cannot suspend or reactivate another member.

## ROLE-012 — Erase a member's personal data

**Verification recipe.** a journey that suspends a member with two comments and an activity entry, finds their name still on all three, previews erasure and finds the counts, is refused when the typed email does not match, then erases with the correct email and finds the comments and the entry kept under "Former member", the member's private view gone, an imported comment under their email anonymized, exactly one new audit entry, and reactivation refused 409; plus an erasure attempt on an active member refused 409, an Admin's erasure of a former Admin refused 403, and a Member's erasure refused 403.

**Mechanism context.** Erasure is a separate, deliberate action, offered only on a suspended member (an active member is suspended first, ROLE-011), to Owners and Admins (only an Owner erases a former Owner or Admin), from the member's profile or `/api/v1` — for example to honor a departed employee's or contractor's deletion request under the CCPA. It shows a counts-only preview (comments, revisions, activity and audit entries, project updates, customer requests, imported records under their email, and the external copies Vector cannot recall) and runs only after the actor types the member's email to confirm. One transaction then replaces the member's name, email, avatar and profile with "Former member" and an opaque reference on every comment, revision, activity entry, project update, customer request and audit entry, keeping the content and the audit trail; deletes their private saved views, favorites, drafts, notifications, passkeys and preferences; applies DATA-011 to every imported record under their email; and runs SEC-003 for their Slack, Teams, GitHub and agent identities, listing the external copies it cannot recall. An erased member can never be reactivated, a later invitation of the same email creates a new member, and the erasure writes exactly one audit entry with the actor and an opaque subject reference. The erasure journal is append-only, so restoring an archive made before the erasure is refused when a later archive's journal is supplied (as DATA-011). Suspension, leaving and SCIM deprovisioning never erase.

## ROLE-013 — Read-only Viewers

**Verification recipe.** A browser and HTTP journey that invites a Viewer, signs them in, reads a public issue, project and shared view, refuses every work mutation (including issue edits, comments, reactions, label application and project edits) with 403 and no writes, shows no private-team search result or identifier lookup until an Owner or Admin adds them, and proves a Guest still creates work only in invited teams while the Viewer remains read-only there.
2. Repeat with an open session after a Member is changed to Viewer; the next mutation is refused.
3. Account sign-in, sign-out and own passkey management still work.
4. For team creation by Viewers (ROLE-013), the inherited TEAM-008 duty is quoted verbatim: "Guests and Viewers never create teams or change this workspace permission." Scope: Viewers only.
5. For team joining by Viewers (ROLE-013), the inherited TEAM-007 duty is quoted verbatim: "Guests and Viewers never self-join or request." Scope: Viewers only.
6. ROLE-013's inherited Viewer duties are TEAM-007's and TEAM-008's only, quoted above.

## TEAM-005 — Team settings

**Verification recipe.** a settings journey that switches a team to T-shirt estimates and off cycles, then sees the issue editor and Current reflect it while closed cycle snapshots stay unchanged.

**Mechanism context.** Each team chooses whether it uses triage, cycles and estimates; its estimate scale (points 1–100 as ISSUE-011, Fibonacci, exponential or T-shirt sizes mapped to points); its default issue template; its triage responsibility (TRIAGE-001); its Git automation rules (GITHUB-003); and its auto-close and auto-archive periods (AUTO-003). Turning a feature off hides it for that team without deleting history. Inherited from ROLE-009: these settings change under the team's *Who manages team settings* permission; Owners and Admins always may and Guests never (role matrix).

## TEAM-006 — Sub-teams

**Verification recipe.** a journey that creates a parent with two sub-teams, finds sub-team issues in the parent's list with the toggle on and absent with it off, and overrides one sub-team's workflow without changing its sibling's; through browser and HTTP, check Owners/Admins, team owners and other Members under both team-setting values on child and parent, refuse a Member missing permission on either side and every Guest/Viewer, and check TEAM-008 on creation.

## TEAM-007 — Team join permissions

**Verification recipe.** A browser and HTTP journey that lets a Member join an open public team, switches it to invite-only and refuses immediate self-join with 403, records a visible join request without granting access, and lets a team owner approve it once; an ordinary Member cannot approve or add another member.
2. The private-team request and hidden-team points are delivered with ROLE-002.
3. Owners/Admins can add members, Guests/Viewers cannot self-join or request, and changing membership mode is audited once.

**Mechanism context.** Team membership is separate from visibility: a public team can allow open joining or require an invitation; private teams always require approval (ROLE-002). Members join open public teams themselves, request membership only where the team has explicitly exposed a request action, and otherwise are added by an Owner, Admin or team owner. A request grants no membership or read access; a hidden private team remains invisible. Owners, Admins and team owners set the membership mode and approve requests or add Members; only Owners/Admins add Guests or Viewers. The refusal for Viewers is delivered with ROLE-013; the refusal for Guests remains this clause's. Leaving preserves assigned work and the last-team-owner guard (ROLE-007). Public-team reads remain workspace-wide regardless of membership mode (OPS-001). *Policy: `team.join.v1`; default: public teams allow open joining, private teams are invite-only.*

## TEAM-008 — Who may create teams

**Verification recipe.** A browser and HTTP journey that refuses a Member's team creation with 403 under Owners and Admins only, lets an Admin enable Members too and then lets the same Member create a public team and become its first team owner, refuses the Member's attempt to change the workspace setting, and refuses Guest and Viewer creation under both values.
2. Return to Owners and Admins only and refuse creation on the Member's next request, without affecting their existing team; record each setting change once in audit.

**Mechanism context.** Owners and Admins set the workspace permission *Who may create teams* to *Owners and Admins only* or *Members too*. Owners/Admins always create teams; Members create public teams only under Members too and become the new team's first team owner (ROLE-007). Private-team creation authority is delivered with ROLE-002. The refusal for Viewers is delivered with ROLE-013; the refusal for Guests remains this clause's. Enforcement is identical through browser, HTTP and API, takes effect on the next request and records each permission change in audit (ROLE-005). *Policy: `team.create.v1`; default: Owners and Admins only.*

## ISSUE-016 — Issue templates

**Verification recipe.** a journey that creates a bug template with two sub-issues, creates an issue from it through the browser and through `/api/v1`, and finds both sub-issues linked; plus the ISSUE-016 rows of the role-matrix journey: a Member's workspace template is refused 403, a non-owner Member's team template is admitted under the default and refused 403 under Team owners only, and a Guest's template is refused 403.

**Mechanism context.** Owners and Admins create, edit and delete workspace templates. A team's templates are created, edited and deleted by Owners, Admins and the team's owners, and by all its members while its *Who manages cycles and templates* permission is All team members, the default (ROLE-009). Guests start issues from a team's templates in their invited teams but never create one (role matrix). A template prefills title pattern, Markdown description, status, priority, labels, assignee, estimate, project, custom fields and sub-issues. New issue, the command palette, Slack (SLACK-002), email intake (TRIAGE-005) and request forms (TRIAGE-004) can start from a template; applying one never overwrites fields already typed. Linear and Jira templates are importable where the source export carries them.

## ISSUE-017 — Reactions

**Verification recipe.** a journey that adds and removes a reaction, sees the count update in a second session within the SYNC-001 window, and finds it in the archive; plus a Slack Events fixture in which a `reaction_added` on a synced thread's message adds that reaction to the mapped comment, and a reaction added in Vector calls `reactions.add` once on the Slack message.

**Mechanism context.** Members react to issue descriptions and comments with emoji; reactions show who reacted, never notify by default, sync with Slack thread reactions (SLACK-002) and are included in export. Owners, Admins and Members may react, Guests may react only where they may comment, and Viewers are refused 403 with no write.

## ISSUE-018 — Description history

**Verification recipe.** a journey that edits a description three times, compares revisions one and three, restores revision one and finds four revisions with the restore attributed.

**Mechanism context.** Every saved description revision is kept with author and time, including the single revision each checklist tick writes (ISSUE-025); members can compare any two revisions and restore one, which writes a new revision and activity entry rather than rewriting history.

## ISSUE-019 — Sub-issue progress

**Verification recipe.** a journey that creates three sub-issues, completes them, and sees the parent count and the optional auto-complete rule act once.

## ISSUE-020 — Undo and Recently deleted

**Verification recipe.** a journey that deletes an issue carrying two comments in a thread, a blocking relation and a parent link, restores it by Undo within 10 seconds and by Recently deleted after a reload, and finds the same identifier, comments, relations and one restore activity entry each time; deletes it again, advances the workspace clock 30 days, runs the purge twice and finds the issue gone with 404 by identifier and no reuse of its number; and presses Command/Ctrl-Z after a bulk priority change and finds every issue's previous priority back with one activity entry each.

**Mechanism context.** Every member action that changes issues — a deletion, a property or status change, a bulk edit (VIEW-004), a move between teams or cycles, a duplicate decision — shows an Undo control for 10 seconds, and Command/Ctrl-Z outside an editable control undoes the member's most recent such action within that window, writing the reversal as a new activity entry under ISSUE-006 version checks (a stale undo shows the conflict and changes nothing). A deleted issue leaves every list, board, search result, Current and My work at once and appears in Settings → Recently deleted (and the team's Recently deleted list) for 30 days with who deleted it and when; members permitted by `issue.can-delete.v1` and its deleter restore it from there or by Undo. Restore brings back the same identifier, title, description, every comment and thread, attachment bytes, links, evidence, relations (blocks, related, duplicate, parent and children whose links were not since replaced), followers, labels, project, cycle (if still open, otherwise uncommitted), customer requests and activity, and appends one restore activity entry. During retention, an exact identifier lookup or link answers "deleted — restorable" to members who could see it, source re-delivery returns 410 (INTAKE-002), and webhooks receive one deleted event and, on restore, one restored event. After 30 days the scheduled purge runs the ISSUE-010 cascade exactly once, after which the identifier answers 404 and is never reused (ISSUE-002). The purge only completes a deletion a member started and could undo during retention; it is not automatic deletion under BASE-DATA-002, which holds unchanged: Vector never purges an issue, file or comment that no person deleted. *Policy: `issue.deleted-retention.v1`; default: 30 days, configurable by Owners from 7 to 90.* Inherited from ROLE-001: only Owners set the Recently deleted retention; Owners and Admins delete any issue to Recently deleted and restore any, a Member deletes their own issues (any issue in their teams when the setting is on) and restores the issues they deleted, and Guests do neither (role matrix).

## ISSUE-021 — Issue types

**Verification recipe.** a journey that enables types on a team, creates a Bug whose required Severity field is refused when empty, groups a list by type, and a Jira fixture whose Story and Bug issues import to the mapped types.

**Mechanism context.** A team can enable issue types (default Bug, Feature, Task and Epic; renameable, with icons) so an issue has at most one type; a type can carry its own template (ISSUE-016), required custom fields (FIELD-001) and request form (TRIAGE-004), and lists, boards, filters, insights and SLAs (AUTO-004) can use it. An Epic-type issue can parent other issues (REL-006) and roll up their progress (ISSUE-019). Jira issue types import to types by explicit mapping (DATA-013), and Linear or GitHub issue types import where the source carries them (DATA-012, DATA-014). Turning types off keeps each issue's last type in history.

## ISSUE-022 — Issue start date

**Verification recipe.** a journey that sets an issue's start date in the browser and through `/api/v1`, finds a start date after the due date refused 400, filters a list to issues starting this week, finds the issue drawn from start to due on the timeline, and finds one activity entry per change.

**Mechanism context.** An issue has an optional start date, which must be on or before its due date when both are set. It is set in the issue editor, as a list and board property (VIEW-008), by bulk edit (VIEW-004), by dragging on the timeline (VIEW-007) and through `/api/v1`; it filters and sorts like the due date, appears in exports (DATA-001) and the API, and each change is an activity entry (ISSUE-007). Jira's Start date field and a GitHub Projects date field mapped to it import onto it (DATA-012, DATA-013).

## ISSUE-023 — Copy issue

**Verification recipe.** a journey that copies an issue with two labels, a custom-field value and two sub-issues through the browser with sub-issues included and through `/api/v1` without, finds new identifiers with equal fields, no comments copied, and the copied-from entries on both issues.

**Mechanism context.** From an issue's menu, the command palette (CMD-001) and `/api/v1`, anyone who can create issues in a team copies an issue into it. Its role-matrix cells, Guests copying only within invited teams, are enforced on every door and proven by the role-matrix journey (`tests/worker/role-matrix.test.ts`) with a Guest assigned through the native ROLE-003 role door. The copy gets a new identifier and the original's title, description, priority, estimate, labels, project, custom-field values; its cycle when it stays in the same team; and, when chosen, copies of its sub-issues and its links. It never copies comments, activity, attachments (except the files embedded in its description, which ISSUE-024 copies so the copy renders them), followers or customer requests, starts in the team's default Backlog status, and both issues record "copied from" / "copied to" in activity. Copying into another team must map statuses, labels and custom-field values for the destination team and report any value it drops. Destination statuses map to the first Backlog status; today labels and the untyped custom-field map have workspace scope and map by identity. Cross-team cycle commitments are omitted and reported. Typed and team-scoped custom-field definitions (FIELD-001) and team labels (ISSUE-014) must participate in this mapping before those capabilities ship. Embedded-file copying remains an inherited obligation of ISSUE-024 before embedded files ship. Native team moves (ISSUE-012) select an explicit same-category status and preserve labels and custom-field values unchanged.

## ISSUE-024 — Inline images and video

**Verification recipe.** a browser journey that pastes a PNG from the clipboard into a new issue's description, creates the issue, drags an MP4 into a comment and reloads: the image shows inline with no load button and opens in the full-size viewer, the video plays and seeks (its `Range` request answered 206), both files appear in the issue's attachments, the file route still answers with an attachment disposition and `nosniff`, an external `https://` image in the same description still shows its Load image button, an SVG upload is refused before storage, and a second member outside a private team gets 404 for the PNG's URL; the same issue at 390px and in the iOS and Android simulator builds (MOBILE-001) shows the PNG inline; copying the issue (ISSUE-023) shows the PNG in the copy from the copy's own attachment; and a DATA-001 export restored under DATA-005 shows the same PNG inline.

**Mechanism context.** A member puts a screenshot, photo or screen recording into an issue description, a comment, a template (ISSUE-016) or a document (PROJ-013) by pasting it from the clipboard, dragging and dropping it onto the editor, choosing `/file` or `/image` from the slash menu (ISSUE-026), or pressing Command/Ctrl-Shift-U, one file or several at once (role matrix: anyone who can edit that text). Each file uploads under ISSUE-009 as an attachment of that issue or document — listed in its attachments with uploader and time — while a placeholder with upload progress holds its place at the cursor; on completion the placeholder becomes an embed that references the attachment by ID, and a refused or failed upload (a type or size outside `seed.json → limits`) leaves a visible error in its place and stores nothing. Images (PNG, JPEG, GIF, WebP) show inline where they were placed with no click to load: at most the editor's width, with their stored intrinsic size reserved so the text does not jump, GIFs animated, and editable alt text; clicking one opens a full-size viewer with zoom, arrow keys through the issue's images, Escape to close, and Download. Videos (MP4, WebM, MOV) show as an inline player with a poster frame, play, pause, seek, full screen and Download; seeking works because the file route answers HTTP `Range` requests with 206; a video whose codec the viewer's browser cannot play shows its name, size and Download in place of the player, never a broken element. `video/mp4`, `video/webm` and `video/quicktime` join `seed.json → limits.attachmentMimeTypes`, and a video may be up to 250 MB, uploaded in resumable parts (R2 multipart) so a dropped connection resumes rather than restarts. On a new issue not yet created, files stage with the member's draft (ISSUE-015) and attach when the issue is created; discarding the draft deletes them; staged files whose draft is gone are listed under Settings → Account → Unattached uploads, where the member attaches or deletes them, and they are never deleted automatically (BASE-DATA-002). Removing an embed from the text keeps the attachment (removing the file is an ISSUE-009 action), and an embed whose attachment was removed shows "File removed"; restoring an older revision (ISSUE-018) that embeds a removed file shows the same marker. An embed resolves only to an attachment of the same issue or document; copying an issue (ISSUE-023) or starting from a template copies the embedded files into the new issue so it renders them. The same embeds are captured, pasted and shown inline in the mobile apps (MOBILE-001), whose camera and photo picker remove location metadata before upload unless the member keeps it; synced Slack and Teams threads carry them both ways (SLACK-002, TEAMS-001); notification email links the issue and never attaches or hotlinks the file (NOTIFY-006); the API (API-003) returns embeds with their attachment IDs; and the portable export (DATA-001) keeps each embed as an archive-relative reference to the original bytes, so a restore (DATA-005) shows the same images. *Baseline reconciliation (BASE-INPUT-002, BASE-INPUT-003).* Inline display applies only to the installation's own uploads of the allow-listed image and video types, referenced by attachment ID. Each is still served by the authorized same-origin file route with its declared content type, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` and the session and team checks BASE-INPUT-003 requires. The page shows it through an `<img>` or `<video>` element, which a browser renders without acting on the download disposition, so opening the file's URL directly still downloads it and BASE-INPUT-003 holds unchanged. The application CSP allows `img-src` and `media-src` only from `'self'` and `blob:` (the local preview of a file being pasted). SVG, HTML and every other type are never shown inline. Every image reference that is not one of the installation's own attachments of the same issue or document — an external URL, another issue's attachment, another origin — is a remote image and keeps BASE-INPUT-002's load-on-request button. A member who cannot see the issue (a Guest outside the team, a non-member of a private team under ROLE-002) gets 404 from the file route, so a copied embed URL reveals nothing.

## ISSUE-025 — Checklists

**Verification recipe.** a browser journey that types `[]` to start a three-item checklist in a new issue's description, saves, reloads, ticks one item without entering edit mode, and finds the box ticked, one new description revision attributed to the member whose Markdown has `- [x]`, one activity entry naming the item, and "1/3" on the issue's list row; a Member who did not write a comment finds its checklist read-only and their tick refused 403 through `/api/v1`; two sessions that tick different items from the same stale version both succeed with two revisions; and the same tick in the iOS and Android simulator builds records one revision.

**Mechanism context.** A description, comment, template or document can hold checklists: typing `[]` or `- [ ]` at the start of a line, pressing Command/Ctrl-Shift-7, or choosing `/checklist` (ISSUE-026) starts one, and items nest and reorder like list items. They are stored as GitHub-flavored Markdown task-list items (`- [ ]`, `- [x]`), so they pass unchanged through the API, export, copying as Markdown, and imports from GitHub, Linear and Jira descriptions. Items show as checkboxes that can be ticked and unticked in place without entering edit mode — in a description or document by anyone who can edit the issue (role matrix; a Guest in invited teams), in a comment only by its author, as ISSUE-008 limits comment edits; everyone else sees a read-only checkbox. Each tick is one version-checked mutation (ISSUE-006) that writes exactly one description revision (ISSUE-018), attributed to the member, and one activity entry naming the item ("checked 'Repro on iOS'"). A tick sent against a stale version applies when that item's text is unchanged in the current version and is otherwise refused 409 with the current text; during a live editing session (SYNC-003) a tick merges like any other edit. An issue whose description has a checklist shows its completed-of-total count ("2/5") as a list and board property (VIEW-008) and in the API; ticking never changes the issue's status by itself. The mobile apps (MOBILE-001) tick items; a synced Slack or Teams comment (SLACK-002) shows a checklist as text (☐ and ☑), and ticks are made in Vector.

## ISSUE-026 — Editor formatting and slash commands

**Verification recipe.** a browser journey that uses the slash menu to insert a heading, a quote, a divider, a 2×2 table and a TypeScript code block, saves, reloads, and finds each one rendered (the code highlighted, the table a table) with stored Markdown that parses as GitHub-flavored Markdown to the same blocks; pastes an HTML fixture with a heading, a list, a link and a `<script>` and finds the first three as Markdown and no script; and `tests/markdown-rendering.test.tsx` checks GitHub-flavored tables, strikethrough and task lists render, while raw HTML still does not.

**Mechanism context.** Descriptions, comments, templates and documents share one editor that writes GitHub-flavored Markdown: three heading levels, bold, italic, strikethrough, inline code, links, bulleted, numbered and check lists (ISSUE-025), quotes, dividers, tables (insert, then add and remove rows and columns), collapsible sections, and fenced code blocks with a language picker, copy button and syntax highlighting for at least TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, Ruby, PHP, C, C++, C#, SQL, shell, YAML, JSON, HTML, CSS and diff. Typing `/` opens a slash menu for every block above, `/file` and `/image` (ISSUE-024), mentions (ISSUE-013) and issue links. Markdown shortcuts (`#`, `-`, `1.`, `>`, `---`, three backticks) and keyboard shortcuts (Command/Ctrl-B, -I, -K for a link, -Shift-7 for a checklist, -Shift-8 for a bulleted list, -Shift-U to upload) apply as typed. Pasting rich text from Google Docs, Notion, Confluence or a web page keeps its headings, lists, links, tables and code as Markdown and drops scripts, styles, forms and remote tracking images, because raw HTML is never rendered (BASE-INPUT-002). Pasting a Vector issue URL makes an issue link, and pasting a GitHub pull request, Figma or Loom URL makes a link that previews under its integration (GITHUB-001, DESIGN-001, DOCS-001). The same Markdown shows the same way in the browser, the mobile apps (MOBILE-001) and exports, and as sanitized text in notification email.

## ISSUE-027 — Issue references and backlinks

**Verification recipe.** a journey that writes "see VEC-123" in VEC-456's description and in a comment, finds both rendered as links with VEC-123's title on hover, finds exactly one "Mentioned in VEC-456" entry on VEC-123 after editing the description again, finds an unknown identifier left as text, and finds a reference from a private-team issue absent from a non-member's view of VEC-123.

**Mechanism context.** Typing an issue identifier such as `VEC-123` in a description, comment, project update or document (PROJ-013) links it when it names an issue the reader can see, with its title and status on hover; an identifier that names no visible issue stays plain text. When a subject first references an issue, the referenced issue gets one activity entry, "Mentioned in VEC-456" (or in the project, update or document), linking back, and later edits of the same subject add none; removing the reference keeps the entry and marks it removed. A reference from an issue in a private team (ROLE-002) shows in the referenced issue's activity only to people who can see the referencing issue. Old identifiers kept by DATA-018 resolve the same way, and the mobile apps (MOBILE-001) link them too.

## ISSUE-028 — Drafts across devices

**Verification recipe.** a journey that types a new-issue draft with a title and two labels in one browser, opens new issue in a second browser signed in as the same member and finds the draft, submits it there and finds it gone from the first browser's Drafts list; plus a second member whose search and `/api/v1` never return the draft.

**Mechanism context.** A new-issue draft and an unsent comment are saved to the member's account as they type and are offered on their other browsers and in the desktop and mobile apps (MOBILE-001, MOBILE-005); a Drafts list shows each open draft with its team and last edit, opens it and discards it. A draft stays private to its author — in no list, search result, notification or API response for anyone else — and is removed on every device once it is submitted or discarded on one; when two devices edit one draft, the later save wins and the other device shows the newer text before its next save. Suspension keeps a member's drafts hidden and erasure deletes them (ROLE-011, ROLE-012). ISSUE-015's in-browser restore still applies while a device is offline.

## FIELD-001 — Custom field definitions

**Verification recipe.** a journey that creates a team single-select field "Severity" with three options, sets it on an issue through the browser and through `/api/v1`, finds a number value refused 400 for it, sees one activity entry per change, renames an option and finds the stored value unchanged, and a Member who does not own the team is refused 403 creating a team field under the default permission.

**Mechanism context.** Owners and Admins define workspace custom fields, and a team's owners — or all its members while its *Who manages team settings* permission is All team members (ROLE-009) — define fields for that team (role matrix, ROLE-001), each with a name unique in its scope, an optional description and one type: text, number (with optional unit and decimals), single-select, multi-select (options with colors, reorderable, archivable), date, person (a workspace member), URL or checkbox. A field applies to issues, projects or both, can be required for chosen issue types (ISSUE-021) or templates, and can be restricted to chosen teams. An issue or project shows its applicable fields in the detail pane; values are validated by type on every door (browser, `/api/v1`, import, Slack forms, automation), and every change is an activity entry (ISSUE-007) with the previous and new value. Renaming a field or option changes no stored value; archiving an option keeps it on issues that have it but removes it from pickers; deleting a field (Owners and Admins only) removes its values after a confirmation that counts affected issues and is recorded in the audit log. PROJ-001 inherits project custom-field definitions, typed values, validation on every door and per-value project activity before project fields ship.

## FIELD-002 — Custom fields in views, search, API and imports

**Verification recipe.** a journey that filters and groups a list by the Severity field of FIELD-001, saves it as a view and finds the expected issues, and a GitHub API fixture whose Projects single-select "Priority" and number "Points" fields import into a single-select and a number custom field with every value matched in the reconciliation report.

**Mechanism context.** Every custom field is available as a list column, a board card property (VIEW-008), a filter with type-appropriate operators (text contains, number ranges, select is / is not / any of, date ranges, person is me, checkbox), a group-by for single-select, person and checkbox fields, and a sort; it is searchable (SEARCH-004), included in exports (DATA-001, REPORT-005), webhooks (WEBHOOK-002) and the API (API-003) with its definition, and usable in automation conditions and actions (AUTO-002). Imports map source fields onto custom fields with an explicit mapping and create missing select options only after review: GitHub Projects single-select, iteration, number, text and date fields (DATA-012), Jira custom fields of select, multi-select, number, text, date, user and URL types (DATA-013), and Linear custom properties where present (DATA-014); unmappable types and values are reported as omissions (DATA-007). PROJ-001 inherits project custom-field columns, filters, search, API, exports and reviewed import mapping before those project capabilities ship.

## REL-007 — Related issues

**Verification recipe.** a journey that relates two issues, sees both sides, and a Jira import fixture whose in-run Relates link becomes a related link.

## TRIAGE-001 — Triage responsibility

**Verification recipe.** a journey that sets a two-person weekly rotation, advances the workspace clock past the handover and sees new items notify the second person.
2. Inherited from NOTIFY-001: a new triage item for the responsible person notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships.

**Mechanism context.** Each team names who triages (set under its *Who manages team settings* permission, ROLE-009): a fixed person, a weekly rotation, or the current on-call person from Oncall or PagerDuty. The responsible person is notified of each new triage item (NOTIFY-007), sees a triage count in navigation, and hands over at rotation time with untouched items listed. Inherited from NOTIFY-001: a new triage item for the responsible person notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships.

## TRIAGE-002 — Triage routing rules

**Verification recipe.** a journey with two rules that routes a Sentry item and a Zendesk item to different teams and shows the acting rule on each, and a non-owner Member's team rule refused 403 under the default permission.

## TRIAGE-003 — Agent triage suggestions

**Verification recipe.** a journey with a seeded near-duplicate that the agent proposes with reason and evidence, the triager accepts the duplicate decision, and the rate report counts it; the model call is faked only at the provider edge.
2. Inherited from INTAKE-004: an agent assertion names the model, the records it read and when, is shown as a suggestion until accepted, and the triage journey shows its provenance and applies it only on acceptance.

**Mechanism context.** When an item enters triage, a triage agent proposes likely duplicates and related issues (by meaning, not only words), team, assignee, labels and priority, each with a one-line reason and the records it compared. The triager accepts, edits or dismisses each suggestion; accept-all is a single explicit action. Acceptance and dismissal rates are reported per team so the policy can be tuned. Agents never decline, merge or close by themselves. Inherited from INTAKE-004: an agent assertion names the model, the records it read and when, is shown as a suggestion until accepted, and the triage journey shows its provenance and applies it only on acceptance. Inherited from ROLE-001: Owners and Admins, and Members in the member's teams, accept, edit or dismiss an agent's suggestion; Guests are refused (role matrix).

## TRIAGE-004 — Request forms

**Verification recipe.** a journey that builds a bug form with a required severity field, submits it from the app and from a Slack shortcut fixture, and finds two triage items with the answers, and a Guest's form edit refused 403 while the same Guest's submission is admitted.

**Mechanism context.** Owners, Admins and a team's owners — or all its members while its *Who manages team settings* permission is All team members (ROLE-009) — publish structured request forms for that team (bug report, feature request, access request) with required fields, help text and a template (ISSUE-016). Forms are available in the app, in Slack and Teams (SLACK-002, TEAMS-001) and through `/api/v1`; anyone who can create issues in the team, including a Guest in an invited team, can submit one, and each submission becomes a triage item with its answers as structured fields. A form can include a Customer field, prefilled for a submitter whose email domain maps to a customer (CUST-006), and the submission then carries that customer's request (CUST-008).

## TRIAGE-005 — Email intake

**Verification recipe.** an inbound-mail fixture at the provider edge that creates one item with two attachments and threads a reply as a comment; plus a member's "Reply by email" comment that makes exactly one SendGrid Mail Send request to the sender carrying the original `Message-ID` in `In-Reply-To`, an internal comment that makes none, the sender's answer to that mail landing in the same comment thread, and a Guest's "Reply by email" refused 403.

**Mechanism context.** Each team can enable a private intake address (under its *Who manages team settings* permission, ROLE-009); mail forwarded from Gmail, Outlook or a shared inbox becomes a triage item with the sender, subject, body, inline images and attachments (within BASELINE file limits), threading later replies as comments and refusing senders outside an allow-list. Mail is received through Cloudflare Email Routing or a SendGrid Inbound Parse webhook. The sender needs no seat: they are recorded as the item's requester (and as a contact of the customer their domain maps to under CUST-006, which records the mail as that customer's request) and get no sign-in. A team member replies to them by posting a comment marked "Reply by email" (role matrix): Vector sends it once from the team's intake address through the declared transactional-email external (SendGrid), to the sender and the addresses the original mail copied, with `In-Reply-To` and `References` naming the original message so it lands in the sender's existing mail thread, embedded images attached to the mail rather than linked, and shows the delivery outcome (accepted or bounced) on the comment; the sender's answer threads back as a reply in that comment's thread, so the conversation continues over email. Internal comments, other fields and status never leave Vector, and an optional team setting sends the sender one acknowledgment with the identifier.

## CUST-001 — Customer requests on issues

**Verification recipe.** a journey that creates the customer Acme by hand with the domain `acme.example`, $120,000 annual revenue and the Enterprise tier, adds a manual request to an issue, then delivers a Penny request from `jane@acme.example` and a HappyToHelp conversation from `bob@acme.example` to the same issue through signed fixtures, and finds one customer, Acme, with three requests from three sources and the USD revenue; a fourth request from a `gmail.com` address adds a requester with no company customer; and a Guest's read of the issue's customers is refused 403.

**Mechanism context.** An issue's Customers section lists each customer (CUST-005) who asked for it, with every request: its source and link — a manual request (CUST-008), a Penny request, a HappyToHelp conversation, a Zendesk, Intercom or Front ticket, a Salesforce or HubSpot opportunity, an Orbit account, a Gong call excerpt, a Slack message (SLACK-002), an intake email (TRIAGE-005) or a Spool error — the requester, and the requester's own words, with the customer's tier, status and annual revenue in USD from the customer record, whether entered by hand or synced from a linked source. Each request is attached to a customer by the identity rule of CUST-006, and one customer is counted once per issue however many requests or requesters link it. Requests move with duplicates (REL-003) and survive merges of issues and of customers (CUST-006). Owners, Admins and Members see customers and requests; Guests see neither (role matrix).

## CUST-002 — Customer-weighted planning

**Verification recipe.** a view journey that sorts three issues by their requesting customers' revenue, entered by hand on the customer records, and matches the expected order, with one customer's two requests on an issue counted once.

## CUST-003 — Close the loop with requesters

**Verification recipe.** a journey that completes an issue with a Penny request and a Zendesk ticket and finds the Penny state change and the Zendesk internal note in the signed outbound fixtures, with no customer-visible message.

**Mechanism context.** When an issue with customer requests completes, ships in a release (RELEASE-001) or is verified (PUSH-004), Vector notifies each linked source: it marks Penny requests shipped with the release, adds an internal note to the HappyToHelp, Zendesk, Intercom or Front ticket, and offers the support owner a drafted customer reply (PUSH-005). Nothing is sent to a customer from Vector without a person approving it.

## CUST-004 — Penny keeps the board

**Verification recipe.** the public route inventory in `seed.json` lists no public feedback, voting or roadmap route; a Penny link shows Penny's state.

## CUST-005 — Customer records

**Verification recipe.** a journey that creates Acme from the palette with the domains `acme.example` and `acmecorp.example`, a logo, an owner, the Enterprise tier, the Active status, size 250 and $120,000 revenue, edits the revenue and finds one activity entry, and finds a second customer claiming `acme.example` refused 409; maps revenue and tier to a HubSpot company fixture and finds both shown as synced and refused for manual edit, then removes the mapping and edits revenue by hand; a Member's change to the tier values refused 403; an export and restore that brings back Acme with its fields and requests; and a Linear GraphQL fixture whose customers and requests import with their domains, revenue and tier.

**Mechanism context.** A customer is a record of the workspace with a name, one or more domains (each belonging to at most one customer), a logo (uploaded, or taken from a linked source), an owner who is a workspace member, a status and a tier chosen from ordered, colored select values the workspace defines (defaults: status Active, Trial and Churned; tier Enterprise, Growth and Starter), a size (employee count), annual revenue in whole US dollars, the external account IDs of linked sources (CUST-006), contacts (name and email, gathered from requests or added by hand), and values for workspace custom fields that apply to customers (FIELD-001). Owners, Admins and Members create a customer by hand — from the command palette's Create new customer, the Customers list (CUST-007) or inline while adding a request (CUST-008) — and edit its fields; Owners and Admins define the status and tier values and merge or delete customers (role matrix). An Owner or Admin can map chosen fields — owner, revenue, size, status and tier — to fields of a linked Salesforce, HubSpot, Orbit, Zendesk, Intercom, Front or HappyToHelp account; a mapped field shows "Synced from" its source with the last sync time, is read-only in Vector while mapped, and returns to manual entry, keeping its last value, when the mapping is removed. Every change is a customer activity entry. Customers and their requests are in the portable export (DATA-001) and restore exactly (DATA-005), are served by `/api/v1` (API-003) and webhooks (WEBHOOK-002), and Linear customers with their domains, owners, statuses, tiers, sizes, revenue and requests import through DATA-014. A customer record is internal and never sent to the customer.

## CUST-006 — Customer identity and merging

**Verification recipe.** a fixture suite through the signed source routes that attaches a Zendesk ticket with organization ID `org-9` to the customer holding that external ID although the requester writes from `acmecorp.example`; attaches `jane@acme.example` and `pat@eu.acme.example` to the customer with the domain `acme.example`; creates `globex.example` as a new customer with the setting on and leaves it under No customer with the setting off; gives a `gmail.com` address and an address on a blocked domain no customer; and flags a request whose ID and domain disagree; plus a journey that merges Acme Inc (two requests on issue A) into Acme (one request on issue A and one on project P), finds issue A with three requests counted as one customer, the request on P kept, the old customer page redirecting and one audit entry, and a Member's merge refused 403.

**Mechanism context.** Every request from a linked source, Slack (SLACK-002), email intake (TRIAGE-005) or a request form (TRIAGE-004) is attached to a customer by one rule, in this order: (1) the source's account ID where the source has one — an Orbit account, Salesforce Account, HubSpot company, Zendesk organization, Intercom company, Front account or HappyToHelp organization ID — matching an external ID stored on a customer; (2) otherwise the requester's email domain, lower-cased, matching one of a customer's domains exactly or as a subdomain of it (`eu.acme.example` matches `acme.example`), with a Slack author's email read through `users.info` under the `users:read.email` scope; (3) otherwise, while the workspace setting Create customers from new company domains is on (the default), a new customer named after the domain, holding that domain and the source's account ID. Free-mail and consumer domains never match or create a customer — a maintained list covering at least gmail.com, googlemail.com, outlook.com, hotmail.com, live.com, msn.com, yahoo.com, icloud.com, me.com, aol.com, proton.me, protonmail.com, gmx.com and zoho.com — and neither does any domain on the Admin's block list (for example the workspace's own domain or a reseller's); such a request keeps its requester as a contact under No customer, and a member can assign it to a customer by hand. A request whose rule-1 ID and rule-2 domain point at different customers attaches by the ID and is flagged for review. Owners and Admins merge two customers in one action after a counts preview: every request, domain, external ID, contact and favorite moves to the surviving customer, the actor chooses each conflicting field's value, every issue and project still counts the survivor once (CUST-001), the merged customer's page and API ID redirect to the survivor, and one audit entry records it. *Policy: `customer.identity.v1`; default: as stated, with new-domain creation on.* Inherited from ROLE-001: only Owners and Admins define customer status and tier values, map customer fields, set the domain block list and new-domain setting, and merge or delete customers (role matrix).

## CUST-007 — Customers list and customer pages

**Verification recipe.** a browser journey that opens the list with G then Q, sorts three customers by revenue and finds the expected order, filters by the Enterprise tier, saves the view and opens it from the palette, opens Acme's page and finds its three requests with their issue and project and the requester's words, favorites Acme, and passes a 390px check of the list and the page; plus a member outside a private team who sees Acme's private-team request as a count only.

**Mechanism context.** A Customers list, opened from the sidebar, the palette or the shortcut G then Q, shows every customer with name, logo, domains, owner, status, tier, size, revenue, request count, open-issue count and newest request, and sorts and filters by revenue, tier, status, owner, size, request count and newest request, with the same save, share and display model as issue views (VIEW-002, VIEW-009). Customers can be favorited (VIEW-010), opened from the palette (CMD-001) and found by name and domain in search (SEARCH-001). A customer page shows its fields (CUST-005), contacts and activity, every request with the requester's words, source, date and linked issue or project, and the issues and projects it asked for grouped by status, with totals; for a request on an issue in a private team (ROLE-002), a non-member sees only that a request exists, never the issue's title. The list and the page have a 390px layout and appear in the mobile apps (MOBILE-001).

## CUST-008 — Adding customer requests by hand

**Verification recipe.** a journey that adds a manual request for Acme to an issue with Control-R and to a project from the project's Customers section, creates Initech inline while adding a second request, moves one request to another issue, and finds each on the customer page and in the issue's and project's activity; plus a Slack Events and interactivity fixture that files an issue from a message by `bob@acme.example` with the Customer picker prefilled to Acme and finds the request on Acme with the message as its words, and a Guest's request refused 403.

**Mechanism context.** Owners, Admins and Members add a request to an issue or a project from its Customers section, from a customer page, from the palette (Add customer request) or with the shortcut Control-R (Alt-Shift-R on Windows and Linux): they pick a customer or create one inline (CUST-005), paste or write the requester's words (required, Markdown), and may name a contact by name and email and add a source link (a call recording, a Gong or Zoom link, a document). The request is attributed to the member who added it, is an activity entry on the issue or project and on the customer, can be edited by its author, moved to another issue or project, and deleted by its author or an Owner or Admin (role matrix). A project's Customers section lists its own requests and its issues' requests, each customer counted once. When a member files an issue from a Slack message (SLACK-002), the dialog offers a Customer picker prefilled by CUST-006 from the message author's email domain, and the message becomes that customer's request in the author's words; a request form (TRIAGE-004) can include a Customer field; and an intake email (TRIAGE-005) becomes a request of the customer its sender's domain maps to. Manual requests count everywhere CUST-001 and CUST-002 do.

## WORK-004 — Created, Subscribed and Activity tabs

**Verification recipe.** a journey in which a member creates two issues, follows a third created by someone else and comments on a fourth, then finds the two in Created, the third in Subscribed and gone after Unfollow from its row, and the comment first in Activity; ROLE-002 owns the inherited lost-private-team-access check in every tab.

**Mechanism context.** Beside the assigned queue of WORK-001, My work has three tabs: Created (every issue the member created, newest first), Subscribed (every issue the member follows, NOTIFY-001, with an Unfollow action on each row) and Activity (the member's own recent changes and comments, newest first, each linking to its issue). Created and Subscribed take the same filters and display options as issue views and can be saved as views (VIEW-002); every tab applies OPS-001 and ROLE-002, has a 390px layout and appears in the mobile apps (MOBILE-001). ROLE-002 inherits private-team narrowing and its lost-access acceptance cell before private teams ship; MOBILE-001 inherits the mobile-app tabs journey. No private teams exist today.

## PROJ-010 — Project updates

**Verification recipe.** a journey that posts an At risk update, finds it in the project, the initiative roll-up and a Slack fixture, and a follower notification.
2. Inherited from NOTIFY-001: a followed project or initiative update notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships.
3. Inherited from SLACK-003: each project update posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.

**Mechanism context.** The project's lead and members (PROJ-014), Owners and Admins post dated updates (Guests cannot, role matrix) with a status of On track, At risk or Off track and a Markdown body; Vector prefills the draft with computed health (PROJ-005), progress since the last update, completed and newly added scope, and slipped milestones. Updates appear in the project, roll up into initiatives (INIT-002), notify project followers, and post to the project's Slack or Teams channel (SLACK-003). Leads are reminded on the project's cadence (AUTO-005). Computed health and the lead's stated status are shown side by side, never merged. Inherited from NOTIFY-001: a followed project or initiative update notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships. Inherited from SLACK-003: each project update posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.

## PROJ-011 — Milestones

**Verification recipe.** `tests/e2e/admin-project-cycle-journey.mjs` creates two milestones, edits and reorders them, assigns issues, completes one, sees the other flagged past its date, moves an issue to another project and sees its milestone clear, then deletes a milestone without deleting its issues, at 1440 and 390.
2. `tests/worker/project-fields.test.ts`, `tests/worker/issue-copy.test.ts` and `tests/worker/data-http.test.ts` cover progress, assignment activity, bulk/Undo, copy and exact archive restore.

**Mechanism context.** A project has ordered milestones with names, optional target dates and descriptions; issues belong to at most one milestone of their own project. Members create, edit, reorder, complete, reopen and delete milestones on the project page. A milestone shows count-based progress by PROJ-004 (Canceled and Duplicate excluded). It slips when its target date is before today in the workspace timezone and it has open countable issues, including when the milestone itself was marked complete. Changing an issue's milestone records one activity entry under ISSUE-007; leaving its project clears the milestone in that same issue change. Copy, persisted Undo, bulk project changes, deletion preimages and native archive restore carry the assignment; deleting a milestone keeps its issues and clears their assignment. Milestones hold no person data, so erasure is unchanged. DATA-013 and DATA-014 inherit the sentence "Jira fix versions and Linear milestones import to milestones or releases (RELEASE-001) by explicit mapping" in their source importers and acceptance journeys; generic mapped issue imports do not yet offer milestone mapping. VIEW-008 inherits grouping by milestone, API-003 inherits the API field and milestone object coverage, and CAL-001 inherits the feed events.

## PROJ-012 — Project templates

**Verification recipe.** a journey that creates a launch project from a template with two milestones and four issues offset from a chosen start date, and a Member's workspace project template refused 403.

## PROJ-013 — Project documents and specs

**Verification recipe.** a journey that writes a spec under a project, links it to an issue, edits it twice and finds both revisions and a search hit; plus one document under an initiative and one under a team, each listed there and found in search, and the team document refused 404 to a non-member once the team is private. plus, inherited from SLACK-005, two signed unfurl fixtures through the Slack events door for one document under a private team: a linked member who can read it receives exactly one preview with its identifier and title and no body, and a linked non-member whose native read of that same document is refused receives none, with storage unchanged apart from the identifier-only receipt.

**Mechanism context.** Projects, issues, initiatives (INIT-001) and teams can hold Markdown documents (specs, PRDs, decision records, team handbooks and runbooks) written in the ISSUE-026 editor, with inline images and video (ISSUE-024), checklists (ISSUE-025), revision history, mentions, comments, attachments and search; a spec document can be linked as an issue's specification (PUSH-001). A team's documents are listed on the team's page and an initiative's on the initiative; a document under a private team (ROLE-002) is visible only to its members. Documents export with their project, issue, initiative or team. Inherited from ROLE-001: Owners, Admins and Members write, edit and comment on documents under what they can see, and Guests only under invited teams' issues and projects (role matrix); this clause's journey checks those cells. Inherited from SLACK-005: a Vector document link pasted in Slack unfurls with the document's identifier and title (a document has no status, assignee or priority) only for linked members allowed to see that document; others, including a linked member who cannot see a private team's document, see the link alone.

## PROJ-014 — Project members and teams

**Verification recipe.** a journey that adds two teams' issues to a project and finds the project in both teams' lists with both teams as contributors.

## PROJ-015 — Project dependencies

**Verification recipe.** a journey that sets project B blocked by project A in the browser and through `/api/v1`, finds the reverse dependency refused 400 as a cycle, sees one solid connector and one dashed derived connector on the timeline, sees the date-conflict flag after moving B's start before A's target, and finds one activity entry on each project.

**Mechanism context.** A project can be marked *blocked by* or *blocking* another project directly, from the project page, the projects list, the roadmap timeline (INIT-003) and `/api/v1`, independently of issue dependencies; a project cannot block itself and a dependency that would close a cycle is refused. The timeline draws direct dependencies as solid connectors and those derived from issue dependencies (an issue in one project blocks an issue in another) as dashed ones, and flags both projects when the blocked project starts before the blocking project's target date. Each change is a project activity entry and notifies both leads (NOTIFY-001); Linear project dependencies import onto it (DATA-014). Inherited from ROLE-001: Owners, Admins and Members set or remove project dependencies; Guests are refused (role matrix).

## PROJ-016 — Project statuses

**Verification recipe.** a browser and HTTP journey that adds an Idea status in Backlog, renames and recolors it, and finds a Member's attempt refused 403; moves an overdue Started project to the default Paused status and finds no At risk health, no slip in the initiative roll-up, no update reminder in the next scheduled run, and the paused style on the timeline; filters the portfolio by the Paused category and by the Idea status with matching counts; removes Idea with Backlog as the destination and finds its project moved and one audit entry, and finds removing the last Paused status refused 409; gives a team its own set and finds a project with that primary team offered only that set; a Linear GraphQL fixture with Backlog, Paused and a custom Started status named Beta that imports each project to the mapped status with the reconciliation counts matching; and an upgrade test that migrates a populated installation's four-value lifecycles with every project keeping its displayed status.

## PROJ-017 — Recoverable project deletion

**Verification recipe.** A browser journey at 1440 and 390 plus HTTP coverage that deletes a project with two issues, milestones and an update, restores it with Undo within 10 seconds and from Recently deleted after reload, and finds the same project ID, retained content and eligible issue memberships with one restore activity entry.
2. Reassign one issue while the project is deleted and prove restore does not overwrite its new project.
3. Refuse Member-lead deletion until recovery ships, then allow the lead to delete and restore their deletion while refusing another Member and all Guests/Viewers; refuse a Member's permanent delete.
4. After 30 workspace days run purge twice and find one final deletion, 404 for the project and both issues intact; stale or expired Undo changes nothing.

**Mechanism context.** Mirroring ISSUE-020, a confirmed project deletion removes it from active lists, search and roadmaps and places it in Recently deleted projects for 30 days with actor and time; the deleting session gets Undo for 10 seconds, including Command/Ctrl-Z outside editable controls. Restore through Undo or Recently deleted keeps the same project ID, fields, milestones, updates, documents, relations and history, and reattaches surviving issues only where their membership has not since been replaced; issues are never deleted (PROJ-003). Restore is version-checked, refuses stale Undo without writes and records one restore activity entry. Owners/Admins delete or restore any project; after this recoverable flow ships the project's Member lead may delete it and restore their own deletion. Until then deletion remains Owner/Admin only because it is irreversible. Guests and Viewers never delete or restore. Only Owners/Admins delete permanently before retention ends; the scheduled purge completes a person-started deletion once after retention, never deletes its issues, and leaves an opaque audit reference. Owners alone configure retention from 7 to 90 days, default 30, as for ISSUE-020.

## INIT-001 — Initiatives

**Verification recipe.** a journey that creates an initiative with a sub-initiative and three projects from two teams and sees them nested, and a Guest's initiative creation refused 403.
2. Inherited from SLACK-003: initiatives bind chosen events to a Slack or Discord channel and each event posts to its bound channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the binding and bound post.

**Mechanism context.** An initiative groups projects (and sub-initiatives up to three levels) under an owner, description, target date and status (Planned, Active, Completed), across teams. A project can belong to several initiatives. Owners, Admins and Members create and edit initiatives and add projects to them; Guests cannot (role matrix). Inherited from SLACK-003: initiatives bind chosen events to a Slack or Discord channel and each event posts to its bound channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the binding and bound post.

## INIT-002 — Initiative roll-up

**Verification recipe.** a journey that posts updates on two projects and sees the initiative roll-up reflect them in order, then pauses one past its target date and finds it shown as paused with no slip.

## INIT-003 — Roadmap timeline

**Verification recipe.** a browser journey with four projects — both dates, target only, start only, no dates — that finds a bar, a diamond, an open-ended bar and an Unscheduled entry respectively; drags the target-only project's diamond and the unscheduled project onto the timeline and finds each change in the project's activity; moves a bar by keyboard; and a 390px check of the list equivalent.

## INIT-004 — Leadership digest

**Verification recipe.** a scheduled-run test that sends one digest per subscriber to the mail and Slack fixtures and omits a private team's project from a non-member's digest.

## CYCLE-007 — Automatic cycle schedule

**Verification recipe.** a scheduled-run test that keeps three upcoming two-week cycles with a one-week cooldown and closes a cycle without a CYCLE-006 failure.

**Mechanism context.** Owners, Admins and the team's owners set a team's cycle cadence, and so do all its members while its *Who manages cycles and templates* permission is All team members (ROLE-007, ROLE-009; proven by `tests/worker/role-matrix.test.ts`). The cadence comprises a duration of one to eight weeks, a start weekday, optional cooldown between cycles and the number of upcoming cycles to keep; Vector creates future cycles on schedule so rollover (CYCLE-004) always has a next cycle, and records each creation as automation. Changing the cadence affects only cycles not yet started.

## CYCLE-008 — Automatic cycle membership

**Verification recipe.** a journey that starts an uncommitted issue and finds it in the active cycle with the automation activity entry.

## RELEASE-001 — Releases

**Verification recipe.** a journey that creates release 2.4, adds five issues, marks it Released and sees release state on each issue, and a Guest's release creation refused 403.
2. Inherited from SLACK-003: a release posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.

**Mechanism context.** Owners, Admins and Members define team or workspace releases (versions) — a Member a team's releases only for teams they can see, and Guests none (role matrix) — each with name, target date, status (Planned, In progress, Released) and description; issues and projects join a release; a release page shows scope, progress, blockers and linked PRs, and can be shared read-only inside the workspace. Jira fix versions import as releases. Inherited from SLACK-003: a release posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.

## RELEASE-002 — Deployment tracking

**Verification recipe.** a signed GitHub Deployments fixture for a merged commit linked to an issue shows the issue deployed to production and triggers the team rule once on replay.

## RELEASE-003 — Release notes

**Verification recipe.** a journey that drafts notes for a release of six issues, edits one line, and sends the approved text to Slack and Penny fixtures.
2. Inherited from SLACK-003: publishing release notes posts the release event to its bound Slack or Discord channel once, without duplicating RELEASE-001’s post; its acceptance journey verifies the bound post.

**Mechanism context.** For a release or a date range, Vector drafts internal release notes from completed issues grouped by label or project, using each issue's title and an optional "release note" field, which the release owner edits and publishes to the workspace, Slack, or hands to Penny as a changelog draft. Inherited from SLACK-003: publishing release notes posts the release event to its bound Slack or Discord channel once, without duplicating RELEASE-001’s post; its acceptance journey verifies the bound post.

## SEARCH-004 — Advanced filters

**Verification recipe.** a journey that builds an (A OR B) AND NOT C filter in the bar and the menu, matches the expected issues, and saves it.

**Mechanism context.** Filters combine with AND/OR groups and negation over every issue field, custom field (FIELD-002), relation, customer request (CUST-002), Git state (GITHUB-005), release, milestone and date expressions ("due before next Friday", "updated in the last 7 days"); a typed filter bar accepts the same expressions with autocomplete, and any filter can be saved as a view. Jira JQL in imported saved filters is translated where every term maps and reported otherwise.

## SEARCH-005 — Meaning-based search

**Verification recipe.** a search for "checkout fails on Safari" that finds an issue titled "Payment page broken in WebKit" labeled as a semantic match, and does not return a private-team issue to a non-member.

## VIEW-006 — Manual order

**Verification recipe.** a journey that reorders three backlog issues by keyboard, reloads in a second session and finds the same order, while Current's order is unchanged.

## VIEW-007 — Timeline and calendar views

**Verification recipe.** a journey that drags an issue's due date on the calendar and finds the change in its activity, and a timeline with one issue of each date combination placed as stated.

**Mechanism context.** Issue lists can be shown as a timeline (by the issue start date (ISSUE-022) and the due date, with dependencies drawn; an issue with only a due date is a diamond, one with only a start date is open-ended to today, and one with neither is listed as Unscheduled beside the timeline) and as a month calendar of due dates, cycles and milestones; dragging changes dates through the version-checked mutation.

## VIEW-008 — Display options

**Verification recipe.** a journey that adds assignee swimlanes, drags a card across a lane and a column, and finds both changes in activity; plus a list grouped by a label group, by milestone and by parent issue, each with group counts matching the filtered result.
2. VIEW-008 inherits PROJ-011's milestone grouping in saved views.

**Mechanism context.** Members choose the properties shown on rows and cards, show sub-issues nested or flat, group lists and add board swimlanes by assignee, project, priority, cycle, label (one label group at a time, ISSUE-014), project milestone (PROJ-011), parent issue (REL-006) or a single-select or person custom field (FIELD-002), and drag cards between columns and lanes (the labeled selector of VIEW-005 remains the keyboard path). Display options save with a view. VIEW-008 inherits PROJ-011's milestone grouping in saved views.

## VIEW-009 — Workspace-wide views

**Verification recipe.** a journey that saves a shared project view filtered by lead and health and a cross-team issue view, and opens both from the palette.

## VIEW-010 — Sidebar favorites

**Verification recipe.** a journey that favorites an issue, a project and a view, moves the view into a folder, reloads in a second browser and finds the same order, then loses access to the project's private team and finds that favorite gone.

**Mechanism context.** Members pin issues, projects, initiatives, cycles, releases, documents, customers (CUST-007), saved views and teams to a Favorites section of the sidebar, reorder them by drag or keyboard, group them in named folders, and see each favorite's unread or count badge; favorites are per member, sync across browsers and the mobile apps (MOBILE-001), and a favorite whose subject is deleted or becomes invisible (ROLE-002) disappears without revealing its title.

## VIEW-011 — Light, dark and system themes

**Verification recipe.** `tests/e2e/theme-runtime.mjs` (VIEW-011), a browser journey that emulates `prefers-color-scheme: dark` and finds the app dark on first paint with scripts disabled, switches to Light and finds it light after a reload and in a second browser signed in as the same member on a dark device, then sets System and follows an emulated scheme change without a reload; plus an automated contrast check (`tests/e2e/theme-contrast.mjs`: axe `color-contrast` for text, and `tests/e2e/theme-control-contrast.mjs` for 3:1 non-text contrast of every enabled button, link drawn as a control, tab, select, text field and disclosure at rest and hovered, native checkboxes and radios from their rendered pixels, selected, pressed and current states, and the keyboard focus indicator of every focusable control) of the issue list, issue page, board, projects list, project page and Settings in both themes at 1440 and 390 with no AA failure.

**Mechanism context.** Each member chooses Light, Dark or System under Settings → Appearance; System, the default, follows the device's `prefers-color-scheme` and switches live when it changes. The choice is stored per member on the installation, so every browser the member signs in to applies it, and the server renders it on the document so it applies before first paint, without a script and with no flash of the other theme. Both themes meet WCAG 2.2 AA contrast for text and controls: text at 1.4.3, and every enabled UI component a person must see to operate (buttons, checkboxes, radios and toggles, selects and text fields, tabs, focus indicators, and selected, current and hover states) at 3:1 against what surrounds it (1.4.11); status, priority, label, project-status and health colors and code highlighting (ISSUE-026) stay distinguishable in both. Signed-out pages, sign-in and the public homepage (HOME-001) keep the light palette and are unchanged. Charts (REPORT-001), the roadmap timeline (INIT-003) and the desktop and mobile apps (MOBILE-001, MOBILE-005) inherit this choice and its contrast rule before they ship.

## CMD-004 — Keyboard-first editing

**Verification recipe.** a keyboard journey that changes status, assignee and priority of two selected issues without a mouse.

## SYNC-001 — Real-time sync

**Verification recipe.** a two-browser journey that changes an issue in one and measures its appearance in the other under one second, then drops the socket and recovers within CURR-008.

## SYNC-002 — Local-first speed

**Verification recipe.** a browser journey that measures issue open and list filter latency from cache, makes an offline edit, reconnects and sees it applied, and a conflicting edit shown.

**Mechanism context.** The web app keeps a permission-scoped local cache of the member's teams so issue lists, issue detail, filters and the palette open from local data in under 100ms (p95) and edits apply optimistically, reconciling with server versions (ISSUE-006) and showing a conflict when one is rejected. Offline edits queue and replay on reconnect in order.

## SYNC-003 — Collaborative editing

**Verification recipe.** a two-browser journey that types into the same description concurrently and finds both edits in the saved text.

**Mechanism context.** Two members editing the same description or document see each other's cursors and changes live and never lose text; the result is one revision per editing session in ISSUE-018 history.

## MOBILE-001 — iOS and Android apps

**Verification recipe.** a device-simulator journey on iOS and Android builds that signs in to a local installation by URL, accepts a triage item, creates an issue with a photo and finds both on the web, the photo shown inline in the description in the app and on the web; plus the MOBILE-004 distributed-build check, which runs the same sign-in and triage steps on the store-distributed build (TestFlight and the Play internal testing track) against a hosted test installation.
2. Inherited from WORK-004: the mobile-app journey exercises Created, Subscribed with row Unfollow and Activity using the same visibility, filters and display rules.

**Mechanism context.** Native apps for iPhone and Android, published by Run Edit Run as one "Vector" listing in the Apple App Store and Google Play (MOBILE-004), so a member installs them from the store with no developer account and no build step; on first launch the member enters their installation's URL (or scans a QR code from Settings → Mobile, or opens an invitation link), signs in through that installation's own sign-in (email link, SSO under ROLE-004) in the system browser, and may add several installations and switch between them. The apps let members read and act on their inbox, triage (accept, defer, decline, duplicate), view My work, Current, projects and cycles, create issues with photos, screenshots, screen recordings and voice-to-text, with the images and video shown inline (ISSUE-024), tick checklists (ISSUE-025), comment with mentions, change properties and search. They use the same `/api/v1` and permission rules, through a per-device OAuth token (API-004) that the member or an Admin can revoke from Settings. The apps inherit VIEW-011: they apply the member's saved Light, Dark or System choice from the installation. Inherited from WORK-004: the mobile-app journey exercises Created, Subscribed with row Unfollow and Activity using the same visibility, filters and display rules.

## MOBILE-002 — Push notifications

**Verification recipe.** a journey on a local installation configured with a relay fixture at the network edge that mirrors the relay's registration and send API: registering a simulator device, triggering one enabled and one disabled event, and finding exactly one relay request whose body has only the listed fields and no description text, then the "ID only" setting producing a request with no title; an enabled event outside the member's working hours in their personal time zone producing no relay request until their working hours begin and then exactly one; a quick action that marks the notification read on the installation; and the MOBILE-004 distributed-build check receiving one real push on a test device through the production relay.
2. For the mobile push channel (MOBILE-002), the inherited NOTIFY-007 duty is quoted verbatim: "SLACK-004 delivers Slack direct messages for assignments and mentions now, the events NOTIFY-006 mails; the per-event choice for every other event, Admin defaults, digests, mobile push (MOBILE-002), desktop notifications (MOBILE-005) and Teams direct messages (TEAMS-001) remain this clause's." Scope: mobile push only.
3. The member chooses this channel per event type; Admin defaults include it; it honors working hours and digests (NOTIFY-010), mutes (NOTIFY-004), actor exclusion (NOTIFY-003) and access (OPS-001), and never repeats a delivered notification.

**Mechanism context.** Working hours gate every time-of-day push delivery under NOTIFY-010.  The mobile apps receive real-time push notifications through Apple Push Notification service and Firebase Cloud Messaging for the events a member enabled (NOTIFY-007), with quick actions (mark read, snooze, assign to me) that call the member's installation directly. The installation never holds Apple or Google push credentials: it sends each push to the Run Edit Run push relay (MOBILE-004), which forwards it to APNs or FCM. The payload the relay receives and forwards carries only the opaque device registration, the issue identifier, its title, the actor's display name, the notification kind and an installation-scoped notification ID — never descriptions, comments, customer data or attachments — and a member can choose "ID only", in which the title and actor are omitted and the app fetches them from the installation after it wakes. A push is sent within 5 seconds of the inbox notification (NOTIFY-001), except during the member's push quiet hours: outside their working hours and working days in their personal time zone (NOTIFY-010), unless they turn quiet hours off, the inbox entry appears at once and the push is held and sent once when their working hours resume; revoking the device token or signing out deregisters the device at the relay.

## MOBILE-003 — Responsive web

**Verification recipe.** the 390px viewport checks in the development journey plus a 390px pass over every new page.

## MOBILE-004 — Distributed apps and push relay

**Verification recipe.** the release lane's distributed-build check on each release: install the TestFlight and Play internal-testing builds on test devices, sign in to a hosted test installation by URL, accept a triage item, and receive one real push through the production relay with only the MOBILE-002 fields; plus a relay test that refuses an unsigned send, a send signed by another installation's key, and a send to a device deregistered by sign-out.

**Mechanism context.** Run Edit Run's release lane builds, signs and publishes the iOS app to the App Store and the Android app to Google Play under Run Edit Run's developer accounts, and the macOS and Windows apps of MOBILE-005, on every Vector release whose API version they support; each app declares the oldest installation version it works with and tells the member to upgrade an older installation rather than failing silently. Run Edit Run operates the push relay those apps need: an installation registers with the relay once from Settings → Mobile (an Owner confirms; the relay issues an installation key, stored encrypted under SEC-001), devices register through the installation, and the relay accepts sends only signed with a registered installation key and only for devices registered to that installation. The relay stores device registrations and installation keys, and keeps no notification payload after forwarding; its terms, data list and status page are linked from Settings → Mobile. An Owner can turn push off for the whole installation, and a buyer who wants their own branded build publishes it under their own Apple and Google accounts with their own push credentials, pointing their installation at their own relay deployment from the same source (docs).

## MOBILE-005 — Desktop apps and desktop notifications

**Verification recipe.** a desktop-shell journey on macOS and Windows CI runners that signs in by URL and shows one native notification for an assignment, and a browser journey that grants notification permission, closes the tab, triggers a mention and finds one Web Push request at the push-service fixture with no description text.
2. For the desktop notification channel (MOBILE-005), the inherited NOTIFY-007 duty is quoted verbatim: "SLACK-004 delivers Slack direct messages for assignments and mentions now, the events NOTIFY-006 mails; the per-event choice for every other event, Admin defaults, digests, mobile push (MOBILE-002), desktop notifications (MOBILE-005) and Teams direct messages (TEAMS-001) remain this clause's." Scope: desktop notification only.
3. The member chooses this channel per event type; Admin defaults include it; it honors working hours and digests (NOTIFY-010), mutes (NOTIFY-004), actor exclusion (NOTIFY-003) and access (OPS-001), and never repeats a delivered notification.

**Mechanism context.** Signed and notarized desktop apps for macOS and Windows (MOBILE-004 publishes them), and the installable web app (PWA) for any browser, open the member's installation by URL with its own window, keyboard shortcuts, a dock or taskbar unread badge and native operating-system notifications in real time for the events the member routes to desktop under NOTIFY-007. In a browser, Web Push delivers the same desktop notifications through the browser's push service with the MOBILE-002 payload limits, while the tab is closed. Clicking a notification opens the issue in the app. The apps inherit VIEW-011: they apply the member's saved Light, Dark or System choice from the installation.

## NOTIFY-007 — Channels and digests

**Verification recipe.** a journey that routes mentions to Slack and comments to a daily digest, then checks the Slack and mail fixtures receive exactly one message each; plus a scheduled-run test in which a member in America/Los_Angeles with working hours from 09:00 on weekdays, in a workspace in America/New_York, receives that daily digest once at 09:00 Pacific on a weekday and none on a Saturday.

**Mechanism context.** Each member chooses per event type whether it reaches them in the inbox only, by email, in a Slack direct message, and can take email as an immediate message or an hourly or daily digest; Admins set workspace defaults. Working hours gate every time-of-day digest delivery. Digests follow the member's personal time zone and working hours (NOTIFY-010): a daily digest is sent once at the start of the member's working hours on each working day, and hourly digests are sent only within working hours, with anything collected outside them carried into the next digest. Every channel honors mutes (NOTIFY-004), actor exclusion (NOTIFY-003) and access (OPS-001), and never repeats a delivered notification. the per-event choice for push, desktop notifications and Teams direct messages is delivered with MOBILE-002, MOBILE-005 and TEAMS-001.

## NOTIFY-008 — Snooze and reminders

**Verification recipe.** a journey that snoozes a notification for one hour, advances the clock, and sees it return once.

## NOTIFY-009 — Subscriptions

**Verification recipe.** a journey that subscribes to a label and gets one notification when a new issue gets that label.

## NOTIFY-010 — Personal time zone and working hours

**Verification recipe.** a scheduled-run test with a workspace in America/New_York, one member in America/Los_Angeles and one without a personal zone, both with an issue due today, that sends the Eastern member's reminder at 09:00 Eastern and the Pacific member's at 09:00 Pacific, each exactly once.

**Mechanism context.** Each member can set a personal IANA time zone (defaulting to the workspace time zone of OPS-003) and working hours. Their due reminders (NOTIFY-005) arrive at the reminder time in their own time zone, and their snoozes (NOTIFY-008), email digests (NOTIFY-007), personal reminders and push quiet hours use it; workspace-level instants (cycle boundaries, SLAs, workspace calendar days) stay in the workspace time zone. Dates and times in the interface show in the viewer's time zone with the zone named where it differs from the workspace's.

## AUTO-001 — Recurring issues

**Verification recipe.** a scheduled-run test that creates a weekly series, runs the scheduler twice in the same week and finds one issue, then skips while open.

## AUTO-002 — Workflow rules

**Verification recipe.** a journey that builds "when label Security is added, set priority Urgent and notify #security", dry-runs it, triggers it, and finds one run-log entry, one change and one Slack fixture message; plus the AUTO-002 rows of the role-matrix journey: a non-owner Member's team rule is refused 403 under the default permission and admitted under All team members, and a Member's workspace rule is refused 403.

**Mechanism context.** Owners and Admins build workspace rules, and a team's rules are built by its team owners or, while its *Who manages team settings* permission is All team members (ROLE-009), by all its members; other Members and all Guests cannot (role matrix). A rule has a trigger (issue created or changed, status entered, comment, label added, PR event, deploy, due-date approaching, SLA warning, schedule), conditions over any field and actions (set fields, assign, move status or team, add to cycle or project, add a comment, apply a template, notify a person or channel, call a webhook, start an agent with AGENT-001). Each rule shows a dry run over recent issues before saving, a run log with every change it made, a monthly run budget, and a failure state that notifies its owner; rules cannot trigger themselves in a loop.

## AUTO-003 — Auto-close and auto-archive

**Verification recipe.** `tests/worker/housekeeping.test.ts` (AUTO-003), a scheduled-run test on a fixed clock with a 30-day stale issue and a 90-day completed issue that closes one and archives the other, each with an automation reason entry that the owner, a follower and a non-following member all read, as the preview listed; each follower gets exactly one notification per change across two runs, with the same causes and mail as an operator's manual cancel, and a non-follower gets none; a signed-out visitor and a removed member are refused the issue and its entry; a stale Bug-labelled issue stays open; the archived issue leaves the completed list and default search, is found with archived records included and in the archive export, and returns on reopening; plus `tests/e2e/housekeeping-runtime.mjs`, which sets and previews the periods in Settings, runs the scheduler twice, finds each reason entry in the issue's activity as the owner and as a following teammate, and not signed out, finds one inbox notification per automated change beside the manual cancel's, and finds the archived notice and archived search at 1440 and 390.

**Mechanism context.** Per team, under Settings → Auto-close and auto-archive, an Owner, an Admin or the team's owners (and every team member while its *Who manages team settings* permission is All team members, ROLE-009) set an auto-close period (days without activity: no issue change, activity entry or comment) and an auto-archive period (days since the issue closed), each 1 to 3650 days or off, and preview exactly which issues the next scheduled run would close and archive. The scheduled run moves each open (Backlog, Unstarted or Started) issue past its period to the team's first Canceled status with a comment-equivalent automation entry explaining why, and archives each completed, canceled or duplicate issue past its period with an automation entry; both are guarded by the issue version and held during a restore. Bugs are exempt by default: until issue types exist (ISSUE-021), an issue carrying a label named Bug is never auto-closed while the team's exemption is on. Archived issues keep every row and link; they leave the issue list, board, saved views, My work and project issue lists and default search, open by their identifier with an Archived notice, appear in search with archived records included, stay in archive exports, and return to lists when another status is chosen. Who may change these periods follows ROLE-009's *Who manages team settings* (proven by `tests/worker/role-matrix.test.ts`). The automation entry is the comment: it sits in the issue's own activity with its reason ("Closed automatically after 30 days without activity", "Archived automatically 90 days after it closed") for everyone who can read the issue, and the issue's followers (NOTIFY-002) receive the notification a manual status change gives them, once per automated change, naming the automation as actor: a cancellation for an auto-close and an archive notification (its own kind, mutable like the others) for an auto-archive.

## AUTO-004 — SLAs

**Verification recipe.** a clock-advancing test that warns once before breach and records one breach.
2. Inherited from NOTIFY-001: an SLA warning notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships.
3. Inherited from SLACK-003: an SLA warning posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.

**Mechanism context.** Teams set SLA targets by priority, label or customer tier (for example: Urgent bugs from Enterprise customers resolved in 24 hours, triage within 4 business hours in the workspace timezone); issues show time remaining, warn the assignee and triage owner before breach, and record breaches for reporting (REPORT-001). Inherited from NOTIFY-001: an SLA warning notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships. Inherited from SLACK-003: an SLA warning posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post. Inherited from ROLE-009: a team's SLAs change under its *Who manages team settings* permission; Owners and Admins always may and Guests never (role matrix).

## AUTO-005 — Update reminders

**Verification recipe.** a scheduled-run test that reminds one lead once per cadence and flags a missed update.

## AUTO-006 — Due-soon rules

**Verification recipe.** an AUTO-002 rule with a due-in-two-days trigger acting once per issue and date.

**Mechanism context.** Rules on due dates can act before the due day (for example two days before: notify the assignee and move to the active cycle), complementing the fixed due-today and overdue reminders of NOTIFY-005. Inherited from ROLE-001: only Owners and Admins build or change workspace automation rules (role matrix).

## REPORT-001 — Insights

**Verification recipe.** a journey on a seeded data set whose cycle-time median and throughput per week match hand-computed values, and whose drill-down lists the counted issues.

## REPORT-002 — Cycle and project charts

**Verification recipe.** `tests/worker/cycle-report.test.ts` and `tests/e2e/cycle-report-runtime.mjs` retain cycle proof; `tests/worker/project-report.test.ts` follows adds, moves, deletions and reopenings at a fixed clock, advances scheduled day closes, proves aggregate-only history, projection and terminal states; `tests/e2e/project-report-runtime.mjs` uses live and frozen reports at 1440/390; `tests/worker/data-http.test.ts` retains report history through archive restore.

## REPORT-003 — Dashboards

**Verification recipe.** a journey that builds a three-widget dashboard, shares it, and opens it as another member who sees only what they may access.

## REPORT-004 — Workload

**Verification recipe.** a journey with three assignees whose committed points match the view and over-capacity is marked.

## REPORT-005 — Warehouse and spreadsheet export

**Verification recipe.** a scheduled export to an R2 fixture whose second run carries only changed rows, a paged export API read, and a Google Sheets API fixture at the network edge to which a saved view syncs: after one issue in the view changes and another leaves it, the next sync updates the first row and removes the second.

**Mechanism context.** Owners and Admins (role matrix) schedule incremental exports of issues, history, cycles, projects and customer links as CSV or JSON to an S3-compatible bucket (Amazon S3, Cloudflare R2), expose a read-only export API that Fivetran and Airbyte connectors can page through, and sync a saved view to a Google Sheets spreadsheet through the Sheets API (`spreadsheets.values.batchUpdate`), refreshed on a schedule of at least hourly with one row per issue and one column per visible view property.

## INTEG-001 — Guided connection from Settings

**Verification recipe.** one setup journey per provider in the table against a provider fixture at the network edge that mirrors that provider's real app-creation, OAuth and event APIs (for example Slack's `apps.manifest.create` and `oauth.v2.access`, GitHub's manifest redirect and `POST /app-manifests/{code}/conversions`), in which an Admin completes setup from Settings → Integrations without entering any scope, URL or manifest text, the first real event (an `@Vector` message, a PR opened) creates or links an issue, and a Member's attempt to open the setup is refused 403; plus a hosted connection run for Slack and GitHub against the real providers on a test workspace and organization, recorded as hosted evidence.

**Mechanism context.** Settings → Integrations lists every integration with its state (not connected, connecting, connected, needs attention). An Owner or Admin connects one through the setup path in the table below: Vector generates every value the provider needs — this installation's request, event, OAuth redirect and sidebar URLs, least-privilege scopes, event subscriptions, a fresh signing secret, and any app package or plugin manifest — and either submits them through the provider's app-creation API or manifest flow, or prefills the provider's creation page, so the Admin never types or edits a scope, URL or manifest by hand; the only values an Admin copies are the credentials a provider shows once, which Vector stores encrypted (SEC-001). Each path ends with a live check: Vector calls the provider with the new credentials and asks the Admin to perform one real action (send `@Vector` a message, open a PR), and marks the integration connected only when that event arrives signed. From then on every member uses it without further setup, linking their own provider identity where the integration acts as them (SLACK-001, DOCS-001). Disconnecting revokes tokens, deletes the provider webhook where the provider's API allows it, and lists anything the Admin must remove in the provider.

## INTEG-002 — Integration health and repair

**Verification recipe.** a journey that changes the installation origin in a fixture run, repairs Slack and GitHub from Settings and finds each provider fixture's request URL updated and the next event received, with existing links intact.

**Mechanism context.** Each connected integration shows its last received event, last successful call, failure count and token expiry; a failing integration notifies the Admins who connected it and shows the provider's error. When the installation's origin changes or a provider rotates a secret, Settings repairs the integration in place — updating the request URLs through the provider's API where one exists (Slack `apps.manifest.update`, GitHub `PATCH /app/hook/config`, GitLab hook update) or re-running the setup path with the existing app otherwise — without losing links, synced threads or identity mappings. After a restore (SEC-001) each integration shows "needs attention" until its credentials are re-entered.

## GITHUB-003 — Branches and status automation

**Verification recipe.** A signed-fixture journey that opens a draft PR, requests review and merges it, and finds three status moves with automation attribution, then replays the deliveries and finds no duplicates.
2. Inherited from NOTIFY-001: a Git status/completion event, naming the Git automation as actor notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships.
3. The inherited merged-PR fixture completes a followed issue and its follower receives exactly one notification naming Git automation; the actor receives none and replay adds none.

**Mechanism context.** Each issue offers a copyable branch name (for example `vec-123-fix-checkout`); Vector links a PR whose branch, title or body names an issue, understands closing words ("Fixes VEC-123") and contributing words ("Part of VEC-123"), and moves the issue by team rules: draft PR opened → In Progress, review requested → In Review, merged → Done (or the status chosen per rule, including on deploy with RELEASE-002). Each move is recorded as Git automation and never moves an issue backwards out of Completed without a rule saying so. Inherited from NOTIFY-001: a Git status/completion event, naming the Git automation as actor notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships. The inherited merged-PR fixture completes a followed issue and its follower receives exactly one notification naming Git automation; the actor receives none and replay adds none. Inherited from ROLE-009: a team's Git automation rules change under its *Who manages team settings* permission (role matrix). Provider-backed "create branch" is tracked in GITHUB-008.

## GITHUB-004 — Commits

**Verification recipe.** a signed push fixture with two commits naming one issue shows both on the issue and applies the closing rule once.

## GITHUB-005 — Review and checks on the issue

**Verification recipe.** signed review and check-run fixtures that change the issue's PR badge from checks failing to approved and passing.
2. Inherited from NOTIFY-001: a Git review request notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships.

**Mechanism context.** A linked PR shows its review state (review requested, approved, changes requested, with reviewers), required check status from GitHub Actions or other CI, mergeability and stacked-PR parent; issue lists can filter by these, and reviewers get a notification in Vector when their review is requested on a linked PR. Inherited from NOTIFY-001: a Git review request notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships.

## GITHUB-006 — GitHub App

**Verification recipe.** an app-install journey against a GitHub API fixture at the network edge that mirrors the manifest redirect, `POST /app-manifests/{code}/conversions` and the installation callback: the Admin connects without editing scopes or URLs, the first PR opened in a chosen repository links its issue and posts one linkback, and calls stop after uninstall; plus the INTEG-001 hosted connection run on a real test organization.
2. Inherited from SEC-001: credentials are sealed, shown once, least-scoped, excluded from archives, re-entered on restore, rotated on demand and revoked on removal; an archive-then-restore journey proves no credential is exported and the restored connection needs re-entry.

**Mechanism context.** Each installation creates its own GitHub App through the GitHub App manifest flow from Settings → Integrations → GitHub (INTEG-001's table): the Admin chooses a personal account or organization (or a GitHub Enterprise Server host), approves the prefilled app on GitHub, and Vector converts the returned code into the app's ID, private key and webhook secret, then sends the Admin to choose repositories. The app has least-privilege scopes on chosen repositories (GitHub.com and GitHub Enterprise Server), posts a linkback comment on linked PRs, reads PR and check state for enrichment, and maps GitHub users to members; tokens are short-lived installation tokens stored encrypted, and uninstalling stops all calls. The webhook-only mode of GITHUB-001 remains available without a token. Inherited from SEC-001: credentials are sealed, shown once, least-scoped, excluded from archives, re-entered on restore, rotated on demand and revoked on removal; an archive-then-restore journey proves no credential is exported and the restored connection needs re-entry.

## GITHUB-007 — GitHub Issues sync

**Verification recipe.** a fixture journey that creates an issue on each side, edits a comment on each side and closes on GitHub, and finds both sides consistent with no duplicate.

## GITHUB-008 — Provider-backed create branch

**Verification recipe.** the offered "create branch" action creates the branch through the installation’s GitHub App (GITHUB-006).

## GITLAB-001 — GitLab

**Verification recipe.** a setup journey against a GitLab API fixture in which pasting a token and choosing two projects creates two webhooks with the installation's URL and secret, then signed GitLab fixtures for MR opened, approved, merged and a production environment deployment that move one issue as configured.

**Mechanism context.** For GitLab.com and self-managed GitLab, Vector links merge requests, branches and commits that name issues, moves status by the same team rules as GITHUB-003, shows approvals and pipeline status, and receives environment deployments for RELEASE-002, through signed webhooks and a least-privilege access token. Setup is INTEG-001's API registration: the Admin pastes a group or project access token with `api` scope, chooses projects, and Vector creates each project webhook (or a group webhook where the tier provides one) with a generated secret token, without the Admin entering a URL.

## GITLAB-002 — GitLab Issues sync

**Verification recipe.** the GITHUB-007 journey against GitLab fixtures.

**Mechanism context.** A team can sync with GitLab project issues with the same behavior as GITHUB-007.

## BITBUCKET-001 — Bitbucket

**Verification recipe.** signed Bitbucket fixtures for PR opened and merged that move one issue.

## CI-001 — CI and deploy providers

**Verification recipe.** one signed or API fixture per named provider — a CircleCI workflow-completed webhook, a GitHub Actions `workflow_run` event, a GitLab pipeline hook, a Vercel deployment webhook, a Netlify deploy notification and a Cloudflare Workers or Pages deployment — each appearing on the linked issue and firing an AUTO-002 rule exactly once when replayed.

## SLACK-001 — Slack app

**Verification recipe.** an install journey against a Slack API fixture that mirrors `apps.manifest.create`, `oauth.v2.access` and the Events API: from Settings → Integrations → Slack an Admin connects through the manifest flow without hand-editing scopes or URLs, the first `@Vector` message in a channel creates an issue, one encrypted bot token is stored and one member is linked, then uninstalling stops all calls; the same journey through the prefilled-page path; and the INTEG-001 hosted connection run on a real test Slack workspace.
2. Inherited from SEC-001: credentials are sealed, shown once, least-scoped, excluded from archives, re-entered on restore, rotated on demand and revoked on removal; an archive-then-restore journey proves no credential is exported and the restored connection needs re-entry.
3. SLACK-003 already covers the sealed bot-token paste path and its archive/re-entry proof; SLACK-004 covers member-confirmed linking by the member's own sign-in email, the pasted signing secret and the interactivity door; the manifest/OAuth installation, Events API, @Vector issue creation, explicit Admin mapping and uninstall remain this clause’s acceptance.

**Mechanism context.** Each installation has its own Slack app, created from Settings → Integrations → Slack through Slack's app manifest (INTEG-001's table): with a one-time app configuration token Vector calls `apps.manifest.create` with the generated manifest (this installation's event, interactivity, slash-command, unfurl and OAuth redirect URLs and least scopes) and receives the app's credentials; without a token, Vector opens Slack's create-from-manifest page prefilled and the Admin pastes the signing secret, client ID and client secret Slack shows. The Admin then clicks Install, which completes OAuth v2 to the company's Slack workspace (or an Enterprise Grid org) and stores the bot token encrypted. Members link their Slack identity to their Vector member; uninstalling or unlinking stops all calls and removes stored tokens. Inherited from SEC-001: credentials are sealed, shown once, least-scoped, excluded from archives, re-entered on restore, rotated on demand and revoked on removal; an archive-then-restore journey proves no credential is exported and the restored connection needs re-entry. SLACK-003 already covers the sealed bot-token paste path and its archive/re-entry proof; SLACK-004 covers member-confirmed linking by the member's own sign-in email, the pasted signing secret and the interactivity door; the manifest/OAuth installation, Events API, @Vector issue creation, explicit Admin mapping and uninstall remain this clause’s acceptance.

## SLACK-002 — Issues from Slack with synced threads

**Verification recipe.** a Slack Events fixture that creates an issue from a message, posts a thread reply that becomes a reply in the mapped comment thread, a Vector reply in that thread that posts back to the Slack thread once, a separate top-level Vector comment that posts nothing to Slack, and a second linked Slack thread whose replies land only in its own comment thread; plus a thread reply carrying a PNG that shows inline in the mapped reply, a Vector reply with an embedded image that calls `files.completeUploadExternal` exactly once for that thread, and a Slack user with no seat and no linked identity who files from a message, is recorded as the requester with no member created, and receives the issue's next status change in the thread; and a filing whose Customer picker is prefilled from the author's domain and adds the message as a request on that customer.

**Mechanism context.** From any message, a shortcut, an emoji reaction or `@Vector` creates an issue (or adds the message to an existing one) with the message, author, attachments and a link, using a template or request form (TRIAGE-004), with a Customer picker prefilled from the message author's email domain so the message becomes that customer's request (CUST-006, CUST-008); the Slack thread then syncs both ways with exactly one Vector comment thread (ISSUE-008): the originating message becomes that thread's root comment, each Slack reply becomes a reply in it, a Vector reply in that thread posts once to the Slack thread, resolving the Vector thread adds a resolved marker in Slack, and comments outside that thread never post to Slack; a second Slack thread linked to the same issue maps to its own comment thread. Status changes post into every linked Slack thread. Request channels can be configured so every top-level message becomes a triage item. Files in Slack messages and replies become attachments shown inline in the mapped comment (ISSUE-024); an image or video embedded in a Vector reply in that thread is uploaded into the Slack thread once through Slack's external upload API (`files.getUploadURLExternal`, then `files.completeUploadExternal`), and a checklist (ISSUE-025) posts as text. A Slack user with no Vector seat and no linked identity (SLACK-001) — someone in sales or support — can file in the same ways in any channel the Vector app is in: Vector records them as the issue's requester by Slack user ID and display name (and as a contact of the customer their email domain maps to under CUST-006), never as a member, and gives them no sign-in and no access to Vector; they receive the confirmation with the identifier and title, and the issue's status changes and the Vector replies in the mapped thread reach them in that Slack thread like anyone in it. For an issue in a private team (ROLE-002), the thread receives only the identifier and status changes.

## SLACK-003 — Channel notifications

**Verification recipe.** a journey that binds a project to a channel and finds one formatted Slack message per update, a project created with "create Slack channel" that finds one `conversations.create` call and the binding, and a Discord webhook fixture that receives one message per bound event.
2. Tests [SLACK-003] in tests/worker/outbound-broken-destination.test.ts and tests/e2e/integration-runtime.mjs exercise Settings, native mutations, one formatted post per event, channel creation and Discord delivery at the network edge; tests/worker/data-http.test.ts retains bindings without credentials through restore.

**Mechanism context.** Teams, projects, initiatives and saved views can post chosen events (new triage item, new issue, status change, project update, release, SLA warning, agent completion) to a Slack channel, respecting ROLE-002 so private-team content only posts to channels the Admin bound to that team. A team or project can create its own Slack channel when it is created (`conversations.create`, named from its identifier or name) and bind it automatically, and a Discord channel can receive the same events through a Discord webhook URL. An Admin enters a Slack bot token in Settings → Integrations once; auth.test validates it, sealSecret/openSecret seal it per workspace, settings never reveal it again, archives exclude it, restored installations need attention until re-entry, and removal calls auth.revoke, deletes local custody and disables bindings (a provider error refuses removal visibly). Owners and Admins connect Slack and bind channels in Settings → Integrations, and only they may have the Slack bot create a channel in the customer's Slack workspace, which a team or project created with it binds automatically; a Member who may create a project may bind it to a channel an Owner or Admin already bound or allowed, and post to it (role matrix, ROLE-001); no private teams exist, so every team is workspace-visible and bindable, and ROLE-002 inherits the private-team channel restriction before private teams ship. Existing new-triage, new-issue and status-change events post through the shared native outbound claim, bounded-retry, uncertain-result and visible Settings failure machinery, once per event per binding. Saved-view membership uses the same list predicates at dispatch. Messages carry identifier, title, readable actor, old → new status and the canonical /app/issues/:identifier link, never description or comment bodies. Unbinding, issue deletion and operator removal stop future posts; already-posted Slack or Discord messages cannot be recalled by local erasure (SEC-003). Channel creation makes one conversations.create call with a lowercase hyphenated identifier or name of at most 80 characters, public channels only; name_taken and other Slack errors are shown without a retry loop and refuse object creation. Discord accepts only HTTPS discord.com or discordapp.com URLs whose path starts /api/webhooks/, seals the URL and refuses redirects; this fixed-host rule does not depend on arbitrary resolved-address egress. PROJ-010, RELEASE-001/RELEASE-003, AUTO-004, AGENT-002/AGENT-003 and INIT-001 inherit their future objects’ bound-channel events and acceptance before shipping. Slack channel selection and each post explicitly check conversations.info: bot membership and is_channel true, archived/shared/external-shared/org-shared/pending-external-shared false, and not frozen; the held Slack conversation object omits is_frozen, recorded as an assumption that an absent is_frozen means not frozen (revisable if a provider run contradicts it). Unsafe channels and archived/frozen/not-joined post refusals suspend routing visibly until an Admin confirms a fresh binding; held events are not replayed. Channel IDs are explicitly mapped by the Admin, never inferred from email or name. Actor display names are allowed for current workspace-visible items (ct, 20 Oct 19:12Z); ROLE-002 inherits generic notices without actor or text, or a DM to a permitted explicitly mapped member, for private/restricted items before they ship.

## SLACK-004 — Personal Slack notifications

**Verification recipe.** a mention routed to Slack produces one DM fixture with working actions. [SLACK-004] in `tests/worker/outbound-broken-destination.test.ts` (with `tests/worker/slack-dm-scenario.ts`), `tests/worker/data-http.test.ts` and `tests/e2e/integration-runtime.mjs` (with `tests/e2e/integrations/slack-dm-settings.mjs`) proves own-email lookup and confirmation, no-match and lookup-error handling, exactly one DM with the three actions and only the allowed fields, signed Assign to me and Change status each applied once, refusal of unsigned, wrongly signed, stale-timestamp, replayed and unlinked requests, the stale-version reply, no DM for a muted event, the actor, a removed or natively inactive member, a turned-off choice or a removed credential, and an archive round trip without the signing secret or links.

**Mechanism context.** Members can receive their notifications as Slack direct messages under NOTIFY-007 with actions (assign to me, change status, open). A signed-in member chooses Link Slack in Settings → Notifications; Vector calls `users.lookupByEmail` (scope users:read.email) with that member's own Vector sign-in email, shows the Slack account it found and links it only when the member confirms; no match shows "No Slack account found for this email" and stores nothing, and a lookup error is shown and not retried. There is no silent or background lookup, no lookup by an Admin for someone else's email, no bulk directory read (`users.list`) and no matching on names (ct, 20 Oct 19:12Z); explicit Admin mapping remains SLACK-001's. The link is shown, audited (`slack.member_linked`, `slack.member_unlinked`) and revocable with Unlink; unlinking, member removal, suspension (ROLE-011 inherits) and removal of the workspace's Slack credential delete it and stop every direct message. A linked member turns on Slack direct messages separately for assignments and for direct mentions, the events Vector mails today (NOTIFY-006); the option is unavailable, with the reason shown, while the workspace has no valid Slack credential or the member has no link, and NOTIFY-007 keeps the choice for every other event. Each qualifying notification creates at most one direct-message intent per recipient in the same transaction as its source mutation, in the native outbound ledger (no second queue); immediately after commit, like immediate mail, and before every later attempt Vector rechecks mutes (NOTIFY-004), actor exclusion (NOTIFY-003), the active recipient, issue access (OPS-001) and the member's link and choice, then calls `conversations.open` (im:write) and `chat.postMessage`. A delivered message is never repeated: rate limits and an unanswered `conversations.open` (which posts nothing) retry at most three attempts, after one and then five minutes; an unknown `chat.postMessage` result is uncertain and never resent; failed and uncertain messages are listed to the recipient in Settings → Notifications. A message carries only the event kind, issue identifier and title, actor display name, status change, due date and the authenticated canonical `/app/issues/:identifier` link, in plain-text blocks with `unfurl_links` and `unfurl_media` false — never a description, comment or mention body, free text or AI output; private or restricted items (none exist until ROLE-002) get a generic notice with no actor or text under ROLE-002. Open is the canonical link button; Assign to me and Change status (an inline select of the team's workflow states the issue-edit door accepts) appear only while the workspace's Slack signing secret is stored, and Settings says they are off until it is entered (pattern 3). Slack's interactivity requests reach `POST /api/integrations/slack/interactive`, which verifies `X-Slack-Signature` (HMAC-SHA256 over `v0:<timestamp>:<raw body>`) in constant time, refuses a timestamp more than 5 minutes from the Worker clock and a replayed request key, maps the Slack user to the Vector member only through the confirmed link and runs the change through the version-checked issue-edit door with that member's own authority and the issue version the message carried. A changed issue is refused with a threaded Slack reply carrying Open and is never overwritten; an applied change refreshes the message with the new version. The door answers before Slack's 3-second limit and replies afterwards. An unlinked, removed or suspended Slack user, a bad or missing signature, a stale timestamp and a replay change nothing. An Admin enters the Slack app's signing secret beside the bot token in Settings → Integrations; it is sealed with sealSecret/openSecret per workspace, never shown again, excluded from archives with the member links (SEC-001: after a restore it is entered again and members re-link) and removed with the credential. docs/INTEGRATIONS.md names the Interactivity Request URL the Admin sets in their Slack app until SLACK-001's manifest sets it, and what leaves the deployment in a direct message.

## SLACK-005 — Link previews

**Verification recipe.** two unfurl fixtures for a private-team issue, one for a member and one for a non-member.

## TEAMS-001 — Microsoft Teams

**Verification recipe.** a setup journey against Bot Framework and Graph fixtures in which an Admin pastes a bot ID and secret, downloads a package whose manifest carries that bot ID and this installation's domain, and the first message to the bot in a channel creates an issue; then the Slack journeys run against Microsoft Bot Framework and Graph fixtures.
2. For the Teams direct message channel (TEAMS-001), the inherited NOTIFY-007 duty is quoted verbatim: "SLACK-004 delivers Slack direct messages for assignments and mentions now, the events NOTIFY-006 mails; the per-event choice for every other event, Admin defaults, digests, mobile push (MOBILE-002), desktop notifications (MOBILE-005) and Teams direct messages (TEAMS-001) remain this clause's." Scope: Teams direct message only.
3. The member chooses this channel per event type; Admin defaults include it; it honors working hours and digests (NOTIFY-010), mutes (NOTIFY-004), actor exclusion (NOTIFY-003) and access (OPS-001), and never repeats a delivered notification.

**Mechanism context.** A Microsoft Teams app offers SLACK-001 to SLACK-005's behavior in Teams: install and identity linking, issues from messages with synced threads, channel notifications, personal notifications and link previews. Each installation has its own bot and Teams app (INTEG-001's table): the Admin creates a bot in the Teams Developer Portal with the messaging endpoint Vector shows and pastes its app ID and client secret, Vector generates the complete Teams app package with that bot ID, valid domains and resource-specific consent permissions, and the Admin uploads it in the Teams admin center as a custom app for the organization; no manifest is edited by hand.

## SUPPORT-001 — Zendesk, Intercom and Front

**Verification recipe.** a setup journey per tool against provider fixtures that mirror Zendesk's private-app upload format, webhook and trigger APIs, Intercom's Canvas Kit initialize request and Front's plugin context, in which the Admin connects without editing a URL and the first sidebar action links a ticket; then signed provider fixtures that link one ticket from each tool and receive one internal note each when the issue completes.

**Mechanism context.** Support agents create or link a Vector issue from a Zendesk ticket, Intercom conversation or Front message through the provider's app sidebar; the ticket shows the issue's status and release, and the issue shows the ticket and customer as a customer request (CUST-001). Status changes add internal notes on the ticket (CUST-003). Setup follows INTEG-001's table: Vector generates a private Zendesk app package (a ticket-sidebar app pointing at this installation) for upload in Zendesk Admin Center and creates the Zendesk webhook and trigger through the Zendesk API with an API token the Admin pastes; for Intercom and Front the Admin creates an app in the provider's developer settings from the copy fields Vector shows (Intercom Inbox app URLs and webhook topics; Front plugin and webhook URLs) and pastes its token and signing secret. Support agents then use the sidebar with no setup of their own, linking their Vector identity on first use.

## SUPPORT-002 — HappyToHelp

**Verification recipe.** a journey across local Vector and HappyToHelp installations that links a conversation and returns the completion note.

**Mechanism context.** HappyToHelp conversations link to Vector issues with the same behavior as SUPPORT-001 through the sibling's API, so a team running Run Edit Run products needs no third-party support tool.

## ERROR-001 — Sentry and Datadog

**Verification recipe.** a Sentry setup journey in which pasting the internal integration's token and secret admits the first signed Sentry webhook, then signed Sentry fixtures that create an issue, resolve it back, and a regression event that reopens it once.

**Mechanism context.** A Sentry issue or Datadog case or monitor alert can create or link a Vector issue with the error, frequency, affected users, release and stack-trace link; resolving the Vector issue can resolve the Sentry issue, and a regression reopens or comments on the Vector issue by team rule. Setup follows INTEG-001's table: a Sentry internal integration created from the webhook URL, scopes and subscriptions Vector shows, and a Datadog webhook Vector registers through the Datadog API.

## ERROR-002 — Spool

**Verification recipe.** a journey across local Vector and Spool installations that links an error group and sees its counts on the issue.

## DESIGN-001 — Figma

**Verification recipe.** a Figma API fixture that mirrors Figma's OAuth and file-image endpoints, in which a connected member's issue renders a frame preview and an unconnected member sees the link alone, a generated plugin manifest that names this installation's origin as its only allowed domain, and a plugin request that creates one issue.

**Mechanism context.** Figma files, frames and prototypes linked in an issue or document show a live preview and last-modified time; a Figma comment can create an issue through the Figma plugin with a link back. Setup follows INTEG-001's table: the Admin registers the installation's Figma OAuth app from the callback URL Vector shows and members connect their own Figma accounts for previews; Vector generates the plugin manifest with this installation in its allowed network domains, published by an Admin as a private organization plugin or imported by members from the manifest.

## DOCS-001 — Notion, Confluence and Google Drive

**Verification recipe.** one fixture per provider at the network edge — Notion, Confluence, Google Drive, Microsoft Graph for OneDrive and SharePoint, and Dropbox — each rendering a preview with title, owner and last update only for the member who connected that account; and oEmbed fixtures for Loom and YouTube that each render an embedded player with no account connection.

**Mechanism context.** Links to Notion pages, Confluence pages, Google Docs and Drive files, Microsoft OneDrive and SharePoint, and Dropbox files (through OAuth clients the Admin registers from the redirect URLs Vector shows, INTEG-001) show title, owner and last-updated previews for members who connected that account, and specs written there can be linked as an issue's specification (PUSH-001). Loom and YouTube video links embed as players through their public oEmbed endpoints, with no account connection.

## CAL-001 — Calendar feeds

**Verification recipe.** a feed request that returns the expected events and a revoked feed that returns 404.
2. CAL-001 inherits PROJ-011's milestone events in calendar feeds.

## CONNECT-001 — Zapier and Make

**Verification recipe.** the app definitions' trigger and action tests run against a local installation, including a connection test that enters the installation URL, completes the OAuth consent and registers one webhook on that installation.

**Mechanism context.** A Zapier app and a Make app expose triggers (issue created, status changed, comment added, project update) and actions (create issue, update issue, comment) over API-003 and WEBHOOK-002 so buyers can connect tools Vector does not integrate natively. Run Edit Run publishes both as public apps in the Zapier and Make directories; each connection asks for the installation URL, authorizes by OAuth (API-004) against that installation, and registers its triggers as REST-hook webhooks (WEBHOOK-002) on it, so no buyer builds or hosts a private app.

## AGENT-001 — Delegate an issue to an agent

**Verification recipe.** for each named provider, a journey that delegates an issue to a fixture at the network edge that mirrors that provider's real delegation API as AGENT-009's table names it (request paths, payload shapes, status values and webhook signatures), and sees the delegate, the human assignee and the exact context payload the fixture received; plus AGENT-009's hosted run per provider.

**Mechanism context.** A member can delegate an issue to a coding agent — Claude Code, OpenAI Codex, Cursor's background agent, GitHub Copilot coding agent or any agent registered through AGENT-006 — from the issue, a shortcut, Slack or a rule (AUTO-002). The human assignee stays accountable; the issue shows the agent as delegate beside the assignee. Delegation sends the issue, its spec (PROJ-013), linked evidence and the team's agent guidance (AGENT-008), scoped to what the delegating member may see, through that provider's own delegation mechanism as AGENT-009 names it — Vector drives each provider's API or the buyer's runner itself, because provider agent apps built for hosted trackers cannot reach a self-hosted installation. Inherited from ROLE-001: Owners and Admins, and Members in the member's teams, delegate to agents allowed under AGENT-004; Guests are refused (role matrix).

## AGENT-002 — Agent session on the issue

**Verification recipe.** per provider, a journey against that provider's mirrored fixture (AGENT-009) where the agent posts a plan and progress, asks a question (or ends a run with one, for providers without a question channel), the member answers and the answer reaches the fixture in the provider's own form (Cursor follow-up, PR comment, runner callback), then cancels, and the session shows the question, answer, cancellation, actor and the provider's stopped status within one minute.
2. Inherited from NOTIFY-001: a delegated agent question or completion notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships.
3. Inherited from SLACK-003: agent completion posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.

**Mechanism context.** Each delegation opens an agent session shown on the issue, fed by the provider mechanism of AGENT-009, with live progress (plan, steps, files touched, commands run, elapsed time and cost in USD when the provider reports it), questions the agent asks a person (answered in the issue or Slack), and a cancel action that stops the session within one minute and records who stopped it. Where a provider has no mid-run question channel, the session says so and a member's answer starts a follow-up run on the same branch (AGENT-009). Inherited from NOTIFY-001: a delegated agent question or completion notifies once in the inbox, never the actor; the receiving journey verifies this before the event ships. Inherited from SLACK-003: agent completion posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.

## AGENT-003 — Reviewable output, human completion

**Verification recipe.** a journey where the agent fixture opens a PR, the issue moves to In Review only, and the agent's attempt to complete the issue through the API is refused 403.
2. Inherited from SLACK-003: reviewable agent completion posts to its bound Slack or Discord channel once, without duplicating AGENT-002’s completion event; its acceptance journey verifies the bound post.

**Mechanism context.** An agent's work lands as a branch and pull request linked to the issue (GITHUB-003), with the tests it added or ran and a summary; the issue moves to In Review, never to Completed, until a person reviews and merges the PR and the team rule or a person completes the issue. An agent may not merge, deploy, change priority, due date or assignee, or message a customer. Inherited from SLACK-003: reviewable agent completion posts to its bound Slack or Discord channel once, without duplicating AGENT-002’s completion event; its acceptance journey verifies the bound post.

## AGENT-004 — Agent permissions and budgets

**Verification recipe.** a journey that exhausts a test agent's session budget and sees the next delegation refused with a visible reason.
2. Inherited from SEC-001: credentials are sealed, shown once, least-scoped, excluded from archives, re-entered on restore, rotated on demand and revoked on removal; an archive-then-restore journey proves no credential is exported and the restored connection needs re-entry.

## AGENT-005 — MCP server

**Verification recipe.** an MCP client journey that lists the tools, creates an issue and comments on it, and a refused read of a private-team issue for a non-member.

## AGENT-006 — Agent platform

**Verification recipe.** a sample agent registered from the docs that receives a delegation webhook and posts three activity types that render on the issue.

**Mechanism context.** Third-party agents register as Vector apps (OAuth with an `app` actor), receive delegation and mention events by signed webhook, post session activities (thought, action, question, result) and request input through a documented API, so new coding or ops agents plug in without changes to Vector. The same API is the callback channel for the runner-based providers of AGENT-009 (Claude Code and Codex on the buyer's runners), each run holding a token scoped to its one session.

## AGENT-007 — Ask Vector

**Verification recipe.** a journey on seeded data whose answer cites the right blocking issues, and a proposed bulk change that applies only after confirmation.

## AGENT-008 — Agent guidance

**Verification recipe.** a journey that edits team guidance and finds the new version in the next delegation payload.

## AGENT-009 — Provider delegation protocols

**Verification recipe.** one fixture journey per provider in which the fixture mirrors that provider's real API or runner protocol as the table names it and the journey drives all five steps end to end, including a signed provider webhook or callback and a refused unsigned one; plus a hosted run per provider on a test repository with the buyer-side setup from the docs, delegating one small issue and receiving one PR, recorded as hosted evidence.

**Mechanism context.** Vector delegates to each named coding agent through the mechanism below, configured by an Admin in Settings → Agents with the buyer's own provider account, keys and runners (INTEG-001); every mechanism supports the same five steps — start with the AGENT-001 context, progress into the AGENT-002 session, a question and its answer, cancel, and a PR returned and linked (GITHUB-003) — and the session records which provider call carried each step. Repositories must be connected through GITHUB-006 or GITLAB-001 first.

## API-003 — Complete public API

**Verification recipe.** an API journey that creates a project, cycle, milestone and three issues and pages through them, and a refused private-team read; plus a schema-coverage check that reads the published API schema and fails unless every object named in this clause has list (with cursor pagination and filters), get, create, update and delete operations, or a stated read-only reason for an operation it omits (for example creating a notification).
2. API-003 inherits PROJ-011's milestone field and complete public milestone object operations.

## API-004 — OAuth apps

**Verification recipe.** an authorization-code journey that grants read-only scope, a refused write, and an Admin revocation that ends the next call.

## API-005 — SDK and docs

**Verification recipe.** the SDK's example scripts run against a local installation in CI.

## WEBHOOK-002 — Webhooks for every object

**Verification recipe.** a destination subscribed to project updates and comments receives exactly those signed events.

**Mechanism context.** Webhook destinations can subscribe to create, update and delete events for issues, comments, reactions, projects, project updates, cycles, initiatives, releases, labels, customers, customer requests and agent sessions, filtered by team, with the delivery guarantees of WEBHOOK-001.

## DATA-012 — GitHub Issues and Projects import

**Verification recipe.** a run against a GitHub API fixture of a repository with a Project, milestones and comments whose reconciliation report matches source counts, and the DATA-017 scale run for a GitHub fixture of 50,000 issues across five repositories.

**Mechanism context.** An Owner or Admin imports from GitHub through a fine-grained token or the GitHub App (GITHUB-006): issues and pull-request references, comments with authors and times, labels, assignees, milestones (to milestones or cycles by mapping), Projects (v2) items, single-select, iteration and number fields (to status, cycles and custom fields), sub-issues and issue types, with attachment bytes fetched from GitHub's asset hosts, the same preflight, loss review, staged apply, reconciliation and rollback as DATA-006 and DATA-007, and an optional continuing sync (GITHUB-007). An API import is one migration (DATA-017): it pages the whole organization or chosen repositories itself, splitting into runs as needed.

## DATA-013 — Jira Cloud and Data Center API import

**Verification recipe.** a run against a Jira REST fixture with two projects, sprints and attachments whose reconciliation matches, and the DATA-017 scale run for a Jira fixture of 50,000 issues across six projects with cross-project Blocks and epic links.
2. DATA-013 inherits PROJ-011's sentence "Jira fix versions and Linear milestones import to milestones or releases (RELEASE-001) by explicit mapping": the Jira importer reviews that choice, assignments and reconciliation before shipping.

**Mechanism context.** An Owner or Admin imports directly from Jira Cloud (API token or OAuth) or Jira Data Center: projects, issue types, workflows mapped to statuses, epics to projects (their Jira status category To Do, In Progress or Done mapped onto project statuses in an explicit step, PROJ-016) or parents, sprints to cycles, fix versions to releases, components to labels, story points, custom fields, comments, worklogs reported as omissions, attachments with bytes, links (Blocks, Duplicates, Relates) and users matched by email, through the same reviewed staged runs as one migration (DATA-017), re-runnable so a second pass imports only issues created or changed in Jira since the first. DATA-013 inherits PROJ-011's sentence "Jira fix versions and Linear milestones import to milestones or releases (RELEASE-001) by explicit mapping": the Jira importer reviews that choice, assignments and reconciliation before shipping.

## DATA-014 — Linear API import

**Verification recipe.** a run against a Linear GraphQL fixture whose reconciliation includes projects, initiatives, attachment bytes, customers with their requests and each project's mapped status, and the DATA-017 scale run.
2. DATA-014 inherits PROJ-011's sentence "Jira fix versions and Linear milestones import to milestones or releases (RELEASE-001) by explicit mapping": the Linear importer reviews that choice, assignments and reconciliation before shipping.

**Mechanism context.** An Owner or Admin imports directly from Linear with an API key: teams, workflow states, issues, comments, attachments with bytes, projects, project updates, milestones, initiatives, cycles, labels, relations, customers with their domains, owners, statuses, tiers, sizes and revenue, customer requests, project statuses mapped by category (PROJ-016) and templates, through the same reviewed staged runs as one migration (DATA-017), paging Linear's GraphQL API within its rate limits and resuming after a limit or interruption. PROJ-001 inherits Linear project start and target dates, priority and project labels onto the native fields, checked in reconciliation, before Linear project import ships. DATA-014 inherits PROJ-011's sentence "Jira fix versions and Linear milestones import to milestones or releases (RELEASE-001) by explicit mapping": the Linear importer reviews that choice, assignments and reconciliation before shipping.

## DATA-015 — Plane, Huly and Shortcut import

**Verification recipe.** one fixture per source whose reconciliation report matches.

## DATA-016 — Transition sync

**Verification recipe.** a Jira fixture sync that mirrors a status change each way and stops at the configured end.

## DATA-017 — Whole-workspace migration

**Verification recipe.** a Linear GraphQL fixture of 50,000 issues across six teams with comments, attachment bytes and 5,000 blocks, duplicate and parent links of which at least 2,000 cross run boundaries, imported as a migration of at least thirteen runs delivered out of order, whose single reconciliation report matches source counts by team, status, project, cycle and assignee, binds every cross-run relation and reports zero pending; a second pass after the fixture changes 100 issues imports exactly those 100; and a file-based migration whose last run is never supplied finishes only after the owner accepts the pending list.

## DATA-018 — Old identifiers and links after a move

**Verification recipe.** after a Linear fixture migration, a journey that pastes a `linear.app` issue URL into search and opens the imported issue, follows `/alias/ENG-123` to it, and a signed GitHub fixture for a PR on branch `eng-123-fix-login` with "Fixes ENG-123" in its body that links and completes the imported issue once; plus a native `VEC-1` whose number collides with an alias and is never shadowed.

**Mechanism context.** Every imported issue keeps its source key (for example `ENG-123` from Linear or `PROJ-45` from Jira) as an alias that stays resolvable after cutover: pasting a source URL (`linear.app/<workspace>/issue/ENG-123/...`, `<site>.atlassian.net/browse/PROJ-45`, a GitHub issue URL) into search, the command palette or a Vector link opens the imported issue; `/alias/ENG-123` redirects to it for bookmarks; and a branch name, PR title or body, or commit message that names an old key ("Fixes ENG-123") links and moves the imported issue under GITHUB-003 and GITHUB-004 exactly as its Vector identifier would, while the owner keeps the alias active for each source prefix. An alias that collides with a native Vector identifier never shadows it: the native issue wins and the alias is reported in the migration report.

## SEC-001 — Integration credentials

**Verification recipe.** the SEC-001 archive-then-restore HTTP journey excludes source signing and webhook URL secrets, repository and outbound webhook secrets API tokens, the Slack paste-path token, the Slack signing secret, member Slack links and Discord webhook URLs; restored settings require credential re-entry or token replacement, and members re-link Slack.
2. The future manifest/OAuth Slack install, Events API, @Vector issue creation and explicit identity-linking cells remain SLACK-001’s; GitHub App and agent cells belong to SLACK-001, GITHUB-006 and AGENT-004.

**Mechanism context.** Every integration and agent credential (GitHub App keys, Slack and Teams tokens, provider API tokens, OAuth refresh tokens) is stored encrypted, shown once, scoped to the least access the feature needs, excluded from archives, re-entered on restore, rotated on demand and revoked when the integration is removed. The Slack bot-token paste path (SLACK-003), the Slack signing secret and member-confirmed Slack links (SLACK-004) and Discord webhook URLs are covered now. SLACK-001’s manifest/OAuth install, Events API, @Vector issue creation and explicit identity linking beyond the member-confirmed email link remain SLACK-001’s. SLACK-001, GITHUB-006 and AGENT-004 inherit these credential rules and their provider archive/re-entry acceptance cells before they ship.

## SEC-002 — Model and agent data handling

**Verification recipe.** a journey that turns off triage suggestions for one team and finds no model call for that team's items at the provider fixture; a check that every enabled model provider in `seed.json` externals carries a terms URL, a no-training statement and data categories; and a journey in which enabling a self-hosted model provider is refused until an Owner records its terms and confirms no-training, with the confirmation found in the audit log.

**Mechanism context.** Admins choose the model provider for triage suggestions, semantic search, Ask Vector and drafting (for example Anthropic, OpenAI, Amazon Bedrock, Google Vertex AI or a self-hosted model), see exactly which data categories each feature sends (declared in `seed.json` externals), can turn each feature off per workspace or team, and private-team content is never sent for members who cannot see it. Every model provider entry in `seed.json` externals names the provider's commercial or API terms URL, states that customer content is not used for training under those terms, and lists the data categories and retention; Settings shows that entry beside the provider choice, and a provider with no such entry (including a self-hosted model the Admin adds) cannot be enabled until an Owner records its terms URL and confirms its no-training status, which is audited (ROLE-005).

## SEC-003 — Erasure across integrations

**Verification recipe.** an issue deletion with a synced Slack thread and an embedding that removes both and lists the GitHub comment it cannot recall.

**Mechanism context.** Erasing a member or an issue (ROLE-012, ISSUE-010, DATA-011) also unlinks their Slack, Teams, GitHub and agent identities, removes their content from synced threads Vector posted, deletes cached previews and embeddings, and records which external copies (in GitHub, Slack or a ticketing tool) Vector cannot recall.

## PUSH-001 — Issue to spec

**Verification recipe.** a journey on a seeded bug with two Spool errors and a Zendesk ticket where the draft cites both, the assignee edits one criterion and approves, and the approved revision is attached.

**Mechanism context.** For an accepted issue, an agent drafts a spec: the problem in the reporter's and customers' words (CUST-001), the evidence (Spool errors, tickets, measurements), acceptance criteria written as checkable statements, the code areas likely affected (from repository search through GITHUB-006 or GITLAB-001), open questions and a test plan. The assignee edits and approves it; only an approved spec is attached as the issue's specification (PROJ-013) and used for delegation.

## PUSH-002 — Spec to tested PR

**Verification recipe.** an agent fixture that returns a PR covering two of three criteria with passing checks, and the issue shows one uncovered criterion and the session not done.

**Mechanism context.** When an issue with an approved spec is delegated (AGENT-001), the agent must return a PR whose tests map to the spec's acceptance criteria; Vector shows each criterion with the test that covers it, the CI result (GITHUB-005) and any criterion left uncovered, and refuses to mark the session done while required checks fail. A reviewer approves the PR in the code host.

## PUSH-003 — Verified deployment

**Verification recipe.** a merge fixture followed by a production deployment fixture that marks the issue deployed, and a second merge with no deployment that raises one question after the window.

**Mechanism context.** After merge, Vector follows the merged commit through CI and deployments (RELEASE-002, CI-001) and records when it reached production; if it does not deploy within the team's expected window, the assignee is asked why.

## PUSH-004 — Outcome verification before close

**Verification recipe.** a journey with a linked Spool error group whose rate drops to zero after the deploy fixture, producing a Verified proposal that the assignee confirms, and a second issue whose error persists and is proposed Not fixed.

## PUSH-005 — Customer follow-through

**Verification recipe.** a verified issue with two tickets yields two drafts; approving one sends one fixture message, skipping the other sends none.

## PUSH-006 — Blocked-work follow-up

**Verification recipe.** a blocked issue whose blocker owner is asked once, answers "Friday", and is asked again only after Friday; a stop instruction ends follow-ups.

## PUSH-007 — Plans with uncertainty

**Verification recipe.** a seeded project where the forecast's 50% and 85% dates match a reference calculation, and the chosen option is recorded with its assumptions.

**Mechanism context.** For a project, release or cycle, an agent uses historical throughput (REPORT-001), current scope, dependencies, unestimated work and people's capacity to propose two or three feasible scope/date options with confidence ranges and the assumptions behind them. The lead chooses; the chosen plan is recorded and later compared with what happened. It never ranks individuals.

## PUSH-008 — Incident follow-up loop

**Verification recipe.** a resolved-incident fixture that yields drafted follow-ups; approving two creates two linked issues and a weekly status post.

## PUSH-009 — Standups and cycle summaries

**Verification recipe.** a seeded day of activity whose summary cites every completed and newly blocked issue and no private-team issue in a public channel.

## PUSH-010 — Agent accountability ledger

**Verification recipe.** a journey that runs a triage suggestion and a spec draft, finds both in the ledger with costs, then pauses all agents and sees the next suggestion skipped.

## Provider setup paths

| Provider | Clause | Whose app | Setup path an Admin follows |
|---|---|---|---|
| Slack | SLACK-001 | the buyer's own Slack app | Settings creates the app through Slack's App Manifest API (`apps.manifest.create`, using a one-time app configuration token the Admin generates at api.slack.com/apps) or, without a token, opens Slack's "create app from manifest" page prefilled with the generated manifest; the Admin then clicks Install, which completes OAuth v2 back to the installation. |
| Microsoft Teams | TEAMS-001 | the buyer's own bot and Teams app | The Admin creates a bot in the Teams Developer Portal (Bot management) with the messaging endpoint Vector shows and pastes its app ID and client secret; Vector generates the complete Teams app package (manifest with bot ID, valid domains and resource-specific consent permissions, plus icons) for the Admin to upload in the Teams admin center as a custom app. |
| GitHub (Cloud and Enterprise Server) | GITHUB-006 | the buyer's own GitHub App | GitHub App manifest flow: Settings posts the generated manifest to the user's or organization's "new GitHub App" page, GitHub redirects back with a code, Vector converts it (`POST /app-manifests/{code}/conversions`) into the app ID, private key and webhook secret, then sends the Admin to the app's install page to choose repositories. |
| GitLab (.com and self-managed) | GITLAB-001 | a buyer group or project access token | API registration: the Admin pastes a group or project access token with `api` scope; Vector creates a project webhook on each chosen project (and a group webhook where the GitLab tier provides one) with a generated secret token. |
| Bitbucket Cloud | BITBUCKET-001 | a buyer workspace access token | API registration of repository webhooks with a generated secret. |
| Zendesk | SUPPORT-001 | a private Zendesk app | Vector generates a private Zendesk app package (ticket sidebar pointing at this installation) for upload in Zendesk Admin Center, and, with an API token the Admin pastes, creates the Zendesk webhook and trigger through the Zendesk API. |
| Intercom | SUPPORT-001 | the buyer's own Intercom app | The Admin creates an app in the Intercom Developer Hub; Vector shows the Inbox app (Canvas Kit) initialize and submit URLs and the webhook topics as copy fields and takes the app's access token and client secret. |
| Front | SUPPORT-001 | the buyer's own Front app | The Admin creates an app in Front's developer settings; Vector shows the plugin (sidebar) URL and webhook URL as copy fields and takes the app's API token and signing secret. |
| Sentry | ERROR-001 | a Sentry internal integration | The Admin creates an internal integration in Sentry with the webhook URL, scopes and resource subscriptions Vector shows, and pastes its token and client secret. |
| Datadog | ERROR-001 | a Datadog webhook | API registration: with an API and application key the Admin pastes, Vector creates the Datadog webhook with a secret header. |
| CircleCI, Vercel, Netlify, Cloudflare | CI-001, RELEASE-002 | provider webhooks | API registration with a provider token the Admin pastes once, or copy fields where the provider offers no webhook API. |
| Figma | DESIGN-001 | the buyer's own Figma OAuth app and plugin | The Admin registers a Figma OAuth app with the callback URL Vector shows; members connect their Figma accounts for previews. Vector generates the Figma plugin manifest with this installation in its allowed network domains, which an Admin publishes as a private organization plugin or members import from the manifest. |
| Notion, Google Drive, Microsoft OneDrive and SharePoint, Dropbox, Confluence | DOCS-001 | the buyer's own OAuth clients | The Admin registers an OAuth client in each provider's developer console with the redirect URL Vector shows (Google as an internal app of the buyer's Google Workspace); members then connect their own accounts. |
| Zapier, Make | CONNECT-001 | Run Edit Run's published apps | No Admin setup in the provider: a member adds the Vector app in Zapier or Make, enters the installation URL, and authorizes it by OAuth (API-004) on the installation; triggers register webhooks (WEBHOOK-002) on that installation. |
| Claude Code, Codex, Cursor, Copilot | AGENT-009 | the buyer's own provider accounts and runners | As AGENT-009's provider table states. |

## Coding-provider protocols

| Provider | Start | Progress | Question and answer | Cancel | PR returned |
|---|---|---|---|---|---|
| GitHub Copilot coding agent | Vector mirrors the issue to a GitHub issue in the chosen repository (GITHUB-007) with the context and assigns it to Copilot through GitHub's issue-assignment API (GraphQL `replaceActorsForAssignable` with the Copilot actor) | Copilot's draft PR events, commits and check runs through the GitHub App webhooks | Copilot asks in its PR; a member's answer posts as a PR comment mentioning `@copilot`, which resumes work | the provider's stop where GitHub's API offers one, otherwise unassigning Copilot and closing its draft PR; the session records which | Copilot's PR, linked by its branch and issue reference |
| Cursor background agent | Cursor Background Agents API `POST /v0/agents` with the prompt, repository, ref, auto-create-PR and a webhook URL and secret | signed `statusChange` webhooks and `GET /v0/agents/{id}` and `/conversation` | the agent's conversation; a member's answer is sent with `POST /v0/agents/{id}/followup` | `POST /v0/agents/{id}/stop` | the PR URL in the agent's target, linked to the issue |
| OpenAI Codex | the buyer's GitHub Actions runner: Vector dispatches the repository's Codex workflow (`openai/codex-action` running `codex exec`) through `POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches` with the session ID and a per-session callback token; or, for Codex cloud, an `@codex` comment on the mirrored GitHub issue | workflow run and job status through GitHub webhooks, plus AGENT-006 activities the run posts | `codex exec` runs non-interactively, so a run that needs input ends with a question activity; the answer dispatches a follow-up run on the same branch | `POST /repos/{owner}/{repo}/actions/runs/{id}/cancel` | the PR the workflow opens, naming the issue |
| Claude Code | the buyer's GitHub Actions runner: Vector dispatches the repository's Claude workflow (`anthropics/claude-code-action`) the same way; or a Claude Agent SDK runner on the buyer's own infrastructure that receives the AGENT-006 delegation webhook | AGENT-006 activities the runner posts, plus workflow status | the runner posts a question activity and waits; the answer reaches it by the AGENT-006 webhook | workflow run cancel, or the AGENT-006 cancel event that the SDK runner obeys within one minute | the PR the runner opens, naming the issue |
| Any other agent | AGENT-006 delegation webhook | AGENT-006 activities | AGENT-006 question activity and answer event | AGENT-006 cancel event | AGENT-006 result activity naming the PR |
