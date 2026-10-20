# SLACK-003 real-provider run

UTC: 2026-10-20T18:53:07.061Z
Source SHA: 6045f4acbfcb1f336ac9e221bb1d270b97f66223
Runtime: local rer dev; real Slack Web API. No Discord account or real DM used.

rer dev: ready; private sign-in URL withheld.
Settings → Integrations: bot token validated with auth.test and saved; read response contains no token.
Public settings door: project bound to the held channel (ID withheld).
RUN FAILURE: Expected values to be strictly equal:

404 !== 200

Slack conversations.history: HTTP 200; ok
Slack conversations.history: HTTP 200; ok
Cleanup readback held channel: 0 run messages remain.
Local Vector workspace state erased after the owned dev process stopped.

Final cleanup correction: owned managed server PID 8747 stopped by SIGTERM; post-stop readback found 0 late run messages, deleted each with chat.delete; second conversations.history readback shows 0 run messages. The initial 404 was the proof driver's public scheduler URL, not a Slack call. Local state is erased.
