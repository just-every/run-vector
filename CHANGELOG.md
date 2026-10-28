# Changelog

## Contract reconciliation — 2026-10-28

API-004 provenance: ct reviewed `93ab66269b4f8fc4109d91504ccfe5233b563c5c` on 27 October 2026 and kept it PARTIAL. The archive policy rider is adopted from that ct review; exact-head ct re-judgment and guarded landing remain outstanding.

## 0.4.1 — 2026-10-21

- Backups restore into an installation whose database Run Edit Run Platform migrated. Platform's runner records each migration in its own `rer_migrations` ledger, which Wrangler cannot read; `rer import` (and `rer export`) ran `wrangler d1 migrations apply` regardless, which re-applied every migration and stopped at "Preparing archive schema" with `table workspace_settings already exists`. A local transfer now reads the migration ledger first: on a Platform-migrated database it leaves migrations to Platform's runner, refuses with `migration_ledger:unapplied:<file>` (or `migration_ledger:multiple`) unless every migration file is already applied, and never runs Wrangler; other databases are prepared by Wrangler as before. The listed version's backups and this version's own restore with every archived row, cell and file intact into Platform-migrated and native installations. Uses rer 0.2.77; recorded Base copies are unchanged.
- Slack and Discord channel notifications (SLACK-003): teams, projects and saved views post new triage items, new issues and status changes to a bound Slack channel or Discord webhook through the native outbound ledger, with visible failures and no repeats; a team or project can create its own Slack channel. Messages carry identifier, title, readable actor and status change, never description or comment bodies.
- Personal Slack direct messages (SLACK-004): a member links the Slack account found for their own sign-in email, then turns on direct messages for assignments and mentions, with Assign to me, Change status and Open actions on signed requests. Unlinking, member removal or removing the Slack credential stops every message.
- TanStack Start is patched for GHSA-qx66-fv34-fjm8.
- Apply migrations **0073–0074** after unchanged 0001–0072. 0073 adds channel destinations and bindings and replaces the native webhook trigger with the same events for existing webhook destinations; 0074 adds member Slack links and request replay keys, which archives exclude. Preserve additive schema and delivery ledgers on compatible-source rollback. RELEASE.json lists each migration's steps.
- Upgrade locally: stop your development process by PID, `rer export --output exports/vector.rer`, pull the release, `rer install`, `rer dev`. Hosted: take a backup with the authenticated Base transfer client below, pull, and `rer deploy` with the existing environment and custody files. Validate backup recovery in isolated empty resources before changing traffic.

Known issues and limits:

- Roles, private teams, guests and most external provider integrations remain incomplete; CONTRACT.md is the full target and records each clause's current status. Every admitted operator currently has owner authority. Slack app installation through its manifest, Events API, @Vector issue creation, Admin mapping of members and Microsoft Teams are not available; Slack and Discord credentials never travel in backups and need re-entry, and Slack members re-link, after a restore. Posted Slack or Discord messages cannot be recalled by local erasure.
- Local `rer setup` and `rer dev` still migrate with Wrangler. A local database carrying Platform's migration ledger is supported for backup and restore only, not for local development.
- Linear and Jira imports remain documented-format, synthetic-only; no actual owner export is claimed, and there is no Asana importer. Managed relay delivery and broad capacity are not proven here.
- Milestone grouping, calendar feeds, complete public milestone API operations and Jira/Linear milestone mapping remain future work.
- The deferral input uses the browser's time zone. Daily reporting preserves only observed aggregate history; days before measurement remain unknown.
- `rer export` refuses a hosted origin, and `wrangler d1 export` cannot read Vector's FTS5 tables. Use the authenticated Base transfer client shown in the 0.3.0 backup instructions, retaining the owner's cookie privately.

Product screenshot: `docs/retained-verification/ui/1440-app.png`.

## 0.4.0 — 2026-10-20

- The current intake assessment, Created/Subscribed/Activity work tabs and credential custody are recorded complete. Future agent-triage, private-team, mobile-app and provider obligations remain under their owning clauses.
- Backups from the previously listed Vector version restore through `rer import` with every archived cell and attachment byte retained, including destinations carrying Platform's migration ledger. Uses rer 0.2.74 and refreshed, recorded Base source.
- Hosted deploy can retire its unused bootstrap session: `POST /auth/signout` now returns the native Base **204** with an empty body. Session revocation and the browser sign-out action are unchanged; HTTP clients should accept success without requiring the former JSON wrapper.
- Personal time zones and working hours; light, dark and system appearance; automatic issue closing and archiving; project colors and emoji; daily aggregate cycle/project reports and final project snapshots.
- Reopened discussion threads notify participants who still follow the issue, with a dedicated preference.
- Project milestones: create, edit, reorder, complete and reopen dated milestones; assign issues and track progress. Project moves clear incompatible assignments, and milestone deletion preserves issues. Copy, Undo, bulk changes and native archives preserve milestone membership.
- Apply migrations **0065–0072** after unchanged 0001–0064. These add preferences, housekeeping and report history; 0068 copies every notification mute/candidate while widening its event types, 0069 lets a refused HTTP restore settle safely, and 0071 widens notification event kinds while copying all mute and pending-candidate rows. Migration 0072 adds milestones and nullable issue assignments; existing issues start without a milestone. Keep milestone data on compatible-source rollback. No historical daily facts are invented. Preserve additive schema, permanent history and terminal effect ledgers on compatible-source rollback. RELEASE.json lists each migration's steps.
- Upgrade locally: stop your development process by PID, `rer export --output exports/vector.rer`, pull the release, `rer install`, `rer dev`. Hosted: take a backup with the authenticated Base transfer client below, pull, and `rer deploy` with the existing environment and custody files. Validate backup recovery in isolated empty resources before changing traffic.

Known issues and limits:

- Roles, private teams, guests and external provider integrations remain incomplete; CONTRACT.md is the full target and records each clause's current status. Every admitted operator currently has owner authority.
- Linear and Jira imports remain documented-format, synthetic-only; no actual owner export is claimed, and there is no Asana importer. Managed relay delivery and broad capacity are not proven here.
- Milestone grouping, calendar feeds, complete public milestone API operations and Jira/Linear milestone mapping remain future work.
- The deferral input uses the browser's time zone. Daily reporting preserves only observed aggregate history; days before measurement remain unknown.
- `rer export` refuses a hosted origin, and `wrangler d1 export` cannot read Vector's FTS5 tables. Use the authenticated Base transfer client shown in the 0.3.0 backup instructions, retaining the owner's cookie privately.

Product screenshot: `docs/retained-verification/ui/1440-app.png`.

## 0.3.0 — 2026-10-19

What an owner gets:

- Writing and follow-up: structured issue descriptions with checklists and a description history you can compare and restore; comment threads with replies, resolve and reopen, and author-only editing; notifications for followers and deferrers; snoozes and personal reminders (Remind me); ten-second Undo of issue changes.
- Planning: ordered sub-issues with automatic parent progress; related issues, kept apart from blocking dependencies; copy an issue from the issue menu, the command palette or the API, optionally with its sub-issues and links; a shared manual order on lists and boards; per-person workload for a cycle or due-date window; project start date, priority, labels and health with its reason ("Urgent work is unassigned: VEC-3"); opt-in automatic cycle membership; automatic team cycle schedules that keep the next cycles ready.
- Current and My work: every Current filter and attention reason, with expired deferrals back in Needs decision; My work Created, Subscribed and Activity tabs; keyboard selection, property editing and palette commands.
- Intake: register a signal source and paste its secret webhook URL into a tool's POST action (Zapier, Make and UptimeRobot steps on the page), or use a signed sender; editable intake defaults for source reports.
- Move in: Plane CSV, Shortcut CSV and Huly JSON files through the same reviewed, staged import as Linear and Jira; Linear and Jira imports carry related issues.
- Mail: Managed hosting sends sign-in, invitation, assignment and mention mail through the Run Edit Run relay with no mail key; own-account hosting uses SendGrid. Sign-in prefills a valid `login_hint`.
- Start and docs: the one-line start `npx -y @runeditrun/rer dev just-every/run-vector`; the contract at `/contract` on the run site; rer 0.2.62.
- One plain catalogue sentence: "Track issues, plan projects, and keep software delivery moving."
- Checked before release (independent gate on `3208cd6`): the whole loop locally at 1440 and 390 and on own-account hosting with real email. A source report landed in Needs decision, was deferred and returned on time (and sooner when new evidence arrived), was declined or accepted with a reason and routed into Now; Current, My work, Board, saved views, Inbox, project health, cycle rollover, Command-K search, related issues, issue copies, cycle schedules and a Plane import all worked. On hosting, an invited teammate signed in from the emailed link (390), received the assignment email, and the owner received the mention email (DMARC pass, no comment text in the mail). A populated v0.2.0 install upgraded with its data. A hosted backup held hosted-only issues, comments and file bytes, and after removal and a fresh deploy it restored with everything intact (locally; see Known issues).

Not in this release:

- CONTRACT.md is the full Linear/Jira-class target; its Status table reads 93 done, 66 partial and 95 missing of 254 clauses (published: 81 done, 23 partial). Roles, private teams and guests, single sign-on, the audit view, GitHub/GitLab/Slack/Teams integrations, initiatives and roadmaps, reporting, mobile apps, real-time collaboration and coding agents are partial or missing.
- Homepage claims still ahead of the code: "alternative to Linear, Jira and Asana" is positioning only. There is no Asana importer, and the Linear and Jira importers are documented-format, synthetic-only (no real export has been supplied). Local invitations send no email; invite by email on a hosted installation.
- Not exercised by this release's gate: Managed relay delivery, a hosted upgrade from v0.2.0 (the upgrade was proven locally), hosted Cron timing beyond the minute schedule, and capacity.

Known issues:

- Restoring a backup into a hosted installation created with `rer deploy` is refused with `restore_bootstrap_not_pristine`: rer's owner claim leaves a second session, and Vector's restore admission requires exactly one. Restore a hosted archive locally with `rer import --input FILE --yes`.
- `rer export` refuses a hosted origin and `wrangler d1 export` refuses Vector's database (FTS5 search tables). Back up a hosted installation with Base's transfer client (below).
- The deferral return time is entered in your browser's time zone, while cycle times use the workspace time zone.
- v0.2.0's pinned rer 0.2.22 can stop `rer dev` with "Could not check local process ownership in time" on a busy computer; run it again.
- Automatic cycles are named by start date plus a short code, for example "Cycle 2026-11-02 · D68MS7".

Back up first: locally, stop dev and run `rer export --output exports/vector.jsonl`. For a hosted installation, put the owner's one `__Host-operator_session=VALUE` cookie in a mode-600 file and run `node node_modules/@runeditrun/rer/modules/portability/cli.mjs export --origin https://YOUR-ORIGIN --session-file /ABSOLUTE/PRIVATE/FILE --out /ABSOLUTE/exports/vector-hosted.jsonl` from the deploying checkout.

Migrations `0050` to `0064` apply in order after unchanged `0001`–`0049`: import steps, notification reason trigger, description history, follower events (0053 rebuilds two notification tables by copy, keeping every row), follow-ups and their indexes, comment threads, activity index, automatic cycle membership, sub-issue progress, workload, manual order, project fields, related issues and cycle schedules. RELEASE.json lists each one's upgrade step.

Upgrading: locally, stop dev, back up, pull, then run `rer install` and `rer dev`. Hosted installations made with `rer deploy`: back up, then `git pull --ff-only` and `rer deploy`.

Screenshot: `docs/retained-verification/ui/1440-app.png` (an issue in the app at 1440 px).

## 0.2.0 — 2026-10-16

### Upgrading from 0.1.0

- This is a breaking upgrade: the canonical local state path, toolchain requirements and meaning of the deployment command changed. Back up matching source, D1 records and R2 files; retain applied SQL, owner customizations and permanent ledgers. Apply migrations **0012–0049** in order after unchanged 0001–0011. Every migration and its buyer steps are listed in RELEASE.json.
- **Local data:** the legacy-state guard refuses `.wrangler/vector-dev`. Stop the runtime and follow [Local recovery](docs/LOCAL-RECOVERY.md) before setup: preserve a complete backup, then move `.wrangler/vector-dev` to `.wrangler/state` without overwriting an existing destination. v0.1.0 local checkouts contain sample data owned by `sarah@vector.test`; preserve that owner in `FIRST_OWNER_EMAIL`. If a failed first start wrote a guessed owner into `.dev.vars`, correct that setting using the recovery guide while retaining the other private values. v0.1.0's local `/signin` could fail to load a dynamically imported module; that historical failure is no reason to reset retained records or files.
- **Hosted controller installations:** follow [Hosted upgrade](docs/HOSTED-UPGRADE.md) and run `pnpm artifact:deploy` with the reviewed plan and existing resource identities. `pnpm run deploy` now invokes `rer deploy`, whose owner-account path targets `vector-projects-<environment>` resources. Using it does not update an old controller deployment. Validate backups and the existing installation's upgrade before changing traffic.
- **Destructive migration 0046:** every pending identity-dependency approval is deleted because it lacks attempt fencing. Owners must renew those approvals after upgrading. Established links remain. Migration 0045 adds identity-dependency ledgers; 0047 adds durable import-number reservations and never rewinds the prefix high-water mark; 0048 adds owner sign-in grant storage; 0049 repairs local step-up mail capture without adding a captured-mail UI or proving hosted delivery.
- Roll back only to source compatible with the retained schema and custody/erasure guards. Preserve terminal mail/webhook outcomes, imported originals and retirement journals, cycle snapshots, reminder receipts, identifier reservations and unresolved file custody. Validate any matching-source backup recovery in isolated resources first.

