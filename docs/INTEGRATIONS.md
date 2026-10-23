# Native integrations

Settings / Integrations manages named API tokens, secret-URL and signed sources, immutable
outbound destinations and GitHub repository receivers. Configuration requires
the current native operator/session/workspace and destination restore grant.
Credentials are revealed once. Token values are hashed by Base; source,
destination and GitHub signing values are encrypted at rest with AES-GCM bound
to their identity, using the installation SESSION_SECRET. Keep that secret
private. After changing it, rotate sources and revoke/re-register destinations
and repositories; old encrypted values cannot be recovered with the new key.

## Secret webhook URLs (no code)

Register a source in Settings → Integrations → Signal sources and copy its secret
webhook URL into a tool’s POST action. The page has complete Zapier, Make and
UptimeRobot steps. Anyone holding the URL can send reports: keep it private.
The URL credential is encrypted separately from the signing secret and excluded
from archives. Replacing the URL invalidates the old URL immediately; revoking
the source disables both options. URL replacement does not rotate the signing key.

Send a JSON object, URL-encoded form fields, or plain text. A `title`, `subject`,
`message`, `name` or UptimeRobot `monitorFriendlyName` supplies the title.
`summary`, `message`, `text`, `alertDetails`, `details` or `description` supplies
the details. Vector defaults the selected team and receipt time. Optional
`sourceRecordId` (also `recordId`, `id`, `ticket_id`, `monitorID`) keeps updates
on one issue; `sourceRevisionId`, `revisionId` or `event_id` identifies an update.
Without revision IDs, identical payloads reuse their receipt. Without record
IDs, changed payloads create separate issues. `observedAt`, `timestamp`,
`alertDateTime` or `updated_at` can supply an observation time.

This unsigned endpoint uses the same bounded body, atomic issue/evidence commit,
revocation, restore, replay, archived-team and deletion checks as signed ingest.
It requires no browser session, bearer header or development checkout key.

## Signed sources

Register a stable source ID and an active Intake team. Save the returned secret,
receiver, signed tenant and source IDs with the producer. Use Base's actual
`createWebhookProtocol` with hex-decoded key bytes, event `signal.revision`, and
the returned tenant/source audience. Source records require `sourceRecordId`,
`sourceRevisionId`, `observedAt`, native `teamId`, title and the documented intake
fields. Assertions explicitly carry `{value, attribution: "source"}`; they stay
source claims rather than established facts. An optional `assertions.assigneeOperatorId`
with `{value: "NATIVE_OPERATOR_ID", attribution: "source"}` supplies an explicit
assignee suggestion for INTAKE-010. It is offered only while that operator is
available in the workspace; it never assigns the Intake issue. Without one,
acceptance starts unassigned with No priority and the team’s first Unstarted
status. The triager can edit all three before accepting. A source always uses
its registered team. Rotation allows a selected overlap
of zero to 24 hours; revocation and expiry deny both new and repeated requests.

The receiver bounds exact raw bytes and verifies before parsing. Signature or
unknown/revoked source failures return 401, invalid input 400, archived team or
changed reused identity 409, deleted native business identity 410, and failed
durability 503. Source identity, native Intake/evidence and processed marker
publish atomically with current key/config/team fences. Exact repeats return the
original result across restart. Observed and receipt times remain distinct;
out-of-order evidence is visible with field changes and source identity. Evidence
does not reopen terminal decisions. Native issue deletion replaces external record/revision identifiers with domain-separated hashes in retained source identity rows, preserving payload-hash conflict precedence and 410 replay refusal. The explicit live/erased discriminator participates in source-record and revision-receipt primary keys, so any raw input remains distinct from an anonymized digest. These anonymous identities survive secret rotation and archive credential exclusion. No external provider is contacted.

## Outbound delivery

Destinations accept public HTTPS addresses. Issue-created, issue-updated and
issue-completed activity generates a minimal durable event; mapped imports and
archive restore do not. Stable native business identities prevent duplicate
enqueue. Payloads contain the issue identifier/version/title/status/time,
without private attachments or credential values.

Enable delivery in Settings → Integrations → Outbound webhooks. The page asks
for the Cloudflare account ID and a token with Account / Workers Scripts / Read
and Zone / Zone / Read for the hosting account and all its zones. Vector reads
the account’s workers.dev subdomain and complete visible zone inventory, verifies
that the installation address belongs to that account, and stores only the
excluded hosting domains encrypted beside its integration credentials. The token
is used only for fixed Cloudflare read endpoints and is never saved. Renew this
setup after adding hosting domains or restoring an archive; credential exclusion
leaves restored delivery disabled. Choose a token that includes every account
zone; a token restricted to selected zones cannot provide a complete inventory.

