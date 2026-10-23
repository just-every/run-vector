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
| GET /api/v1/issues/IDENTIFIER | issues:read | Current native issue projection, branchName and deployments |
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
Project, milestone and comment deletion use separately selected delete scopes; there is no issue deletion API or token-administration bearer route. Existing assignment/direct-mention notifications keep
their native policy. A token acts with its member's current role, read on every request (ROLE-001); there is no tenant selector.

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
retained name-order setting). Counts and rows use the same filters. The portfolio response is cursor paginated, with `limit` (1–100, default 50), `cursor`, `nextCursor` and `total`. Lifecycle and health counts describe the entire filtered result, consistently across pages.
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

## Versioned schema and coverage (API-003)

`GET /api/v1/schema` publishes the checked-in OpenAPI 3.1 document
[`schema/api-v1.json`](../schema/api-v1.json), without authentication. Its path,
method and `x-scopes` entries are the API admission table. Unknown paths or
methods return 404 before bearer authentication. The normal worker test reads
the published schema and checks it against every mounted route, the named
object inventory, list filters and cursor declarations. `x-object-coverage`
reports omitted native operations as **owed**, and initiatives (INIT-001),
releases (RELEASE-001), documents (PROJ-013), customers (CUST-005) and customer
requests (CUST-001) as **not-built**, never as read-only exemptions. Inventory
validation is not full clause acceptance: complete operation coverage remains owed.
Run `node --experimental-strip-types scripts/api-coverage.mjs` for strict full
qualification; it exits nonzero with the exact missing operations and unbuilt
objects until all clause coverage is complete. The normal worker test verifies
that the published schema produces this incomplete qualification, rather than
claiming full coverage from a partial inventory.

Existing tokens keep exactly their issued scope arrays. Select new scopes in
Settings → Integrations when issuing a new token; expanding the selector does
not expand an old token. New routes are:

| Route | Scope | Native behavior |
| --- | --- | --- |
| GET /api/v1/comments | comments:read | Cursor list filtered by `issue`, `createdFrom`, `createdTo` (inclusive UTC timestamps) |
| GET /api/v1/comments/ID | comments:read | A live comment on an issue this operator can read |
| PATCH /api/v1/comments/ID | comments:edit | Strict `{body, expectedVersion}` input, native author-only editing |
| DELETE /api/v1/comments/ID | comments:delete | Strict `{expectedVersion}` input, native author/Owner/Admin deletion policy; deleted comments disappear |
| DELETE /api/v1/projects/ID | projects:delete | Deletes populated projects, preserves their issues and clears the issues’ project assignment |
| GET /api/v1/projects/ID/milestones | milestones:read | Cursor list, optional `completed=true` or `false` filter |
| GET /api/v1/projects/ID/milestones/MILESTONE_ID | milestones:read | Full native milestone projection, including progress and slip |
| POST /api/v1/projects/ID/milestones | milestones:write | Native creation: `name`, optional `description`, `targetDate` |
| PATCH /api/v1/projects/ID/milestones/MILESTONE_ID | milestones:write | Native fields and `completed`, including reopen |
| PUT /api/v1/projects/ID/milestones/order | milestones:write | `{milestoneIds}` containing every project milestone once |
| DELETE /api/v1/projects/ID/milestones/MILESTONE_ID | milestones:delete | Preserves issues, clears assignment and records native activity |
| GET /api/v1/cycles | cycles:read | Cursor list with optional `team` and `closed=true` or `false` filters |
| GET /api/v1/cycles/ID | cycles:read | Native cycle detail, progress, report and closure snapshot |
| POST /api/v1/cycles | cycles:write | `teamId`, `name`, `startsLocal`, `endsLocal`, optional `capacity`; native timezone and overlap guards |

Issue creation and update accept the inherited `milestoneId` field. An issue
must belong to that milestone's project. Project moves and milestone deletion
retain the native assignment-clearing behavior. Milestone writes use the app's
snapshot guard (409 on concurrent changes), not a new version protocol.

### Comment read shape

```json
{
  "id": "stable comment ULID",
  "issueIdentifier": "TEAM-123",
  "body": "complete body text",
  "version": 0,
  "author": { "id": "stable operator ULID", "displayName": "native display name" },
  "createdAt": "ISO-8601 timestamp",
  "editedAt": null,
  "url": "https://installation.example/app/issues/TEAM-123",
  "maxBodyLength": 100000,
  "truncated": false
}
```

