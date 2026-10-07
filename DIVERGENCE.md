# Vector requirement notes

All source and guidance in this edition, including AGENTS.md, AGENTS.consumer.md
and BASELINE.md, are editable. CONTRACT.md and BASELINE.md define the requirements;
HANDOVER.md records implemented scope and remaining gaps. The notes below explain
how those requirements relate to the current source. They do not amend a clause
or authorize a baseline supersession.

## Contract format and reporting

CONTRACT.md and BASELINE.md group clauses under area headings and use a bullet
with a bold stable ID for each clause. `scripts/contract-report.mjs` recognizes
those bold IDs and registers evidence after the local verification completes.
Test tags alone indicate partial evidence; they do not establish full clause
satisfaction. Preserve the IDs and their assertions when editing requirements.

## Signed signal sources remain a requirement

INTAKE-009 and INTAKE-011 require signed source requests and source registration.
The current native intake endpoint accepts an authenticated operator session;
source signature validation and idempotency remain unimplemented requirements.
`seed.json → deploy.publicPaths` declares no signal-source endpoint.

BASE-ACCESS-004 requires server-side session and ownership checks for mutations.
Before adding signed source ingress, explicitly reconcile its credential boundary
with BASE-ACCESS-003 and BASE-ACCESS-004, declare the public path and verify the
replacement guarantees. CONTRACT.md currently records no product supersession;
these future source clauses do not silently exempt an endpoint from authorization.

## Scheduled-work timing

CYCLE-004, NOTIFY-005 and INTAKE-006 each require the relevant scheduled action
within five minutes. BASE-OPS-003 requires idempotency and BASE-OPS-004 requires
visible failures; neither supplies a general scheduling tolerance.

The implemented deferral-return path performs bounded work through the scheduled
handler and native Current reads. Local checks exercise that behavior, while
provider Cron delivery and five-minute capacity remain unverified. Cycle closure
and notifications remain broader requirements. Retain each product timing bound
until a deliberate requirement change supplies and verifies its replacement.

## Retention and source idempotency

ISSUE-010 and INTAKE-002 require retaining source identities after issue deletion
so a re-delivery returns 410 without recreating the issue. These are requirements
for the future signed-source path, not a claim that it is already implemented.
BASE-DATA-002 permits expiry only for sessions and rate-limit state; it supplies
no expiry permission for source deduplication records or deletion tombstones.
Any future retention policy must preserve the no-resurrection guarantee and
explicitly reconcile deletion, anonymization and expiry with the baseline.

## Measurement status

`seed.json → limits.status` is `estimated-not-load-tested`. Its accessibility
status names a target rather than completed acceptance, and operating cost is
marked as an estimate. The manifest has no top-level `$comment`. Local test
success does not turn these estimates into measured limits or prove complete
accessibility. Update their status only with corresponding measured evidence.

## Policies, settings and extension points

The manifest declares seven policy IDs and ten UI slot IDs as product targets.
It does not establish that every extension point is implemented. AGENTS.md
contains no numerical policy or slot budget; actual source and HANDOVER.md govern
implementation claims. Keep a configurable value as a setting when that meets
the requirement, and expose a policy when owners need to replace a decision.