The installation uses Base's enforcing `EgressTransport` inside its Worker.
It checks all DNS answers, refuses private/reserved and hosting-account
addresses, pins a public address with rustls certificate/name checks for
non-Cloudflare destinations, and uses the existing all-Cloudflare platform-fetch
route when all answers are Cloudflare addresses. That route resolves again and
relies on platform private-address refusal and the destination zone's origin TLS
policy; it does not promise an application address pin or origin certificate
verification. Neither route follows redirects or falls back after failure.
The existing deployment-owned `INTEGRATION_EGRESS` service binding and
`public-dns-pinned-tls-v1` policy remain supported as an alternative composition.

Each destination has **Send a test**. It creates one durable `vector.test` event
without editing issues, signs it using the generated destination secret, and
shows its actual delivery state. **Accepted** means the receiver returned a
successful HTTP status; check the receiver for the same event ID. A lost
acknowledgement is uncertain and is never automatically replayed. A receiver
must support Vector's signed payload format (the exact signing format is shown
on the page); a provider's incoming webhook may require an adapter.

Base DeliveryService and the native repository retain attempts, backoff and
cooldown across restart. Queued/sending/accepted/rejected/uncertain are actual
durable states. Accepted means a receiver acknowledgement, not a claim about its
downstream work. Ambiguous sends become uncertain and do not retry under fresh
IDs. Reconcile only from independent receiver evidence, using a safe evidence
reference in Settings. Destination revocation/configuration and restore holds
are rechecked before preparing and sending.

The local composition journey uses the real native queue and the egress
service's own transport through its test double (`createDevEgress`): synthetic
DNS answers and loopback sockets, with real WASM rustls TLS to a test CA. The
receiver independently checks exact HMAC bytes, tamper and replay. Through
Vector's Settings routes, a destination whose name resolves to a private address
is never connected, and one that answers 302 is not followed; both deliveries
stay uncertain. Native tests cover failed SQL, restart, finite retry and
uncertainty. This is local composition proof, with no live endpoint.

Native issue deletion erases local event, delivery and retained receiver-inbox bodies atomically. Permanent event-identity guards prevent stale enqueue, replay publication, claims and transport. Attempts retain only protocol-generated kind/code/status/retry delay; the native webhook classifier ignores response bodies and Base projects the result before persistence. Operator-entered reconciliation codes can contain private text, so deletion replaces them with a fixed deletion code while retaining the decision, identity and time. The same rule applies to late reconciliation. Vector currently mounts no generic Base replay receiver, but populated archive replay rows receive the same erasure and publication guard. An already invoked external provider operation cannot be recalled.

## GitHub pull requests

