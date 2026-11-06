# Resolution SLAs

In Settings, open a team and its Automation tab. Resolution SLA accepts a priority, a label or both. Both selected filters must match. The target and advance warning are business minutes. Choose business days and a same-day working interval in the workspace timezone. Team owners and people admitted by the team's settings permission can save; workspace Owners and Admins always can. Guests and Viewers cannot.

A matching issue shows its remaining business minutes. Its persisted clock keeps the target, business hours and timezone under which it started. Later target edits apply to new clocks. Completion, cancellation, duplication, team movement, archival, filter withdrawal or disabling stops the original clock; reopening never resets its warning or breach. Resolution targets do not alter issue status, priority, assignment or due date.

The real scheduler records one warning during the advance-warning interval and one breach at the target, with transactional occurrence receipts. A tick after the target records the breach without sending a late advance warning. Inbox goes to an eligible current assignee and current native triage-responsible person, with one row if they coincide. It excludes the event actor and respects current visibility, issue mutes and SLA-warning type mutes. Personal notification channel choices remain in effect. Muted or ineligible occurrences do not backfill.

An Owner or Admin can explicitly select SLA warning on an existing team Slack or Discord binding. The selected channel receives one identifier, a warning and an authenticated issue link. Private work uses the shared generic message. This uses the existing credential, privacy, restore and terminal-delivery checks. No issue description, title or customer details are sent by this producer. No new provider connection is required for Inbox.

Targets, clock snapshots, stops and occurrence history are portable domain data. Credentials stay excluded. Restored clocks are stopped and historical delivery stays held; effect review never reconstructs old warnings. Forward migration `0126_resolution_slas.sql` retains prior preferences and event history. Compatible rollback must retain this schema and the shared delivery ledgers.

This native resolution slice does not implement customer tiers, triage-time targets, broader policy combinations or Insights charts. External Oncall and PagerDuty recipient qualification and hosted provider commissioning remain separate requirements in AUTO-004.
