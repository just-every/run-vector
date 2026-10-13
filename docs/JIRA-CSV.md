# Jira CSV file importer

Choose **Jira All Fields CSV (supported profile)** in Settings → Data / Move in, or use `pnpm run import:issues -- preview --format jira-csv` with the same file, source namespace and mapping configuration. The existing preview, apply, status, resume, report and whole-run rollback services handle it. No new schema is needed. This is a file importer, not a Jira integration: it makes no Atlassian requests and never fetches attachment URLs.

The current claim is **documented format, synthetic-only; real export not supplied**. Export the selected Jira issues with **All Fields** and preserve the UTF-8 file. [Atlassian's Cloud export guide](https://support.atlassian.com/jira/kb/how-to-export-issues-from-jira-cloud-in-csv-format/) documents separate chronological Comment columns and attachment URLs. Attachment bytes are absent; supply bytes separately if wanted. Public import examples support some accepted encodings below, but do not establish that every native export has these spellings or encodings. Server and Data Center variants are unverified.

## Part 1: reader and scalar apply

Preview writes nothing. It lists every nonempty unsupported column occurrence with its physical starting row, original header and one-based column position. Apply requires no row errors and acknowledgement of omissions. The report retains those omissions and the exact original file. The full concept/count review and confirmation tables are Part 2; comments, relations, labels, sprints and old-key search are Part 3. Until then scalar-only apply is explicit: none of those deferred concepts is silently imported.

Headers are matched ignoring case and surrounding whitespace, while every original spelling, position and raw value remains in the source record. Repeated multivalue and unknown headers are preserved as ordered occurrences, including empty occurrences. Repeated scalar columns are refused because choosing one would hide another. Mapped CSV and Linear CSV still require distinct headers. Quoted commas, semicolons, Unicode and multiline text are preserved; original bytes, including BOM and line endings, are retained.

Each Issue id must occur only once in a Jira file, including otherwise identical rows. One Issue key cannot belong to multiple Issue ids; key comparisons ignore case and surrounding whitespace, while IDs remain opaque and exact. Preview names every affected physical starting row and refuses apply. Every repeated row is still reviewed, and its nonempty unsupported occurrences remain visible in omissions even when preview is invalid.

| Column read | Current treatment |
| --- | --- |
| Issue id; Issue key; Summary | All three columns and each row's values are required. Issue id is the stable, opaque source record ID scoped to the supplied source namespace. Summary becomes title. Issue key is a separate retained occurrence, conspicuously omitted from old-identifier display/search until Part 3. |
| Description | Imports as description when present. |
| Issue Type | Retained and listed as omitted. Planned: Epic becomes an ordinary parent issue with the `epic` label. Other types remain originals. |
| Status; Status Category | Status requires an explicit source-value → native status-ID entry, even when its name matches. Status Category is retained as an omission; suggestions for review are To Do → Unstarted, In Progress → Started, Done → Completed. A default native status applies only when Status is empty/absent. |
| Priority | Requires an explicit source-value → `none`, `low`, `medium`, `high` or `urgent` table. No inference from Highest or any matching priority name. |
| Assignee; Reporter | Assignee resolves only through explicit mapping to an existing active native operator ID; otherwise it imports unassigned with a per-row omission. Reporter is retained and omitted. No operators are created or account identities guessed. |
| Created; Updated; Due date; Resolved | All nonempty values participate in date detection. Created/Updated import as instants and Due date as a calendar day. Resolved is retained and omitted. Missing created time uses the reviewed effective time; missing updated time uses creation time. |
| Parent; Parent id | Both retained and omitted pending relation effects. Current Cloud documents Parent with numeric source IDs; Parent id is only a legacy compatibility spelling. |
| Sprint, including repeated columns | Each occurrence retained and omitted. Planned repeated-name profile convention: explicitly map the last occurrence to an exact-name cycle, retain earlier values as rollover. This is not proven Jira export chronology. |
| Labels, including repeated columns | Each occurrence retained and omitted pending label effects. |
| Story point estimate | Integer points from 1–100 or empty; other values refuse apply. This is an accepted profile name, not a proven universal native header. |
| Original estimate | Seconds, retained and conspicuously omitted. No seconds-to-points conversion is made. |
| Outward issue link (Blocks), (Duplicate), (Relates) | Every occurrence retained and omitted pending relation effects. These spellings are supported-profile concepts, not a verified complete Cloud export contract. Unknown/custom link columns are equally visible. |
| Comment, including repeated columns | Compatible import-style `date;author;body`. The body may contain semicolons. Every timestamp participates in detection. Every occurrence is retained and omitted until imported-comment effects are implemented. |
| Attachment, including repeated columns | Compatible import-style `date;author;filename;URL`. Every timestamp participates in detection. Metadata remains an omission; URLs are neither fetched nor added as native links. |
| Every other column | Each nonempty occurrence appears in omissions, including custom/plugin fields, Components, Fix versions, Affects versions, Watchers, Worklog, Time spent, Security level and Resolution detail. |

The [Cloud parent mapping guide](https://support.atlassian.com/jira/kb/keep-issue-parent-child-mapping-during-csv-import-to-jira-cloud/) gives Issue id, Issue key, Summary, Issue Type and Parent examples. [Cloud's Parent transition](https://support.atlassian.com/jira-software-cloud/docs/upcoming-changes-epic-link-replaced-with-parent/) explains the older parent-ID field. [Issue keys change on project moves](https://support.atlassian.com/automation/kb/how-to-store-the-old-issue-key-when-an-issue-is-moved-from-one-project-to/); [the issue ID remains stable](https://support.atlassian.com/jira-align/kb/changes-to-the-work-item-in-jira-align-still-sync-to-jira-even-after-its-moved-to-an-unlinked-jira-project/) (the latter source discusses Jira Align synchronization). Use a different source namespace for a different Jira site.

[Cloud CSV import documentation](https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/) demonstrates repeated multivalue columns and the comment/attachment metadata encodings. These are import encodings, not a promise about all export variants. Repeated Comment is independently documented by the export guide; repeated Attachment metadata is not. [Cloud's sprint CSV example](https://support.atlassian.com/jira/kb/add-a-jira-work-item-to-a-future-sprint-without-losing-closed-sprints/) instead uses comma-separated sprint IDs in one column and warns that names may repeat. All such Sprint values currently remain visible omissions. [Original estimate is seconds](https://support.atlassian.com/automation/kb/importing-the-original-estimate-field-using-csv/).

## Date grammar and refusal policy

The reader considers **all** nonempty Created, Updated, Due date and Resolved values and the leading timestamp of **every** Comment and Attachment occurrence. It never samples the first rows to decide the order. Preview and the CLI review file show the detected calendar pattern, first sample, total date cells, supplied fixed offset, short-year century and policy.

Accepted calendars are `YYYY-MM-DD`, numeric `D/M/YYYY` or `M/D/YYYY`, and English abbreviated-month `D/Mon/YYYY` (`Jan`–`Dec`, case insensitive). Years may have four digits (1000–9999), or two digits with an explicitly reviewed `jira.shortYearCentury` (for example 2000 maps 00–99 to 2000–2099). No century is guessed. One file must use one calendar family, one year width and one numeric day/month order. When both numeric orders remain possible across the file, preview refuses; conflicting numeric order, mixed families, impossible dates and invalid leap days also refuse. A disambiguating comment or attachment date is evidence just like Created.

A calendar may be followed by a space or `T`, then `H:mm` or `H:mm:ss`. Without a marker this is a 24-hour clock; with `AM` or `PM` (case insensitive, optional separating space) the hour must be 1–12. Midnight is 12 AM and noon is 12 PM. The clock may end with `Z` or `±HH:mm`. The grammar intentionally excludes fractional seconds, localized month names and dash-separated local dates. Public Jira examples such as `13/Feb/26 1:30 PM` are accepted with the century explicitly supplied. Unsupported grammar is refused with an actionable reason.

A date-only Due date needs no offset. Every other offsetless instant, including metadata timestamps that will only be retained, requires `jira.sourceOffset`: `Z` or a fixed offset within `-14:00` to `+14:00`. A cell's explicit offset takes precedence. The reader never uses the machine timezone, workspace timezone or implicit UTC. Due date remains the source calendar day even if it includes a time. A fixed offset cannot infer daylight saving; files spanning offset changes must supply per-cell offsets. No IANA timezone conversion is implemented in this part. [Jira export preferences affect timestamps](https://support.atlassian.com/jira/kb/jira-csv-export-discrepancy-in-the-date-and-time-when-exporting-issues-with-csv-export/).

## Explicit configuration

The CLI's `--mapping` file accepts this shape (replace IDs with active records from this workspace):

```json
{
  "mapping": {},
  "defaults": {"team": "NATIVE_TEAM_ID"},
  "references": {
    "status": {"Ready": "NATIVE_STATUS_ID"},
    "assignee": {"source-account-token": "ACTIVE_OPERATOR_ID"}
  },
  "jira": {
    "sourceOffset": "+10:00",
    "shortYearCentury": 2000,
    "priorities": {"Highest": "urgent", "High": "high", "Medium": "medium", "Low": "low", "Lowest": "low"}
  }
}
```

This example is an explicit operator decision, not an automatic priority policy. Jira's built-in columns cannot be remapped by generic column name, and only default team/status are accepted. Configuration and exact file bytes participate in the reviewed fingerprint. Use the source site's stable name for deduplication. Follow [Move in](MOVE-IN.md) for session-file protection, preview/review/apply, durable run commands and conflict-aware whole-run rollback. No hosted acceptance, attachment-byte handling, live Atlassian behavior or real-team export fidelity is proven.
