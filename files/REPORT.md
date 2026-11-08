# sd-vector-c-f206 results

Repository: just-every/run-vector
Branch: cloud/sd-vector-c-f206
Candidate: 7334487bdc9102011b9b646e37fe60da45ebf338
Baseline main: 0e8a686c06eddd55943ed1d2690df32a8fc82213
PR: none; Verify declares the named cloud branch as a push entry point.

SLACK-002 is claimed PARTIAL, with the five selected thread-sync cells implemented. The actual CONTRACT.md Status row remains main's MISSING row, unchanged. All 272 Status rows remain, with 136 DONE, 72 PARTIAL and 64 MISSING before and after this work. No acceptance point, Status, Gap or Evidence cell was edited; no generated view was committed. The only campaign update proposed to the lane is that SLACK-002's selected native thread-sync cells are now implemented and locally proved; every supplied hold remains owed.

## Implementation and result

Signed mentions and the signed message shortcut create an issue with the source text, original Slack author identity and Slack's validated canonical permalink, plus one mapped root comment. An explicit mention beginning `@Vector add VEC-123` adds a second source as its own comment thread on the visible issue in the bound team. Mappings retain signed workspace, installation generation, destination, channel, source thread and original member-link generation. Inbound replies use native comment admission and land only under their mapped root.

Native replies, resolution activity and all issue-status producers create transactional outbound intents. Those intents use Base's existing durable delivery service, claims, attempts and terminal receipts. The stored envelope contains an opaque intent rather than captured comment text. Each provider post rechecks current native identity and issue access, the original link and installation generation, the binding, restore holds and the provider's unshared-channel safety response. A native top-level comment produces no thread intent. Private-team threads receive only identifiers and status names; replies and resolution markers are suppressed.

Signed source replay, repeated source timestamps and concurrent deliveries cannot create another issue, mapped root or reply. New issue numbering is reserved inside the source transaction, so a rejected concurrent root does not consume another identifier. Bot echoes are ignored without storage changes. Rate-limited posts have finite retry receipts; unknown post results remain uncertain and are never automatically resent. Uninstall, credential revocation, membership withdrawal and an unlink during the safety lookup prevent posting.

The additive migration retains source identities and history. Upgrade preserves populated prior data without manufacturing mappings. Native archive restore retains mapped roots, incoming replies, accepted and queued delivery receipts, and marks restored mappings and intents permanently held. Credentials and member links remain excluded.

The existing discussion interface already renders source links, independent roots, ordered replies and resolution; no product interface components or styles were changed. The new browser helper is reached through the existing installation helper and integration runtime at the assertion width 1440. Candidate browser proof also runs the same changed discussion screens at 390, with keyboard reply and resolution, focus tooltip, accessibility, overflow, reload persistence and hydration checks. The supplied independent interface gate retains its Claude Opus requirement and remains fleet custody.

## Frozen selected-work rubric and proof map

The existing registration is `tests/worker/outbound-broken-destination.test.ts` — `[SLACK-001 SEC-001 ROLE-001] Signed Slack Events create one issue as the linked member and refuse invalid intake`. It calls `slackEventIntake`, `slackThreadSync` and the populated-upgrade helper. Archive and lifecycle registrations remain in that same file. No test registrations or existing assertions were removed, skipped or narrowed; new scenarios extend the existing journeys.

