# Label workflow rules

The native rule API supports the AUTO-002 Security journey: an actual addition of a selected label sets priority and notifies one existing Slack destination. The Settings interface and its browser qualification remain pending.

Owners and Admins manage workspace rules. Team owners, and team Members while the team permits all members to manage settings, manage that team's rules. Guests and Viewers cannot read or manage these Settings resources. The accountable owner is the person who created the rule; another administrator's edit never silently transfers ownership.

Native authenticated routes are rooted at `/api/settings/automation-rules` for workspace rules and `/api/settings/teams/:id/automation-rules` for team rules:

- `GET` lists rules, stable label choices, approved Slack destinations for subjects the current manager can see, current monthly usage and restore holds. Private-team channel names and identities are withheld until the reader has current access.
- `POST /dry-run` accepts an unsaved rule and returns matching issues among the latest 100 visible issues, planned priority changes and the destination identity. It writes nothing and makes no network request.
- `POST` creates a rule with `expectedVersion: 0`.
- `PATCH /:ruleId` replaces that rule's configuration with its current `expectedVersion`. Stale saves return 409.
- `GET /:ruleId/runs` returns up to 100 recent visible run receipts, recorded changes and reasons for stopped or failed runs.

A rule contains `name`, `labelId`, `priority`, `destinationId`, `monthlyBudget` and `enabled`. Priority is one of `none`, `low`, `medium`, `high` and `urgent`. Its Slack destination must be an active binding made by a current Owner or Admin and explicitly subscribed to `automation.rule`. Names never substitute for label or channel identity. Private-team work can post only a generic notice to that team's bound channel.

An addition commits its pending once receipt with its source activity. Native and scoped API creation and editing, bulk edits, agent issue tools, template application, issue copies and native label consolidation produce additions. Repeating a label set, removing a label, importing history, Undo and restoring an archive produce none. Removing and adding the label again is a new original event. A rule's own priority act never produces another trigger, including for another rule.

The scheduler evaluates committed receipts. Run admission, one budget slot, the priority change, native activity, an audit record of actor kind `automation` and the durable channel intent commit atomically. Activity and audit retain the rule's accountable owner. Delivery uses the existing channel queue, checks current authority and safety again at the network edge, masks private work and keeps terminal uncertainty inert.

Budgets are monthly UTC evaluation buckets and count admitted attempts. Saving a rule does not reset its usage. Exhausted runs retain a visible `budget_exhausted` receipt without changing the issue or posting. A failure pauses the rule and sends its still-authorized owner one native Inbox notice per rule version. A repair requires an explicit versioned save. Recorded changes remain in the run log if delivery later fails.

Archives retain rule configuration, usage and run history. Restored rules remain held after general effect review. An explicit save can admit future additions; it stops all historical pending runs first. Credentials and per-installation restore holds are excluded from archives. Other triggers, conditions and actions from AUTO-002 remain owed, including due-soon rules under AUTO-006.

Apply `0135_automation_rules.sql` after `0134_slack_threads.sql`; existing applied migration bytes remain unchanged.
