# Sentry intake routing

Native Sentry intake supports ordered source-condition rules. Configuration uses
Settings API doors; rendered routing controls remain unimplemented. Workspace
Owners and Admins use `PUT /api/settings/triage-routing`. Team settings managers
use `PUT /api/settings/teams/:id/triage-routing` under the team's current settings
permission. Guests and Viewers cannot configure either scope. The corresponding
GET returns the saved version, rules, registered Sentry sources and visible
active destinations.

A save supplies `expectedVersion` and an ordered `rules` array. Each rule has a
stable UUID `id`, a `name`, the registered connection's `sourceId`, and a visible
`targetTeamId`. The first save expects version zero. A successful save increments
the version and records its configuring person and audit. A stale save returns
409 without changing configuration. Unsupported conditions and actions are
refused rather than silently ignored.

Workspace rules run before team rules; the first matching registered source
wins within each ordered list. Generic signed sources and caller-supplied
provider labels cannot qualify as Sentry. A nonmatching event keeps its original
source team's intake placement. A matching event creates native intake in the
chosen team, retaining the source connection's original team and credentials.
The item records the rule's identity, name, saved revision, configuring person
and source identity. Its native detail projection exposes this provenance.

Routing is part of the same transaction as issue creation, evidence, source
identity, replay receipt, creation activity and target-team triage notification.
It never declines or deletes, bypasses intake, or moves an existing source record.
Later evidence retains the original item and recorded rule even after rules are
reordered or removed. Native Sentry resolution and configured regression handling
continue on that item's current workflow.

The conservative authority floor requires the configuring person to remain an
active settings manager for the recorded scope, with current visibility of the
source team and destination. The connection custodian must remain an active
Owner or Admin with current access to both teams. An archived destination,
withdrawn permission or lost private-team access refuses the event, including a
captured replay, without falling back to another team. Concurrent configuration
or authority changes abort publication. Configuration grants no receiver secret
or lasting capability. A restored source remains inert until its excluded
credentials are re-entered and restored effects are reviewed.

Configuration and immutable item provenance are included in native archives.
Earlier imported issue snapshots omit unset routing provenance, preserving their
existing comparison semantics. Removed configuring people have no retained name
in provenance; current detail reads resolve only an active person's display name.

Zendesk routing, the complete two-source acceptance, label, customer-tier, text
and form-field conditions, label, priority, assignee and template actions,
trusted-source Backlog bypass and other intake producers remain unimplemented.
The real Zendesk adapter, actual customer and form models, team feature settings
and triage responsibility keep their own obligations. No provider commissioning
or complete TRIAGE-002 acceptance is claimed.
