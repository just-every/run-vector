# Selected public-door probes

Candidate: 7334487bdc9102011b9b646e37fe60da45ebf338
Actual execution: signed Slack fixture and mounted native HTTP routes, in the eight passing worker registrations. See the actual final-head log and receipt.

PROBE SLACK-002 1: signed app_mention and message_action in the explicit team channel -> issue text, original Slack author, validated provider permalink, one mapped root; unsigned and unlinked shortcuts refuse with unchanged storage.
PROBE SLACK-002 2: signed thread message, its replay, restarted retry and concurrent retry -> one native reply under the original mapped root; refused replays leave storage unchanged.
PROBE SLACK-002 3: native mapped reply plus scheduler, restart and repeated dispatch -> one accepted Slack thread receipt; 429 retries once successfully; 503 remains uncertain without resend.
PROBE SLACK-002 4: native separate top-level comment -> zero Slack thread posts.
PROBE SLACK-002 5: signed second-thread add mention plus replies in each direction -> a different mapped root and only that source thread's replies and provider target.
PROBE SLACK-002 resolution: repeated native resolution -> one resolved marker and a persisted collapsed thread in the browser.
PROBE SLACK-002 status: native issue status change -> one status post in each linked source thread.
PROBE SLACK-002 privacy: queue a reply while public, make team private, then change status -> no reply text leaves; linked threads receive only identifier and status name.
PROBE SLACK-002 authority: withdraw private membership, set restore hold, revoke source link during channel safety lookup -> no unauthorized post and unchanged refused intake storage.
PROBE SLACK-002 portability: populated upgrade and HTTP archive restore with incoming, accepted and queued replies -> original records and receipts retained, mappings and intents held, credentials and member links absent.

MECHANICAL lock=pnpm sources:lock then pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write SLACK-002 then check SLACK-002 exit=0, views restored from origin/main and not committed; ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0.
