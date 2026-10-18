# Plane CSV profile

Use `plane-csv` with the original UTF-8 issue CSV. This is a documented-format, synthetic-only profile; no real owner export or hosted acceptance has been supplied. The [Plane issue schema](https://github.com/makeplane/plane/blob/master/apps/api/plane/utils/exporters/schemas/issue.py) and [field formatters](https://github.com/makeplane/plane/blob/master/apps/api/plane/utils/exporters/schemas/base.py) define the source fields. No Plane API is called.

Column names are exact and fixed. Send `mapping: {}` and an explicit default Vector team. Only team, status and project defaults are supported. Existing native references can be selected through `references`; source project names never imply a team. A default status/project fills an absent or empty value. Nonempty source values still require an available matching native reference or an explicit reference alias. No reference records are created.

| Source column | Vector treatment |
| --- | --- |
| ID; Name; Description | Source identity; title; plain description. ID is a display key such as ENG-42, not a UUID. Keep the same namespace and IDs on repeat imports; project/key changes are not reconciled to an invisible UUID. |
| State; Project; Cycle Name | Status, project and cycle through native reference resolution. |
| Priority; Estimate | Lowercase canonical priority; integer estimate points 1–100. Unsupported estimate scales are omitted with their raw value. |
| Labels; Assignees | Comma-space labels become an array. One assignee may resolve to an active operator; multiple assignees are omitted with a reason. |
| Target Date | Due day from an exact English calendar such as `Fri, 30 Oct 2026`. Impossible dates and mismatched weekdays refuse the row. |
| Parent | Source ID within the same run; shared parent validation refuses cycles and self references and reports outside-run references. |
| Start Date | Calendar validated, then retained as an omission: no native start-date field. |
| Created At; Updated At; Completed At; Archived At | Omitted: the exporter uses a 12-hour clock without AM/PM, so its instant cannot be recovered. |
| Comments; Relations; attachments | Named omissions; no comment, relation or attachment effects. Attachment bytes are absent and links are never fetched. |
| Every other nonempty column | Raw value retained and reported as unmapped. |

Missing source timestamps use the reviewed effective import time through the shared importer; that time is not presented as a recovered source timestamp. Vector has no issue archive state. Finished-status lifecycle times follow the shared importer. Original file bytes remain available; deliberately omitted mapped cells also retain their raw value in per-row diagnostics. `$profileOmissions` is reserved and refused in source files.

Follow [Move in](MOVE-IN.md): preview, review mappings/errors/omissions, acknowledge omissions, apply the reviewed fingerprint, resume staged batches, inspect reconciliation and use whole-run rollback when appropriate. Changing bytes or configuration requires a new review.

`tests/fixtures/import/plane.csv` contains two synthetic issues (`ENG-42`, `ENG-43`), two due days, two estimates, one parent and one unsupported Comments cell. With an available default team and `Ready` status reference: expect two imported issues, one parent, zero comments/links/files and one `plane_comments_unsupported` omission. Labels, assignees, projects and cycles are empty. This fixture establishes only the supported synthetic format.
