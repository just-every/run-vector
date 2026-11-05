# Retained native title events

The mounted MCP tool `vector.events.list` reads retained native issue-title
changes. Issue creation, other field changes, comments and other record
producers are not qualified by this integration.

Issue a personal credential in Settings with both `events:read` and
`evidence:read`. Existing credentials gain no scopes automatically. Event reads
use the sponsoring person's current issue access; an event grant does not grant
issue access or mutation authority. Removing private-team membership withholds
its issue events on the next read. Revoking the credential or pausing agents
refuses further calls.

Call the tool through `/mcp` with an optional `after` event ID and a `limit`
between 1 and 200. Pass the returned `cursor` as the next `after` value. Reusing
the same cursor replays the retained IDs in commit order, including after a
Worker restart, subject to current access. Consumers should deduplicate by ID.

An actual title mutation commits one `issue.updated` event in the same guarded
D1 transaction as its issue and activity changes. The event uses that activity's
stable ID and time, the issue resource URI and the trusted person or agent acting
for that person. It retains no title, description, credential or other record
text. Semantic no-ops, stale edits and refused mutations produce no title event.
An event-storage failure rolls back the mutation and its side effects.

This uses the pinned Base retained-event table, which remains excluded from
native archives. Existing agent custody and person-erasure holds are unchanged.
Subscription transport, latency, webhook parity and recovery, policy and decision
event qualification and other producers remain BASE-AGENT-010 gaps.