### Work, browsing and decisions

- Add Settings administration for teams, workflows, labels, projects and manual cycles, plus issue label and cycle commitment editing. Durable prefix reservations and team issue history keep consumed identifiers unavailable after failed writes or a released prefix (0013). Issue details also edit estimate, due date, expected outcome and customer impact through version-checked field updates; the due-date editor retains its draft after the operator's own update.
- Add daily issue lists with filtering, derived sorting, grouping, paging and parent filters; atomic bulk edits; parent authoring; saved list/board layouts; and separate per-operator controls for Issues, Board, Current, My work and Projects (0015–0017). The workflow board selects the sole team automatically, requires a choice when several teams exist, and supports keyboard status changes and a labelled phone column selector. Board requests use bounded status-grouped pages with complete SQL status totals; grouped paging orders the group key before sort and stable identity.
- Index issue identifiers and searchable text, comments, evidence, projects, labels and accessible saved views in the source transaction. Exact primary identifiers remain available during an index failure; other search failures remain visibly unavailable. Migration 0018 replaces derived rowid mappings with stable source IDs; pre-0018 readers are incompatible. Palette entries open accessible saved views directly.
- Retain the newest successful writing-editor and saved-view receipts across immediate reopening and older background responses; genuine stale conflicts preserve drafts. Mutation receipts update headings and import progress immediately. Document navigation closes outgoing private reads, and sign-out drains coordinated reads before revocation with visible retry on failure. Private attachment downloads keep live updates running.
- Improve keyboard focus and scrolling for boards and parent editing, long saved-view headings, triage selects and decision sheets, mention names and chips, relative times and narrow Inbox identifiers. History names changed fields with old and new values. Projects opens on the portfolio, project administration lives on each detail page, and Settings links directly to its sections.
- Add automatic scheduled cycle closure, default rollover, durable missing-next failures and immutable snapshots (0031). Cycle details show frozen scope; project history retains project-at-close facts. Identifier-only membership history and guards survive later edits and compatible-source rollback. Local proof does not establish hosted Cron timing.
- Add confirmed, version-checked native issue deletion and duplicate decisions with canonical repointing and undo (0033). Erase dependent content and import custody atomically while retaining anonymous replay identities, identifier-only history and durable pending file keys. Expanded live/erased source keys preserve independent custody; concurrent dependent mutations refuse with 409. Attachment cleanup checks settled writers and actual storage absence, with visible pending/failed receipts and scheduled recovery. Historical receiver envelopes and operator-entered reconciliation codes are erased while terminal protocol outcomes and attempt history remain.

### Collaboration and reminders

- Add private Inbox follows, stable-ID mention autocomplete, issue/event mutes, read/mark-all and a live unread count (0014). Assignments, direct mentions, followed comments, exact deferral returns and last-blocker changes deduplicate by recipient and event while respecting each cause's mute.
- Add optional assignment/direct-mention email through Base transactional mail with recipient preferences, minimal issue metadata, immediate submission and at most three attempts within 24 hours for definite rejection or rate limit. Accepted, development and uncertain outcomes never automatically replay; erasure and authority checks apply before submission.
- Add a persisted daily reminder clock in workspace time, defaulting to 09:00 (0032). Minute Cron creates Inbox-only due-today and first-overdue reminders with atomic deduplication, late/DST catchup and mutes. Preserve global delivered receipts, per-operator suppression history and identifier-only feature/time audits through deletion, rollback and archive restore. Hosted Cron delivery remains unproven.

### Imports, archives and erasure

- Add reviewed mapped CSV/JSON and Linear workspace CSV imports through native Base import-kit in Settings and the terminal. Runs preview once and publish up to 4,000 source rows in staged atomic batches, with exact progress, restart/resume, durable source identity, reconciliation reports/CSV and guarded whole-run rollback (0025–0026, 0035–0037). Later native work refuses rollback without writes; detached issues from personal-data erasure are explained and reported. Optional owner-produced Linear API-file enrichment adds original-author/time comments, safe HTTPS links and in-run blocks/duplicate relations.
- Add Jira Cloud All Fields CSV preflight, explicit mappings, complete omission review, in-run parents/Blocks/Duplicate relations, imported comments and searchable old keys. Optional named HTTPS attachment links are off by default and never fetched. Jira reuses staged-import storage without another migration. Linear and Jira remain documented-format, synthetic-only profiles: generator evidence covers 2,000 Linear issues and 300 Jira issues; no actual owner export has been supplied. There is no Asana importer or Jira service integration.
- Fix hosted Unicode import failures caused by D1's two-byte batch request encoding: SQL wire strings use lossless ASCII escapes and retained plans load in pages. A durable run's receipt and progress row publish together. Migration 0047 reserves complete reviewed issue-number ranges; older conflicting runs require reviewed rollback and a new preview, while existing issues and consumed numbers remain.
- Add local portable archives, original-file round trips, destination access/effect review, FTS rebuild and historical-delivery quarantine (0022–0023). Authenticated HTTP restore admits only a proven pristine bootstrap, atomically retires its exact native session/link, serializes storage settlement through the declared coordinator and requires fresh historical-owner sign-in after commit (0034). Repeating a committed create after a lost reply returns the same session's staging job. Stop local runtime before archive operations; local Worker HTTP proof does not establish hosted HTTPS acceptance.
- Add counts-only preview and confirmed imported-person erasure (DATA-011). One D1 batch retires identifying imported records, originals, report cells, comments and development mail across applied or pending runs; already-published issues remain and a pending run can finish without erased entries. Current members require operator removal first. Base retirement journals and reversal fences (0043–0044) survive rollback and archives; a supplied later erasure journal refuses a pre-erasure restore.
- Remove the unsupported `import.completed.v1` extension declaration; it had no shipped emitter. Preserve existing source/replay and deletion identities, and never replay historical notification or integration effects after import, erasure or restore.

### Runtime, access and deployment

- Adopt the public rer lifecycle, exact recorded Base selections and root setup manifest; retire replaced lifecycle wrappers and copied Base tests. Share private settings across browser setup, terminal setup and Vite, use canonical local state, and retain explicit legacy recovery. Source packing, trigger-aware SQL safety, bounded private-file operations, safe artifact custody and offline operations checks remain explicit.
- Development enters as the configured owner through private `RER_OPEN`, including legacy `--login`; there is no dev badge, toolbar, captured-mail inbox/outbox page or printed sign-in link. Open the owner entry before selecting a teammate in the same browser; signed-out entry is available. Preview serves production output with its ready address. Production build refuses development markers and embedded installation archives; the private dev key, settings, archives and runtime state stay off the public port.
- Fresh configured owners review `/setup` before the app; existing configured installations retain completion (0029–0030). The installed Lobby recognizes the persisted owner claim. Local invitations state that no email was sent and explain teammate entry; hosted invitations request step-up in place. The invitation-cancellation ledger is retained (0012); cancellation routes are not enabled.
- Add native signed owner claim and optional owner editor with permanent claim admission (0024). Adopt Base identity-provider, domain/step-up, provider-control and dependency-setup ledgers (0038–0042), then identity-dependency attempt fencing (0045–0046). `rer signin` provides hosted owner recovery using the deploying checkout's Cloudflare credentials (0048). Production requires configured email or an approved Auth SSO dependency; owner-account deployment has no setup-token claim. Remove remote installation from the browser installer and normalize display-name senders to their mailbox for sign-in preflight. Deployment removal empties owned attachments and removes resources in one confirmed operation.
- Keep owner-account `rer deploy` separate from the reviewed artifact controller. Add installer, README and slow-start journeys, shard push verification and retain the slow journeys on release tags and nightly. Remove redundant foundation/removal harnesses; the admin journey verifies persisted workspace time. CLAUDE.md delegates to AGENTS.md.
- Refuse legacy local state with a visible recovery guide before preparing private settings. A configured hosted owner without a setup token sees Sign in on the first landing request, before any health probe or bootstrap request.

### Integrations, brand and acceptance limits

- Add scoped native Base API tokens with transactional authority and safe usage/revocation, signed source ingestion with atomic issue/evidence/replay publication, and signed GitHub PR links without provider tokens or API enrichment (0027–0028). No bearer admission to documents, private files, deletion or administration is added. Restore excludes credentials and quarantines historical effects.
- Add durable outbound webhook histories with accepted/rejected/uncertain states and finite retries. Dispatch requires an enforcing deployment-owned `INTEGRATION_EGRESS` service binding. Test-double loopback transport proof rejects private-address and redirecting destinations; source adoption does not provision hosted egress and no live delivery is claimed.
- Adopt Base's native RER mail adapter for Managed sign-in, invitations and notifications. Managed Configure supplies its relay settings and private credential without a customer provider account; Free/Assisted choices and owner-account SendGrid deployment remain. Local setup requires no provider credential and hosted Configure refuses local-only mail. Retries respect `Retry-After`; failed authentication delivery revokes the issued link. **Managed-relay-shaped hosted acceptance is BLOCKED by Base patch `gr-base-162` and is not proven.** Provider-mail and source proofs establish no hosted relay sign-in, invitation delivery or DMARC claim.
- Carry the approved brand through the public homepage, repository-backed `/docs`, authentication/setup/error documents and app styling, with shared drawings and self-hosted brand fonts. Preserve approved homepage and Run page copy/assets. The 12 October owner decision lists Linear, Jira and Asana in `seed.json` and the approved positioning line; it does not promise feature parity or broaden importer evidence. This supersedes the earlier 8 October empty-replacements position for the listing only.
- Final toolchain pins: **rer 0.2.22, Node 22.20.0, pnpm 10.12.4**.

## 0.1.0 — 2026-10-07

Initial public source for Vector, a deployable, self-hosted issue tracker. Includes email authentication, first-owner workspace setup, operator invitations/removal, Current and My work, issue intake and triage, projects, dependencies, comments, private files, activity history and timezone settings.

Ships Cloudflare artifact preparation, setup/deploy/health commands, source integrity locks and local verification. Existing immutable migrations and behavioral assertions are preserved. Diagnostic reports are generated into ignored output directories.

Portable application export/restore and wider product, capacity and provider-delivery acceptance remain incomplete; see HANDOVER.md. This release requires explicit owner, mail and session configuration for production authentication; retain D1/R2 backups and applied migration history when updating.

## 28 October 2026 — Contract structure and historical judgments

The contract now owns the acceptance text and status, with generated acceptance and homepage claims. The following are historical source notes; the current Status table is authoritative.

Security, privacy and operational requirements are in BASELINE.md, and no product clause supersedes a baseline clause. Capacity and rate limits in seed.json remain estimates; a stated latency is a target until measured. Clauses marked *Policy* name intended replaceable behavior. Dated evidence distinguishes executed checks from unmet obligations.

Vector is a full Linear/Jira-class issue tracker for software teams. A team that runs on Linear, Jira Software or GitHub Issues and Projects — or on the up-and-comers Plane and Huly — can move to Vector and keep doing the whole job: fast keyboard-first issues, triage, cycles, projects, initiatives and roadmaps; roles and private teams; reporting; mobile apps; follow-up automation; and the integrations the category runs on (GitHub, GitLab, Slack, Microsoft Teams, Zendesk, Intercom, Sentry, Figma, Notion and the coding agents). Work flows from report to merged change and on to a verified fix: an accepted issue can be delegated to a coding agent that opens a tested pull request under human review, the deployment is tracked, and the issue closes only when the user-facing problem is shown to be gone.

**Buyer.** A US software team of 5 to 500 people — engineering, product and design, with support and leadership as readers — replacing Linear, a Jira Software project or GitHub Projects. Self-hosted on the buyer's own Cloudflare account, free and open source; money appears only as customer revenue in USD (CUST-005).

**Separation from sibling products.** Vector keeps the market's separation and links to its siblings rather than rebuilding them:

**Penny** owns the customer feedback board, public roadmap and public changelog (the Canny/Productboard job). Vector receives Penny requests as customer-request links on issues and hands shipped work back to Penny (CUST-001, CUST-003, RELEASE-003).

**HappyToHelp** owns the support inbox, **Orbit** the CRM, **Spool** error tracking, **Uptime** external checks and **Oncall** paging. Vector links their records to issues and reads their evidence (CUST-001, ERROR-002, PUSH-004) but never replaces them.

