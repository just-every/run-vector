# ROLE-001/ROLE-007/ROLE-009 migration upgrade proof (one-off, not a permanent test)

UTC: 2026-10-22T05:36:37Z
Base: main f7391aeed0547faa219f99e4523be906cb87489a. Code: candidate commit 301f4b8 plus the temporary proof files below; migrations `0075_workspace_roles.sql`, `0076_team_membership.sql` and `0077_team_permissions.sql` and the bootstrap change are unchanged since.

Released shapes, read from the tags' `migrations/core` listings: v0.4.0 ends at `0072_project_milestones.sql`; v0.4.1 and main end at `0074_slack_direct_messages.sql`, so one store shape stands for both.

Temporary Vitest files ran the existing `provePopulatedUpgrade` helper (tests/worker/populated-upgrade.ts) through a one-off wrapper, then were deleted. Each store held the historical sample (three operators: Sarah Chen, Maya Ortiz and Alex Lee; two teams: Flow and Platform; their issues, projects and cycles), a comment and an R2 file, the owner's Base session, a scoped API token written at the old schema and a pending invitation link the owner issued before roles existed.

- **v0.4.1 and main (0074) → 0075-0077**, installation owner recorded, plus a Slack member link (0074 row). Schema delta exactly: `table vector_invitation_roles`, `trigger vector_preserve_installation_owner_role`, `trigger vector_preserve_last_owner_role`, `trigger vector_preserve_last_owner_removal`, `table team_members`, `index team_members_operator` and `table team_departures` added; nothing removed; only `table operators`, `table workspace_settings` and `table teams` changed (added columns); every other object kept its exact SQL.
- **v0.4.0 (0072) → 0073-0077**, installation owner recorded. The same assertions; the schema delta spans 0073-0074 and is not asserted.
- **A v0.4.1 store that never recorded its installation owner → 0075-0077.** Bootstrap records the configured owner on the first request after the upgrade, and that owner then owns every team.

Every store recorded an installation owner when it served a request after 0010, so the first two runs are the shape of a real upgrade.

After each run:

- every row of every earlier table compared equal, `PRAGMA foreign_key_check` was empty, and the R2 file was unchanged;
- all three operators were Owners (`role<>'owner'` count 0);
- the installation owner (Sarah) was the team owner of both teams, `team_members` held exactly one row per team (no other membership was inferred), and both teams had `settings_permission='team_owners'` and `planning_permission='all_members'`;
- the pending invitation kept admitting as an Owner (`vector_invitation_roles` held exactly `pre-roles-invite → owner`);
- the owner's session answered `/api/session` and search with 200, and a complete archive export finished;
- the API token written before roles read `/api/v1/issues` (200) and created an issue (201).

Before the bootstrap change (commit de0aada), the unrecorded order failed: `expected [ { n: 2 } ] to deeply equal [ { n: 0 } ]`, meaning both teams had no team owner.

Vitest result: `Test Files 3 passed (3)`, `Tests 3 passed (3)` (17.7 s).

The permanent populated-upgrade tests (`tests/worker/base-refresh-upgrade.test.ts`, `tests/worker/owner-claim-upgrade.test.ts`, `tests/worker/project-fields-upgrade.test.ts`) also apply 0075-0077 to their populated stores and compare every row. With `tests/worker/data-archive-failure.test.ts` they passed on the same code: `Test Files 4 passed (4)`, `Tests 4 passed (4)` (22.8 s).
