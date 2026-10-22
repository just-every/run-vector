# Notifications and outbound email

Vector's private Inbox records assignments, selected mentions, comments on followed issues, the return of the exact intake decision an operator deferred, and resolution of the last blocker on assigned work through implemented status transitions or explicit dependency removal. Due reminders for assigned incomplete work are Inbox-only. Inbox, follow and preference mutations do not change issue versions. A single event yields one row for each recipient and issue, retaining each unmuted qualifying cause. Actors never receive their own authored events; scheduled reminders have no operator actor.

Creators, assignees, commenters and selected mention recipients follow automatically. Explicit unfollow affects only the caller. Deleting a comment preserves followers. Issue and event-type mutes suppress future matching causes without deleting history or unfollowing. Unmuting does not backfill missed events. Email opt-out leaves Inbox active. Mutes and opt-out also suppress already committed but still-unsent mail at final admission; historical Inbox rows remain.

Mentions use autocomplete-selected stable operator identities in the actual Markdown source. Display names are not identity keys. Unknown and removed identities remain literal text. Code, escapes, images, links and raw HTML do not create mentions. Editing a body compares its committed previous mention set inside the source transaction; only newly added identities notify. Removing a mention does not retract history or its follow.

## Email configuration and privacy

Every current event type can create member-selected immediate email or an hourly/daily digest. Workspace defaults retain immediate assignment and mention email and Inbox-only delivery for other events; individual choices override those defaults. The pinned native Base mail facade supports SendGrid and the RER relay. Managed Configure supplies and hides `MAIL_PROVIDER=rer`, `MAIL_FROM`, `MAIL_RELAY_URL` and private `MAIL_API_KEY`; customers need no provider account or key. Free and Assisted retain existing provider options, and owner-account deployment remains SendGrid. `NOTIFICATION_EMAIL_ENABLED=false` disables product email. Otherwise it is available when the configured provider has `MAIL_API_KEY`, `MAIL_FROM` and a canonical HTTPS `APP_ORIGIN`, plus `MAIL_RELAY_URL` for `rer`. See [Managed source](MANAGED-SOURCE.md) for the relay contract, shared allowance and credential recovery. Each operator's email preference defaults on and can be disabled independently in Settings. Missing product capability creates no pending intent. Authentication still validates its own required configuration and fails closed; product preferences never disable required sign-in or invitation mail.

Explicit `MAIL_MODE=local-outbox` on localhost, 127.0.0.1 or ::1 captures notification messages through Base's development facade. Captures are separate from the authentication outbox and have no public reader or automatic network replay. This mode makes no provider request.

Mail carries the recipient address, full issue title, identifier, readable actor or automation label, and a canonical `/app/issues/:identifier` link requiring normal sign-in. It carries no description, comment, evidence, attachment, filename, signed reader URL or tracking pixel. Base disables SendGrid click and open tracking. With `rer`, the same minimal message passes through the RER relay to its provider; Vector sends no sender or installation ID and refuses redirects. An issue title therefore leaves the deployment through the declared transactional-email external. Keep sensitive prose in the issue body if it should remain inside the deployment.

## Delivery and recovery

The source mutation, followers, mention delta, Inbox event and unique delivery intent commit in one D1 transaction. A committed source mutation immediately drains its own event intents, bounded by the 100-operator workspace capacity, independently of older pending work. The existing Cron drains up to 20 pending intents and due retries per run. A durable conditional claim and attempt record allow only one dispatcher to submit a given attempt. Current recipient activity, issue existence, mutes, email preference and mail capability are rechecked immediately before initiating Base's send. The original actor signing out does not cancel already committed mail. Native session and workspace authority are rechecked after delivery before exposing the private HTTP response; losing access hides that response without undoing committed work or recipient mail.

Accepted and development results are terminal. Accepted means provider API acceptance, not mailbox receipt. Transport uncertainty, timeout, or an interrupted claim never triggers automatic resubmission. Cron marks claims older than five minutes uncertain. A late result may settle only its exact existing claim; it cannot recreate erased records. Settings shows failed and uncertain deliveries without exposing provider responses or offering unsafe resend.

