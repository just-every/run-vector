# Jira public journey captures

Run from a committed checkout containing the final Jira executor and this harness,
with the pinned Node and pnpm installed, dependencies installed, `dist` built, and
Playwright Chromium available:

```sh
node tests/e2e/jira-captures.mjs
```

The command creates a genuine cloned installation through
`startDataUiInstallation`, configures sample data and the owner, launches
`node scripts/rer.mjs dev` through the public copied CLI, signs in through the development mail outbox, and
opens an authenticated Playwright page. It stops its browser and installation
and removes the private installation even after failure. No provider keys or
external service calls are needed. The generated CSV is synthetic; this is not
evidence from a real Jira export.

Native labels (including `epic`) and the fixture's exact-name cycles are created
through public settings routes. The import uses one existing active team,
existing statuses in that team, and an explicit existing active operator mapping.
Before the import journey, the harness observes a fresh successful native
scheduled run so the sample installation's due-reminder work finishes before
the preview snapshots. Cron stays enabled. `scheduledSetup` records before/after
counts and the joined reminder, Inbox and audit receipts.
The page itself selects Jira CSV, uploads the generated 300-row file, sets source,
offset, status, priority, account and sprint mappings, and submits every preview
and apply. The unknown-status variant is refused first, then replaced with the
intended baseline file. All application table row counts are compared around
every preview. All concepts are checked against physical generated CSV cells,
including repeated column row counts and occurrence counts. Errors and missing
omission acknowledgement must disable Apply.

Before applying, the live status selector is exercised against a deliberately
stale review: the selected team's qualified alias moves from Unstarted to Started
to Completed, then Unconfirmed, then the intended Unstarted target. A competing
bare alias and another team's qualified alias remain present during the scoped
changes. Live values and subsequent public preview targets must agree;
Unconfirmed must remove both applicable aliases and refuse Apply. This proof is
recorded in `captures.json` as `statusControls`.

The baseline is applied once through the real staged browser flow. The retained
run's Reconciliation report button opens the native report; all five dimension
tables are checked against its read/written data. Native effect totals must be
173 labels, five parents, two Blocks dependencies, two canonical Duplicate links,
102 comments, two total links and zero files. Status totals must be 100 each and
native cycle commitments must total 125. The ambiguous numeric-date
variant must then refuse Apply and expose an undetermined date pattern and the
date-order reason. No imported run is seeded through an API or fixture store.
Every label's planned and written count is also checked independently against
the physical CSV cells, including the ordinary epic's native label.

Each state produces `*-1440-panel.png`, `*-1440-viewport.png`,
`*-390-panel.png`, and `*-390-viewport.png`; review/report states also have
`*-focus.png` captures. Raw-row disclosure controls stay closed through normal
clicks to keep the 300-row evidence finite. Screenshots preserve the existing UI.
No CSS is injected and no responses or routes are mocked. Every state checks
zero serious/critical axe violations, document/body horizontal overflow, and the
existing native control affordance audit. Actual screenshots and failure details
remain available if those product checks fail.
At 390px, the status, priority and concept table regions must accept keyboard
focus. Tab must reveal their far-column controls; read-only confirmation tables
must scroll to the far edge with arrow keys. Arrow keys must return each region
to its source columns. `*-far-columns.png` captures retain that visible proof,
and `mobileTables` records the scroll and focus checks without pinning CSS sizes.

`captures.json` records source SHA, per-preview table counts, every concept's
row/occurrence counts, date/error evidence, native setup, real batch receipts,
report totals/effects/dimensions, and screenshot audit results including control
counts. It contains no session
cookie, login token or authentication secret. Standard output is a shorter JSON
receipt with capture names, table totals and report dimensions.

Local evidence runs use the pinned Node 22.20.0 and pnpm 10.12.4, `nice -n 15`,
one allocated heavy lane, a one-minute load at most 36 and at least 15 GiB free.
Build with `node scripts/rer.mjs build` before running this command. The browser request counter
proves zero external browser requests in this journey; it does not certify
hosted provider egress. Root owns source commits and runtime authorization.
This harness is a standalone evidence command and is not added to full verify.

This source checkpoint contains the executable capture journey only. Capture
images and `captures.json` must be generated against a committed public source
head; prior private-checkpoint images and measurements are not included.
The manifest records the actual source commit used. Root owns the final image
commit, visual inspection, full verification and exact-head CI evidence.