`version` is a nonnegative integer revision, stable between body edits and
increased by every native body edit, including checklist changes. Both PATCH
and DELETE require the last-read `version` as the JSON body field
`expectedVersion`, matching the issue API's body-field convention. PATCH takes
`{"body":"replacement text","expectedVersion":0}`; DELETE takes
`{"expectedVersion":0}`. `If-Match` is not a substitute for that required field.
A missing or invalid revision returns 400; a stale revision returns 409. The
revision comparison and mutation are atomic: refusal leaves the body, revision,
history, links and notification effects unchanged (token usage and rate-limit
accounting still apply). Two concurrent edits using the same revision admit
exactly one. Read the comment again after a successful edit for its new revision.

`editedAt` becomes an ISO timestamp after editing. The canonical link opens the
containing issue. Responses do not truncate bodies; native creation/editing
limits body text to 100,000 characters. Display names follow the app, including
`Removed operator` after erasure and imported attribution. A suspended-member
product state does not yet exist; its safe display behavior remains inherited
under ROLE-012/OPS-004. Only comments on readable issues appear; deleted
comments are absent from list and get, never content-bearing tombstones.

### Pagination and limits

Comments, projects, milestones and cycles accept `limit` and `cursor`; responses
include their named array, `total` and nullable `nextCursor`. Treat cursors as
opaque and keep all filters and the limit unchanged. They are bound to the actor
and filters, and a changed ordered projection returns 409. Restart from the
first page after that response. Issue lists support the same cursor protocol
when `limit` or `cursor` is supplied, retaining legacy `offset`/`revision` paging
for existing clients. Do not combine those two protocols. Cursor mode retains
the native issue-list revision check and supports small pages.

Authenticated API calls allow 300 requests per token per calendar minute.
Exhaustion returns 429 with integer `Retry-After` seconds until the next minute;
other tokens have independent buckets. The existing transient access limiter
stores buckets and is excluded from archives. Public schema reads do not use a
token bucket. Invalid, expired, revoked, removed-operator or insufficient-scope
tokens remain refused before resource admission.

### Open acceptance

API-003 remains partial. Idempotency keys (including replay, concurrency,
expiry, erasure and archive exclusion) are not implemented. Complete API
operations for attachments, relations, labels, teams, workflow states, saved
views, notifications and members, cycle update/delete and issue deletion remain
owed. Attachment bytes stay behind the same-origin cookie file door: API-001
still forbids private-file access by bearer. The five not-built objects and a
real private-team refusal under ROLE-002 remain owed. Native cookie issue
deletion, import erasure and its receipts are unchanged.

## Native GitHub read projections

| Native app route | Read-only fields |
| --- | --- |
| GET /api/issues/IDENTIFIER | `branchName` suggestion and `deployments` (repository, deploymentId, sha, environment, deployedAt) |
| GET /api/issues/IDENTIFIER/github | `pullRequests`, `commits` (literal author, subject and URL), and `deployments` |

Full issue reads and mutation receipts carry branchName and deployments on both native and versioned issue doors.
GitHub signing credentials authorize receiver deliveries only, never member API access.

## Releases

| Route | Scope | Behavior |
| --- | --- | --- |
| GET /api/v1/releases | releases:read | Cursor paging with team and status filters |
| GET /api/v1/releases/ID | releases:read | Scope, progress, blockers and linked PRs |
| POST /api/v1/releases | releases:write | Name, optional teamId/targetDate, status and description |
| PATCH /api/v1/releases/ID | releases:write | Field edits or publishing with expectedVersion |
| PUT /api/v1/releases/ID/scope | releases:write | Replace issueIdentifiers and projectIds with expectedVersion |

Owners, Admins and Members act on readable team and workspace releases; Guests are refused 403.
Native app doors use /api/releases and the same inputs. Released scope stays fixed until
an explicit reopen. Release deletion remains an API-003 gap. A ?readOnly=1 workspace
link hides editing and retains normal sign-in and scope admission; it is not a public share.

## Initiatives

| Route | Scope | Behavior |
| --- | --- | --- |
| GET /api/v1/initiatives | initiatives:read | Cursor paging with status and parent filters |
| GET /api/v1/initiatives/ID | initiatives:read | Three-level hierarchy with visible projects and their teams |
| POST /api/v1/initiatives | initiatives:write | Name, ownerOperatorId, optional parentId/targetDate, status and description |
| PATCH /api/v1/initiatives/ID | initiatives:write | Version-checked field and parent edits |
| PUT /api/v1/initiatives/ID/projects | initiatives:write | Replace direct projectIds with expectedVersion |

Native app doors use /api/initiatives and the same inputs. Owners, Admins and Members
may act; Guests receive 403 on native, scoped API and page doors. A fourth level or
a parent cycle receives 400. A project may join several initiatives. Deletion,
INIT-002 roll-ups and Slack/Discord initiative bindings are not implemented.
