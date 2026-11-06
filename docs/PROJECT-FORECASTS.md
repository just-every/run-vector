# Native project forecast

Authenticated project detail (`GET /api/projects/:projectId`) includes a
`forecast` alongside the unchanged REPORT-002 `report`. It creates no stored
plan or outbound action. Current project access and private-team visibility
apply to every input, including throughput and dependencies.

The `daily-throughput-bootstrap-v1` method uses 28 closed workspace calendar
days. Each currently visible, currently Completed project issue contributes to
the day of its latest completion, following REPORT-001 Insights semantics.
Reopening withdraws that issue from delivered throughput. Today's completions
are excluded until its workspace day closes. Zero days remain in the sample.
This differs intentionally from REPORT-002's immutable, aggregate-only closed
history, which remains unchanged after erasure or reopening.

The remaining count includes all nonterminal project issues and the transitive
closure of their visible, unresolved prerequisites, once each. Canceled,
duplicate and completed work needs no further completion slot. Open archived
issues remain scope. Hidden prerequisites and hidden throughput are never
inferred or disclosed; the response explicitly qualifies its visible scope.

Capacity comes only from each active assignee's Workload date range beginning
on the current workspace date and ending 27 days later, inclusive. Cycle
capacity and other date ranges are not borrowed. Visible commitments in that
range, outside the required scope, consume their assignee's capacity. Missing
estimates, unassigned work, inactive assignees, unknown or exhausted capacity,
or unestimated competing commitments withhold unsupported dates.

Known remaining capacity is spread uniformly over the 28 calendar days. A
conservative serial schedule visits prerequisites before dependents and ready
issues in stable identity order, respecting existing project and issue start
dates. Each issue takes its points times 28 divided by its assignee's remaining
capacity; zero-point issues still need a throughput completion slot. This is
an explicit modeling assumption, not an optimized allocation or a comparison
of people. The schedule's ceiling in calendar days is a capacity floor.

Independently draw a daily completed count from the empirical sample on each
future day. Exact discrete convolution computes the probability that the
remaining count has completed by each day. The 50% and 85% dates are the first
days meeting each probability and the capacity floor. Day one ends on the
current workspace date. Neither quantile extends beyond the known capacity
interval. A quantile outside that interval stays null; another supported
quantile may still be returned with `insufficient-evidence` status.

At least 28 closed days since project creation and three visible completed
issues are required. Missing evidence returns explicit reasons. Empty remaining
scope has `nothing-remaining` status; completed, canceled or archived projects
have `inactive` status. Both return null dates. Dates are conditional model
quantiles, with independent daily samples and unchanged future scope assumed;
they are not calibrated delivery guarantees.

The mounted journey in `tests/worker/project-report.test.ts`, extended by
`tests/worker/project-forecast-scenario.ts`, compares both quantiles with an
independent binomial-tail reference on native issue transitions and Workload
capacity. The seed has no forecast choice screen or saved assumptions. Complete
scope and date options, lead selection, stored plans, actual-outcome comparison,
release and cycle variants, and agent or provider production remain PUSH-007
requirements.
