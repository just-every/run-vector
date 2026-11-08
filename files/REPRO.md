# Original findings

Original candidate: 806b1715d89a5383b5722b1b6c37a615b0665763.
Original exact-SHA Verify: 42513319748, failure. API discovery confirmed the exact head.
Failed assertion archives read once for jobs 128831161230 (imports), 128831161235 (worker-2), 128831161241 (portability), and 128831161257 (hosted-artifact). The hosted-artifact archive returned only a truncated source-lock listing, without its terminal failure; no blocked blob or archive retries were attempted. The seven ordinary assertions are complete in the other three archives.

REPRO seven: head -> 7 failed, 6 passed (13 total), five test files, exit 1.
Command: timeout 300 pnpm exec vitest run --config vitest.config.ts tests/worker/issue-session-projection.test.ts tests/worker/source-ingest.test.ts tests/worker/project-dependencies.test.ts tests/worker/follower-events.test.ts tests/worker/project-report.test.ts

1. issue-session-projection, stale edit: projected=false at line 79.
2. issue-session-projection, stale accept: projected=false at line 79.
3. issue-session-projection, stale return: projected=false at line 79.
Cause: the candidate replaced the shared activity actor read, so the existing SQL interleaving fixture no longer observes the projection and cannot revoke the session before the final native admission. The tests and their assertions are unchanged.
4. source-ingest signed native publication/replay: the populated pre-0121 upgrade snapshot expected eight operator fields; the candidate adds suspended_at and suspended_by, both null on pre-existing rows. The fixture needs the exact additive default columns while preserving every original field comparison.
5. project-dependencies direct graph: a suspended lead's previously received project_notifications row survives.
6. follower-events workflow status removal: subject_subscriptions row survives suspension.
7. project-report documents: document_notifications row survives; the next assertion also requires document_followers cleanup.
Cause of 5–7: the candidate replaced the existing notification-removal helper with a narrowed lifecycle cleanup list that omitted those custodians. Restoring recipient/follower/subscription cleanup must preserve the candidate's names, personal settings and saved views.

REPRO spec: head -> integration:check exit 1, Stale integration management/integration/deployment-spec.json. Setup had built the candidate output first. Migration 0134_member_suspension.sql is absent from the tracked deployment specification.

Fresh main at initial integration: 0e8a686c06eddd55943ed1d2690df32a8fc82213; it is an ancestor of the published candidate. Main has migrations through 0133_release_notes.sql, so candidate 0134 has no number collision.

REPRO browser counterpart: first repair head 58cceb1b4cd7ea8aeb8f55ef28cfd26fc27d19d9 -> pnpm test:collaboration exit 1 at collaboration-pagination.mjs:114. The earlier 24 browser subchecks passed; the changed recipient custody was correctly empty but a candidate-added expectation required all 40 notifications to remain. The correction restores main zero-row cleanup assertions and keeps all pagination, cached-page, independent session and personal preference/follower assertions.
