# Writing and recovering issue descriptions

Issue descriptions and comments use the same Markdown editor. Use **+ Insert** or type `/` at the start of a line for headings, lists, checklists, quotes, dividers, tables, code blocks, links, mentions and collapsible sections. Bold, italic and link also have Command/Ctrl-B, -I and -K shortcuts. Command/Ctrl-Shift-7 starts a checklist and -Shift-8 a bulleted list. Select a table cell to add or remove rows and columns. Rich HTML paste converts supported formatting to Markdown and discards scripts, styles, forms and images.

Tick description checkboxes directly. Each changed tick saves a version-checked description revision and an activity entry. Two delayed ticks can both succeed when their respective item text is unchanged; a changed target returns a conflict. A comment's checklist is writable only by its author. Checklist progress appears on issue list rows, board cards and the issue API.

**Description history** retains the original and later descriptions with their author and time. Choose any two revisions to compare their Markdown. **Restore earlier revision** writes a new revision rather than editing the old one. Existing history is migrated from recorded activity; historical issue versions that were never recorded remain unknown.

The native authenticated API provides:

- `GET /api/issues/:identifier/description-history`
- `POST /api/issues/:identifier/description-restore` with `expectedVersion` and `revisionId`
- `POST /api/issues/:identifier/checklist` with `expectedVersion`, zero-based task `index`, exact source item `text`, and `checked`
- `POST /api/issues/:identifier/comments/:commentId/checklist` with `expectedBody`, task `index`, exact `text`, and `checked`

The same paths under `/api/v1` admit scoped API tokens: history requires `issues:read`, description restores/ticks require `issues:write`, and comment ticks require `comments:write`. Native requests retain session and same-origin checks. Changed or stale targets return 409; another author's comment tick returns 403. Archives carry revisions and Markdown; issue deletion removes the revision content, and member erasure anonymizes revision authors.

Inline image/video commands, templates, documents, native mobile editing and live collaborative editing remain contract gaps. Existing Attach file controls remain available in issue discussion. Remote Markdown images still load only when a reader asks, and raw HTML is never rendered.
