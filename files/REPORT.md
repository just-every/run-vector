# sd-vector-c-f187 results

BITBUCKET-001 moves from MISSING to PARTIAL. The selected signed PR opened and merged cells are implemented and locally proved. No DONE claim is made: branch, commit and pipeline linking, remaining provider and setup qualification, hosted commissioning, scoped delegation and the supplied Claude Opus interface qualification and independent gate remain owed. All other clause obligations are retained.

Repository: just-every/run-vector. Branch: cloud/sd-vector-c-f187. Candidate: `cd75596d78fe0400bcbcbbc2bc0de50b1441e2f7`. Parent main at final synchronization: `7c811313e446ae19630f387f2ac927dafba3dbe5`. PR: none required; Verify accepts this branch through its existing push entry point. Verify 42125490314, status in_progress, conclusion None; exact head cd75596d78fe0400bcbcbbc2bc0de50b1441e2f7.

Counts change from 136 DONE, 69 PARTIAL, 67 MISSING to 136 DONE, 70 PARTIAL, 66 MISSING. All 272 parent Status rows remain in every candidate commit. The only campaign plan row changed is BITBUCKET-001; no Mac lane file was read or written. The full executable work plan is in `PLAN.md`.

## Delivered behavior

An Owner or Admin registers a Bitbucket Cloud repository through Settings, binding both its canonical workspace and repository slug and immutable repository UUID. The signing secret is generated, encrypted under installation custody and revealed once. The signed receiver verifies Bitbucket's exact raw-body HMAC under X-Hub-Signature before parsing. It admits only pullrequest:created with OPEN and pullrequest:fulfilled with MERGED, validates both top-level and destination repository identities, and validates the HTTPS PR URL against repository identity and PR number. The event header is checked against signed state and retained with the content-bound request receipt.

Native issue identifiers in PR title and description link real issues in the configured workspace. Opened PRs use each issue team's saved review rule; merged PRs use its saved merged rule. The journeys deliberately configure new nondefault review and completion statuses. Bitbucket automation is the system actor; a provider actor UUID never implicitly impersonates a workspace member. Activity, versioned rule admission, the issue move, eligible follower Inbox, link and delivery receipt commit in one D1 batch. GitHub retains its existing default system actor and existing behavior through the extracted native rule module.

Identical replay and application restart reuse the original receipt. Concurrent identical delivery commits once. A reused delivery identity with different content refuses 409. A new request identity cannot repeat an unchanged lifecycle transition. Older, conflicting equal-time and post-merge open states do not regress or repeat issue status. Forced receipt failure rolls back every domain effect. Revocation between admission and batch commit refuses the delivery. Private issue reads reauthorize before and after projection, return 404 after withdrawal, and reveal no link or title. Deleted issues lose their links while retained delivery custody prevents replay from recreating them.

Migration 0126 is additive. Repository configuration, PR identity, issue links and identifier-only delivery receipts are portable domain history. Secrets remain excluded in the existing secret table. The native HTTP archive journey exports populated state, checks credential absence, restores all four new tables into a distinct target, requires fresh historical-owner sign-in, requires secret re-entry and effect release, and proves the retained delivery still replays without new effects. The populated-upgrade journey checks prior schema and rows, native sign-in, foreign keys and archive production.

The Settings connection form and authorized issue link use the existing visual components. The browser journey registers the actual connection through rendered controls, closes the private credential panel before capture, sends authentic signed events, asserts configured status identities and attributed Inbox, checks persistent provider links after reload, and audits the changed screens at 1440 and 390. New controls have visible text labels; no new icon-only control is introduced. Browser contexts and owned runtime processes are closed.

## Fixed rubric and proof map

| Item | Proof through public doors | Result |
| --- | --- | --- |
| R1 Opened PR links one issue and obeys its configured rule | `tests/worker/bitbucket-links.test.ts`, signed Bitbucket PR journey: native repository registration and team rule PATCH, signed created request, exact custom status, provider URL, attributed activity and follower Inbox. `tests/e2e/integrations/bitbucket-chain.mjs`, exerciseBitbucketChain, repeats it from rendered Settings. | Locally passed |
| R2 Merged PR completes by its configured rule once | The same Worker and browser journeys send fulfilled, assert a different custom completion status and one completion notice, then replay and read the retained merged link. | Locally passed |
| R3 Authentic admission and stable repository and PR identity | Worker journey attempts byte tampering, wrong repository UUID, wrong destination identity, foreign URL and event-state mismatch; domain snapshots stay unchanged. | Locally passed |
| R4 Replay, restart, concurrency, stale state and rollback | Worker journey repeats delivery across restart, races two identical requests, conflicts content, delivers older and equal-time conflicting states, and aborts receipt insertion; exact domain snapshots and issue versions are checked. | Locally passed |
| R5 Current authority, privacy and deletion | Member, Guest and Viewer configuration refusals; Admin access; foreign-workspace omission; public-to-private withdrawal; issue deletion with inert replay; receiver revocation before the actual batch. | Locally passed |
| R6 Upgrade and archive custody | `tests/worker/bitbucket-upgrade.test.ts`, populated installation upgrade; `tests/worker/bitbucket-archive-scenario.ts`, exerciseBitbucketArchive invoked by the PR journey through native HTTP export and restore. | Locally passed |
| R7 Existing GitHub behavior | `tests/worker/github-links.test.ts`, signed deliveries preserve links, automate team statuses and notify followers exactly once, including its automation, commits, deployments and connection-health helpers. | Locally passed |
| R8 Existing runtime entry point and changed screens | `tests/e2e/integration-runtime.mjs` unconditionally invokes exerciseBitbucketChain. Assertions run at 1440; screen audits at 1440 and 390 check overflow, serious or critical axe findings and hydration errors. Six images and `browser/bitbucket-browser.json` are retained. | Locally passed |

