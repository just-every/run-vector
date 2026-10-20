# SLACK-004 migration upgrade proof (one-off, not a permanent test)

UTC: 2026-10-20T22:54:13Z
Base: main de3ad96a7806972885f498593b51fbba7d2cc9ac plus the uncommitted SLACK-004 working tree that became the candidate (migration 0074_slack_direct_messages.sql unchanged since).

Two temporary Vitest files ran the existing `provePopulatedUpgrade` helper (tests/worker/populated-upgrade.ts) through the public test door and were then deleted:

- **main 0073 → 0074:** the historical sample plus 0073-era Slack rows (`vector_slack_installations`, the sealed `slack:` key row, a Slack `vector_webhook_destinations` row, `vector_channel_bindings`, `vector_webhook_events`) at the 0073 schema; boundary `0074_slack_direct_messages.sql`. Schema delta was exactly `table vector_slack_member_links`, `table vector_slack_request_keys`, `trigger vector_slack_installation_disabled`, `trigger vector_slack_member_removed`; every earlier object kept its exact SQL; every row of every table compared equal after the upgrade; `PRAGMA foreign_key_check` empty; owner sign-in, search and a complete archive export passed.
- **released v0.4.0 (0072) → 0073 → 0074:** the historical sample plus a notification, a webhook destination (pre-0073 shape) and its webhook event; boundary `0073_channel_notifications.sql` with the 0073 and 0074 objects as the expected delta (`vector_webhook_destinations` and `vector_native_webhook_event` changed by 0073 only). Every row compared equal; foreign keys clean; sign-in, search and archive export passed.

Vitest result: `Test Files 2 passed (2)`, `Tests 2 passed (2)` (11.4 s).

The permanent populated-upgrade tests (`tests/worker/project-fields-upgrade.test.ts`, `tests/worker/owner-claim-upgrade.test.ts`, `tests/worker/base-refresh-upgrade.test.ts`) also apply 0074 on their populated stores and compare every row; they passed in the full local worker run before this change was committed (172 of 173 cases; the one failure was the new SLACK-004 scenario's own precondition, since fixed).
