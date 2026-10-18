# Planning claims

These rows state the implemented planning behavior; CONTRACT.md defines the full product target.

| Clause | Status | Proven behavior | Evidence |
| --- | --- | --- | --- |
| REPORT-004 | done | Cycle or due-date workload shows each active member’s assigned estimates and issue count, unestimated work, personal capacity and overload. Assigned issues stay with their accountable member, including work delegated to an agent. Agent delegation itself remains unbuilt under AGENT-001. | `tests/worker/workload.test.ts`, `tests/e2e/core-workload-journey.mjs` |
| VIEW-006 | done | Team lists and boards share manual order; saved views keep independent sequences. Drag, keyboard and move buttons persist across browsers without changing Current. Supported Jira Rank and Linear API-file sortOrder import, repeat, rollback and archive restore are proven with synthetic files; real owner exports remain unproven. | `tests/worker/manual-order.test.ts`, `tests/worker/manual-order-import.test.ts`, `tests/e2e/core-manual-order-journey.mjs`, `tests/worker/data-http.test.ts` |
