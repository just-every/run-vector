# Importer evidence and claims

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
  batch and resuming. A 4,000-issue run (4.05 MB) was measured locally; the
  numbers are in [MOVE-IN.md](MOVE-IN.md).
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
