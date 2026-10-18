# Importer evidence and claims

## Linear

Linear: **documented format and API file, tested at 2,000 issues with a
generator; no owner export supplied.**

What is proven, and how:

- **Format.** The workspace issue CSV follows Linear's documented export
  ([Exporting data](https://linear.app/docs/exporting-data)). The API file and the
  query that makes it follow Linear's published GraphQL schema
  ([GraphQL API](https://linear.app/developers/graphql)); see
  [LINEAR-API-FILE.md](LINEAR-API-FILE.md). No Linear account was used and no
  Linear API request was made.
- **Scale.** `tests/fixtures/import/linear/generate.mjs` produces a deterministic
  workspace (2,000 issues, 2.04 MB CSV, two teams, Linear's status names, parents,
  labels, projects, cycles, a person who is not an operator, archived and
  unsupported columns) and its API file. `tests/worker/data-import-staged.test.ts`
  moves it in through the import routes: one preview, 61 staged batches, a failed
  batch resumed, each record landing once, no notification, mail or webhook, the
  reconciliation report equal to the database query for query, source IDs found
  by search and lookup, and whole-run rollback refused for three issues with later
  work and complete for an untouched run. `tests/e2e/data-staged-cli.mjs` does the
  same run through `pnpm run import:issues`, stopping the process after its third
  batch and resuming. A 4,000-issue run (4.05 MB) was measured locally and a 2,000-issue run
  completed on a hosted installation; the numbers and the hosted limits are in
  [MOVE-IN.md](MOVE-IN.md).
- **API file.** `tests/worker/linear-api-import.test.ts` merges a generated CSV
  and API file pair: comments with original times and author names, HTTPS links,
  dependencies and duplicates, and a malformed file refused row by row.
- **Small fixture.** The committed three-issue CSV under
  `tests/fixtures/import/linear/` remains the documented-format example
  (`tests/worker/linear-import.test.ts`).

What is not proven: a real Linear export from an owner's team (the owner's step,
[MOVE-IN-CHECKLIST.md](MOVE-IN-CHECKLIST.md)); a real API file from Linear;
hosted Worker memory, CPU and time at this size (only the local runtime is
measured); and attachment file bytes, history and memberships, which neither file
carries.

`importers.json` is a product-owned support catalogue. Its adapted Base registry
schema keeps the documented-format and synthetic-only classifications and records
the inputs and the generator-tested scale. It does not assert acceptance by
Base's hash-bound registry trust policy or a public mirror. `seed.json.replaces`
names Linear, Jira and Asana under the owner's 12 October 2026 homepage decision.
It lists what Vector is an alternative to, not importer evidence.

Public writer handoff: "Linear importer: documented CSV format plus an
owner-made API file for comments, links and relations; tested at 2,000 issues
with generated files, up to 4,000 issues per reviewed run, with a reconciliation
report and whole-run undo; no owner export supplied." Do not describe Vector or
its importers as replacing Linear. The homepage says only "100% free, open source
alternative to Linear, Jira and Asana", with no comparative claim.

## Jira Cloud CSV

Jira: **documented format, synthetic-only; real export not supplied.**
This applies to the supported Jira Cloud All Fields CSV profile in
[JIRA-CSV.md](JIRA-CSV.md). Public export documentation does not specify every
native header or plugin encoding. The documented profile is supported; a real
Jira Cloud export, Server/Data Center variants, attachment bytes, hosted
acceptance and live Atlassian behavior remain unproven. No Jira account,
provider API or attachment URL is contacted by the importer.

The generated repository fixture contains 300 issues and 41 positional columns:
176 Sprint values on 151 rows, 172 Labels on 161 rows, 102 Comments on 95 rows
and 38 Attachments on 37 rows. The native public-route tests check write-free
preflight, exact occurrence counts, ambiguous dates and missing required
columns, explicit mappings and omission acknowledgement. Apply writes 173 label
assignments including `epic`, five parent links, two directed Blocks dependencies,
two canonical Duplicate links and 102 comments. Status totals are 100 each;
125 issues have cycle commitments. Every comment preserves its full body,
original author and normalized timestamp. Source IDs and old Jira keys are
verified in detail and search. Files remain zero; optional attachment links add
38 named HTTPS links to a separately reviewed run.

`tests/worker/jira-import.test.ts` (DATA-009) and
`tests/worker/jira-apply.test.ts` (DATA-010) exercise the real import routes and
D1 records. The latter compares report dimensions and effects with native SQL,
repeats apply without duplicates, refuses rollback after exactly two native
edits with all table contents unchanged, and removes an untouched run while
accounting for retained custody, identifier reservations and cycle history.
Signed-out, API-token and removed-operator import requests receive 401;
cross-origin mutations receive 403. Existing generic/Linear staged and imported
person erasure tests run alongside them. The erasure clause is DATA-011;
Jira's optional detailed review is withdrawn when erased person metadata occurs.
Public rollback behavior is preserved; no newer detached-survivor presentation
is implied.

An earlier public terminal proof, recorded against its exact source head in the
external public-port REPORT, used `tests/e2e/jira-cli-runtime.mjs` to preview,
apply, repeat, read status, resume, reconcile and roll back the same 300-issue
fixture. It compared all application table counts around preview and recorded
before/apply/rollback counts. That run checked 170 tables, excluding request
rate counters and SQLite/D1 infrastructure, and returned the native issue count
from 300 to zero. These counts apply only to that recorded source head. The
external public-port REPORT records each CLI command, result and exact source
head, with labels distinguishing this earlier copied-CLI run from the
`@runeditrun/rer` CLI run. Earlier private npm snapshots are not public
acceptance evidence.

Browser captures at 1440 and 390, a separate held-out fixture, final full
verification and exact-head CI evidence are recorded in the external
public-port REPORT. The repository and held-out fixture totals must never be
interchanged.

No migration, Base refresh or pin change is needed. Trial a real team's export
using [MOVE-IN-CHECKLIST.md](MOVE-IN-CHECKLIST.md) before broadening the claim.
Default: an Epic is an ordinary parent issue with the existing `epic` label;
Status Category supplies suggestions which the operator must confirm against
actual workflow statuses. Release, tag and deployment wait for owner review.

## Plane, Huly and Shortcut (DATA-015)

Named file profiles now use the shared reviewed staged run and reconciliation report. [Plane CSV](PLANE-CSV.md), [Huly JSON](HULY-JSON.md) and [Shortcut CSV](SHORTCUT-CSV.md) document exact supported fields and omissions against primary export sources. Each two-issue synthetic fixture is exercised by `tests/worker/plane-huly-shortcut-import.test.ts`, including review acknowledgement, mapped fields, source-to-native counts, replay and whole-run rollback. `tests/e2e/data-staged-cli.mjs` exercises the Plane fixture through terminal preview/apply/report/rollback. `tests/e2e/data-profile-journey.mjs` exercises Huly JSON review, staged apply and reconciliation at 1440 and 390. No real owner export, live API, attachment-byte or hosted source acceptance is claimed. Base copies and the import-kit door are unchanged in this round.
