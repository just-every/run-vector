# Operator removal and in-flight commands

`OPS-004` retains comments, evidence, file bytes and immutable history while
removing an operator's ability to act. A removed operator row is an anonymous
foreign-key tombstone, not continuing authorization.

The API first admits the native cookie and same origin. For mutations it then
creates a request-owned D1 binding with that operator and its validated Base
session ID/version (or the exact native hash in historical local fixtures). Every D1 write, including ORM allocation/RETURNING, executes in a batch
whose first statement requires an active operator and an unrevoked, unexpired
session. The guard and requested statements share the D1 transaction. Denial
aborts all its statements and returns native 401, including errors wrapped by
the ORM. Read-only SELECTs keep their original D1 methods and result semantics.
No global Worker binding or session is replaced.

The SQLite guard uses a lazy CASE with a failing JSON expression on denial.
D1 rolls the batch back on that failure. The error path reads the actual current
authority before classifying a failure as revoked; storage failures with active
authority remain storage failures. This uses the existing schema.

## Mutation coverage

| Native command | Atomic boundary |
| --- | --- |
| Issue create | Sequence allocation and issue/labels/activity batch |
| Operator intake | Sequence allocation and issue/evidence/activity batch |
| Issue edit and semantic no-op | Version/options guard with activity and label changes |
| Accept, defer, decline, early return | Decision/activity/version batch or guarded no-op |
| Team move, dependency add/remove | Existing graph/workspace/version predicates plus native session guard |
| Comment add/edit/delete | Comment/activity/audit and owned-link erasure batch |
| Named-link add/remove | Link/activity/audit batch |
| File upload | Durable metadata/quota reservation before R2 PUT |
| File remove | Durable removal intent before R2 DELETE |
| Timezone, operator removal | Settings update or complete removal batch |
| Magic-link request | Base active recipient/version insertion, then explicit mail dispatch; failed delivery revokes the link |
| Magic-link consume | Base active operator, authority version and single-use POST transaction |

Direct domain mutators without a native request also guard active actors. Team
move and dependencies retain their existing actor predicates. Single-statement
no-ops and file-removal intent use an active-actor SQL predicate. Scheduled
return and file cleanup settle recorded work using their existing automation
paths; a removed native session never becomes an automation.

Sequence allocation deliberately remains durable when a later issue write
fails, preserving the existing never-reuse rule and its original tests. A denied
allocation writes nothing. A number allocated while authorized is never reused
if removal wins before the later issue transaction. No partial issue, comment,
evidence, link or requested history is committed by a denied transaction.

Create and intake acceptance additionally recheck a newly selected assignee
inside their transaction. Issue edit retains its existing assignment predicate.
An active actor therefore cannot assign fresh work to a member removed after
option validation.

## Files and external effects

R2 and D1 do not share a transaction. The existing upload reservation and removal
intent are the durable acceptance boundaries. A body-delayed upload revoked
before its reservation commits has no metadata or R2 effect. Once a file command
is accepted, its exact persisted receipt can settle after browser sign-out; that
receipt does not authorize another command.

Operator removal checks for unsettled uploads by the target and unconfirmed
file-removal intents attributed to the target, both at preflight and in the
removal transaction. While either exists, it returns 409 `operator_files_pending`
without revoking sessions or doing removal cascades. Finish the upload or existing
file recovery, then retry removal. Successful removal therefore never races a
later PUT, deletion, or file-history entry by its removed actor. Concurrent
active operators continue to act normally. No clock timeout, assumed blob
absence, automatic retry or new lease table is used.

The existing ambiguous-upload limitation remains: if the runtime died before an
R2 receipt can prove settlement, the pending file requires recovery. Such a
writer cannot safely be forgotten merely because it is old. Operator removal
reports that unresolved state rather than claiming it finished.

## Retained activity

Removal changes the actor column and only the native top-level
`assigneeOperatorId` (issue activity) or `leadOperatorId` (project activity), when
the JSON value actually equals the removed operator. JSON-aware updates retain
all arbitrary custom keys and values, nested objects/arrays and other historical
shapes. Nonmatching rows and columns are unchanged. No raw string replacement
runs over history. Existing malformed legacy payloads are not silently repaired
or discarded; they still require an explicit data repair.

Local Worker regressions cover held request bodies, removal/sign-out/expiry at
commit, the reachable mutation matrix, rollback, assignee races, credential
recreation, original JSON/key corruption, real R2 effects and retained history.
`node tests/e2e/removal-runtime.mjs` exercises the emitted Worker on 41920/41921,
real streamed HTTP, synthetic local-outbox native sessions, responsive 1440/390
views and restart persistence. `VECTOR_REMOVAL_EVIDENCE` chooses its output path.
Those historical native-fixture checks do not prove real mail or the Base browser
flow. The separate Base runtime journey described below covers local Base
integration; neither establishes deployed mail delivery.

## Base session integration

Migration 0011 adds a stable mapping between Base authentication identity and the
existing product operator. Production admission now verifies the Base session
and carries its session ID and authority version into `mutationDatabase`.
The D1 guard repeats active mapped actor, active/unexpired session and version
checks at commit. Historical local native fixtures retain their existing token
hash fence only inside the explicit local-outbox dialect.

The `vector_operator_auth_remove` trigger runs inside the existing OPS-004
transaction. It revokes mapped Base sessions, links and invitations issued by
the target; marks Base authority inactive; increments the Base version; and
anonymizes the Base display name/email. All product transfers, file settlement
rules, setup-owner protection, last-operator rejection and rollback guarantees
remain in force. Every admitted operator uses the same internal Base owner
role, so the last-owner trigger cannot privilege one product operator. Base's
standalone status/role endpoints are not exposed. See
[authentication and migration details](AUTHENTICATION.md).
