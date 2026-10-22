# Role screens (ROLE-001, ROLE-007, ROLE-009)

`pnpm test:admin` writes these captures. It drives Settings → Members and Settings → Teams in a real browser. At 1440 and 390 it checks every state for horizontal overflow and for serious or critical axe findings (none found), then captures it.

- `members-owner-{1440,390}.png`: the Owner's Members section after promoting a Member to Admin at 1440 and demoting them at 390. It shows role controls, the invitation setting and an invitation that names its role.
- `members-last-owner-refused-{1440,390}.png`: the last Owner's own demotion refused beside the controls, with the select back on Owner.
- `members-member-view-{1440,390}.png`: a Member's read-only directory. Their only control is leaving.
- `team-member-view-{1440,390}.png`: a Member who joined a public team from the directory, with the team's settings, members, permissions and workflow locked.
- `team-last-owner-refused-{1440,390}.png`: the last team owner's attempt to leave refused.
- `team-owner-controls-{1440,390}.png`: a team owner's member, team-owner and permission controls after adding a member, naming them team owner and opening team settings to all members.

A one-off capture for ct's c8a role rulings (sd-vector-c8b) checked two more states the same way (overflow and axe at both widths, none found); the admin journey does not write them:

- `team-archive-member-all-members-{1440,390}.png`: a Member who does not own a team whose *Who manages team settings* is All team members. The team's settings are theirs to save, but Archive team is disabled with its reason: archiving belongs to Owners, Admins and team owners (TEAM-003 row).
- `project-create-member-{1440,390}.png`: a Member's New project form without Create Slack channel, which only Owners and Admins are offered (SLACK-003 row).
- `project-delete-member-{1440,390}.png`: a Member's project page for a project someone else leads. They can still edit it, but Delete project is disabled with its reason: deleting belongs to Owners, Admins and the project's lead (PROJ-003 row). Before this, the control was enabled and its confirmation was refused 403.
- `project-delete-lead-confirm-{1440,390}.png`: the same Member on the project they lead, at the existing confirmation; confirming deleted it.

`UPGRADE.md` records the one-off migration upgrade proof.
