# Jira CSV file importer

Choose **Jira All Fields CSV (supported profile)** in Settings → Data / Move in, or use `pnpm run import:issues -- preview --format jira-csv` with the same file, source namespace and mapping configuration. The existing preview, apply, status, resume, report and whole-run rollback services handle it. No new schema is needed. This is a file importer, not a Jira integration: it makes no Atlassian requests and never fetches attachment URLs.

The current claim is **documented format, synthetic-only; real export not supplied**. Export the selected Jira issues with **All Fields** and preserve the UTF-8 file. [Atlassian's Cloud export guide](https://support.atlassian.com/jira/kb/how-to-export-issues-from-jira-cloud-in-csv-format/) documents separate chronological Comment columns and attachment URLs. Attachment bytes are absent; supply bytes separately if wanted. Public import examples support some accepted encodings below, but do not establish that every native export has these spellings or encodings. Server and Data Center variants are unverified.

## Part 2: loss review and confirmed native fields

Preview writes nothing. One structured `jiraReview` appears in the public preview response, the Settings Data page, the CLI's private review file and the stored reconciliation report. Each present concept lists original column names/positions, distinct physical starting rows, nonempty occurrence counts, repeated-value counts, and action/reason groups with their own distinct-row and value totals. Every occurrence retains the source ID, key, raw value and row. Comment/attachment details separately show author, source timestamp, body or filename and URL; URLs render as text, never links. Unresolved assignees, sprints and outside-file relationships list each source row/value and reason.

Status and priority confirmation tables show suggestions only. Selecting a target invalidates the previous review; preview again before apply. The server repeats preflight, checks the fingerprint (including every configuration option), refuses all row errors, and requires omission acknowledgement. Parents, blocks, duplicates, imported comments and visible/searchable old keys are explicitly **not imported in this milestone**; Part 3 owns those effects. Epics are ordinary issues with the existing `epic` label; becoming parents still awaits Part 3. No attachment link opt-in exists yet; optional named HTTPS links are deferred to Part 3.

Headers are matched ignoring case and surrounding whitespace, while every original spelling, position and raw value remains in the source record. Repeated multivalue and unknown headers are preserved as ordered occurrences, including empty occurrences. Repeated scalar columns are refused because choosing one would hide another. Mapped CSV and Linear CSV still require distinct headers. Quoted commas, semicolons, Unicode and multiline text are preserved; original bytes, including BOM and line endings, are retained.

Each Issue id must occur only once in a Jira file, including otherwise identical rows. One Issue key cannot belong to multiple Issue ids; key comparisons ignore case and surrounding whitespace, while IDs remain opaque and exact. Preview names every affected physical starting row and refuses apply. Every repeated row is still reviewed, and its nonempty unsupported occurrences remain visible in omissions even when preview is invalid.

| Column read | Current treatment |
| --- | --- |
| Issue id; Issue key; Summary | All three columns and each row's values are required. Issue id is the stable, opaque source record ID scoped to the supplied source namespace. Summary becomes title. Issue key is a separate retained occurrence, conspicuously omitted from old-identifier display/search until Part 3. |
| Description | Imports as description when present. |
| Issue Type | Epic becomes an ordinary issue with the exact existing `epic` label; a missing label is an error. Other types (including subtasks) are retained and listed as omitted. Parent links await Part 3. |
| Status; Status Category | Status requires an explicit source-value → native status-ID entry, even when its name matches. Status Category is retained for review only; suggestions are To Do → Unstarted, In Progress → Started, Done → Completed. A default native status applies only when Status is empty/absent. |
| Priority | Requires an explicit source-value → `none`, `low`, `medium`, `high` or `urgent` table. Suggestions are Highest → urgent, High → high, Medium → medium, Low → low, Lowest → low; none resolves automatically. |
| Assignee; Reporter | Assignee resolves only through explicit mapping to an existing nonremoved native operator whose mapped Base identity is active. Blank stays unassigned; an unmapped token imports unassigned with a per-row omission; an explicitly mapped missing/removed/inactive target is a row error. Reporter is retained and omitted. No operators are created or account identities guessed. |
| Created; Updated; Due date; Resolved | All nonempty values participate in date detection. Created/Updated import as instants and Due date as a calendar day. Resolved is retained and omitted. Missing created time uses the reviewed effective time; missing updated time uses creation time. |
| Parent; Parent id | Both retained and omitted pending relation effects. Current Cloud documents Parent with numeric source IDs; Parent id is only a legacy compatibility spelling. |
| Sprint, including repeated columns | Only the last **nonempty** occurrence may map explicitly to an exact-name existing open cycle in the same team. Earlier nonempty occurrences are retained and counted as “rolled over in Jira”. Unmapped sprints are per-row omissions; invalid explicit targets are row errors. Completed/canceled/duplicate issues omit cycle commitment per row. This positional policy is not proven Jira export chronology. |
| Labels, including repeated columns | Each distinct exact existing label is applied once per issue; every raw occurrence is retained and counted. Missing labels are row errors; labels are neither guessed nor created. Generic label aliases do not change this Jira policy. |
| Story point estimate | Integer points from 1–100 or empty; other values refuse apply. This is an accepted profile name, not a proven universal native header. |
| Original estimate | Seconds are retained. Without an explicit `jira.originalEstimateSecondsPerUnit` policy they are omitted. With it, seconds must convert exactly into an integer 1–100; no rounding or default unit is allowed. Story points win when both are present, and the seconds are then visibly retained without conversion. |
| Outward issue link (Blocks), (Duplicate), (Relates) | Every occurrence retained and omitted pending relation effects. These spellings are supported-profile concepts, not a verified complete Cloud export contract. Unknown/custom link columns are equally visible. |
| Comment, including repeated columns | Compatible import-style `date;author;body`. The body may contain semicolons. Every timestamp participates in detection. Every occurrence is retained and omitted until imported-comment effects are implemented. |
| Attachment, including repeated columns | Compatible import-style `date;author;filename;URL`. Every timestamp participates in detection. Metadata remains an omission; URLs are neither fetched nor added as native links. |
| Every other column | Each nonempty occurrence appears in omissions, including custom/plugin fields, Components, Fix versions, Affects versions, Watchers, Worklog, Time spent, Security level and Resolution detail. |

The [Cloud parent mapping guide](https://support.atlassian.com/jira/kb/keep-issue-parent-child-mapping-during-csv-import-to-jira-cloud/) gives Issue id, Issue key, Summary, Issue Type and Parent examples. [Cloud's Parent transition](https://support.atlassian.com/jira-software-cloud/docs/upcoming-changes-epic-link-replaced-with-parent/) explains the older parent-ID field. [Issue keys change on project moves](https://support.atlassian.com/automation/kb/how-to-store-the-old-issue-key-when-an-issue-is-moved-from-one-project-to/); [the issue ID remains stable](https://support.atlassian.com/jira-align/kb/changes-to-the-work-item-in-jira-align-still-sync-to-jira-even-after-its-moved-to-an-unlinked-jira-project/) (the latter source discusses Jira Align synchronization). Use a different source namespace for a different Jira site.

[Cloud CSV import documentation](https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/) demonstrates repeated multivalue columns and the comment/attachment metadata encodings. These are import encodings, not a promise about all export variants. Repeated Comment is independently documented by the export guide; repeated Attachment metadata is not. [Cloud's sprint CSV example](https://support.atlassian.com/jira/kb/add-a-jira-work-item-to-a-future-sprint-without-losing-closed-sprints/) instead uses comma-separated sprint IDs in one column and warns that names may repeat. Numeric/comma-separated IDs are opaque values and are not converted into names; without a valid explicit exact-name cycle mapping they remain visible omissions. [Original estimate is seconds](https://support.atlassian.com/automation/kb/importing-the-original-estimate-field-using-csv/).

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
    "assignee": {"source-account-token": "ACTIVE_OPERATOR_ID"},
    "cycle": {"Sprint 42": "EXACT_NAME_OPEN_CYCLE_ID"}
  },
  "jira": {
    "sourceOffset": "+10:00",
    "shortYearCentury": 2000,
    "priorities": {"Highest": "urgent", "High": "high", "Medium": "medium", "Low": "low", "Lowest": "low"}
  }
}
```

Optionally add `"originalEstimateSecondsPerUnit": 3600` inside `jira` only if the team explicitly chooses one native estimate unit per hour. It is not a default and is not needed for story points.

This example is an explicit operator decision, not an automatic priority policy. Jira's built-in columns cannot be remapped by generic column name, and only default team/status are accepted. Configuration and exact file bytes participate in the reviewed fingerprint. Use the source site's stable name for deduplication. Follow [Move in](MOVE-IN.md) for session-file protection, preview/review/apply, durable run commands and conflict-aware whole-run rollback. No hosted acceptance, attachment-byte handling, live Atlassian behavior or real-team export fidelity is proven.


## Executed synthetic evidence

The single DATA-009 public-route journey uses `tests/fixtures/import/jira/generate.mjs`: 300 issues, 41 positional columns, normal keys `VJ-1`–`VJ-300`, opaque numeric source IDs, a label-free source Epic, subtasks and parent/block/duplicate/related references. Independent declared column totals were checked with Python `csv.reader` for baseline, unknown-status, missing-column and all-date-ambiguous variants. Repeated concepts contain 176 Sprint values on 151 rows, 172 Labels on 161 rows, 102 Comments on 95 rows, and 38 Attachments on 37 rows. Thirty rows contain only original-estimate seconds; thirty contain both seconds and story points.

Preview checks exact occurrence counts, physical rows, identities and metadata against fixture expectations and leaves every issue, relation and import table count unchanged. Refusals cover unknown status even with a known category, every-date ambiguity, required-column absence, unconfirmed mappings, invalid explicit targets, missing omission acknowledgement and changed configuration after review. A small native apply proves automatic Epic labeling, active mapped assignment, last nonempty sprint selection and explicit exact estimate conversion, persists the same review, and rolls back. Original date/identity/scalar assertions remain in the same journey. The broader 300-issue relationship/comment/old-key apply and rollback acceptance remains Part 3.

No migration or upgrade proof is required: existing import-kit lifecycle, source identities, exact originals and `vector_import_reports.report_json` are reused. The optional detailed Jira review is removed when person erasure finds its raw source metadata, avoiding duplicate author tokens in retained summaries; source metadata also exposes the author token to the existing erasure matcher. This does not establish real export fidelity, attachment-byte handling or hosted Jira behavior.
