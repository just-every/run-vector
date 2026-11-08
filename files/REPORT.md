# sd-vector-c-f205 — TEAM-006

Repository: just-every/run-vector. Product branch: cloud/sd-vector-c-f205.
Starting main: 0e8a686c06eddd55943ed1d2690df32a8fc82213.
The contract's Status, Gap and Evidence cells remain untouched.

## Plan and scope

1. Read TEAM-006, TEAM-004, TEAM-008, ROLE-009, the supplied campaign extract,
   rulings index and DONE-RIDERS.
2. Add forward-only hierarchy storage with independent team identity and members,
   a three-level bound, cycle refusal, version checks and atomic authority fences.
3. Materialize each inherited workflow with stable team-local status identities.
   Propagate parent edits transactionally, preserve explicit child overrides,
   map removed statuses through TEAM-004's chosen destination, and keep siblings isolated.
4. Inherit both ROLE-009 values with explicit child overrides and current-request
   enforcement. Require team-setting authority on the child and affected parents;
   keep TEAM-008 creation admission.
5. Add the visible-descendant issue-list predicate, exact counts, paging and
   existing preference persistence. Preserve independent private-team visibility.
6. Prove native and scoped API doors, role cells, refusal storage, stale writes,
   populated upgrade and native archive round-trip. Run typecheck, relevant
   existing role journeys, migration-ledger proof, contract generation and lock checks.
7. Keep interface implementation and its independent gate reserved for Claude Opus,
   as the assignment requires. No Claude Opus executor or model is available in
   this session's tool or agent inventory. Do not substitute another model.
8. Publish product work only to the named cloud branch and publish this packet
   separately to the evidence branch. The fleet retains publication-scan and landing custody.

## Acceptance boundary

TEAM-006 remains PARTIAL as a builder claim, with the authoritative main row
still MISSING pending lane judgment. No complete clause acceptance point is
claimed: its combined journey explicitly requires the browser interface.

Implemented backend outcomes: parent with two children; three hierarchy levels;
cycle and excessive-depth refusal; unchanged identifiers on reparent; own members;
workflow inheritance and explicit override; parent and sibling isolation;
transactional inherited status validity after rename, order and removal;
permission inheritance and explicit override; all role cells under both child
and parent settings; TEAM-008 creation refusal; visible-descendant list totals
and two-page traversal; persisted toggle value; private-team concealment and
membership withdrawal; stale transaction refusal; populated upgrade and archives.

Remaining selected work: Settings hierarchy, creation and override controls,
the parent's rendered issue-list toggle, browser journeys registered in the
administration runtime at 1440 and 390, and the required Claude Opus interface
implementation and independent gate.

Remaining full-clause obligations stay unchanged: inherited labels, custom fields,
cycle cadence and Git rules; sub-team inclusion in boards, cycles, Insights and
triage; Linear hierarchy import. No held requirement is released.

## Frozen rubric

R1 — Hierarchy and identity: native hierarchy journey, with real issue readback.
R2 — List toggle and current privacy: populated two-page native and scoped list
reads, persisted preference, private membership addition and withdrawal.
R3 — Workflow and destination integrity: parent edits, sibling override,
grandchild propagation and same-category removal, followed by valid status joins.
R4 — Permissions: both settings values on parent and child, all workspace roles,
retained scoped tokens, TEAM-008 creation, refusal storage comparisons.
R5 — Upgrade and portability: populated prior schema, exact native graph restore.
R6 — Rendered interface and browser proof: UNMET, required Claude Opus unavailable.
R7 — Full TEAM-006 inheritance and receiving integrations: UNMET, remain owed.

## DONE-RIDERS

1. FAIL for a DONE claim: rendered outcomes and full-clause integrations remain.
2. PASS locally for backend security paths: supported writes succeed and denied
   writes leave the compared domain graph unchanged; list data is populated.
3. PENDING exact-SHA Verify; the new Worker files use the existing test glob.
4. Final receipts will identify the candidate SHA and relevant unchanged bytes.
5. INSPECTED: TEAM-006 already names ROLE-009 permission inheritance.
6. Main's Status, Gap and Evidence are preserved. Generator write and check
   must pass locally; generated views are restored from origin/main.
