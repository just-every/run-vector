# Scoped native API

Create a named token in Settings / Integrations. Select only the needed scopes,
optionally set an expiry, save the credential once, and revoke it there. Lists
and usage contain safe metadata, route names and times. Base TokenService owns
generation, hashed storage and transactional issuance/usage. An active mapped
operator and current workspace authority are required on every request and
inside each mutation transaction. Operator removal revokes issued tokens.

Send `Authorization: Bearer TOKEN` to the saved installation origin. Do not put
credentials in URLs. Browser Origin, when supplied, must match that origin.

Tokens created through local `RER_OPEN` sessions also require the checkout key in
`x-rer-dev-key` on every request. Load it from the owner-only
`.rer/local/dev-key.env` in that checkout; do not print it. Bearer-only local
requests return 401. See [the local token command](guide/api.md#use-a-local-development-token)
for the complete Bash/curl example. These development tokens are excluded from
archives, fail after local reset and cannot authenticate to deployed Vector.
Hosted tokens need only the bearer header.

| Route | Scope | Native behavior |
| --- | --- | --- |
| GET /api/v1/issues | issues:read | Existing bounded filters, cursor paging, sort and grouping |
| GET /api/v1/issues/IDENTIFIER | issues:read | Current native issue projection |
| POST /api/v1/issues | issues:write | Existing issue creation schema, references and history |
| POST /api/v1/issues/IDENTIFIER/copy | issues:write | Copy with expectedVersion, optional teamId, includeSubissues and includeLinks |
| PATCH /api/v1/issues/IDENTIFIER | issues:write | Existing field schema and required expectedVersion |
| POST /api/v1/issues/IDENTIFIER/comments | comments:write | Existing trimmed nonempty body and comment mutation |
| GET /api/v1/metadata | metadata:read | Current teams/statuses/operators/projects/cycles/labels |
| GET /api/v1/projects | projects:read | Portfolio filters and matching lifecycle/health counts |
| GET /api/v1/projects/ID | projects:read | Project fields, labels, progress, risk and activity |
| POST /api/v1/projects | projects:write | Create a project with a lead, optional dates, priority and enabled project labels |
| PATCH /api/v1/projects/ID | projects:write | Change native project fields with date validation and per-field activity |

Unknown query/body fields refuse. Workspace and actor identity come from the
token authority, never the request. Native status/reference/archived-team rules
apply. Missing, incorrect, expired, revoked or insufficient authority returns
401; foreign Origin returns 403; bad input returns 400; missing resources/routes
return 404; stale writes or invalidated pagination return 409. Durability or usage
recording failures return 503 and deny admission. Native mutation authority loss
rolls back the whole transaction. A postcommit authority loss conceals the result
without erasing already-committed native notification intent.

Tokens admit only these explicit routes. They cannot sign into documents,
generated functions, private files, ordinary cookie APIs or token administration.
There is no token deletion route. Existing assignment/direct-mention notifications keep
their native policy; API access introduces no product roles or tenant selector.

The native Worker tests exercise scopes, stale writes, revocation/removal,
issuance/commit races, usage-write failure and restart. Local proof does not
establish hosted token commissioning or a live client integration.

## Project planning

Project create accepts `name`, `description`, `leadOperatorId`, `startDate`,
`targetDate`, `priority` and `labelIds`. Dates are `YYYY-MM-DD` or null; a target
before the start is refused without changes. Priority is `urgent`, `high`,
`medium`, `low` or `none`. Labels must be workspace labels marked **Use for
projects** in Settings. PATCH accepts any of those fields plus `lifecycle` and
`archived`; simultaneous changes are atomic, and each changed planning field
has its own activity entry. Native project updates guard the fields and labels
read during preparation; they do not use the issue `expectedVersion` protocol.

The portfolio supports `lifecycle`, `health`, `lead`, `team`, `targetFrom`,
`targetTo`, `label`, `includeArchived` and `sort=priority` (or `newest`, the
retained name-order setting). Counts and rows use the same filters. The current
portfolio response is a complete workspace list, without API-003 pagination.
Project custom fields, configurable project statuses, roadmap editing and
Linear project-field import remain targets in CONTRACT.md.

## Native operator deletion and duplicate decisions

A current cookie session may `DELETE /api/issues/IDENTIFIER` with the strict body `{ "expectedVersion": 1, "confirmed": true }`. The version must be the reviewed current version. Any active workspace operator is admitted by `issue.can-delete.v1`. Signed-out, token-only and removed-operator requests return 401; foreign Origin returns 403; unknown issues return 404; stale intent and a canonical issue with incoming duplicates return 409. A canonical refusal identifies its duplicates. Deletion commits atomically with retained import erasure, source identity fences and webhook payload redaction. A dependent graph change during preparation returns 409 without erasure and requires a fresh review; unrelated SQL failures remain 500 with atomic rollback.

A 200 response confirms all attachment bytes absent; 202 reports pending or failed cleanup honestly. Both include only the identifier, timestamps, counts and the authorized `/api/issues/IDENTIFIER/deletion` receipt URL. Existing durable file-removal intents settle uploads and retry cleanup through Cron. An unsettled upload is never declared complete merely because its object is absent.

`POST /api/issues/IDENTIFIER/duplicate` accepts `{ "expectedVersion": 1, "canonicalIdentifier": "FLW-123" }`; null undoes the decision. The selected canonical must be another non-duplicate issue. Incoming duplicates are repointed in the same transaction, and undo restores the latest nonterminal team status or default Backlog. These native commands are not added to `/api/v1`.

## Copy an issue (ISSUE-023)

`POST /api/v1/issues/IDENTIFIER/copy` accepts a strict body such as
`{ "expectedVersion": 1, "includeSubissues": true, "includeLinks": true }`.
Both options default to false. Omit `teamId` to stay in the source team; supply
an available team ID from the same workspace to copy elsewhere. The cookie API
uses the same body at `/api/issues/IDENTIFIER/copy`. Issue menu → Copy issue and
the command palette open the same review form.

The 201 response contains `issue`, `copies` (source and new identifiers),
`mappings` (source/destination status, labels and custom-field keys), and
`droppedValues` (source identifier, field, original value and reason). Every new
issue starts in the destination's first Backlog status. Labels and custom fields
are workspace scoped and map unchanged between teams. A cross-team cycle is
dropped and reported; a same-team open cycle is preserved. A closed or missing
cycle, or an unavailable project, is also reported when dropped.

Selected sub-issues include the full ordered descendant tree, with new identifiers
and independent histories. Selected links are issue-level named links; comment
links stay with their excluded comments. Copies preserve title, description,
priority, estimate, labels, project, custom fields, due date, expected outcome
and customer impact. They are unassigned and have no original comments,
activity, files, followers, customer requests, dependencies or duplicate links.
Each source and copy receives its own copied-to/copied-from activity entry.
Description-embedded file cloning belongs to ISSUE-024, whose inline attachment
support is still partial.

A stale source or a change to the selected tree, labels or links during
preparation returns 409 and creates no copy. All selected issues and their new
hierarchy/history commit together. Archived, missing and other-workspace target
teams are refused. Token scope, native session and Origin checks remain in force.

In the command palette, enter `Copy issue` on an open issue, or `Copy issue <identifier or title>` from any page. Ordinary issue searches retain one result per issue.