Register the repository by owner and name (for example
`octocat/linguist`), save the reveal-once secret, and configure the
repository webhook yourself. The receiver implements GitHub's distinct raw-byte
HMAC protocol, `X-Hub-Signature-256`, `X-GitHub-Delivery` and authenticated GitHub `ping` connection checks plus allowlisted
`pull_request` actions: opened, edited, closed, reopened and synchronize.
See [signature validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
and [payload documentation](https://docs.github.com/en/webhooks/webhook-events-and-payloads).

Explicit native identifiers in PR titles/bodies persist repository/number links,
title, validated HTTPS PR URL and open/closed/merged state in issue details.
Unknown references record a diagnostic. A PR never creates, completes or
reprioritises an issue. Delivery identity/hash and version/state fences commit
with the link; duplicate or older deliveries cannot regress current state.
Merged state remains terminal. Current receiver authority also gates retained
replay results. No GitHub token, OAuth/App installation, enrichment or URL fetch
is used. The browser checks links locally without opening the GitHub account.

## Restoration and upgrades

Archives retain safe configuration, source business identities/deletion history,
PR links/states and delivery/attempt/usage history. Credentials, transient claims
and destination-only holds are excluded. Restore quarantines every historical
webhook delivery and native event, clears signing values and requires re-entry.
Fresh operator access/effect review can admit future work; it never releases
historical pending or uncertain sends. Restored tokens require new credentials.

A destination whose signing secret is missing (restore) or no longer opens is
listed in Settings as needing attention with that reason and a re-enter action.
Its new events stay queued and unsent, counted as held; already queued
deliveries wait. Every other destination keeps delivering. Re-entering the
secret releases the held events, signed with the new secret.

Apply 0027/0028 additively after 0026. Keep schema, tombstones, processed markers,
attempts and terminal results on compatible-source rollback. Recover D1/FILES
and matching source together in isolation. Hosted egress, stage installation,
live accounts, the public site and publication remain owner work.

## Slack and Discord channel notifications (SLACK-003)

In Settings → Integrations → Slack and Discord channels, an Admin pastes a Slack
bot token with `chat:write`, `channels:manage` and `channels:read`. Vector validates it with `auth.test` and seals it with AES-GCM using
`sealSecret`/`openSecret`, bound to this workspace. The token never appears in a
read response. Replace it in the same form to rotate it. Removing the connection
calls `auth.revoke`, deletes the stored token and disables its bindings. A provider
revocation error is shown and refuses removal; a restored connection with no
usable token can still be removed locally. Owners and Admins connect, bind and
remove Slack (role matrix, ROLE-001); teams are workspace-visible until ROLE-002.

Choose a team, project or saved view, a Slack channel ID and display name, and
chosen events. Each object has one destination; saving again replaces its
binding. Add the Slack bot to an existing channel first. New triage, new issue
and status changes post now. Saved views use the member’s current browse filters
at dispatch. Project updates, releases, SLA warnings, agent completions and
initiatives inherit their posts in PROJ-010, RELEASE-001/003, AUTO-004,
AGENT-002/003 and INIT-001 before those objects ship. ROLE-002 must enforce that
private-team content only posts to channels an Admin bound to that team.

Owners and Admins see **Create Slack channel** on a team or project creation form. Members who may create a project can instead choose a Slack channel an Owner or Admin already bound or allowed. Vector calls
`conversations.create` once, for a public channel named from the identifier or
name (lowercase, hyphens, at most 80 characters), and binds the returned channel
as part of the native object transaction. A Slack error, including `name_taken`,
is shown and refuses creation without an automatic retry. If Slack creates a
channel but the later local transaction fails, check Slack before trying again;
Vector cannot atomically commit across Slack and its own database.

Discord destinations accept only HTTPS `discord.com` or `discordapp.com` URLs
with a path beginning `/api/webhooks/`. The complete URL is sealed in the same
excluded secret store; settings retain only its display name. Redirects are
refused. Slack uses fixed `https://slack.com/api/` endpoints. These fixed provider
hosts do not use the arbitrary-webhook resolved-address egress configuration.

Messages send the issue identifier, title, readable actor name, status change
and canonical `/app/issues/:identifier` link outside the deployment. Descriptions,
comments, attachments and evidence bodies are never included. Slack formatting
and Discord allowed mentions prevent issue text from generating mentions.

Channel delivery reuses the existing durable outbound events, claims, attempts,
finite retries and uncertain terminal states. Settings → Delivery history shows
failures. A timeout or unknown provider result is never automatically resent.
Unbinding, issue deletion, removal of the configuring operator or removing Slack
stops future sends; a request already started may finish. Vector’s local erasure
cannot recall messages already posted in Slack or Discord (SEC-003).

Archives retain bindings and delivery history but exclude the bot token and
Discord webhook URL. Restore holds historical effects permanently and shows
**Needs attention** until credentials are re-entered and future effects reviewed.
The manifest/OAuth installation, Events API, @Vector issue creation and explicit
member linking remain SLACK-001; this paste path does not claim those features.
Apply `0073_channel_notifications.sql` additively after the v0.4.0 schema and keep
all prior rows, outbound terminal states and new binding tables on rollback.

Slack channel selection and every post require `conversations.info`: the bot
must be a member, `is_channel` must be true, and `is_archived`, `is_shared`,
`is_ext_shared`, `is_org_shared` and `is_pending_ext_shared` must explicitly be
false. Frozen channels are refused; only an absent optional `is_frozen` means
false: the held channel omitted this field in the recorded provider run, an
assumption open to revision (ct, 20 October 2026 19:12Z and 19:24Z). Any other missing or malformed safety flag
refuses routing. No channel is inferred from a name or email address.
A channel that becomes unsafe, or whose post is refused as archived, frozen or
not joined, is visibly suspended. An Admin must save a fresh binding after the
underlying access is fixed; old held events are not replayed. The current
workspace has no private/restricted teams; ROLE-002 must add generic notices
without actor or text, or a DM to a permitted explicitly mapped member, before
private-team channel delivery ships. This is named in its acceptance.

Discord requests server confirmation with `wait=true`, suppresses embeds and
mentions, and retains only the transport result. Provider response bodies are
not retained. Removed native operators’ queued actor display snapshots are
anonymized locally while their events remain ineligible to post.

## Slack direct messages (SLACK-004)

Slack direct messages reuse the SLACK-003 bot token. The token also needs `im:write`
(to open the direct message) and `users:read.email` (to find a member's own account).

**Members link themselves.** In Settings → Notifications a signed-in member chooses
**Link Slack**. Vector calls `users.lookupByEmail` with that member's own sign-in email,
shows the Slack account it found and links it only after the member chooses **Confirm
Slack link**. No match shows "No Slack account found for this email" and stores nothing;
a lookup error is shown and not retried. Vector never looks members up in the background,
never looks up someone else's email for an Admin, never reads the directory
(`users.list`) and never matches on names. Linking and unlinking are audited. **Unlink
Slack**, member removal, suspension (ROLE-011) and removing the Slack connection delete
the link and stop every direct message. Explicit Admin mapping is SLACK-001's.

**Choosing Slack.** A linked member turns on Slack direct messages for assignments and
for mentions, the events Vector also mails (NOTIFY-006). The choice is unavailable, with
the reason shown, while Slack is not connected or needs attention, or while the member
has no link. Every other event's channel choice belongs to NOTIFY-007.

**Delivery.** A qualifying notification creates one direct-message intent in the same
transaction as the change that caused it. Right after that change commits, like
immediate mail, Vector rechecks mutes, the actor, the recipient's activity, issue access
and the member's link and choice, calls `conversations.open` and then `chat.postMessage`.
The intent uses the existing outbound ledger: a rate limit, or a `conversations.open`
that did not answer (nothing was posted), retries at most three attempts, after one and
then five minutes; an unknown `chat.postMessage` result is uncertain and is never resent.
The recipient sees failed and uncertain messages under Slack delivery updates in
Settings → Notifications; personal messages are not listed in the Admin's delivery
history.

**What leaves the deployment.** For the lookup, the member's sign-in email. In a direct
message, only the event kind, issue identifier and title, actor display name, status
change, due date, the team's workflow status names in the Change status select, the
issue version inside the action values, and the canonical `/app/issues/:identifier`
link that requires sign-in. Messages use plain-text blocks with `unfurl_links` and
`unfurl_media` false. Descriptions, comments, mention bodies, attachments, free text and
AI output never leave. Private or restricted items do not exist until ROLE-002, which
must send a generic notice without actor or text.

**Actions and the signing secret.** Each message has **Open**, the canonical link.
**Assign to me** and **Change status** appear only after an Admin enters the Slack app's
signing secret (Basic Information → App Credentials) beside the bot token in Settings →
Integrations; until then Settings says they are off and messages offer Open only. The
signing secret is sealed per workspace with `sealSecret`/`openSecret`, never shown again,
excluded from archives with the member links, needs entering again after a restore
(members re-link) and is deleted when the Slack connection is removed.

Until SLACK-001's manifest sets it, turn on **Interactivity** in the Slack app and set
its Request URL to the value Settings shows:

```
https://<your Vector address>/api/integrations/slack/interactive
```

Vector verifies `X-Slack-Signature` (HMAC-SHA256 over `v0:<timestamp>:<raw body>`) in
constant time, refuses a timestamp more than five minutes from its clock and any
replayed request, and maps the Slack user to a Vector member only through a confirmed
link. The change runs through the version-checked issue edit with that member's own
authority and the issue version the message carried: an issue that changed since is
refused with a threaded reply carrying Open, never overwritten; an applied change
refreshes the message. Vector acknowledges within Slack's three seconds and replies
afterwards. Unlinked, removed or suspended Slack users, bad or missing signatures,
stale timestamps and replays change nothing.

Apply `0074_slack_direct_messages.sql` additively after 0073. It adds the member link
and request-key tables (both excluded from archives) and triggers that drop links and
the signing secret when the connection is removed and scrub queued messages for a
removed member. Keep all prior rows and outbound terminal states on rollback. An
already-sent direct message cannot be recalled by local erasure (SEC-003).
