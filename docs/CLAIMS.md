# Planning claims

These rows state the implemented planning behavior; CONTRACT.md defines the full product target.

| Clause | Status | Proven behavior | Evidence |
| --- | --- | --- | --- |
| REPORT-004 | done | Cycle or due-date workload shows each active member’s assigned estimates and issue count, unestimated work, personal capacity and overload. Assigned issues stay with their accountable member, including work delegated to an agent. Agent delegation itself remains unbuilt under AGENT-001. | `tests/worker/workload.test.ts`, `tests/e2e/core-workload-journey.mjs` |
