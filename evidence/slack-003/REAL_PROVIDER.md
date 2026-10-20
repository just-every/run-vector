# SLACK-003 real-provider run
Run ID: mvh1uvzf

UTC: 2026-10-20T19:01:48.277Z
Source SHA: ccd68218f38b1a009d012a18d8115d7f9873cada
Runtime: local rer dev; real Slack Web API. No Discord account or real DM used.

rer dev: ready; private sign-in URL withheld.
Settings → Integrations: bot token validated with auth.test and saved; read response contains no token.
Public settings door: project bound to the held channel (ID withheld).
Created native issue VEC-1 for run mvh1uvzf.
Waiting for the next normal rer dev scheduled tick.
Slack conversations.history: HTTP 200; ok
Held-channel history: VEC-1, exactly 2 messages (one creation, one status change), identifier/title/actor/change/canonical link present.
Create Slack channel: one conversations.create through the project creation door; public channel vector-c6-mvh1uvzf automatically bound.
Created native issue VEC-2 for run mvh1uvzf.
Waiting for the next normal rer dev scheduled tick.
Slack conversations.history: HTTP 200; ok
Scratch-channel history: VEC-2, exactly 2 messages (one creation, one status change), identifier/title/actor/change/canonical link present.
RUN FAILURE: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:15860/app/settings#integrations
Call log:
  - navigating to "http://127.0.0.1:15860/app/settings#integrations", waiting until "load"

Slack conversations.history: HTTP 200; ok
Slack conversations.history: HTTP 200; ok
Slack conversations.history: HTTP 200; ok
Slack conversations.history: HTTP 200; ok
Slack chat.delete: HTTP 200; ok
Slack chat.delete: HTTP 200; ok
Slack chat.delete: HTTP 200; ok
Slack chat.delete: HTTP 200; ok
Slack conversations.history: HTTP 200; ok
Cleanup readback held channel: 0 run messages remain.
Slack conversations.history: HTTP 200; ok
Cleanup readback scratch channel: 0 run messages remain.
Slack conversations.archive: HTTP 200; ok
Slack conversations.info: HTTP 200; ok
Cleanup archive readback: vector-c6-mvh1uvzf; is_archived=true. Slack channels cannot be deleted outside Enterprise Grid.
Local Vector workspace state erased after the owned dev process stopped.

Run interruption: after ct’s 20 Oct 19:02Z privacy ruling was read, the owned managed dev process (PID 59017, verified checkout cwd and port) was stopped by SIGTERM. Both issue/status pairs had already posted and were found exactly once each. The later browser connection refusal is this intentional shutdown, not a Slack provider failure. All four messages were deleted and read back absent; the only scratch channel was archived and read back archived. This is recorded live-provider evidence for the original brief, not acceptance of the later policy. No Slack scope or quota call failed; no real DM was sent.
