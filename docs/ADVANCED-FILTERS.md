# Advanced issue filters

Open **Advanced filter** on an issue list, board or saved issue view. Type an
expression or use **Build expression**. Both controls produce the same bounded
native expression. Save view retains that expression together with the existing
list controls. Ordinary scalar URL filters and personal list preferences remain
supported; other selected controls still constrain the expression.

```text
(priority=high OR priority=urgent) AND NOT blocked
estimate>=5 AND due before next Friday
updated in the last 7 days
NOT (project=none OR assignee=none)
```

NOT binds first, then AND, then OR. Parentheses select other grouping. The bar
suggests current visible records. Parent, related, blocks and blockedby values can
be found by title; choose a suggestion to insert its stable issue identifier.
Unsupported fields, operators, malformed groups and expressions beyond the
bounded grammar are refused visibly. An invalid draft leaves the applied query
and saved definition intact.

| Fields | Values and operators |
| --- | --- |
| priority and blocked | Native priority values; blocked is an operand. Use NOT to negate either. |
| category and status | Workflow category or current status identity. Explicit status and completed-date expressions include completed work. |
| team, assignee, project, cycle, label, milestone and release | Current record identity from a suggestion or menu. Assignee also accepts me. Nullable fields accept none. |
| creator and follower | Current person identity, me or none. Removed people are not current operands. |
| parent, related, blocks and blockedby | Visible issue identifier or none. Blocking links differ from the computed blocked state, which ignores completed blockers. |
| git | Recorded linked pull-request state: open, closed, merged or none. Review and required-check states are not inferred. |
| title, identifier, description, outcome and impact | Equality, inequality or literal case-insensitive substring matching with ~. Quote text containing spaces or punctuation. |
| estimate | Integer comparisons with =, !=, <, <=, > and >=; none means unestimated. |
| due, start, created, updated, completed, canceled and deferred | Calendar-date comparisons, before, after, on, or within "last N days". Nullable dates accept none. |

Use `outcome="none"` to find the literal text and `outcome=none` to find a
missing outcome. Native negation is total Boolean negation: missing values can
match a negated comparison. For example, `NOT estimate>=5` includes unestimated
issues. Inequality on a nullable native operand has the same behavior.

Calendar dates accept an ISO date, today, tomorrow, yesterday and next weekday.
Next Friday is the next occurrence strictly after today. A last-N-days window
contains today and the preceding N minus one workspace calendar days. Timestamp
fields use workspace midnight boundaries, including daylight-saving changes;
start and due dates remain date-only values. Saved relative expressions remain
relative when reopened.

Current workspace and team visibility and the list's archive admission always
apply outside the expression. Negation cannot admit hidden or archived issues.
Release predicates consider only releases available to the reader; Guests do
not acquire release membership through filtering. A changed query, authority or
linked fact invalidates a continuation page instead of mixing result sets.

## Import one Jira saved filter

The existing authenticated native `POST /api/views` door also accepts a
`jiraImport` object. Select the name and jql from one Jira saved-filter record
in an owner-produced export. Supply explicit mappings reviewed against the
current installation. Source field names are case insensitive; source values
must match their mapping exactly. No Jira account is contacted and no source
name is guessed into a native record or priority.

```json
{
  "name": "Reviewed priorities",
  "jiraImport": {
    "jql": "priority IN (High, Highest) AND assignee IS EMPTY",
    "mappings": {
      "priority": { "field": "priority", "values": { "High": "high", "Highest": "urgent" } },
      "assignee": { "field": "assignee", "values": {} }
    }
  }
}
```

A successful request returns the ordinary saved view with its translated native
query. Open that view or execute its issue query through the existing list door.
Optional ordinary query controls can accompany the import; an additional native
expression is refused so two definitions cannot silently compete.

The supported JQL subset includes AND, OR, NOT, parentheses, mapped comparisons,
IN and NOT IN lists of at most eight values, IS EMPTY, IS NOT EMPTY and
currentUser() for person operands. EMPTY behavior is preserved through negation:
Jira `NOT labels=Review` does not acquire unlabeled issues. Unlike the default
native list, an imported Jira query explicitly includes completed states while
retaining native visibility and archive fences.

A missing mapping, unavailable target, unsupported function, text-search
operator, ordering clause or expression exceeding native bounds returns HTTP
422 with `error: unmapped_jql` and an omissions list. The whole selected filter
is refused and no partial view is created. Malformed request envelopes return
400. Existing view creation permissions, personal ownership, Guest scope,
Viewer refusals and per-person limits still apply. Bulk saved-filter file intake,
complete Jira syntax, typed custom fields and customer-request filters remain
outside this supported subset.
