# Huly JSON profile

Use `huly-json` with a UTF-8 top-level array of flattened issue documents. This is a documented-format, synthetic-only profile; no real owner export or hosted acceptance has been supplied. The [Huly JSON serializer](https://github.com/hcengineering/platform/blob/master/services/export/pod-export/src/json/json-serializer.ts) writes flattened document data, while the [converter](https://github.com/hcengineering/platform/blob/master/services/export/pod-export/src/converter.ts) resolves references and dates. An envelope such as `{ "issues": [...] }` is unsupported. No Huly API is called.

Every row must have `_class: "tracker:class:Issue"`; other classes are row errors and are never silently skipped. Export only issues, or explicitly select those documents before submitting a mixed export. Column names are exact and fixed: send `mapping: {}` and an explicit default Vector team. Only team, status and project defaults are supported. Use reviewed `references` to select existing native records; none are created. A source project is not a native team.

| Source field | Vector treatment |
| --- | --- |
| _id; title | Stable opaque source identity; issue title. |
| description | Text imports as supplied. Objects/arrays are omitted with the raw markup and a reason, without stringification into the native description. |
| status; space; assignee | Native status, optional project and active operator references. Exported reference text can be an identifier, title, email, name or unresolved ID; select the intended native target. Missing space leaves project empty or uses the selected project default. |
| priority | Numeric 0 → none, 1 → urgent, 2 → high, 3 → medium, 4 → low. Other values refuse the row. |
| createdOn; modifiedOn | Valid ISO instants with explicit timezone, normalized to UTC. Impossible calendar days, offsetless or malformed timestamps refuse the row. |
| identifier; _class | Retained source metadata, reported as omissions; Vector assigns its own native identifier. |
| dueDate | Omitted: the exported instant has no selected timezone-to-calendar policy. |
| estimation | Omitted: source hours do not establish native estimate points. |
| attachments | Relative paths retained; the JSON contains no file bytes. Nothing is fetched or attached. |
| labels; comments; other nonempty fields | Unsupported collections and unmapped fields are retained and reported. |

No hours conversion or due-day policy is implemented by this profile. Missing source timestamps use the reviewed effective import time through the shared importer. Original file bytes remain available; omitted mapped values also remain in per-row diagnostics. `$profileOmissions` is reserved and refused in source files.

Follow [Move in](MOVE-IN.md): preview, resolve errors and references, review and acknowledge omissions, apply the reviewed fingerprint, resume staged batches and inspect reconciliation. Repeat/resume and conflict-aware whole-run rollback use the existing import services. Changed bytes or configuration need another review.

`tests/fixtures/import/huly.json` has two synthetic issues (`huly-issue-1`, `huly-issue-2`), two text descriptions, four source instants and priorities high/low. With a default team and `Ready` status reference: expect two issues and zero parents/comments/links/files. Five nonempty source fields are omitted: two `_class`, two `identifier`, and one `estimation` (`huly_hours_not_points`). Projects are absent. This fixture establishes only the supported synthetic format.
