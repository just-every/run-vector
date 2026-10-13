# Scoped native API

Create a named token in Settings / Integrations. Select only the needed scopes,
optionally set an expiry, save the credential once, and revoke it there. Lists
and usage contain safe metadata, route names and times. Base TokenService owns
generation, hashed storage and transactional issuance/usage. An active mapped
operator and current workspace authority are required on every request and
inside each mutation transaction. Operator removal revokes issued tokens.

Send `Authorization: Bearer TOKEN` to the saved installation origin. Do not put
credentials in URLs. Browser Origin, when supplied, must match that origin.

| Route | Scope | Native behavior |
| --- | --- | --- |
| GET /api/v1/issues | issues:read | Existing bounded filters, cursor paging, sort and grouping |
| GET /api/v1/issues/IDENTIFIER | issues:read | Current native issue projection |
| POST /api/v1/issues | issues:write | Existing issue creation schema, references and history |
| PATCH /api/v1/issues/IDENTIFIER | issues:write | Existing field schema and required expectedVersion |
| POST /api/v1/issues/IDENTIFIER/comments | comments:write | Existing trimmed nonempty body and comment mutation |
| GET /api/v1/metadata | metadata:read | Current teams/statuses/operators/projects/cycles/labels |

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

## Native operator deletion and duplicate decisions

A current cookie session may `DELETE /api/issues/IDENTIFIER` with the strict body `{ "expectedVersion": 1, "confirmed": true }`. The version must be the reviewed current version. Any active workspace operator is admitted by `issue.can-delete.v1`. Signed-out, token-only and removed-operator requests return 401; foreign Origin returns 403; unknown issues return 404; stale intent and a canonical issue with incoming duplicates return 409. A canonical refusal identifies its duplicates. Deletion commits atomically with retained import erasure, source identity fences and webhook payload redaction. A dependent graph change during preparation returns 409 without erasure and requires a fresh review; unrelated SQL failures remain 500 with atomic rollback.

A 200 response confirms all attachment bytes absent; 202 reports pending or failed cleanup honestly. Both include only the identifier, timestamps, counts and the authorized `/api/issues/IDENTIFIER/deletion` receipt URL. Existing durable file-removal intents settle uploads and retry cleanup through Cron. An unsettled upload is never declared complete merely because its object is absent.

`POST /api/issues/IDENTIFIER/duplicate` accepts `{ "expectedVersion": 1, "canonicalIdentifier": "FLW-123" }`; null undoes the decision. The selected canonical must be another non-duplicate issue. Incoming duplicates are repointed in the same transaction, and undo restores the latest nonterminal team status or default Backlog. These native commands are not added to `/api/v1`.