| Row | Selected outcome or inherited duty | Proof and observed result |
| --- | --- | --- |
| R1, point 1 | Message filing and one mapped root with text, Slack author and permalink | `tests/worker/slack-thread-scenario.ts:14` to 19; signed mention creates one root and description with actual fixture permalink. Signed shortcut and unchanged refused storage: lines 76 to 87. |
| R2, point 2 | Slack reply becomes one mapped Vector reply | Same helper lines 20 to 29: correct root, replay and restart refusal, concurrent replay yields one reply. |
| R3, point 3 | Vector reply posts once through durable delivery | Same helper lines 31 to 49: correct Slack thread, one accepted receipt, finite 429 retry and inert uncertain 503 result. |
| R4, point 4 | Separate top-level comment posts nothing | Same helper lines 33 to 37: source reply and separate top-level comment are created together; only one thread post occurs. |
| R5, point 5 | Second Slack source has its own mapped comment thread | Same helper lines 50 to 58: independent root, inbound isolation and outbound target. |
| R6 | Resolution marker once | Same helper lines 59 to 61: repeated resolution produces one marker. Browser helper lines 40 to 44 proves persisted collapsed resolution. |
| R7 | Each status change reaches every linked thread | Same helper lines 62 to 66: exact status text in both source threads, no duplicates on another dispatch. |
| R8 | Private-team redaction | Same helper lines 88 to 98: queued public content is suppressed after privacy changes; only identifier and status text reach each linked thread. |
| R9 | Current authority and unchanged refusal storage | `tests/worker/slack-events-scenario.ts` retains unsigned, invalid-signature, stale, unlinked, unmapped, Guest, demoted and removed-member assertions. Thread helper lines 99 to 115 proves private withdrawal, restore hold, and unlink during channel safety lookup. Foreign permalink refusal at lines 67 to 69 changes no table. |
| R10 | Durable replay and echo suppression | Thread helper lines 24 to 30 and 70 to 75: replay, restart, concurrent reply, concurrent root, one identifier allocation and no-effect bot echo. |
| R11 | Uninstall and credential retirement | Existing lifecycle registration calls `slackProviderUninstall`; the expanded setup queues a mapped reply before uninstall and proves no further provider call. Both app_uninstalled and tokens_revoked remain covered. |
| R12 | Populated upgrade | `tests/worker/slack-thread-upgrade.ts:7` to 20 applies the additive migration over populated prior tables, compares all retained rows and checks foreign keys. |
| R13 | Populated archive round trip | `tests/worker/slack-app-scenario.ts` archive phase creates incoming, accepted outgoing and rate-limited queued replies. `tests/worker/slack-app-recovery-scenario.ts:12` to 33 compares every new table and terminal delivery states, checks permanent holds and credential exclusion. |
| R14 | Existing interface, source links, keyboard, tooltip, accessibility and responsive proof | `tests/e2e/integrations/slack-threads.mjs:17` to 48; actual screenshots and browser receipt in the packet. |
| H1 | Slack PNG and Vector image upload | Held ISSUE-024 receiving work; not implemented or claimed. |
| H2 | Unlinked or no-seat requesters | Held ROLE-006 and SLACK-001 broader actor work; refused by the conservative native-member boundary. |
| H3 | Customer picker and customer request | Held CUST-006 and CUST-008; not implemented or claimed. |

Worker rows R1 to R13 run in the existing push Verify worker path. Browser row R14 runs through `tests/e2e/integration-runtime.mjs`, the existing Settings journey and installation helper in hosted-artifact. Exact-head CI observations are in `candidate-ci.json`; local proof and its actual exits are recorded separately. No result from another SHA is presented as candidate CI success.

## DONE-RIDERS review

1. PARTIAL for the whole clause: the selected native outcomes have public-door proof, while H1 to H3 and the supplied held remainder prevent a whole-clause DONE claim.
2. PASS locally for selected work: seeded roots, real discussion reads, actual fixture posts and unchanged whole-database refusal snapshots cover both allowed and denied paths.
3. PASS: push Verify 42510098606 completed successfully on exact candidate 7334487bdc9102011b9b646e37fe60da45ebf338. Its existing Worker and hosted-artifact paths reach the selected journeys; local worker and browser receipts are additional proof.
4. PASS for local proof: final-head receipts name the candidate; no earlier-SHA evidence is silently promoted.
5. INSPECTED: the existing clause names ISSUE-008 mapping, private-team behavior and the held receiving duties. Existing SEC-001 credential custody is preserved; no acceptance text was rewritten.
6. PASS mechanically: touched-clause generator write and check pass; generated views are restored whole from main and omitted from commits. Status judgments remain lander-owned.
7. PASS: no clause or acceptance rewrite, no rider duplication and no status row removal.
8. PASS locally for the selected native authority boundary: invalid signatures, unlinked and withdrawn actors, current private access and in-flight unlink are refused; storage assertions remain intact.
9. PASS as an honest boundary: only signed network-edge Slack fixtures and native local archives are claimed. No hosted Slack workspace commissioning or real provider receipt is claimed.
10. PARTIAL policy boundary: restored mappings stay permanently held and linking generations are not automatically reused. This conservative default follows the supplied standing scope policy; the clause is not counted DONE.
11. Pending fleet landing: the latest main observation is 0e8a686c06eddd55943ed1d2690df32a8fc82213; exact candidate publication scan, guarded landing and candidate Run site remain fleet custody.