Cross-functional work management for non-software teams (the Asana, monday.com and ClickUp job) is not Vector's product; Vector is for software delivery.

The code host, CI runners and deploy platform stay GitHub, GitLab, Bitbucket and the buyer's CI; Vector owns work state, relationships and delivery evidence.

**Scope before this contract** was one business workspace of equal operators built around evidence-led intake decisions, issues, work streams, projects, dated cycles, saved views, search, in-app notifications and Linear/Jira file imports, with integrations, AI, roadmaps, roles, chat, mobile and real-time collaboration declared out of scope. Those clauses remain where they still hold, rewritten where the scope changed, and now form one part of the full job.

*Status:* done — `tests/e2e/core-runtime.mjs`.

*Status:* partial — `tests/worker/search-access.test.ts`, `tests/worker/removal-boundary.test.ts`, `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-access-journey.mjs` (rolePrivateCells), and the existing calendar/report/template/reference journeys apply current public/private scope to Owners, Admins, Members, Guests and Viewers.

*Gap:* Mobile payloads (MOBILE-001/002) and agent contexts (AGENT-001/005) inherit this rule when built; complete registered-door coverage remains ROLE-008. A receiving-clause browser census of Viewer exports/notifications, attachment bytes and webhook privacy transitions is not proved here.

*Status:* done — `tests/worker/first-run.test.ts`.

*Status:* partial — `tests/worker/base-auth.test.ts`, `tests/worker/role-matrix.test.ts` (invitations name their role, Members invite Members only while the workspace lets them, only Owners invite, promote or remove Owners and Admins, Admins remove Members and Members remove only themselves; removal is not yet a suspension (ROLE-011), reactivation and erasure are ROLE-011's and ROLE-012's, and native Guest invitations name their allowed teams (ROLE-003)).

*Status:* done — `tests/e2e/admin-workspace-time-journey.mjs`.