7. PASS: acceptance text is not changed.
8. PASS locally for backend role cells and transactional refusal; browser
   authority qualification remains with the interface journey.
9. No external provider or legal boundary is claimed.
10. No new permission grant is adopted. Reparenting conservatively requires
    authority on both the previous and destination parents as well as the child.
11. PENDING guarded fleet landing, exact main equality, scan and Run site.

## Pre-ready checks

Backend public-door assertions use populated records and explicit expected
identifiers and totals. No existing assertion is removed, narrowed or skipped.
The existing Viewer census is extended to include both new hierarchy doors.
Existing current-session and token guards remain active. Private descendant
visibility is evaluated for each read; parent membership grants no child access.
No screen or homepage is changed. No provider or hosted commissioning is claimed.
No source status counts change. Full publication scanning belongs to the fleet.

## Execution results

Final results and exact product provenance are recorded in RECEIPT.json and the
selected non-secret check logs. Intermediate local test failures are retained
as work history here: an archive helper initially reused a variable name and was
corrected; the first existing role journey required a new valid Viewer-census
fixture for the added native and scoped hierarchy doors. Existing assertions
were extended, not weakened.


## Exact proof map

- Hierarchy creation, independent membership, depth and cycles:
  ./tests/worker/sub-team-workflow-journey.ts, subTeamHierarchy.
  Two children and a grandchild are created through mounted native doors;
  invalid graphs leave teams, statuses, issues and audits unchanged.
- Identifier stability: the same journey reparents a child carrying SUBA-1 and
  reads back the same identifier and prefix.
- Inherited workflows and sibling isolation: the same journey renames, adds,
  reorders and removes parent statuses, keeps a custom sibling unchanged,
  propagates to a grandchild and restores inheritance.
- Destination integrity: inherited issues use the parent's explicitly chosen
  same-category removal destination; no issue retains an invalid team status.
- Parent list inclusion, exclusion, counts and paging:
  ./tests/worker/sub-team-list-journey.ts, subTeamList.
  Expected identifiers are literal seeded issue results, with 53 visible rows
  traversed as 50 plus 3; the private child remains absent.
- Persistence and withdrawal: the same list journey stores and reopens the
  includeSubTeams preference, admits a private-child member, withdraws access,
  and observes totals return from 54 to 53. A hidden private parent is omitted
  from metadata, its identity is concealed on the public child, its subtree
  query returns zero, and the public child's own 52 issues remain readable.
- Permission inheritance and overrides:
  ./tests/worker/sub-team-authority-journey.ts, subTeamAuthority, reached by the
  existing ROLE-009 registration in ./tests/worker/role-matrix.test.ts.
  Both permission values are exercised for child and parents, with successful
  actual reparenting and unchanged storage for refused native and scoped writes.
- Creation and retained credentials: the same authority journey checks TEAM-008
  under both workspace values, all required denied roles, current parent
  permission and a revoked retained token.
- Stale writes: subTeamHierarchy refuses stale submitted versions and a graph
  changed immediately before the D1 batch, without applying the requested override.
- Populated upgrade: the existing journey in
  ./tests/worker/base-refresh-upgrade.test.ts retains its original historical
  schema, data, auth and archive checks, then confirms existing roots and
  statuses acquire no fabricated inheritance.
- Portable graph: subTeamHierarchy exports through native Base portability,
  restores into the independent migrated D1 target, compares exact teams,
  workflow statuses, issues and memberships, and checks foreign keys.
- Registration and assertion custody: ./tests/worker/sub-teams.test.ts invokes
  the unchanged existing membership journey plus subTeamHierarchy and subTeamList.
  The original membership body is byte-for-byte retained after moving it to
  ./tests/worker/team-membership-journey.ts. ASSERTION-CUSTODY.json records
  unchanged direct registration counts, 204 before and 204 after; this is a
  bounded source census, not a claim that every expanded registration in the
  repository has been recounted or that the inherited suite is under its cap.

## Runtime probes

