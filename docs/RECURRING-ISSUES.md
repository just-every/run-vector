# Weekly recurring issues

A weekly series creates an issue, with its template's subissues, from an existing issue template. Other cadences, editing, rescheduling and resuming remain unavailable.

In Settings, open Teams, choose a team and open Planning. Under Recurring issues, choose New recurring issue, then name the series and choose its template, first occurrence date, optional due offset, assignee, project and whether to skip a week while the previous issue is open. Each row shows the series state, its next week and its last failure. Open Configuration and history to see who configured it, the template version and timezone it captured, and each week's created, skipped or failed occurrence with links to the created issues. Pause or End stops future weeks after a confirmation; created issues are retained.

The same native commands are available to scripts. Use the installation's signed-in native session and same-origin request protection. These commands have no scoped API grant. Owners and Admins may configure series for visible teams; Members must currently belong to the selected team. Guests and Viewers cannot configure, pause or end a series.

Create a series with `POST /api/recurring-issues`:

```json
{
  "name": "Weekly review",
  "teamId": "<native team id>",
  "templateId": "<native template id>",
  "templateVersion": 1,
  "cadence": "weekly",
  "startsOn": "2030-03-03",
  "dueOffsetDays": 2,
  "skipWhileOpen": true,
  "overrides": {
    "title": "Review the weekly work",
    "priority": "high"
  }
}
```

The series records the configuring person, team, exact template version and workspace timezone. The first occurrence is due at local midnight on `startsOn`; later occurrences are seven calendar days apart in that captured zone, including daylight-saving changes. A delayed scheduler considers the latest due week without backfilling missed weeks. Changing the workspace timezone does not silently reschedule existing series.

Supported overrides are native title, Markdown description, status, priority, labels, assignee, estimate and project. Explicit empty or null values retain native template semantics. The due offset applies to the parent issue's local occurrence date; template children retain their own native defaults. Typed custom fields remain outside this implementation.

The scheduler rechecks the configuring person's current role, team membership, template version and referenced properties. The occurrence receipt, native parent, ordered children, provenance and native creation effects commit in one transaction. Repeated and concurrent ticks cannot publish the same occurrence again. With `skipWhileOpen`, an open previous parent consumes the due week as skipped; completing it allows a later week's occurrence.

Read `GET /api/recurring-issues` or `GET /api/recurring-issues/:id` for current state, next due date, restore hold, symbolic failure and occurrence history. History projects only currently readable issues. A stale or deleted template, withdrawn authority or unavailable property produces a failed occurrence without a partial graph. A later tick may retry that due week.

Send `PATCH /api/recurring-issues/:id` with `{"expectedVersion":1,"state":"paused"}` or `{"expectedVersion":1,"state":"ended"}` to stop future work. A stop that wins against an in-flight tick prevents its entire graph from committing. Existing issues are retained. Ended series cannot restart.

Native archives retain series definitions, exact occurrence identities and issue graphs. Installation activation is excluded, so restored series remain inert even after the general effects review. Start a new series explicitly for future work; historical occurrences are never replayed.
