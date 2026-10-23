# Insights

Owners, Admins and Members open Insights at /app/insights. Guests receive 403 on
the document, chart and CSV doors. The Viewer role is not implemented yet.

Reports reuse issueListQuerySchema, browseWhere and the viewer-scoped database.
The explicit Include completed option adds the issue list's Completed query to
its normal result. Archived issues remain excluded. More than 10,000 matching
issues returns a visible request error asking for narrower filters; results are
never silently truncated.

Weeks start Monday in the workspace timezone. From and Through are inclusive
workspace dates of the plotted event. Creation and bug inflow use the creation
date. Throughput and delivery durations use the latest completion of currently
Completed issues; reopening removes an issue until it completes again. Lead
time is elapsed days from creation. Cycle time is elapsed days from the first
recorded Started-category entry, including creation in Started, to completion.
A missing Started transition is unknown and excluded, with a notice.

Duration percentiles are nearest rank: sort n observed durations and select
ceil(p * n), using one-based positions, for p = 0.5, 0.75 and 0.9. They are
per-issue, not estimate-weighted. Count and estimate are both available for
flow, throughput and bug inflow. Null estimates contribute zero points and are
reported separately. Duration charts retain issue count, total elapsed days,
median, p75 and p90; bars show median days.

Time in status totals each issue's recorded intervals in a status through the
read instant and buckets those observations into the current week. Missing
history and deleted historical status names remain unknown. Open bug age is a
current snapshot of nonterminal issues currently carrying a Bug label (case
insensitive), grouped into the current week. A workspace without that label has
no bug series. Vector does not store issue types. Grouping uses current team,
project, labels, assignee or priority. An issue with several labels contributes
once to each label group; groups must not be summed as distinct issues.

Each bar and table row opens the exact issue set for that week, group, series
and filter. The CSV for a selected bucket exports those issues; otherwise it
exports the chart table. Formula-leading =, +, -, @, tab and carriage return are
prefixed with an apostrophe, matching the Jira import report.

Triage time (TRIAGE-001), SLA breaches (AUTO-004), customer tier (CUST-*), issue
types, private-team refusal (ROLE-002), Viewer admission (ROLE-013), and data
Vector does not store remain outside this partial implementation. There is no
/api/v1 series endpoint. Existing visibility policy is reused without inventing
a separate private-team model.
