# Synthetic Jira 300-issue fixture

This generator creates a deterministic, synthetic Jira CSV profile for a public-door importer trial. No real Jira export, account, user, attachment URL, or Jira service is used. The supported profile and its evidence limits are documented in `docs/JIRA-CSV.md` and `PUBLIC-SOURCES.md`: **documented format, synthetic-only; real export not supplied**.

```js
import { generateJiraFixture } from './generate.mjs';

const { csv, headers, rows, expected } = generateJiraFixture();
```

`rows` contains 300 positional arrays without the header row. Use each array with the matching entry in `headers`; positional arrays preserve repeated header occurrences. `expected.rawConceptCounts` gives explicit nonempty-row and distinct-value totals for every original column position (one-based). The expected source IDs, parent edges, in-run Blocks and Duplicate links, external-key omission, and Relates link are declared independently of importer code.

The default issue IDs are the numeric strings `710001` through `710300`. Issue keys use `VJ-1` through `VJ-300`; keys are separate from source IDs. A second untouched run can use another key prefix while retaining the same source IDs:

```js
const secondRun = generateJiraFixture({ sourceKeyPrefix: 'VJ2' });
```

`sourceKeyPrefix` changes only issue keys and in-run outward-link values. Parent values continue to use numeric source IDs. The external link remains `OUTSIDE-9001` in every run.

The repeated column positions intentionally contain sparse values: Sprint at 16 and 20, Labels at 18 and 22, Comment at 26 and 31, and Attachment at 28 and 33. Quoted values exercise commas, a quoted string, multiline text, Unicode, and semicolons in comment bodies. Comment and attachment cells use the documented import-style `date;author;body` and `date;author;filename;URL` shapes; attachment URLs use the reserved `.invalid` domain and must never be fetched.

The default includes one Epic with three numeric-ID children and one ordinary Task with two subtasks. It also includes in-run Blocks and Duplicate links, one external-key Blocks link, and one Relates link. The Epic row has no source label; the importer must add the existing `epic` label. Thirty rows have original seconds but no story points, exercising explicit conversion. Thirty other rows have both, exercising points precedence. All five Jira priority spellings, three status categories, mapped and unmapped opaque assignee tokens, story points, and original-estimate seconds are present. Plugin/custom fields, components, versions, watchers, worklogs, time spent, security levels, resolution details, and reporter values remain raw source values for omission review.

`expected.nativeSetup` lists the exact synthetic label names, cycle names, status values/categories, and source account tokens needed for fixture setup. Choose one existing Vector team as the operator-selected default team. Map the three known status names and the mapped assignee token explicitly to existing native records; leave the unmapped assignee token unmapped. Follow the mapping shape and priority policy in `docs/JIRA-CSV.md`; the fixture does not introduce importer configuration keys. The named cycles and the convention that the last repeated Sprint is current are declared Vector fixture policy, not a claim about Jira export chronology. The unmapped Sprint value stays visible in expected metadata.

Available refusal variants are:

- `generateJiraFixture({ variant: 'ambiguous-numeric-dates' })` rewrites every nonempty date-bearing cell, including Comment and Attachment timestamps, to numeric dates where both day/month orders remain possible.
- `generateJiraFixture({ variant: 'missing-required-column' })` removes the required `Issue id` header and its cells.
- `generateJiraFixture({ variant: 'unknown-status' })` changes one row to `Awaiting Product Review` and leaves its category as `To Do`.

Each variant returns adjusted expected raw counts and an `expectedRefusal` reason. All baseline instants use English abbreviated-month `D/Mon/YYYY` dates with valid `+10:00` offsets; Due date cells are date-only. The ambiguous-date variant uses four-digit years and valid timestamps but intentionally leaves both numeric orders possible across the whole file.