A definite provider rejection or rate limit permits at most three total attempts within 24 hours. Only Cron retries, after one minute and then five minutes, delayed further when the provider supplies `Retry-After`; the three-attempt and 24-hour bounds still apply to relay rate limits and rejections. Local validation/configuration failure terminates promptly. Exhaustion is a visible failure. There are no sleeping request loops, fallback providers or automatic retries for uncertainty. Attempt and delivery records describe transport state. Accepted and development settlement also atomically writes a separate retained automatic-action audit containing only feature, time, issue identifier, outcome and an opaque attempt key. It contains no operator identity, address, actor name, title or body and survives issue or recipient deletion. Existing issue activity and audit history is not inflated by transport bookkeeping.

Operator removal atomically deletes their addressed Inbox, follow, mute, preference, intent, attempt and development-capture state, and anonymizes retained actor snapshots. Issue deletion cascades the new collaboration state. Once a network request has actually started, local erasure cannot recall that request; late settlement cannot resurrect erased local records. Vector does not claim atomicity across D1 and an external mailbox.

## Upgrade and rollback

Apply `0014_collaboration.sql` after all immutable earlier migrations. It backfills only recoverable creators, current assignees and commenters, with no historical mentions, Inbox events or mail. Existing deferrals acquire a decision link only when persisted history identifies one unambiguously. New deferrals always store their exact decision identity, including repeated equal deadlines.

Back up D1 and R2 and validate a populated previous-head upgrade on an isolated copy. For application-code rollback, retain all additive collaboration tables, claims, attempts and terminal delivery states. Never reset accepted or uncertain delivery state, replay development captures or rerun historical relationship backfill. Old application SQL remains compatible, but older application code does not produce new collaboration events. Native issue deletion and duplicate decisions use the existing cascade boundary; their operator flows and delivery erasure are described below. Signed source evidence append retains its independent source authority.

Issue titles, identifiers, and readable actors leave the deployment through Base transactional mail with the authenticated issue link; descriptions, comments, and attachments do not.

## Due reminders

Settings persists a daily reminder time beside the IANA workspace timezone, defaulting to 09:00. Every-minute Cron creates an Inbox reminder for an active assignee's incomplete issue on its due day at the first observed local time at or after that setting; a late Cron still catches up that day. The first run on a later local day creates one overdue reminder. Completed, canceled, duplicate and unassigned work and removed or native-inactive recipients are excluded. A skipped DST clock minute runs at the next observed eligible time, and repeated minutes cannot duplicate reminders.

The delivered ledger is keyed by issue, due date and internal due-today/overdue kind. Changing dates enables a new key; returning to an already delivered date, changing timezone or changing reminder time never resets one. Issue and due-reminder type mutes retain a separate suppression for that operator and occurrence, preventing their own backfill after unmuting while allowing another unmuted assignee to receive it. Each operator's suppression survives repeated reassignments; a delivered occurrence never repeats for any assignee. SQL rechecks observed settings, date, status, active recipient and mutes at commit. The receipt, Inbox row and identifier-only `due_reminder.delivered` feature/time audit commit atomically. The audit survives issue deletion; suppressed occurrences create no user-reaching audit. By default no activity, mail intent, development outbox or integration event is produced. An explicit NOTIFY-007 channel choice can route a due reminder to email or a linked Slack direct message after the same recipient, mute and access checks.

Apply forward migration `0032_due_reminders.sql` after 0031. It adds the workspace clock, delivered reminder ledger and recipient suppression history, and expands only the mute-kind CHECK while retaining existing preferences. Keep the setting, delivered identities, per-operator suppressions, feature audits and all prior schema on compatible-source rollback. Archives classify every column and retain reminder history; restored effects stay held until reviewed. Validate a populated upgrade and isolated matching-source D1/R2 recovery before traffic changes. Local scheduled tests establish behavior and normal minute-tick timing; hosted Cron delivery and capacity remain separate acceptance.

### Deleted issues

Native confirmed issue deletion atomically removes inbox rows, candidates/events, notification deliveries and attempts, development captures and restore mail holds through their existing cascades. Recipient preferences and issue-independent notification settings remain. Current issue/session admission prevents a late mail capture or submission from recreating private local state. An already invoked mail or webhook provider operation cannot be recalled; identifier-only mail audit and terminal webhook evidence survive. Webhook event/envelope payloads are erased and permanent event fences block later enqueue, claim and transport. Attachment cleanup completion is tracked separately in the authorized deletion receipt.

