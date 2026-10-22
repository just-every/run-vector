# Role screens (ROLE-001, ROLE-007, ROLE-009)

`pnpm test:admin` writes these captures. It drives Settings → Members and Settings → Teams in a real browser. At 1440 and 390 it checks every state for horizontal overflow and for serious or critical axe findings (none found), then captures it.

- `members-owner-{1440,390}.png`: the Owner's Members section after promoting a Member to Admin at 1440 and demoting them at 390. It shows role controls, the invitation setting and an invitation that names its role.
- `members-last-owner-refused-{1440,390}.png`: the last Owner's own demotion refused beside the controls, with the select back on Owner.
- `members-member-view-{1440,390}.png`: a Member's read-only directory. Their only control is leaving.
- `team-member-view-{1440,390}.png`: a Member who joined a public team from the directory, with the team's settings, members, permissions and workflow locked.
- `team-last-owner-refused-{1440,390}.png`: the last team owner's attempt to leave refused.
- `team-owner-controls-{1440,390}.png`: a team owner's member, team-owner and permission controls after adding a member, naming them team owner and opening team settings to all members.

`UPGRADE.md` records the one-off migration upgrade proof.
