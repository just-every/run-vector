# Native integrations

Settings / Integrations manages named API tokens, signed sources, immutable
outbound destinations and GitHub repository receivers. Configuration requires
the current native operator/session/workspace and destination restore grant.
Credentials are revealed once. Token values are hashed by Base; source,
destination and GitHub signing values are encrypted at rest with AES-GCM bound
to their identity, using the installation SESSION_SECRET. Keep that secret
private. After changing it, rotate sources and revoke/re-register destinations
and repositories; old encrypted values cannot be recovered with the new key.

## Signed sources

Register a stable source ID and an active Intake team. Save the returned secret,
receiver, signed tenant and source IDs with the producer. Use Base's actual
`createWebhookProtocol` with hex-decoded key bytes, event `signal.revision`, and
the returned tenant/source audience. Source records require `sourceRecordId`,
`sourceRevisionId`, `observedAt`, native `teamId`, title and the documented intake
fields. Assertions explicitly carry `{value, attribution: "source"}`; they stay
source claims rather than established facts. Rotation allows a selected overlap
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
