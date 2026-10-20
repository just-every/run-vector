# SLACK-004 real-provider run
Run ID: mvhaj05a

UTC: 2026-10-20T23:04:30.345Z
Source SHA: 9283d67616155189b6cd17391db511c1c4d99bf2 (local, pre-publication)
Published candidate: 37872b7977ffab2f9c7c431c3824d96c78220b92. Before publication one evidence line that named a local folder was removed from `evidence/slack-004/UPGRADE.md`; the only other difference is that file's hash in `sources.lock.json`. The run's trees are byte-identical in the published commit (`git rev-parse 37872b7:<path>`): src `dc67c060f956c6bce9217793c01b0d4bab9e3e34`, migrations `1ba12c71fefb529091e9423f785945fa452b6570`, tests `475d57221b7b8ce78cecc420d426f9902ee6b1a5`, seed.json `af64275cc45c665ce731e1080f0448de8be94e45`, package.json `2022cf868c2ac1397bfcacc3de64900e436e34e4`, pnpm-lock.yaml `be7f8e671604e305bbff6c6b6ccded06feb1204c`, vendor `f1a40e6348d9280755a88c01d0354faf1ba95eec`.
Runtime: local rer dev; real Slack Web API with the held bot token. No real DM, no channel creation, no button click.

rer setup: local owner owner@example.test (example address).
rer dev started in its own process group (pid 67113).
rer dev: ready; private sign-in URL withheld.
First workspace review completed: HTTP 200
Settings → Integrations: bot token POST HTTP 200 (Vector validated it with auth.test).
Settings → Integrations: generated signing secret POST HTTP 200.
Integrations read: connected=true, signingSecret=true, token in response=false, secret in response=false.
Settings → Notifications before: available=true, link=null, actionsEnabled=true, member sign-in email owner@example.test.
Link Slack at 1440: POST /api/settings/notifications/slack/lookup HTTP 200 {"match":null,"message":"No Slack account found for this email"} (Vector called users.lookupByEmail for owner@example.test).
Screen at 1440: Settings → Notifications shows "No Slack account found for this email" (evidence/slack-004/live/no-match-1440.png).
Link Slack at 390: POST /api/settings/notifications/slack/lookup HTTP 200 {"match":null,"message":"No Slack account found for this email"} (Vector called users.lookupByEmail for owner@example.test).
Screen at 390: Settings → Notifications shows "No Slack account found for this email" (evidence/slack-004/live/no-match-390.png).
Settings → Notifications after: link=null (nothing stored).
Slack users.lookupByEmail: HTTP 200; error users_not_found
Independent check of the same address: users.lookupByEmail answered users_not_found.
Fixture payload evidence/slack-004/fixture/dm-payload-1440.json: actions vector_open, vector_assign_me, vector_change_status; unfurl_links=false, unfurl_media=false.
Slack chat.postMessage: HTTP 200; ok
Slack conversations.history: HTTP 200; ok
Readback: 1 message with vector-c7-mvhaj05a; its actions: button:vector_open, button:vector_assign_me, static_select:vector_change_status.
Slack chat.delete: HTTP 200; ok
Slack conversations.history: HTTP 200; ok
Cleanup readback: 0 messages with vector-c7-mvhaj05a remain.
rer dev stopped by its own process group id (67113).
Local Vector workspace state erased with rer reset --yes (exit 0).

## Scope of this run (recorded run, not provider acceptance)

- Covered: the held bot token through the public settings door (`auth.test`), a run-generated signing secret, the member's own-email `users.lookupByEmail` (answered `users_not_found` for the local example address; Settings showed the no-match message at 1440 and 390 and stored nothing), and Slack's acceptance of the exact direct-message blocks Vector produced at the fixture edge (`evidence/slack-004/fixture/dm-payload-1440.json`), posted once with only `channel` replaced by the held channel and the run tag appended to `text`, read back with all three actions, deleted and read back empty.
- Not proven live: a real direct message to a person (the workspace is the owner's, no consenting test user exists, and `im:history` is not held for a readback) and a live button click (no Slack signing secret is held and the Interactivity Request URL is a Slack-console step). Signed actions are proven at the network edge in `tests/worker/outbound-broken-destination.test.ts`.
- The bot token and held channel ID never appear in this transcript, the captures or the commit.
