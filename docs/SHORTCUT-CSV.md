# Shortcut CSV profile

Use `shortcut-csv` with the original UTF-8 story CSV. This is a documented-format, synthetic-only profile; no real owner export or hosted acceptance has been supplied. [Shortcut's export guide](https://www.shortcut.com/help/admin/export-data/) names the lowercase export columns. It does not establish list delimiters or a timestamp grammar. CSV importer semicolon syntax is not evidence about exported lists. No Shortcut API is called.

Columns are exact and fixed: send `mapping: {}`. Only team, status and project defaults are supported; they fill missing/empty cells. Native references resolve through the shared importer, including explicit `references` overrides. Choose existing team/status/project/cycle records; none are created.

| Source column | Vector treatment |
| --- | --- |
| id; name; description | Stable story source ID; title; description. Vector assigns its own native identifier. |
| state; team; project; iteration | Native status, team, optional project and optional cycle through reference resolution. |
| estimate | Integer estimate points 1–100, or empty; other values refuse the row. |
| priority | Supported subset: scalar none, urgent, high, medium or low, case insensitive. Other custom priority values are retained as a named omission. |
| created_at; updated_at | Supported subset: possible ISO instants with explicit timezone. Unsupported values are omitted with their raw cell and a reason; timezone is never guessed. |
| due_date | Supported subset: valid `YYYY-MM-DD` calendar day. Timestamps and localized/invalid dates are omitted with a reason. |
| owners; labels; epic label columns | Entire cell omitted with a delimiter-unverified reason, including apparently single-valued cells. No first owner or guessed label is selected. |
| is_blocked; is_a_blocker | Omitted: booleans contain no relation endpoints. |
| is_archived | Omitted: Vector has no issue archive state. |
| tasks; external tickets; other nonempty columns | Named unsupported/unmapped omissions; no issue/comment/link/file effects are inferred. |

Accepted timestamp syntax is `YYYY-MM-DDTHH:mm:ss[.sss]Z` or the same with `±HH:mm` (maximum offset 14 hours). Seconds are required; fractions have one to three digits. Impossible calendar dates are rejected by validation before timestamp conversion. These are profile-supported encodings, not a claim that every Shortcut export uses them. Missing or deliberately omitted source times use the reviewed effective import time through the shared importer.

Original bytes remain available; deliberately omitted mapped cells also retain their raw value in per-row diagnostics. `$profileOmissions` is reserved and refused in source files. Follow [Move in](MOVE-IN.md) for preview, reference/error/omission review, acknowledgement, apply by reviewed fingerprint, staged resume, reconciliation, repeat and whole-run rollback. Changing configuration or bytes requires a fresh preview.

`tests/fixtures/import/shortcut.csv` has two synthetic stories (`101`, `102`), two descriptions, two estimates, two due days and four source instants. With a default team and `Ready` status reference: expect two issues, zero parents/comments/links/files, and one `shortcut_list_encoding_unverified` omission for the first story's owners cell. Team/project/iteration cells are empty. This fixture establishes only the supported synthetic format.