PROBE TEAM-006 hierarchy: native create and hierarchy PUT with two children and a grandchild -> three levels accepted; cycles and a fourth level refused without writes; SUBA-1 remains unchanged on reparent.
PROBE TEAM-006 list: native and scoped issue lists with includeSubTeams=true -> 53 visible identifiers over pages of 50 and 3; false -> one parent issue.
PROBE TEAM-006 privacy: add and remove private-child membership -> totals 53, 54, 53; hidden issue detail returns 404. A hidden parent's subtree returns zero while its public child's own list remains readable.
PROBE TEAM-006 workflow: parent create, rename, reorder and destination removal -> inherited child follows, custom sibling stays unchanged, and every issue retains a valid same-category status.
PROBE TEAM-006 authority: native and scoped hierarchy PUT under both child and parent settings -> Owners, Admins and both-team owners succeed; a Member succeeds only with both permissions; Guests and Viewers receive 403; revoked token receives 401; refusals leave compared storage unchanged.
PROBE TEAM-006 portability: native export and native import into independent D1 -> exact hierarchy, effective workflows, issue identities and memberships retained.
PROBE TEAM-006 interface: none, interface implementation and independent browser gate are reserved for Claude Opus, which is unavailable in this session.

## Plan return and custody

Only the TEAM-006 campaign row has a proposed builder update: backend progress
is PARTIAL, and the interface dependency and full held remainder remain open.
No Mac plan, inbox or state file was read or written.
Authoritative counts remain 136 DONE, 72 PARTIAL and 64 MISSING, 272 total,
before and after. The TEAM-006 source row remains MISSING, unchanged.
No contract acceptance sentence, Status row, Gap or Evidence cell is edited.
No generated view is committed. The current rer and Base pins are retained.
No homepage, logo, other seed or workflow file is changed.
No PR is required by this repository's cloud-branch workflow entry point.
Publication scanning, independent gate, guarded main landing and candidate
Run site remain fleet responsibilities; this cloud claims none of those results.

## Final local result

Candidate: 69464a9b035333e4b9bcbdbd6d2ceed672c3a378 on cloud/sd-vector-c-f205.
Seven Worker tests in three files pass on that exact commit (236.94 seconds).
The production build, typecheck, first-party check, migration-ledger behavior,
contract view write and check, and source-lock check all exit 0.
The source and test tree is clean. Both product commits have fleet identity and
no co-author trailers. Main remains 0e8a686c06eddd55943ed1d2690df32a8fc82213 and is intentionally
different from the branch candidate. Main Verify 42503991437 and 42501646337
and Run site 42503991458 are completed success on that main SHA; none is
offered as proof for the candidate.

MECHANICAL lock=pnpm sources:lock then pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write TEAM-006 then node scripts/contract-docs.mjs check TEAM-006 exit=0; ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0.

Publication scan receipt: commit=69464a9b035333e4b9bcbdbd6d2ceed672c3a378 complete=false historyScanned=false findings=unestablished; cloud branch scanning remains with the fleet.
No Run site or main-equality receipt exists for the candidate before landing.
The exact candidate Verify observation is in CI.json.

The first product save was 569212d1b2eb44a7ebb45eec4ee5b0a25d025572
with skip-ci. The final substantive change conceals a hidden private parent's
identity without concealing its public child's independently visible issues.
A redundant intermediate local Worker process was terminated before the final,
successful exact-candidate run. No live test, browser or server is left running.

Candidate CI: push Verify 42510260429 is in_progress on 69464a9b035333e4b9bcbdbd6d2ceed672c3a378. Conclusion is not yet available. No CI failure is known. Three GitHub API calls were used; no workflow was dispatched or rerun.

CLAIM TEAM-006 PARTIAL points=none tests=tests/worker/sub-teams.test.ts#[TEAM-006 TEAM-007 TEAM-008 ROLE-007 OPS-001] team hierarchy, membership, workflow and paged visible issues retain identity and current access; tests/worker/sub-team-authority-journey.ts#subTeamAuthority
GAP TEAM-006: Required Claude Opus interface implementation and independent browser gate remain unavailable; rendered hierarchy creation, parent-list toggle and workflow override at both widths remain unproved. Full held inheritance and receiving integrations remain owed.