Issue deletion snapshots current Inbox state, finalized events, candidates, mail intents, attempts, restore holds and development captures. Their complete removal is a transaction postcondition, using captured IDs even after owner rows disappear. A concurrent public read/mute or transport state change requires a fresh deletion preparation. Identifier-only mail and due-reminder audits remain; deleted content and private preimages are never retained in the deletion receipt.

## Bound Slack and Discord channels

SLACK-003 channel posts use the native integration outbound ledger, rather than
personal email intents. The configured team/project/saved-view destination gets
one minimal post per selected new-triage, new-issue or status-change event.
Messages include identifier, title, actor, change and canonical issue link only.
No description or comment body leaves the deployment. See [Integrations](INTEGRATIONS.md)
for credentials, creation, the Discord host restriction, restore holds and
failure history. Removing a binding, deleting the issue or removing the binding
operator stops future posts; a started request may finish, and local erasure
cannot recall already-posted messages. Future project, release, SLA, agent and
initiative clauses inherit the same once-per-bound-event rule.

## Slack direct messages

SLACK-004 adds a Slack direct message beside assignment and mention mail. A member who
linked their own Slack account in Settings → Notifications chooses it separately for
assignments and for mentions; mutes, actor exclusion, active-recipient and access checks
apply exactly as they do to mail, at the source transaction and again before each send.
The intent lives in the native outbound ledger rather than the mail intents, and is
delivered immediately after commit like mail, with Cron retrying rate limits and
unanswered `conversations.open` calls at most three attempts. Uncertain results are never
resent; failures and uncertain results are listed to the recipient. Messages carry the
event, identifier, title, actor, status change, due date and the authenticated link, and
offer Open, plus Assign to me and Change status once the workspace's Slack signing
secret is entered. Removing a member deletes their link and scrubs their queued
messages. See [Integrations](INTEGRATIONS.md) for linking, signed actions and what
leaves the deployment. The NOTIFY-007 matrix now extends channel choices to every current event type. Push, desktop and Teams direct messages inherit MOBILE-002, MOBILE-005 and TEAMS-001.


## Per-event channels and digests

Settings → Notifications keeps Inbox delivery and lets each member choose immediate, hourly, daily or no email and linked Slack direct messages for each current event type. Owners and Admins set workspace defaults; a member can override a row or return it to inheritance. The separate email permission pauses all notification email without changing the saved matrix. Unavailable Slack connections are explained; push, desktop and Teams direct messages remain unavailable under their inheriting clauses.

Daily email collects events through the start of the member's working day and sends once in that local daily window. Hourly email collects through the start of its working-hour slot. Events after the cutoff, or outside working hours, carry to the next eligible window. Personal timezone, working days and hours apply to first submissions and retries; the workspace clock is used only when the member inherits it. A late scheduled tick catches up eligible queued work. A skipped clock minute uses the first real eligible instant; a repeated hour cannot repeat a slot.

When one Inbox event has several causes, its fastest selected email cadence wins; that notification appears in one email. Slack remains an independent channel.

A durable envelope and per-member/cadence/window reservation prevent competing dispatchers or an older retry plus new arrivals from producing two accepted digests in one window. Definitive rejection retries retain the existing finite retry policy; accepted, development and uncertain outcomes never replay. Settings shows failed or uncertain digest outcomes. Every constituent is rechecked immediately before sending against current access, recipient activity, actor exclusion, type/issue mutes, email permission and the saved channel choice. A digest contains only the same minimal issue fields as immediate email.

Apply forward migration `0081_notification_channels.sql`. Preserve channel choices/defaults, source routing receipts, envelopes, item ownership, attempts and window reservations on rollback. Archives omit claim secrets and quarantine historical effects; older restored Inbox events acquire routing receipts and never backfill the new channels. Deleting an issue removes its digest item and erases any captured digest containing it; payload-free envelopes and window fences remain. Member removal removes addressed digest state. Retained identifier-only delivery audits survive both.