## Pre-ready self-check and mechanics

Selected user-visible outcomes have native HTTP or signed-provider journey assertions. Existing assertions remain, and no new permanent test registration was added. Revocation, source replay, private withdrawal, held restore and retired installation paths are covered for the selected work. Full synced-thread erasure remains SEC-003's held duty. Reused discussion text and controls were inspected; the native icon-only reaction control's focus tooltip is proved. No homepage, look, logo, Base pin or Verify workflow was changed.

Mechanical commands: touched generator write and check; restore generated views whole; source lock regenerated last and checked; typecheck; first-party rer check; migration-head ledger and repeated-application test; deployment specification check. Actual exit codes and logs are in the local receipt. A cloud publication scan is not required for this branch push and was not run: commit=7334487bdc9102011b9b646e37fe60da45ebf338, complete=unestablished, historyScanned=unestablished, findings=unestablished. Full history was cloned. The Mac must run the exact-tree COMPLETE scan and enforce NEW 0 before landing.

Baseline main Verify 42503991437 and Run site 42503991458 are successful on 0e8a686c06eddd55943ed1d2690df32a8fc82213. Those runs establish the starting main only. Candidate main equality and Run site remain pending fleet landing.

## Claims and held work

CLAIM SLACK-002 PARTIAL points=1,2,3,4,5 tests=tests/worker/outbound-broken-destination.test.ts#[SLACK-001 SEC-001 ROLE-001] Signed Slack Events create one issue as the linked member and refuse invalid intake; tests/worker/outbound-broken-destination.test.ts#[SLACK-001 SEC-001] Slack archives exclude credentials and restore requires re-entry; tests/e2e/integrations/slack-threads.mjs#exerciseSlackThreads

DEFAULT SLACK-002: Only an active linked native Member, Admin or Owner may intake in an explicit team binding; mappings retain original installation and link generations and restored mappings never auto-reactivate, under the supplied standing conservative-default policy.

GAP SLACK-002: Held emoji filing, request channels, Slack and Vector media under ISSUE-024, checklist projection under ISSUE-025, no-seat or unlinked requesters under ROLE-006, customer and request integration under CUST-006 and CUST-008, template and form filing under ISSUE-016 and TRIAGE-004, reactions under ISSUE-017, Teams parity, synced-thread erasure under SEC-003 and hosted SLACK-001 commissioning remain owed. INIT-001, RELEASE-001, ISSUE-008 and WEBHOOK-002 holds remain unchanged. Independent Claude Opus interface qualification and guarded landing remain fleet work.

No product blocker is known from local checks or the successful exact-head Verify. Publication scan, independent gate, landing and candidate Run site receipts remain unestablished, never claimed as completed acceptance.

## Candidate CI result

Push Verify 42510098606 completed with success on exact candidate 7334487bdc9102011b9b646e37fe60da45ebf338, observed 2026-11-08T18:57:27Z. The workflow was started by the product push; it was neither dispatched nor rerun. Nine of the ten API calls were used, with at least 300 seconds between run observations. `candidate-ci.json`, `ci-receipt.json` and the numbered observation files preserve the actual responses. No red-job repair round was needed.

The final product branch is pushed and local proof is complete. PR: none required. A READY handoff authorizes only the existing fleet's exact-tree scan, independent gate and guarded landing. The source Status row and counts remain unchanged in this candidate.

READY branch=cloud/sd-vector-c-f206 head=7334487bdc9102011b9b646e37fe60da45ebf338