*Status:* partial — `tests/worker/removal-boundary.test.ts`, `tests/worker/role-matrix.test.ts` (removal revokes sessions, unassigns, transfers and rolls back as one unit, refuses the last Owner and, when a member leaves, transfers to the longest-standing remaining Owner, but today every removal also deletes the member's private views and anonymizes their references at once; suspension that keeps the name is open with ROLE-011 and the separate erase with ROLE-012).

*Status:* done — `tests/e2e/admin-team-journey.mjs`.

*Status:* done — `tests/e2e/admin-team-journey.mjs`, `tests/worker/role-matrix.test.ts`.

*Status:* done — `tests/e2e/admin-archive-team-journey.mjs`.

*Status:* done — `tests/e2e/admin-team-journey.mjs`.

*Status:* done — `tests/e2e/core-runtime.mjs`.

*Status:* done — `tests/worker/issue-deletion-relations.test.ts`.

*Status:* done — `tests/e2e/core-board-journey.mjs`, `evidence/keyboard-board/ISSUE-003/`.

*Status:* done — `tests/worker/issue-session-projection.test.ts`.

*Status:* done — `tests/worker/removal-assignment.test.ts`.

*Status:* done — `tests/e2e/core-runtime.mjs`.

*Status:* done — `tests/worker/dependencies.test.ts`.

*Status:* partial — `tests/worker/discussion-threads.test.ts`, `tests/worker/discussion-access.test.ts`, `tests/e2e/core-threads-journey.mjs`; `evidence/comment-threads/ISSUE-008/` (threads with ordered replies, resolve and reopen naming who and when, reopen on a new reply, author-only editing refused 403, and deletion by the author or an Owner or Admin with tombstones that keep replies are implemented; inline comments quoting description or document text are not built; team-owner deletion waits on ROLE-007, Guest limits on ROLE-003, inline images and video on ISSUE-024, and the Slack thread mapping on SLACK-002).

*Status:* done — `tests/worker/discussion-file-admission.test.ts`.

*Status:* partial — `tests/worker/issue-deletion-cascade.test.ts`, `tests/worker/role-matrix.test.ts` (the immediate permanent cascade, which only Owners and Admins run as the role matrix's permanent deletion. Gap, carried as release debt: until ISSUE-020's Recently deleted lands, Members cannot delete issues, their own included, because the only deletion today is irreversible and there is no creator exception; deletion by an issue's creator or, with the setting, its team's Members, Recently deleted and undo are open with ISSUE-020).

*Status:* done — `tests/worker/cycle-closure.test.ts`.

*Status:* done — `tests/worker/bulk-commands.test.ts`, `tests/e2e/core-stream-planning-journey.mjs`, `evidence/keyboard-planning/ISSUE-012/`.

*Status:* done — `tests/e2e/collaboration-events.mjs`.

*Status:* partial — `tests/e2e/admin-label-journey.mjs`, `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-access-journey.mjs` (Owners, Admins and Members create and apply workspace labels and only Owners and Admins rename, recolor or delete them (role matrix); Settings → Labels is written by Owners and Admins and is read-only for Members. Members create inline in the issue label picker or through session and scoped `/api/v1/labels` doors when the workspace permits it; Owners/Admins set the audited creation permission. Merging relabels issues, projects and saved-view filters atomically with one activity per changed issue. Gap: team labels and groups are absent).

*Status:* done — `tests/e2e/core-draft-journey.mjs`.

*Status:* done — `tests/worker/dependencies.test.ts`.

*Status:* done — `tests/worker/dependencies.test.ts`.

*Status:* done — `tests/worker/issue-deletion-relations.test.ts`.

*Status:* done — `tests/worker/issue-deletion-relations.test.ts`.

*Status:* done — `tests/worker/issue-deletion-relations.test.ts`.

*Status:* done — `tests/worker/issue-deletion-preimage.test.ts`.

*Status:* done — `tests/worker/source-ingest.test.ts`.

*Status:* done — `tests/worker/source-ingest.test.ts`.

*Status:* done — `tests/worker/source-ingest.test.ts`.

*Status:* done — `tests/e2e/core-runtime.mjs` (source, operator and policy provenance; TRIAGE-003 inherits agent provenance and its triage journey).

*Status:* done — `tests/e2e/core-runtime.mjs`.

*Status:* done — `tests/worker/source-ingest.test.ts`, `tests/e2e/core-runtime.mjs`, `evidence/issue-follow-up/INTAKE-006/`.

*Status:* done — `tests/worker/source-ingest.test.ts`.

*Status:* done — `tests/worker/source-ingest.test.ts`.

*Status:* done — `tests/worker/source-ingest.test.ts`.

*Status:* done — `tests/worker/intake-policy.test.ts`, `tests/e2e/core-intake-policy-journey.mjs`.

*Status:* done — `tests/worker/source-ingest.test.ts`.

*Status:* done — `tests/worker/current-disjoint.test.ts`, `tests/e2e/core-current-disjoint-journey.mjs`.

*Status:* done — `tests/worker/current-intake-pagination.test.ts`, `tests/e2e/core-current-intake-pagination-journey.mjs` (every expired deferral is included before bounded return automation drains; Needs decision shows totals and Show more through all 120 items at 1440 and 390, in CURR-007 order).

*Status:* done — `tests/worker/current-now.test.ts`, `tests/e2e/core-current-now-journey.mjs`.

*Status:* done — `tests/worker/current-next.test.ts`, `tests/e2e/core-current-next-journey.mjs`.

*Status:* done — `tests/worker/current-recently-done.test.ts`, `tests/e2e/core-current-recently-done-journey.mjs`.

*Status:* done — `tests/worker/dependencies.test.ts`.

*Status:* done — `tests/e2e/core-stream-controls-ranking.mjs`, `evidence/current-controls/CURR-007/`.

*Status:* done — `tests/e2e/core-current-journey.mjs`.

*Status:* done — `tests/e2e/core-stream-controls-journey.mjs`, `evidence/current-controls/CURR-009/`.

*Status:* done — `tests/worker/dependencies.test.ts`.

*Status:* done — `tests/worker/dependencies.test.ts`.

*Status:* done — `tests/e2e/core-stream-controls-journey.mjs`, `evidence/current-controls/WORK-003/`.

*Status:* done — `tests/worker/project-fields.test.ts`, `tests/e2e/core-project-fields-journey.mjs`, `tests/worker/project-fields-upgrade.test.ts`, `tests/worker/data-http.test.ts`.

*Status:* done — `tests/e2e/admin-project-cycle-journey.mjs`.

*Status:* done — `tests/worker/project-membership.test.ts`, `tests/e2e/core-project-membership-journey.mjs` (the project administration form has a Delete project control with cancellation and explicit confirmation; confirmed deletion detaches issues and preserves their identities and content. Gap PROJ-003: deletion is currently irreversible and must remain Owner/Admin only; the Member lead cell applies only after PROJ-017 supplies recoverable deletion, Undo and restore. This clause's membership-preservation acceptance does not require Member lead deletion).

*Status:* done — `tests/e2e/core-runtime.mjs`.

*Status:* done — `tests/worker/project-health.test.ts`, `tests/e2e/core-project-health-journey.mjs`.

*Status:* done — `tests/worker/project-risk.test.ts`, `tests/e2e/core-project-risk-journey.mjs`.

*Status:* done — `tests/worker/project-fields.test.ts`, `tests/e2e/core-project-fields-journey.mjs` (lifecycle, health, lead, contributing team, target-date range and label filters, including combined filters, use the same rows for health/lifecycle counts; native 1440/390 journeys also exercise priority order and list editing).

*Status:* done — `tests/worker/cycle-closure.test.ts`.

*Status:* done — `tests/e2e/admin-project-cycle-journey.mjs`.

*Status:* done — `tests/e2e/admin-project-cycle-journey.mjs`.

*Status:* done — `tests/e2e/admin-cycle-list-journey.mjs`.

*Status:* done — `tests/worker/cycle-closure.test.ts`.

*Status:* done — `tests/worker/cycle-closure.test.ts`.

*Status:* done — `tests/worker/cycle-closure.test.ts`.

*Status:* done — `tests/worker/cycle-closure.test.ts`.

*Status:* done — `tests/worker/search-access.test.ts`.

*Status:* done — `tests/worker/search-exact-admission.test.ts`.

*Status:* done — `tests/worker/search-access.test.ts`.

*Status:* done — `tests/e2e/dev-runtime.mjs`.

*Status:* done — `tests/worker/views-removal.test.ts`.

*Status:* done — `tests/worker/views-removal.test.ts`.

*Status:* done — `tests/e2e/core-keyboard-journey.mjs`, `tests/e2e/core-undo-journey.mjs`, `tests/worker/issue-undo.test.ts`, `evidence/issue-undo/VIEW-004/`.

*Status:* done — `tests/e2e/core-board-journey.mjs`, `evidence/keyboard-board/VIEW-005/`.

*Status:* done — `tests/e2e/core-palette-journey.mjs`, `evidence/keyboard-board/CMD-001/`.

*Status:* done — `tests/e2e/core-keyboard-journey.mjs`.

*Status:* done — `tests/e2e/core-stream-planning-journey.mjs`, `tests/e2e/core-keyboard-journey.mjs`, `evidence/keyboard-planning/CMD-003/`.

*Status:* done — `tests/worker/follower-events.test.ts`, `tests/worker/follower-last-blocker.test.ts`, `tests/e2e/core-follower-journey.mjs`, `tests/worker/source-ingest.test.ts`, `tests/e2e/collaboration-events.mjs`, `evidence/issue-follow-up/NOTIFY-001/`.

*Status:* done — `tests/e2e/collaboration-events.mjs`.

*Status:* done — `tests/worker/due-reminders.test.ts`.

*Status:* done — `tests/e2e/collaboration-preferences.mjs`.

*Status:* done — `tests/worker/due-reminders.test.ts`.

*Status:* done — `tests/e2e/collaboration-delivery-ui.mjs`.

*Status:* done — `tests/worker/github-links.test.ts` (signed PR linking from identifiers in the title or body; branch names and status rules belong to GITHUB-003).

*Status:* done — `tests/worker/github-links.test.ts`.

*Status:* done — `tests/worker/integration-api.test.ts`.

*Status:* done — `tests/worker/integration-authority.test.ts`.

*Status:* done — `tests/worker/outbound-webhooks.test.ts`.

Local portable archive commands use the landed Base D1/R2 engine. Mapped CSV/JSON imports, Linear's documented workspace CSV importer with optional owner-produced API-file enrichment, and Jira Cloud's supported All Fields CSV profile use Base import-kit through the same reviewed native adapter in Settings and the terminal. A reviewed run holds up to 4,000 source rows in a file of up to 4 MiB and publishes in staged, individually atomic batches sized by measured SQL admission (docs/MOVE-IN.md). The run is the unit of review and rollback, not the size limit of a move: a whole-workspace move is one migration (DATA-017) made of as many runs as the source needs, with relations resolved across all of them, one reconciliation report and a tested size of 50,000 issues. Linear and Jira are documented-format, synthetic-only profiles; generator evidence covers 2,000 Linear issues and 300 Jira issues. No actual owner export has been supplied, and hosted importer acceptance or capacity is not claimed. Authenticated HTTP restore into a pristine bootstrap uses Vector admission and a real coordinator with the unchanged Base engine. Local Worker HTTP proof includes exact native records/files and fresh historical-owner sign-in after atomic session retirement; hosted HTTPS acceptance remains separate. See docs/ARCHIVES.md.

*Status:* done — `tests/worker/data-http.test.ts`.

*Status:* done — `tests/worker/linear-import.test.ts`.

*Status:* done — `tests/worker/data-import-atomic.test.ts`.

*Status:* done — `tests/worker/data-import-atomic.test.ts`.

*Status:* done — `tests/worker/data-archive-failure.test.ts`.

*Status:* done — `tests/e2e/data-staged-cli.mjs`.

*Status:* partial — `tests/e2e/jira-public-journey.mjs`.

*Gap:* tests/e2e/jira-public-journey.mjs registers no tests and no push/pull_request Verify job or named scheduled job reaches it.

*Status:* done — `tests/worker/linear-api-import.test.ts`.

*Status:* done — `tests/worker/jira-import.test.ts`.

*Status:* done — `tests/worker/jira-apply.test.ts`.

*Status:* done — `tests/worker/imported-person-erasure.test.ts`.

*Status:* partial — `tests/worker/role-matrix.test.ts` (the registered matrix, private identifier 404 cells and next-request Viewer refusals), `tests/e2e/admin-access-journey.mjs` (workspace roles, rolePrivateCells and viewerRoleJourney). Owners alone change leadership roles; Admins manage Member/Guest/Viewer assignments; current sessions and retained bearer tokens use the current stored role.

*Gap:* Complete coverage remains ROLE-008; unbuilt matrix doors inherit their source clauses. Private 404 evidence is this clause's own case, separate from ROLE-002.

*Status:* partial — `tests/worker/role-matrix.test.ts` (current private and invited teams scope native, bearer, search, project, notification and document reads; privateVisibilityJourney), `tests/worker/search-access.test.ts` (exact/full-text and options scope), `tests/worker/outbound-broken-destination.test.ts` (privateChannelRouting: current team-only channels, generic notices and membership-gated DMs), `tests/e2e/admin-access-journey.mjs` (privateTeamJourney), `tests/e2e/admin-team-journey.mjs` (privateTeamRequest and privateAdminMetadata at 1440/390).

*Gap:* Private reads, membership withdrawal, identifier/search/Current/Created/Subscribed/Activity, counted CSV, exposed requests and team-only generic Slack delivery are implemented. The existing calendar, dashboard, Insights, template and reference journeys exercise their own private/Viewer cells. Browser attachment bytes and webhook privacy transitions remain unproved; their current network-edge and HTTP checks do not establish every-door browser acceptance. Unbuilt Slack unfurls inherit SLACK-005, mobile payloads MOBILE-001/002, documents PROJ-013 and agent contexts AGENT-001/005. Non-member Admins see private-team metadata, owners, membership, counts and privacy controls in Settings without content access; saved definitions re-evaluate current visibility without edits. Ruled archive behavior: Admin archives must exclude unreadable private-team rows and carry only an excluded-team count; Owner archives carry everything. BLOCKED ROLE-002(c): Base portability per-export row scope and manifest count are unavailable in rer 0.2.77; the safe Admin refusal remains until Base supplies them.

*Status:* done — `tests/worker/role-matrix.test.ts` ([ROLE-003 OPS-001 OPS-002] real Guest invitations and assignments scope native, bearer, search, project, notification and document reads to current invited teams), using `tests/worker/role-guest-journey.ts`: native invitation and role assignment, current invited-team reads across issues/streams/projects/reports/search/options/directory/views/cycles/notifications, queued mail, bearer API, exports/Settings/tokens refusals, hidden relations and Guest labels; the registry-driven every-role-matrix-row case keeps all inherited write cells with a real assigned Guest. `tests/e2e/role-ui-support.mjs` (exerciseGuestRoles), called by `tests/e2e/admin-access-journey.mjs`: named-team invitation/assignment, Guest issue/project/cycle/Account and labels at 1440/390 with axe/overflow checks. Private-team permissions remain ROLE-002. Guests cannot read indivisible historical aggregates or frozen snapshots containing currently hidden references; visible live facts are used by their live reports, and stored historical records are unchanged.

*Status:* missing.

*Status:* done — `tests/worker/role-matrix.test.ts` ([ROLE-005] native actions populate an immutable workspace audit view and exactly filtered CSV): existing sign-ins, role/membership changes, erasures, integration/token changes, automation, imports/exports and deletions, actor/time/action/opaque subject, all filters, exact CSV, retention and no edit/delete door; `tests/e2e/admin-audit-journey.mjs` (exerciseAuditView, exerciseAuditAccess): Settings view/all filters/CSV and denied Member/Guest page/API through real role assignment, at 1440/390 with axe/overflow checks. Team privacy changes inherit ROLE-002; suspension/reactivation doors inherit ROLE-011, separate full-person erasure ROLE-012, agent runs AGENT-001 and the automation-run framework AUTO-001. Existing automation and imported-person erasure doors are audited now. Previously erased legacy actors retain explicitly unknown opaque references; new events retain actor provenance.

*Status:* missing.

*Status:* done — `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-team-journey.mjs`.

*Status:* partial — `src/core/features/roles/doors.ts`, `tests/worker/role-matrix.test.ts` (every state-changing door is registered against one role-matrix row, a door with no row admits Owners only and Settings pages open as the matrix row says; the coverage check, auditing of refusals, the Guest Settings sweep and agents' own identities with ROLE-006 are open).

*Status:* done — `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-team-journey.mjs`.

*Status:* missing.

*Status:* partial — `src/core/features/settings/removal.ts`, `tests/worker/removal-boundary.test.ts` (removal revokes sessions and invitations, transfers led projects and owned shared views, and unassigns issues; the suspended state, kept names, the assignment choice, token, OAuth, passkey and push revocation, and reactivation are absent).

*Status:* partial — `src/core/features/settings/removal.ts`, `src/core/features/settings/removal-history.ts`, `tests/worker/removal-boundary.test.ts` (today's removal anonymizes the member's references in comments, activity and audit and deletes their private views as part of every removal; a separate erase action on a suspended member, its preview, the typed confirmation and the single audit entry are absent).

*Status:* partial — `tests/worker/role-matrix.test.ts` (viewerVisibilityJourney: real invitation, native/bearer registered work-mutation census with unchanged storage, private reads, Guest contrast, role transitions and own leave), `tests/worker/project-fields-upgrade.test.ts` (populated 0095 upgrade), `tests/worker/data-http.test.ts` (Viewer archive restore), `tests/e2e/admin-access-journey.mjs` (viewerRoleJourney at 1440/390). Migration 0097 stores Viewer in the role and invitation CHECK constraints; the door registry refuses work mutations, including a Member's next request after conversion. ROLE-013 stays partial under ct 25 Oct 04:20Z. `tests/worker/role-matrix.test.ts` ("current private and invited teams scope native, bearer, search, project, notification and document reads; Viewers remain read-only", worker-2, loading viewerVisibilityJourney): each of 136 native and 26 bearer work/administrative write doors returns 403 with all 245 snapshotted tables unchanged (request-budget counters excluded); bearer-use audit append is checked separately with prior audit rows unchanged. The same case positively reads workspace Labels and the issue label. `tests/e2e/viewer-role-journey.mjs` ("Owner invites a Viewer through named-team Settings; accepted sign-in reads public work without write controls at 1440 and 390" and "Viewer signs in and signs out through native account controls at 1440 and 390 and loses admission", administration through `tests/e2e/admin-runtime.mjs`) positively reads Labels on the issue and in Settings and performs native sign-in and sign-out at both widths, with overflow, serious/critical axe and hydration assertions. One-off persisted writes at native project PATCH, native integration destination POST and bearer project PATCH each fail the per-door storage comparison at `tests/worker/role-viewer-journey.ts` line 66; the normal journey passes. The earlier silent-pass report was not reproduced; the existing comparison already catches these writes. `tests/worker/role-viewer-census.ts` supplies explicit bodies and seeded identities for the original 136 native and 26 bearer mutations plus three Slack settings mutations and the OAuth callback (140 native state-changing doors in total), including raw file upload, own comment and description checklists, import review/apply and erasure confirmation; resource schemas validate the administration, initiative, release and view inputs. Both destination restore doors use active completed-restore fixtures with positive Owner grant/review controls and unchanged Viewer refusals.

*Gap:* Unresolved: (b) agent contexts apply Viewer visibility: a duty of AGENT-001/005 (missing, unbuilt), no Viewer assertion yet; (c) own passkey management for Viewers has no asserting test (carried by ROLE-010, missing). ROLE-013 re-proposes DONE only after PROJ-013 and agent-context Viewer assertions exist, or when ROLE-010 and those clauses name the inheritance in both documents and are asserted.

*Status:* missing.

*Status:* missing.

*Status:* done — `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-team-journey.mjs` (teamJoinPermissions and teamJoinReaderCells at 1440/390: public open/invite-only, private exposed request with no issue/search/membership, once-only approval, hidden 404, Owner/Admin assignment, Member team-owner refusal to add Viewer, Guest/Viewer join/request refusals, membership-mode audit). Private/Viewer cells use this receiving clause's own journey; ROLE-002/013 retain independent source-clause evidence.

*Status:* done — `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-team-journey.mjs` (teamCreationPermission and privateTeamCreationCells at 1440/390: both workspace values, current native and scoped API refusal for Guest/Viewer, next-request Member refusal, first team ownership, Owner/Admin private creation and one audit per change). Private/Viewer cells use this receiving clause's own journey; ROLE-002/013 retain independent source-clause evidence. The Member-created response and subsequent state assert `isPrivate === false`; D1 asserts `is_private = 0` in the Worker case and each 1440/390 teamCreationPermission iteration.

*Status:* missing.

*Status:* partial — `src/core/features/reactions/`, `tests/worker/role-matrix.test.ts` (viewerVisibilityJourney and registered matrix cells), `tests/e2e/collaboration-runtime.mjs` (description/comment add/remove, names, second-session five-second refresh and no notification at 1440/390), `tests/e2e/data-roundtrip.mjs` (portable reaction rows).

*Gap:* Slack thread reaction synchronization awaits SLACK-002.

*Status:* done — `tests/worker/description-history.test.ts`; `evidence/issue-writing/ISSUE-018/`.

*Status:* done — `tests/worker/subissues.test.ts`, `tests/worker/subissues-access.test.ts`, `tests/worker/subissues-import.test.ts`, `tests/e2e/core-subissues-journey.mjs`.

*Status:* partial — `tests/worker/issue-undo.test.ts`, `tests/e2e/core-undo-journey.mjs`, `tests/e2e/core-undo-properties.mjs`, `evidence/issue-undo/ISSUE-020/` (Native property, bulk, team/cycle and duplicate changes offer session-bound, version-checked Undo for ten seconds and append reversal activity. The 1440/390 journeys exercise status timestamps, assignee, priority, labels, cycle/team restoration, stale refusal and expiry; selectors wait for hydration and reversed team confirmations clear. Deletion/Recently deleted, intake decisions and other issue relation actions still lack Undo; retention, restore and purge remain unbuilt).

*Status:* missing.

*Status:* missing.

*Status:* done — `tests/worker/issue-copy.test.ts`, `tests/e2e/issue-copy-runtime.mjs`.

*Status:* partial — `src/core/features/discussion/routes.ts`, `tests/worker/discussion-file-admission.test.ts` (PNG, JPEG, WebP and GIF attachments upload and are served same-origin with an attachment disposition and `nosniff`; paste, drop, the upload command, inline display, the viewer, video types, `Range` responses and resumable upload are absent, and `src/core/features/markdown/ui/markdown.tsx` refuses image paths on the installation itself).

*Status:* partial — `tests/worker/description-history.test.ts`, `tests/markdown-rendering.test.tsx`; `evidence/issue-writing/ISSUE-025/` (browser description and author-only comment ticks, independent stale description ticks, revision/activity attribution and list/board/API counts are implemented; comment ticks use body checks; templates, documents, native mobile, live editing and role/private-team enforcement remain open).

*Status:* partial — `tests/markdown-rendering.test.tsx`, `src/core/features/markdown/editor/`; `evidence/issue-writing/ISSUE-026/` (the shared browser editor has slash and formatting commands, shortcuts, safe rich paste, tables, collapsible sections, syntax highlighting and code copy; raw HTML is not rendered. Inline file/image commands, provider previews, templates/documents and native mobile editing remain open).

*Status:* partial — `tests/worker/description-history.test.ts` (referenceScenario through the description/history registration), `tests/worker/role-matrix.test.ts` (ROLE-003 invited-team visibility), `tests/e2e/collaboration-references.mjs` (exerciseReferences), `tests/worker/data-http.test.ts` (portable restore), `tests/e2e/data-roundtrip.mjs`.

*Gap:* Project updates (PROJ-010), documents (PROJ-013), mobile links (MOBILE-001), DATA-018 aliases and historical/provider backlink backfill remain. `tests/e2e/collaboration-references.mjs` (referenceAccessCells at 1440/390 and HTTP) exercises private-source backlinks for Member/Viewer before membership, after addition and after withdrawal.

*Status:* missing.

*Status:* partial — `src/core/features/issues/repository.ts`, `src/core/features/issues/input.ts` (issues store an untyped key/value custom-field map and its changes reach activity through `src/core/features/issue-edit/plan.ts`; typed definitions, scopes, project fields, validation and the role rule are absent).

*Status:* missing.

*Status:* done — `tests/worker/related-issues.test.ts`, `tests/worker/jira-apply.test.ts`, `tests/worker/linear-api-import.test.ts`, `tests/e2e/core-related-journey.mjs`.

*Status:* missing.

*Status:* partial — `src/core/features/issues/mutations.ts` (manual acceptance chooses team, status and assignee; rules are absent).

*Status:* missing.

*Status:* partial — `src/core/features/operator-intake/input.ts` (one fixed internal intake form; configurable forms are absent).

*Status:* partial — `tests/worker/collaboration-mail.test.ts`, `tests/worker/role-matrix.test.ts`, `tests/e2e/integration-settings-journey.mjs`.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* done — `tests/e2e/core-runtime.mjs` (the public surface is the homepage, sign-in and declared auth routes, and unknown public paths answer 404 in the RENDER-404 check; the Penny link itself is CUST-001).

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* done — `tests/worker/my-work-tabs.test.ts`, `tests/e2e/core-my-work-tabs-journey.mjs`; `evidence/my-work-tabs/WORK-004/` (Created, Subscribed with a row Unfollow, and Activity are implemented at desktop and 390px, Created and Subscribed take the issue-view filters, display options and Save view, and every tab reads only the member's workspace; ROLE-002 inherits private-team narrowing and MOBILE-001 the mobile-app tabs journey).

*Status:* missing.

*Status:* done — `src/core/features/projects/milestones.ts`, `src/core/features/administration/project-milestones.ts`, `src/core/features/projects/ui/project-milestones.tsx`, `evidence/milestones/PROJ-011/`.

*Status:* partial — `tests/worker/project-fields.test.ts` (project planning and ordered milestones; exerciseProjectTemplates), `tests/worker/data-http.test.ts` (portable template structure), `tests/worker/project-fields-upgrade.test.ts` (populated upgrade), `tests/e2e/admin-project-cycle-journey.mjs` (`tests/e2e/project-templates-journey.mjs`: projectTemplatesJourney and nativeProjectTemplatesJourney at 1440 and 390; configured and zero-membership native Owners use native issue-team choices, and created projects retain milestones/issues after template deletion). Gap: Update cadence is stored and shown; its effect awaits PROJ-010/AUTO-005. Issue templates await ISSUE-016. `tests/e2e/admin-project-cycle-journey.mjs` (projectTemplateAccessCells) exercises current private-template visibility and Viewer creation/edit/application refusals at 1440/390 and HTTP. Default ADOPTED: team templates are visible only to their members; deletion preserves created projects. Member applications skip unavailable project labels and report their names. Application uses native services in order; an interrupted creation names the partial project for inspection before retry.

*Status:* partial.

*Status:* partial — `src/core/features/administration/projects.ts` (lead and cross-team issues exist; members, contributing teams and following are absent).

*Status:* missing.

*Status:* partial — `src/core/features/administration/schema.ts`, `tests/e2e/admin-project-cycle-journey.mjs` (a fixed lifecycle of Planned, Active, Completed and Canceled set by hand; named, ordered and colored statuses, the Backlog and Paused categories, team sets, removal with a destination and status import are absent).

*Status:* missing.

*Status:* partial — `tests/worker/project-membership.test.ts` (exerciseInitiatives: persisted Planned readback and retained hierarchy, roles and API checks), `tests/worker/role-matrix.test.ts` (every role-matrix row with a door), `tests/e2e/initiatives-journey.mjs` (initiativesJourney, 1440 and 390); `tests/worker/channel-notifications-scenario.ts` (initiativeChannels: public create then selected creation binding once at both provider edges, full private notice without actor or private text, chosen versus unselected events, each real provider edge once, replay, private content, actor access, revocation, uncertain and terminal results, restore holds); `tests/e2e/initiatives-journey.mjs` (initiativesJourney: rendered Planned state, Settings binding and bound initiative post, 1440 and 390); `tests/worker/initiatives-scenario.ts` (scopedInitiativeDoors: Members refused at the approval and Settings administration doors, Guests and Viewers refused at every scoped door, only this initiative’s approvals offered, approved Discord binding with chosen events, unapproved, display-name, stale and demoted refusals with no row, withdrawal by another editor); `tests/worker/channel-notifications-scenario.ts` (scopedInitiativeChannels: unapproved identities refused before any provider call, one Slack and one Discord post through the Member’s scoped binding with replay adding none, demoted and removed binders post nothing, a withdrawn approval drops the pending and later events, re-approval replays nothing until the Member binds again, approval and withdrawal audited; changed Slack workspace refuses saving without custody changes, stops pending and future posts, fresh approval replays nothing, and an explicit new binding permits subsequent work); `tests/worker/role-probes.ts` (channels.bind-initiative row through role-matrix.test.ts); `tests/e2e/initiatives-journey.mjs` (initiativesJourney: Settings approval control and the Member’s initiative-page binding with one bound post, 1440 and 390); `tests/e2e/data-integration-history.mjs` (populateIntegrationHistory and verifyIntegrationCategories through `tests/e2e/data-roundtrip.mjs`: an Owner-approved destination and the initiative binding saved through the scoped door retained in the portable archive, the sealed webhook excluded). ct judged af171d2d782a3787e43cd339867cc06dec89677f STAYS PARTIAL on 27 October 2026 under DONE-RIDERS rows 1, 6, 8 and 11; these added assertions address the three behavioral gaps, with fresh judgment and landing gates pending.

*Gap:* **INIT-001 unproved:** assertion sensitivity for approval refusal when the connected Slack workspace changes. Candidate landing, exact-SHA Run site and complete clean publication-scan proof remain outstanding. INIT-002 roll-ups remain separately assigned. **CT policy ruling, 27 October 2026 — REJECT WITH ALTERNATIVE for INIT-001-BIND-ROW.** A current Member who may edit an initiative may manage that initiative’s selected events and binding through a scoped initiative capability, using only an existing destination explicitly approved by an Owner or Admin for the intended initiative and permitted audience. Owners and Admins retain integration installation, credentials, channel creation, destination approval and broader Settings administration. Guests and Viewers receive no binding authority. An approved destination is identified by its provider, workspace and immutable channel identity; approval is not inferred from a display name, another unrelated binding or possession of a credential. The scoped capability cannot approve a destination, widen its audience, expose private-team work, alter another subject’s binding or acquire integration administration. Recheck current editor authority, destination approval, binding version, source visibility and channel safety when saving and immediately before posting. Withdrawal stops pending and future posts; fresh authorization never replays held events automatically. INIT-001 retains its expressly named SLACK-003 durable delivery and minimal-message inheritance. Public workspace-visible events may show the readable actor. Private or restricted events use the required generic notice without actor or private text. Every offered selected initiative event requires a usable public flow and once-only delivery proof. This policy accepts no completion; INIT-001 remains partial.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* done — `tests/worker/cycle-schedule.test.ts`, `tests/e2e/cycle-schedule-runtime.mjs`.

*Status:* done — `tests/worker/cycle-membership.test.ts`, `tests/e2e/core-cycle-membership-journey.mjs`.

*Status:* partial — Team/workspace releases have name, date, status and Markdown description; issues and projects form deduplicated scope with completed/total progress, open dependency blockers and linked PRs. Publishing records one activity per included issue and issue chips show release state. Native and scoped versioned doors use the existing release role row; Guests are refused on pages and every API door. A read-only workspace URL shares the visible scope. Evidence: `tests/worker/project-membership.test.ts` (only Owners and Admins delete a project; removal, archive and deletion preserve its issues; exerciseReleases), `tests/worker/role-matrix.test.ts` (every role-matrix row with a door), `tests/worker/integration-api.test.ts` (the versioned schema is published through the real app), `tests/e2e/releases-journey.mjs` (releasesJourney, 1440/390).

*Gap:* Slack/Discord release bindings are absent: the existing durable channel model binds issue-bearing team/project/view subjects. Jira fix versions import remains DATA-013. Conservative default: reopen a Released release before changing its scope.

*Status:* partial — Signed GitHub successful deployments attach environment and provider time by exact linked commit or merged-PR SHA, or ancestry from recorded non-forced push events. The team-selected production environment applies its chosen status once per issue/deployment; replay is inert. Evidence: `tests/worker/github-links.test.ts` (signed deliveries preserve links, automate team statuses and notify followers exactly once; exerciseGithubAutomation, exerciseGithubCommits, exerciseGithubDeployments), `tests/e2e/integrations/github-chain.mjs` (exerciseGithubChain, 1440/390).

*Gap:* GitLab environments, CircleCI, Vercel, Netlify and Cloudflare Workers/Pages have no receiver or signed fixture. Unrecorded ancestry, missing non-forced push proof and unknown SHAs remain unproven and never attach an issue.

*Status:* missing.

*Status:* partial — `src/core/features/issues/list.ts` (single-value filters per field; grouped and negated expressions are absent).

*Status:* missing.

*Status:* done — `tests/worker/manual-order.test.ts`, `tests/worker/manual-order-import.test.ts`, `tests/e2e/core-manual-order-journey.mjs`, `tests/worker/data-http.test.ts`.

*Status:* partial — `tests/worker/base-auth.test.ts` (calendar capability and shared month reader via exerciseCalendarCapability), `tests/e2e/calendar-month-journey.mjs` (calendarMonthJourney), run by `tests/e2e/cycle-report-runtime.mjs`. Gap: Timeline, dependency drawing and start-date combinations await ISSUE-022. Target-dated releases are included by current creator visibility: personal feeds carry own-team and readable workspace releases, and private-team releases require membership at each request. `tests/e2e/calendar-access-cells.mjs` (calendarAccessCells) asserts the readable team release in its team feed and excludes workspace releases and release descriptions. Team feed authority loss returns 404. Release channel binding remains RELEASE-001. `tests/e2e/calendar-feeds-journey.mjs` (calendarAccessCells at 1440/390 and HTTP) exercises current private-team omission and Viewer read-only month access. Calendar uses the feed event reader, workspace-local cycle days, native version-checked due-date edits and Undo. Guests retain the Calendar page refusal adopted for CAL-001.

*Status:* partial — `src/core/features/issues/ui/issue-board.tsx` (columns by status with a keyboard selector; swimlanes, drag and property choices are absent).

*Status:* partial — `src/core/features/views/service.ts` (saved issue views; project, initiative and request views are absent).

*Status:* missing.

*Status:* done — `tests/e2e/theme-runtime.mjs`, `tests/e2e/theme-contrast.mjs`, `tests/e2e/theme-control-contrast.mjs`, `src/core/app/ui/palette.css`, `src/core/app/app.css`, `src/core/features/settings/appearance.ts`.

*Status:* done — `tests/e2e/core-stream-planning-journey.mjs`, `tests/worker/bulk-commands.test.ts`, `evidence/keyboard-planning/CMD-004/`.

*Status:* partial — `tests/e2e/core-current-journey.mjs` (refresh within five seconds without reload; a live connection is absent).

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* partial — `tests/e2e/dev-runtime.mjs` (390px checks exist for current pages; new pages in this contract are open).

*Status:* missing.

*Status:* missing.

*Status:* done — per-event email and Slack choices, workspace defaults, hourly/daily email digests and working-hours admission; evidence is mapped per acceptance point in the Status table. Mobile push, desktop notifications and Teams direct messages are inherited by their named clauses.

*Status:* done — `tests/worker/notification-followups.test.ts`, `evidence/issue-follow-up/NOTIFY-008/`.

*Status:* done — `tests/worker/follower-events.test.ts` (line 406: the NOTIFY-009-tagged workflow-status-removal case calls exerciseSubjectSubscriptions in `tests/worker/subscriptions-scenario.ts`: ordinary Member Bob outside a public team is omitted from subjects, refused 403 `team_membership_required` with no row or new-issue notice; joining permits a subscription and one notice; leaving removes it, re-subscription is refused with no row or notice; a directly inserted pre-fix row is unavailable and delivers nothing), `tests/e2e/subscriptions-journey.mjs` (subscriptionsJourney at 1440/390: the Owner outside a public team has neither its picker option nor Subscribe to team; joining restores both and the picker subscribes successfully; each width restores its membership fixture), `tests/worker/project-membership.test.ts` ([PROJ-003 ROLE-001 RELEASE-001 INIT-001 NOTIFY-009] only Owners and Admins delete a project; removal, archive and deletion preserve its issues, calling `exerciseInitiatives` in `tests/worker/initiatives-scenario.ts`: a fresh initiative-only subscriber gets one creation notice, two after one status change, and still two after rereading), `tests/worker/role-matrix.test.ts` (current role-matrix doors), `tests/worker/data-http.test.ts` (native archive HTTP), and `tests/e2e/initiatives-journey.mjs` (1440/390). Default ADOPTED: self-only readable subjects; team subscriptions require current membership at selection, creation and delivery; Guests use invited-team subjects. The Worker helper asserts workspace-removal cleanup and status-channel development delivery. Portable preferences and history retain a destination-only historical replay cutoff. DONE-JUSTIFIED by ct (25 Oct 04:20Z). `tests/worker/follower-events.test.ts` ("workflow status removal notifies followers once without replaying terminal completion", worker-3, loading exerciseSubjectSubscriptions in `tests/worker/subscriptions-scenario.ts`): one fresh label-only Member with no issue-follow row has status email off and completion email immediate; creation produces one status notice and no delivery or mail, completion produces a distinct completed-only notice and exactly one development delivery and mail, and rereading preserves both notice and delivery/mail counts. Mapping completion to status fails the completed-causes assertion.  `tests/worker/follower-events.test.ts` (workflow status removal notifies followers once without replaying terminal completion, worker-3, loading exerciseSubjectSubscriptions): after genuine completion, remapping the completed status to another completed status adds exactly one status-only notice, no delivery or mail with status email off and completion immediate, and rereads retain all counts. The original (pre-0100) trigger fails at `tests/worker/subscriptions-scenario.ts` line 56 with completed instead of status; migration 0100 passes.

*Gap:* None.

*Status:* done — `tests/worker/personal-time.test.ts`, `tests/e2e/personal-time-runtime.mjs`, `src/core/app/viewer-time.tsx`, `src/core/features/settings/personal-time.ts` (members save a personal IANA zone or follow the workspace zone, including its later changes, plus working hours and working days; due reminders arrive at the workspace reminder time in each assignee's zone, exactly once; personal reminders, snoozes, deferral and expiry inputs and interface instants use the viewer's zone, named where it differs from the workspace's; workspace calendar days and date-only due and target dates are unchanged. Working hours are stored in `settings/personal-time.ts`; NOTIFY-007 and MOBILE-002 inherit their application to digest scheduling and push quiet hours before those capabilities ship).

Every background action in Vector has an accountable owner (the person or Admin who configured it), a due condition, durable progress, a visible failure state and an explicit stop. Repeated runs never duplicate issues, comments, notifications or customer messages.

*Status:* missing.

*Status:* partial — `src/core/features/due-reminders/service.ts`, `src/core/features/intake-return/service.ts` (fixed due reminders and deferral return; configurable rules are absent).

*Status:* done — `tests/worker/housekeeping.test.ts`, `tests/e2e/housekeeping-runtime.mjs`, `src/core/features/housekeeping/`, `src/core/features/notifications/events.ts`.

*Status:* missing.

*Status:* missing.

*Status:* partial — `src/core/features/due-reminders/service.ts` (due-today and overdue notifications only).

*Status:* partial — `tests/worker/cycle-report.test.ts` (Insights, shared dashboards and daily burn-up); `tests/e2e/insights-journey.mjs` (insightsJourney), run by `tests/e2e/cycle-report-runtime.mjs`.

*Gap:* Triage time (TRIAGE-001), SLA breaches (AUTO-004), customer tier (CUST-*), issue types and unavailable historical data; `tests/e2e/insights-journey.mjs` (insightsAccessCells at 1440/390 and HTTP) exercises Member omission and Viewer chart/count/drill/CSV reads after explicit membership. Bug series require a current Bug label. No /api/v1 series read. Default ADOPTED: Owners, Admins and Members read only visible issues; Guests refused.

*Status:* done — `src/core/features/project-report/`, `tests/worker/project-report.test.ts`, `tests/worker/cycle-report.test.ts`, `tests/e2e/project-report-runtime.mjs`, `tests/worker/data-http.test.ts`.

*Status:* done — `tests/worker/cycle-report.test.ts` (Insights, shared dashboards and daily burn-up), `tests/worker/dashboard-proof.ts` (exerciseDashboards), `tests/worker/data-http.test.ts` (portable definitions), and `tests/e2e/dashboards-journey.mjs` (dashboardsJourney, loaded by cycle-report-runtime in the runtime Verify shard). Each light/dark theme at 1440/390 selects both projects across chart, count and list: two exact small-project identifiers; 26 large-project matches with exactly 25 preview rows and the native full-list link showing all 26; matching project-filtered HTTP results; All projects restores the 28 owner-created matches. The added 26 issues are due outside 2026-11-02..05, preserving the existing one-issue date-range and member-created-scope assertions. dashboardAccessCells proves private omission at both widths and Viewer mutation refusals; after private-team admission, positive Viewer counts and identifiers are HTTP-asserted, rather than UI content assertions at both widths. Default ADOPTED: Owners/Admins manage any dashboard, Members their own, Guests refused; team sharing requires membership. Only definitions are stored; every read uses the viewer. The global date range filters issue due dates and intersects every saved widget; issue-list widgets show 25 with a link to the native full list.

*Status:* done — `tests/worker/workload.test.ts`, `tests/e2e/core-workload-journey.mjs`.

*Status:* missing.

Vector runs on each buyer's own Cloudflare account, so there is no shared Slack, GitHub or Teams app that reaches every installation, and Run Edit Run runs no event relay for them: each installation owns its provider apps, created for it by the provider's own app-creation flow, so its events and tokens never pass through a third party. Run Edit Run publishes only the apps whose provider requires a store listing and that call the installation by URL: the mobile and desktop apps with their push relay (MOBILE-004) and the Zapier and Make apps (CONNECT-001).

*Status:* partial — `src/core/features/integrations/ui/github-setup.tsx`, `src/core/features/integrations/ui/source-setup.tsx`, `src/core/features/integrations/ui/copy-field.tsx`, `src/core/features/integrations/test-webhook.ts` (Settings → Integrations exists for signed sources, GitHub repository webhooks and outbound destinations, with copyable payload URLs, reveal-once secrets and a test delivery; provider app creation, manifest flows, OAuth installs and the live first-event check are absent).

*Status:* partial — `src/core/features/integrations/reenter.ts`, `src/core/features/integrations/ui/delivery-setup.tsx` (credential re-entry after restore and outbound delivery state; health for inbound providers and in-place repair are absent).

*Status:* done — Copyable issue branch suggestions; branch/title/body references and closing/contributing words; version-checked per-team draft/review/merge/deploy rules; Git automation status activity and follower notifications commit with delivery replay receipts. Evidence: `tests/worker/github-links.test.ts` (signed deliveries preserve links, automate team statuses and notify followers exactly once; exerciseGithubAutomation: contributing-only PR link, follower Inbox outcomes and replay with exact recipients; exerciseConfiguredPrIsolation: non-default draft, review and merge outcomes for two teams and unchanged unconfigured work; exerciseGithubCommits, exerciseGithubDeployments), `tests/e2e/integrations/github-chain.mjs` (exerciseGithubChain: Owner rule saves, stale concurrency, branch copy and signed lifecycle at 1440 and 390), `tests/e2e/integrations/github-team-permissions.mjs` (exerciseGithubTeamPermissions: team-owner and ordinary Member saves, next-request revocation, visible stale and permission errors, Guest and Viewer refusals, personal Integrations), `tests/worker/role-probes.ts` (githubRuleProbes, registered by the role-matrix journey: filtered GET and native PATCH under both settings values).

*Gap:* Provider-backed create branch is tracked in GITHUB-008.

*Status:* done — Signed push events retain commit author text, first message line and a validated commit URL; non-default branches only link; default-branch closing words share the PR rule engine and apply once per issue/event and commit SHA. Evidence: `tests/worker/github-links.test.ts` (signed deliveries preserve links, automate team statuses and notify followers exactly once; exerciseGithubAutomation, exerciseGithubCommits, exerciseGithubDeployments), `tests/e2e/integrations/github-chain.mjs` (exerciseGithubChain, 1440/390).

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* partial — `tests/worker/outbound-broken-destination.test.ts` ([SLACK-001 SEC-001 ROLE-001] Owners create manifests and install Slack through actor-bound one-use OAuth with sealed credentials; [SLACK-001 ROLE-001] Owners and Admins explicitly map Slack members with audited changes; [SLACK-001 SEC-001 ROLE-001] Signed Slack Events create one issue as the linked member and refuse invalid intake; [SLACK-001 SEC-001] Slack archives exclude credentials and restore requires re-entry; [SLACK-001 SEC-001] Provider uninstall and local removal retire Slack credentials and revoke access), with `tests/worker/slack-app-scenario.ts`; shard worker-1. Public Settings APIs prove generated/prefilled manifest paths, Owner/Admin admission and Member refusal, encrypted credential reads, one-use/expired/wrong-actor state, grant validation and local removal/revocation. `tests/e2e/integration-runtime.mjs`, loading exerciseSlackAppInstallation from `tests/e2e/integrations/slack-app-installation.mjs` in hosted-artifact, proves Settings generated and prefilled app setup, OAuth installation, invalid-token errors, cleared secret fields, both local removal controls and unchanged removal after reload at 1440/390, with overflow, serious/critical axe and hydration checks. No hosted provider claim. Additional proof: `tests/worker/outbound-broken-destination.test.ts` ([SLACK-001 SEC-001 ROLE-001] Owners create manifests and install Slack through actor-bound one-use OAuth with sealed credentials; [SLACK-001 ROLE-001] Owners and Admins explicitly map Slack members with audited changes; [SLACK-001 SEC-001 ROLE-001] Signed Slack Events create one issue as the linked member and refuse invalid intake; [SLACK-001 SEC-001] Slack archives exclude credentials and restore requires re-entry; [SLACK-001 SEC-001] Provider uninstall and local removal retire Slack credentials and revoke access; Verify worker-1), loading `tests/worker/slack-app-scenario.ts`, `tests/worker/slack-events-scenario.ts` and `tests/worker/slack-app-recovery-scenario.ts`: both manifests carry installation-specific Events, interactivity, command, unfurl and OAuth configuration; signed URL verification and the first app_mention create exactly one issue in the bound team as the linked Member; unsigned, wrongly signed, stale, replayed and unmapped requests leave storage unchanged; Owner/Admin mapping is audited and removable while Member/Viewer management is refused; an installed app's secrets and ciphertext are excluded from native HTTP export, an independent restore requires app credential re-entry and retains identifier-only event receipts; app_uninstalled and tokens_revoked remove stored Slack keys and member links and disable destinations without a provider call. `tests/e2e/integration-runtime.mjs`, loading exerciseSlackAppInstallation from `tests/e2e/integrations/slack-app-installation.mjs` and exerciseSlackAppArchive from `tests/e2e/integrations/slack-app-archive.mjs` (Verify hosted-artifact), exercises generated/prefilled Settings installation, explicit mapping, first-mention issue and actor, local removal, independent restored empty credential fields and provider uninstall followed by a scheduled tick with no further Slack calls at 1440/390, with overflow, serious/critical axe and hydration checks. `tests/worker/role-matrix.test.ts` (current private and invited teams scope native, bearer, search, project, notification and document reads; Viewers remain read-only; Verify worker-2), through `tests/worker/role-viewer-census.ts`, supplies valid seeded inputs for both new mapping mutation doors and requires unchanged Viewer storage. Admin mapping riders in the named mapping phase (Verify worker-1): Admin mapping to another Admin or Owner is refused with unchanged links and audit; self, active Member and Guest mappings are accepted; targets read their Slack user/workspace IDs and revoke through personal Settings, including Guest/Viewer targets; Admin revoke and every map, re-map or unmap each add exactly one actor/target audit entry; a foreign Slack workspace is refused. The named Events phase (Verify worker-1) proves a mapped Guest receives Slack 403 with unchanged storage and native uninvited-team 404 with unchanged issues/receipts; demotion or public-door removal stops the next signed event without any storage write.

*Gap:* Hosted real-workspace installation remains unproved, pending the owner's Slack app console steps.

*Status:* missing.

*Status:* done — `src/core/features/integrations/channels/`, `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/channel-settings.mjs`, `tests/worker/role-matrix.test.ts`. Strict channel-safety fixtures, the built settings and create-channel journey at 1440/390, and the real-provider run passed; dated provider and cleanup transcripts are in evidence/slack-003/SAFE_PROVIDER.md, REAL_PROVIDER.md and CHANNEL_SAFETY.md. The role-matrix journey admits Owners and Admins and refuses Members and Guests 403 when a project created with Create Slack channel asks the bot for a channel, with no Slack call. The registry-driven `tests/worker/role-matrix.test.ts` case "every role-matrix row with a door" admits Owner, Admin and Member project bindings, refuses an unapproved channel before any Slack call, and refuses Guest. `tests/worker/outbound-broken-destination.test.ts` (channel notifications scenario) proves a Member binds an already-bound channel and its issue/status events post once. `tests/e2e/integrations/channel-settings.mjs` (`exerciseChannels`) proves the approved-channel choice and bound state at 1440 and 390, with overflow and serious/critical axe checks.

*Status:* done — `src/core/features/integrations/slack-dm/`, `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/slack-dm-settings.mjs`. The dated real-provider leg in evidence/slack-004/REAL_PROVIDER.md covered `users.lookupByEmail` and the message format only: no real direct message to a person and no live button click (pattern 3).

*Status:* partial.

*Status:* missing.

*Status:* partial — `src/core/features/integrations/source-ingest.ts` (signed generic source intake with replay identity; provider apps, linking and status sync are absent).

*Status:* missing.

*Status:* partial — `src/core/features/integrations/source-ingest.ts` (generic signed source intake; Sentry and Datadog adapters, resolution sync and regression handling are absent).

*Status:* missing.

*Status:* missing.

*Status:* partial — `src/core/features/links/repository.ts` (named HTTPS links; previews and provider connections are absent).

*Status:* done — `tests/worker/base-auth.test.ts` (removal revokes calendar capabilities), `tests/worker/calendar-feed-proof.ts` (exerciseCalendarCapability), `tests/worker/data-http.test.ts` (credential exclusion and restore), `tests/e2e/calendar-feeds-journey.mjs` (calendarFeedsJourney), run by `tests/e2e/cycle-report-runtime.mjs`.  `tests/e2e/calendar-access-cells.mjs` (calendarAccessCells), loaded by `tests/e2e/calendar-feeds-journey.mjs` through `tests/e2e/cycle-report-runtime.mjs`, asserts team-release name inclusion, workspace-release name and release-description exclusion, and team-feed 404 after authority loss; after private-team membership removal it asserts native release read 404 and personal feed 200 with the workspace release retained and the unreadable release name and description absent. Viewer month controls are checked at 1440 and 390; personal-feed rotation and revocation are checked over HTTP. `tests/worker/calendar-feed-proof.ts` (exerciseCalendarCapability), called by the existing tagged `tests/worker/base-auth.test.ts` entry, now asserts team-feed issue due-date, cycle and milestone events with their names, UIDs and dates; the mutation “Drop team due dates, cycles and milestones while retaining releases” fails these assertions. Target-dated releases are included by current creator visibility: personal feeds carry own-team and readable workspace releases, and private-team releases require membership at each request. Team feed authority loss returns 404. Default ADOPTED: 256-bit creator-bound capabilities, only SHA-256 hashes stored, shown once, current creator visibility, 404 after rotation/revocation or authority loss, no cookie and no-store. Credentials are excluded from archives; create new feeds after restore. Personal feeds include assigned work, own-team cycles, milestones for led or assigned projects and currently readable own-team or workspace releases; team feeds carry that team's releases and use contributing projects for milestones.

*Status:* partial — `src/core/features/integrations/api.ts`, `src/core/features/integrations/outbound.ts` (the API and webhooks they need exist in part; the apps are absent).

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* partial — `src/core/features/integrations/api.ts`, `src/core/features/integrations/outbound.ts` (scoped tokens and signed outbound events; app actors, delegation events and activity types are absent).

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* partial — `schema/api-v1.json` is published at `/api/v1/schema` and drives the explicit route/scope admission table. `tests/worker/integration-api.test.ts` validates the published route inventory and reports operation gaps; full schema-coverage acceptance remains owed. Native comment list/get/edit/delete, project cursor lists and deletion, full milestone operations and inherited issue assignment, cycle list/get/create, actor/filter-bound cursors and per-token 300/minute limits with Retry-After are implemented. The planning journey creates a project, cycle, milestone and three issues, pages them, and tests comment authorship, erasure aliases, scopes and invalidated cursors. Comment reads: `{id, issueIdentifier, body, version, author:{id, displayName}, createdAt, editedAt, url, maxBodyLength:100000, truncated:false}`; IDs are stable, times are ISO-8601 (`editedAt` nullable), the canonical URL opens the issue, bodies are complete, and native author aliases (including Removed operator after erasure) apply. Only comments on readable issues appear; deleted comments are absent, never content tombstones. Suspended-member display remains owed with the native product state under ROLE-012/OPS-004.

*Gap:* Idempotency keys and their concurrency/retention proofs; issue deletion through the native receipt/policy door; cycle update/delete; complete list/get/create/update/delete coverage for attachments, relations, labels, teams, workflow states, views, notifications and members; attachment bytes excluded by API-001; initiative and release deletion; documents PROJ-013, customers CUST-005 and customer requests CUST-001 not built; real private-team refusal under ROLE-002; full schema-coverage acceptance. API-001 published wording is retained pending a valid next-release amendment representation: the issued RELEASE.json fails its pinned validator and the schema has no NEXT envelope.

*Status:* missing.

*Status:* missing.

*Status:* partial — `src/core/features/integrations/outbound.ts` (issue created, updated and completed events).

*Status:* missing.

*Status:* partial — `src/core/features/data/import/jira.ts` (All Fields CSV file profile; the live API, attachment bytes, versions and Data Center are absent).

*Status:* partial — `src/core/features/data/import/linear.ts`, `src/core/features/data/import/api-file.ts` (workspace CSV plus an owner-produced API file; direct API, bytes, initiatives and updates are absent).

*Status:* done — `tests/worker/plane-huly-shortcut-import.test.ts`, `tests/e2e/data-staged-cli.mjs`, `tests/e2e/data-profile-journey.mjs`.

*Status:* missing.

*Status:* partial — `src/core/features/data/import/ids.ts`, `src/core/features/data/import/runs.ts`, `tests/e2e/data-staged-cli.mjs` (stable per-source import identities, staged runs with resume, repeat and rollback, and in-run relations; migrations, cross-run relation binding, the migration report, incremental re-runs and the 50,000-issue run are absent).

*Status:* partial — `tests/e2e/jira-public-journey.mjs` (imported issues show and find their source ID in search under DATA-007; URL resolution, alias redirects and Git magic words on old keys are absent).

*Status:* done — `tests/worker/data-http.test.ts`, `tests/worker/outbound-broken-destination.test.ts`.

*Status:* missing.

*Status:* partial — `src/core/features/issue-deletion/service.ts` (native, file and webhook erasure; posted Slack channel messages, already-sent Slack direct messages and Discord messages cannot be recalled by local erasure; member removal deletes SLACK-004 Slack links; synced-thread erasure, other external identities and embeddings are absent).

Agents serve the whole job beyond today's up-and-comers: an accepted issue becomes a spec, a tested PR and a verified deployment, and the issue closes only when the evidence shows the user-facing problem is gone. A named person stays accountable at every step.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* missing.

*Status:* partial — `src/core/features/dependencies/repository.ts`, `src/core/features/due-reminders/service.ts` (waiting state and due reminders; questions, promised times and Slack are absent).

*Status:* partial — `src/core/features/projects/service.ts` (explainable health and capacity risk; forecasts and options are absent).

*Status:* missing.

*Status:* partial — `src/core/features/cycle-closure/read.ts` (numeric closed-cycle summaries; written summaries are absent).

*Status:* missing.

Vector does not do these jobs, and buyers get them as follows (US-first):

**Code hosting, CI runners and production deploys.** Vector links to GitHub, GitLab or Bitbucket and the buyer's CI and deploy platform (GitHub Actions, CircleCI, Vercel, Cloudflare); it never hosts repositories, runs builds or deploys.

**Running coding agents.** Agents run in their providers' sandboxes (Claude Code, OpenAI Codex, Cursor, GitHub Copilot) or the buyer's own runners; Vector holds delegation state, context and evidence, never source checkouts or production credentials inside its Worker.

**Customer feedback board, public roadmap and changelog.** Penny.

**Support inbox, CRM, error tracking, uptime checks, paging.** HappyToHelp, Orbit, Spool, Uptime and Oncall, with [Porthole](https://github.com/just-every/run-porthole) as the Run Edit Run observability sibling, or Zendesk, Intercom, Front, Salesforce, HubSpot, Sentry, Datadog and PagerDuty through the integrations above.

**Cross-functional work management for marketing, operations and agencies.** [Pegboard](https://github.com/just-every/run-pegboard) is the Run Edit Run sibling for this job; buyers may also use Asana, monday.com or ClickUp. Vector serves software delivery.

**Wiki and design tools.** Project documents and specs are a target (PROJ-013, missing), alongside links to Notion, Confluence, Google Drive and Figma; Vector does not take on the company wiki or design-tool job.

**Timesheets, billing and capitalized-labor reports.** Not provided; buyers use Harvest, Toggl or Clockify linked by issue identifier, and REPORT-005 exports for finance.

**Enterprise service management (help-desk ITSM, change approval boards) and regulated validation.** Not provided; an issue status is not a legal approval or a compliance record. Buyers use Jira Service Management or ServiceNow alongside.

**Perpetual parity with every incumbent field and app.** Imports report every omission, and transition syncs (DATA-016) are bounded; Vector does not promise ongoing two-way parity with Jira or Linear.

**Buyer-branded mobile apps.** Members install Run Edit Run's store-listed apps and receive push through Run Edit Run's relay (MOBILE-001, MOBILE-002, MOBILE-004). A buyer who wants apps under their own name and developer accounts builds them from source and publishes them with their own Apple and Google push credentials; Vector does not publish to a buyer's store accounts for them (Linear does not offer branded apps either).

For local entry under BASE-ACCESS-001, `rer dev` prints `RER_SIGNED_IN` and a private `RER_OPEN` link. Opening `RER_OPEN` automatically enters as the configured owner with a real, key-gated Base session; legacy `--login` uses the same automatic owner entry. `--as` selects another declared dev persona or signed-out entry. Development has no badge, toolbar or captured-mail UI. Preview serves production output and prints its ready address without captured-mail sign-in. Existing mail storage, erasure guards and applied migrations remain intact. Production requires declared outbound email or an approved Auth SSO setup dependency; Vector’s documented path uses SendGrid, with `rer signin` retained for Cloudflare-credential owner recovery.

BASE-ACCESS-001 uses ordinary Base operator-auth for local and hosted sessions. Local development uses automatic owner entry through the private checkout key, exact origin/Host and a valid persisted SESSION_SECRET. Test local entry by opening `RER_OPEN` and reviewing `/setup`, then select a teammate or signed-out entry with `rer dev --as` in that browser. For hosted email sign-in, a confirmation GET does not consume a token; only POST confirms. There is no secret-free or vector.test auth dialect. BASE-ACCESS-002 retains independent document/API/generated-function/private-file admission and the captured actor/workspace/native session through the final SQL projection. BASE-OPS-002 preserves all applied SQL and proves populated 0018→0019→0020→0021 transitions; expiring obsolete transient development captures neither replays mail nor changes delivery ledgers.

The shared installer and terminal local setup preserve configured FIRST_OWNER bootstrap and saved settings. Owner-account deployment and the separate artifact controller retain distinct credential contracts. Local archive export/restore uses Base portability with destination access/effect review; mapped imports, scoped native API tokens (including project list/detail/create/update), registered signed source ingestion and GitHub PR links are implemented. Project start/target dates, priority and enabled workspace labels are editable from the project page, projects list and scoped API, with date validation and per-field activity. Portfolio filters for lifecycle, health, lead, contributing team, target-date range and label keep counts and rows aligned; roadmap editing and Linear project-field import remain requirements. Outbound dispatch requires Settings to identify the hosting account’s excluded domains for the built-in Base enforcing transport, or a deployment-owned enforcing RPC transport binding. Missing configuration remains visible; a failed send never switches transports.

Signed source ingestion implements INTAKE-001/002/003/008/009 and the source registration, rotation and revocation behavior of INTAKE-011 using Base's source audience signature and one native D1 publication transaction. Source/revision identities, exact-repeat results, terminal decisions, observed/receipt order and field-level changes survive restart. INTAKE-011 source management is accepted for today's Owners; ROLE-001/ROLE-003/ROLE-008 inherit the Owner/Admin-only restriction before additional roles ship. See docs/API.md and docs/INTEGRATIONS.md for routes, wire protocols, secret re-entry and the owner-held hosting/live boundary. The Jira file importer is not a live Jira integration: it makes no Atlassian requests and never fetches attachment URLs (DATA-013 is the target API importer).

*Status:* done — `tests/worker/owner-claim.test.ts`.

*Status:* done — `tests/worker/editor.test.ts`.

Gap PROJ-003: current deletion is irreversible and must remain Owner/Admin only; Member lead deletion is conditional on PROJ-017 recoverable deletion, Undo and restore. Membership preservation is proven independently

These rows state the implemented planning behavior; CONTRACT.md defines the full product target.

| Clause | Status | Proven behavior | Evidence |

| REPORT-004 | done | Cycle or due-date workload shows each active member’s assigned estimates and issue count, unestimated work, personal capacity and overload. Assigned issues stay with their accountable member, including work delegated to an agent. Agent delegation itself remains unbuilt under AGENT-001. | `tests/worker/workload.test.ts`, `tests/e2e/core-workload-journey.mjs` |

| VIEW-006 | done | Team lists and boards share manual order; saved views keep independent sequences. Drag, keyboard and move buttons persist across browsers without changing Current. Supported Jira Rank and Linear API-file sortOrder import, repeat, rollback and archive restore are proven with synthetic files; real owner exports remain unproven. | `tests/worker/manual-order.test.ts`, `tests/worker/manual-order-import.test.ts`, `tests/e2e/core-manual-order-journey.mjs`, `tests/worker/data-http.test.ts` |

| PROJ-005 | done | Active projects apply Blocked → At risk → On track → Unknown precedence using remaining work, workspace dates and active-cycle estimates/capacity; equality is safe, terminal scope is excluded and non-active lifecycles have no health. Unknown health names missing inputs. Named project status sets remain PROJ-016. | `tests/worker/project-health.test.ts`, `tests/e2e/core-project-health-journey.mjs` |

| PROJ-006 | done | Blocked and At risk projects expose the exact triggering issues, unresolved blocker pairs, target-date exposure and remaining active-cycle points against capacity. Blocked precedence retains concurrent risks; resolving the urgent blocker removes that trigger while preserving other exposure. | `tests/worker/project-risk.test.ts`, `tests/e2e/core-project-risk-journey.mjs` |

| CURR-003 | done | Now includes Started and overdue non-terminal work outside Intake, using the workspace calendar day. HTTP coverage crosses Los Angeles midnight and DST, excludes terminal and deferred work, and proves a timezone change leaves due dates intact; native browser journeys open the overdue work at 1440 and 390. | `tests/worker/current-now.test.ts`, `tests/e2e/core-current-now-journey.mjs` |

| CURR-004 | done | Next contains Unstarted issues due today through seven workspace calendar days ahead, or in their own team’s active or next open cycle. Midnight/DST, independent team schedules, exact cycle-end transitions and Now/Intake precedence are exercised over HTTP. The 1440/390 browser journey moves a cycle commitment from Next to Now through its native status selector. | `tests/worker/current-next.test.ts`, `tests/e2e/core-current-next-journey.mjs` |

| CURR-005 | done | Recently done includes completions from the whole seventh prior workspace date through the read instant, ordered by completion then identifier. HTTP tests cover midnight/DST, future completions, timezone changes, later edits and reopening; 1440/390 native journeys show ordinary priority ranking beside completion order and reopen completed work into Now. | `tests/worker/current-recently-done.test.ts`, `tests/e2e/core-current-recently-done-journey.mjs` |

| CURR-001 | done | Current places overlapping intake, started, overdue, cycle/due-soon and completed work in exactly one section, excluding canceled, duplicate, actively deferred and deleted issues. Public-route tests assert every section and a 1440/390 native journey moves Next work into Now without a duplicate row. | `tests/worker/current-disjoint.test.ts`, `tests/e2e/core-current-disjoint-journey.mjs` |

| PROJ-003 | done | Issue membership can be removed; archiving keeps membership and deletion detaches every issue without deleting its identity or content. The project page confirms deletion, supports cancellation and returns to Projects. Public-route tests and native 1440/390 journeys exercise these end states. Gap PROJ-003: current deletion is irreversible and remains Owner/Admin only. Member lead deletion is a PROJ-017 target after recoverable delete, Undo and restore; this done claim proves membership preservation. | `tests/worker/project-membership.test.ts`, `tests/e2e/core-project-membership-journey.mjs` |

| INTAKE-010 | done | Signed source assignee assertions become editable suggestions without assigning the issue. Missing or unavailable assignee suggestions leave it unassigned, with No priority and the team’s first Unstarted status. Hydration gates decision controls; 1440/390 journeys override all three choices and verify accepted records. Sources stay bound to their registered team. | `tests/worker/intake-policy.test.ts`, `tests/e2e/core-intake-policy-journey.mjs` |

| CURR-002 | done | Current includes every expired deferral while return automation processes bounded batches. Needs decision exposes a filtered total and Show more, reaching all 120 items in Current ranking at 1440 and 390. Future deferrals remain hidden even with a future as-of request. | `tests/worker/current-intake-pagination.test.ts`, `tests/e2e/core-current-intake-pagination-journey.mjs` |

| PROJ-007 | done | Portfolio filters by lifecycle, health, lead, contributing team, target-date range and project label, with matching health/lifecycle counts for each and combined filters. Priority sorting and list editing use the native project fields. | `tests/worker/project-fields.test.ts`, `tests/e2e/core-project-fields-journey.mjs` |

| PROJ-001 | partial | Start/target date validation, five priorities, project-enabled workspace labels and per-field activity work in project pages, list editing and scoped project API. Populated upgrades and archive restore retain them. Project custom fields, configurable statuses/primary teams, colour/icon editing, roadmap editing, Linear project-field import and Guest restrictions remain unbuilt. | `tests/worker/project-fields.test.ts`, `tests/e2e/core-project-fields-journey.mjs`, `tests/worker/project-fields-upgrade.test.ts`, `tests/worker/data-http.test.ts` |

| ISSUE-027 | partial | Visible native description/comment identifiers link with title/status; one retained backlink per source issue is scoped to its readers. Visible issue references refresh when rendered description/comment text or the issue revision changes and on focus/visibility return, with no clock poll or refresh started while hidden. Gap: Project updates (PROJ-010), documents (PROJ-013), mobile links (MOBILE-001) and DATA-018 alias resolution remain unbuilt. Native description/comment writes index one retained backlink per source issue and target; reader resolution follows current visibility. Conservative default: backlink creation admits only targets visible to the author at save. Historical and provider/import-created text resolves for readers but has no backlink backfill. | `tests/worker/description-history.test.ts` (referenceScenario through the description/history registration), `tests/worker/role-matrix.test.ts` (ROLE-003 invited-team visibility), `tests/e2e/collaboration-references.mjs` (exerciseReferences), `tests/worker/data-http.test.ts` (portable restore), `tests/e2e/data-roundtrip.mjs` |

| INIT-001 | partial | Three-level initiatives group projects across teams; graph revision fences cycles/depth, with native and scoped API role cells. Gap: Slack/Discord initiative bindings are absent: the existing durable model requires issue-bearing team/project/view subjects. INIT-002 roll-ups remain separate and are not implemented. | `tests/worker/project-membership.test.ts` (exerciseInitiatives), `tests/worker/role-matrix.test.ts` (every role-matrix row with a door), `tests/e2e/initiatives-journey.mjs` (initiativesJourney, 1440/390) |

| RELEASE-001 | partial | Team/workspace releases show scope, progress, blockers, PRs, state chips and read-only sharing. Gap: Slack/Discord release bindings are absent: the existing durable channel model binds issue-bearing team/project/view subjects. Jira fix versions import remains DATA-013. Conservative default: reopen a Released release before changing its scope. | `tests/worker/project-membership.test.ts` (only Owners and Admins delete a project; removal, archive and deletion preserve its issues; exerciseReleases), `tests/worker/role-matrix.test.ts` (every role-matrix row with a door), `tests/worker/integration-api.test.ts` (the versioned schema is published through the real app), `tests/e2e/releases-journey.mjs` (releasesJourney, 1440/390) |

| RELEASE-002 | partial | Signed GitHub deployments require recorded inclusion and apply production rules once. Gap: GitLab environments, CircleCI, Vercel, Netlify and Cloudflare Workers/Pages have no receiver or signed fixture. Unrecorded ancestry, missing non-forced push proof and unknown SHAs remain unproven and never attach an issue. | `tests/worker/github-links.test.ts` (signed deliveries preserve links, automate team statuses and notify followers exactly once; exerciseGithubAutomation, exerciseGithubCommits, exerciseGithubDeployments), `tests/e2e/integrations/github-chain.mjs` (exerciseGithubChain, 1440/390) |

| NOTIFY-009 | done | Personal team, project, initiative, label and saved-view subscriptions; independent matching, event deduplication, channels, access and departure/erasure cleanup. Gap: Default ADOPTED: self-only readable subjects; Guests invited-team subjects only; removal/suspension erases subscriptions. New matching issues use existing status channel preferences, completion uses its event channel. Portable preferences and history retain a destination-only historical replay cutoff. | `tests/worker/follower-events.test.ts` (exerciseSubjectSubscriptions), `tests/worker/project-membership.test.ts` (exerciseInitiatives), `tests/worker/role-matrix.test.ts` (every role-matrix row with a door), `tests/worker/data-http.test.ts` (native archive HTTP), `tests/e2e/subscriptions-journey.mjs` (subscriptionsJourney, 1440/390), `tests/e2e/initiatives-journey.mjs` (initiativesJourney, 1440/390) |

| GITHUB-003 | partial | Copyable branches and attributed, replay-safe draft/review/merge/deploy automation. Gap: Provider-backed create branch is tracked in GITHUB-008. A team-member rules screen is not exposed; native team-settings writes enforce both ROLE-009 values and refuse Guests. | `tests/worker/github-links.test.ts` (signed deliveries preserve links, automate team statuses and notify followers exactly once; exerciseGithubAutomation, exerciseGithubCommits, exerciseGithubDeployments), `tests/e2e/integrations/github-chain.mjs` (exerciseGithubChain, 1440/390) |

| GITHUB-004 | done | Signed commit links retain literal authors and apply default-branch closing once. | `tests/worker/github-links.test.ts` (signed deliveries preserve links, automate team statuses and notify followers exactly once; exerciseGithubAutomation, exerciseGithubCommits, exerciseGithubDeployments), `tests/e2e/integrations/github-chain.mjs` (exerciseGithubChain, 1440/390) |

| REPORT-001 | partial | Filtered weekly created/completed, throughput, cycle/lead time, status time and Bug-label inflow/age; viewer-scoped reads, exact bucket lists, neutralized CSV and SVG/text charts. Gap: triage, SLA, customer tier, issue types, unknown history and /api/v1 series. Private/Viewer cells: insightsAccessCells, 1440/390 and HTTP. | `tests/worker/cycle-report.test.ts` (Insights, shared dashboards and daily burn-up); `tests/e2e/insights-journey.mjs` (insightsJourney), run by `tests/e2e/cycle-report-runtime.mjs` |

| CAL-001 | partial | Personal and team ICS feeds include due issues, cycles and milestones. Hash-only, once-shown capabilities rotate and revoke; current creator authority is checked on every read; archives exclude tokens. Gap: releases. Private/Viewer cells: calendarAccessCells, 1440/390 and HTTP. | `tests/worker/base-auth.test.ts` (removal revokes calendar capabilities), `tests/worker/calendar-feed-proof.ts` (exerciseCalendarCapability), `tests/worker/data-http.test.ts` (credential exclusion and restore), `tests/e2e/calendar-feeds-journey.mjs` (calendarFeedsJourney), run by `tests/e2e/cycle-report-runtime.mjs` |

| REPORT-003 | done | Ordered saved-chart, count and issue-list widgets; private or team/workspace shared; global filters intersect definitions; results computed as the current viewer and never stored. Private-team and Viewer read-only cells proved by dashboardAccessCells at 1440/390 and HTTP. | `tests/worker/cycle-report.test.ts` (Insights, shared dashboards and daily burn-up), `tests/worker/dashboard-proof.ts` (exerciseDashboards), `tests/worker/data-http.test.ts` (portable definitions), `tests/e2e/dashboards-journey.mjs` (dashboardsJourney), run by `tests/e2e/cycle-report-runtime.mjs` |

| PROJ-012 | partial | Save project structure, edit templates and launch native projects/milestones/issues with relative dates; workspace and team planning permissions; Member label skips; portable structure. Gap: cadence effects PROJ-010/AUTO-005, ISSUE-016. Private/Viewer cells: projectTemplateAccessCells, 1440/390 and HTTP. | `tests/worker/project-fields.test.ts` (project planning and ordered milestones; exerciseProjectTemplates), `tests/worker/data-http.test.ts` (portable template structure), `tests/worker/project-fields-upgrade.test.ts` (populated upgrade), `tests/e2e/admin-project-cycle-journey.mjs` (projectTemplatesJourney at 1440 and 390) |

| VIEW-007 | partial | Month calendar shares feed events; drag and keyboard due-date changes use native version checks, activity and Undo; stale changes show a refusal without writing. Gap: ISSUE-022 timeline and releases. Private/Viewer cells: calendarAccessCells, 1440/390 and HTTP. | `tests/worker/base-auth.test.ts` (calendar capability and shared month reader via exerciseCalendarCapability), `tests/e2e/calendar-month-journey.mjs` (calendarMonthJourney), run by `tests/e2e/cycle-report-runtime.mjs` |

| GITHUB-008 | missing | Provider-backed create branch carved verbatim from GITHUB-003. Copyable names, signed linking, closing/contributing words, attributed replay-safe status moves, follower notifications and the Member-facing rules screen remain GITHUB-003 duties. | Requires GITHUB-006 and a provider write credential. |