The normal push Verify discovers all three Worker files through its existing glob and the browser helper through its existing integration runtime. No workflow was edited. Two focused Worker registrations were added. Existing tests and assertions were neither deleted nor narrowed.

## Local checks and mechanical custody

- Three touched Worker files and three tests pass, including the existing GitHub regression.
- Typecheck, rer build and first-party check exit 0. The final build's product source bytes match the candidate; later edits affect only tests, contract evidence and generated source-lock hashes.
- The touched contract generator write and check both pass before the generated views are restored whole from origin main. Neither ACCEPTANCE.md nor docs/CLAIMS.md is committed. Stale candidate views remain the documented lander responsibility.
- Source lock is regenerated last and its freshness check passes. All 126 native migration identities and digests are unambiguous; the actual applied and tracked ledgers also cross the populated upgrade and HTTP restoration journeys.
- Candidate author and committer identities and all trailers are inspected over the complete candidate ancestry before push. Every new commit uses the fleet identity and the cleanup hook remains active. No co-author trailer is added.
- New fixture account identities are assembled as provider values, without email literals or provider-shaped secret fixtures. No secret, cookie, environment dump, database, outbox body or private gate material is in the packet.

PROBE BITBUCKET-001 opened: native Settings registration, custom team review rule and signed created request -> exact configured review status, one provider-labelled link, attributed activity and an eligible follower status notice.
PROBE BITBUCKET-001 merged: signed fulfilled request and custom merged rule -> exact configured completion status and one completion notice; identical, concurrent, restarted and stale deliveries add no repeated move.
PROBE BITBUCKET-001 custody: native HTTP archive export and restore -> populated repository, PR, link and receipt history retained, secrets absent, receiver inert until re-entry and effect release, historical replay remains inert.
MECHANICAL lock=pnpm sources:lock then pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write BITBUCKET-001 then check BITBUCKET-001 exit=0, generated views restored; ledger=matchMigrationLedger plus populated upgrade and tracked-ledger HTTP restore exit=0.

## DONE riders and handoff limits

1. Selected PR outcomes are reached; the full clause remains PARTIAL because held provider objects and qualifications are not proved.
2. Seeded real issues and nondefault status rules are checked. Unsafe admission, privacy and authority paths refuse with unchanged domain storage.
3. Local public-door proof is reached by existing Verify entry points. Candidate run status: Verify 42125490314, status in_progress, conclusion None; exact head cd75596d78fe0400bcbcbbc2bc0de50b1441e2f7.
4. The local browser receipt is bound to the candidate. The relevant product source and final tests are checked on the candidate.
5. No receiving acceptance or inherited Base duty is rewritten; existing GitHub, CI and release obligations remain unchanged.
6. Partial Gap and evidence are updated honestly. Touched generated views write and check successfully, then are restored for the lander. Existing ct provenance is retained; no independent judgment is invented.
7. Acceptance text is unchanged and all parent Status rows are retained.
8. Owner and Admin configuration admission, Member, Guest and Viewer refusal, current privacy and transaction-time revocation are exercised.
9. No hosted Bitbucket account, provider commissioning, provider writes, GitHub App or deployment qualification is claimed.
10. Conservative Owner and Admin-only authority and the system-actor rule are named in the Gap. This is not counted DONE.
11. Publication scanning, guarded landing, candidate main equality and candidate Run site remain Mac fleet gates. The cloud pushes only its named product branch and separate evidence ref.

The pre-handoff review confirms the selected user-visible behaviors have failing assertions if removed, existing assertions remain, revocation and restoration cannot replay effects, private withdrawal and deletion do not expose retained links, and the new text controls use the existing Settings styling. Exact-candidate CI is reported honestly above. There is no known reproduced product failure. Independent interface qualification, publication scanning, landing and Run site are outstanding gates, not claimed results.
