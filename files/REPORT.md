# sd-vector-c-f197 — AUTO-004 continuation

Repository: just-every/run-vector. Product branch: cloud/sd-vector-c-f197.
Requested base: 14f77ce74afb0c776e42b935fce53ea66ef9baf4. Full history clone; base replayed onto main before the first new commit, retaining its three commits and main's newer generator and installer changes.

## Plan

1. Read the inline campaign, standing rulings, builder rules and DONE riders; inspect the actual clause, Status Gap, source and registered journeys at the requested base.
2. Map the selected native resolution SLA outcomes to the existing mounted Worker and browser journeys. Run the selected baseline. Extend the existing registration only for unproved user-visible clock and recipient behavior, and reproduce defects through public doors before correcting them.
3. Preserve the supplied held remainder, every other clause, native permission and delivery boundaries, and all existing assertions. Keep AUTO-004 partial unless its complete acceptance and every substantive rider are proved.
4. Prove any additive storage change on a populated upgrade and the native archive path. Run touched Worker journeys, typecheck, first-party checks and the clause's mounted real scheduler browser journey with configuration, countdown and Inbox screenshots at 1440 and 390.
5. Integrate current main; run touched contract generation, restore generated views from main, regenerate the source lock last and check it. Audit parent Status rows, commit identities, trailers and changed public text. Commit and push only the named cloud branch through the fleet guard.
6. Discover exact-head Verify through REST, respect the five-minute polling interval and ten-call budget, and publish the actual report and receipts only through the separate evidence ref. Leave publication scanning, guarded landing and Run site to the fleet.

## Scope and initial evidence

Actual starting status at the requested base is PARTIAL, rather than the planner's original MISSING. Counts are 136 DONE, 70 PARTIAL, 66 MISSING across 272 Status rows. No acceptance text will be changed.

The existing test `tests/worker/due-reminders.test.ts` — “restored effects hold new reminders until reviewed while preserving historical claims; resolution SLAs warn and breach once through native clocks and bound channels” — loads `resolution-sla-scenario.ts` and `resolution-sla-upgrade.ts`. Its baseline passed: one selected registration, four unrelated registrations skipped by the local filter. It covers no early warning, repeated and concurrent ticks, restart, one warning and breach, fixed DST clocks, label start and withdrawal, current triage responsibility, Slack and Discord network edges, mutes, private access, role cells, atomic rollback, restore holds and erasure.

`tests/e2e/resolution-sla-journey.mjs` is loaded by the existing integration runtime, which push Verify invokes. It covers mounted team configuration, persistent countdown, native Inbox and actual local scheduled requests, with desktop assertions and both screenshot widths. `tests/worker/data-http.test.ts` already carries actual native export and restore of SLA clocks and receipts without replay.

The supplied held remainder remains customer-tier and triage-time targets, other policy combinations, REPORT-001 charts, external Oncall and PagerDuty recipient qualification, hosted commissioning and supplied interface qualification. Actual CUST models, held TRIAGE-001 work, AUTO-002 rules, live AUTO-001 and AUTO-005 dependencies are unchanged. No held requirement is released and no DONE claim is made from the selected slice alone.

## Result

AUTO-004 stays PARTIAL → PARTIAL. Counts stay 136 DONE, 70 PARTIAL, 66 MISSING, total 272. All 272 parent Status rows survive every candidate commit. The campaign row changed is only AUTO-004: add the team-archive clock correction and the additional native proof; retain its full held remainder. No other clause or acceptance sentence changed. No new test registrations, skipped assertions or deleted tests were introduced.

A native team archive followed by restoration before the next scheduler tick previously left an SLA running. The added public-door probe reproduced this: expected `state: stopped`, six remaining business minutes and a 10:04 stop; received `state: running`, four remaining minutes and a null stop. Forward-only `migrations/core/0130_sla_team_archive.sql` now stores the stop in the team archive transaction and backfills active clocks of already archived teams during upgrade. It changes no table or column, so the existing archive classification continues to cover every stored field. It retains elapsed time, target snapshots and occurrence receipts. No migration already applied was edited.

The existing SLA registration now also proves both selected filters must match, an actor who is both assignee and triage-responsible receives no warning, the current assignee who is also triage-responsible receives one warning after reassignment, and an existing clock retains its original target and timezone after configuration changes. The original concurrency, DST, role, channel, mute, privacy, restore and erasure assertions remain.

The populated upgrade preserves prior notification choices, stopped-clock target data and occurrence history. The native HTTP archive journey exports and restores an actual archived clock, releases the effect hold, restores the team and confirms the issue still shows the original stop with no replay at a much later scheduler instant. Its existing subscription, migration-ledger, authority, credential and file assertions remain unchanged. While adding the fixture, an intermediate local run detected a subscription revision expectation captured before that new issue existed; moving the fixture before the existing capture resolved the mismatch, preserving the original equality assertions. This was a fixture-order correction, not a CI repair.

## Product provenance and validation

- Requested base: `14f77ce74afb0c776e42b935fce53ea66ef9baf4`.
- Integrated main: `5cf3649a1dddb2c2774bae51121b156518bd7b69`. The initial unpublished branch replayed the three base commits onto it. After the first published save, a fresh fetch and merge found main already up to date. No published history was rewritten.
- First product save: `93d6431f`, pushed successfully on attempt one with CI skipped.
- Final product head: `091e707eee124b0a52421053e5c142f40f8178bf`, on `cloud/sd-vector-c-f197`, pushed successfully on attempt one. A subsequent remote read advertised this exact SHA.
- PR: none required; the existing Verify workflow has a branch push entry point.
- Main baseline was green: Verify `42169379975`, Run site `42169379974`, both on the integrated main SHA. These are baseline results, never candidate proof.
- Candidate Verify: push run `42170959260`, bound to the full final head. Its final observed state is recorded separately in `ci-receipt.json`.
- Exact-head touched Worker run: `pnpm test:worker tests/worker/due-reminders.test.ts tests/worker/data-http.test.ts`, exit 0, two files and six registrations passed. `touched-receipt.json` records its actual start, completion, head and log hash. No local full suite was run.
- Typecheck, first-party check, source lock freshness, touched contract generator write and check: all exit 0. Generated `ACCEPTANCE.md` and `docs/CLAIMS.md` were then restored whole from main; neither is committed by this round.
- Build: exit 0. The final commit changes only the HTTP archive test and its source lock, so the application's built source is unchanged from the successful build. The mounted browser journey ran on the exact final head.
- Exact-head browser: `cloud_run timeout 1200 node /tmp/vector-sla-browser.mjs`, exit 0; this temporary launcher calls the committed `runResolutionSlaRuntime` with system Chromium and `--no-sandbox`. The committed helper remains invoked by the ordinary integration runtime in Verify. Configuration, remaining-time countdown, Inbox warning and stopped countdown were captured at 1440 and 390. Its desktop assertions and existing phone smoke, accessibility, overflow and hydration checks passed. Browser contexts and the owned Worker were closed. `browser/receipt.json` hashes all eight screenshots.
- All five candidate commits passed the complete author, committer and trailer audit, including side parents. New text contains no email-shaped address or provider-shaped key. Existing repository history and unrelated legacy prose remain intact. The history audit is narrower than the fleet's full publication scan and does not claim that scan passed.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node scripts/contract-docs.mjs write AUTO-004 then check AUTO-004, restore generated views from main exit=0; ledger=resolutionSlaUpgrade ordered migration-ledger and foreign-key assertions inside exact-head touched Worker run exit=0.

## Runtime probes

PROBE AUTO-004 target and clock: native team SLA PUT plus issue POST with priority and label -> only issues satisfying both filters acquire a clock; native GET shows the persisted target and timezone after later settings edits.
PROBE AUTO-004 advance warning: actual scheduled export at 89 business minutes -> zero warnings; concurrent ticks at 90 -> one Inbox warning and one selected Slack post; repeated tick and fresh app -> still one.
PROBE AUTO-004 breach: concurrent and repeated scheduled ticks at the target -> one breach receipt and one breach audit, retaining the single warning receipt.
PROBE AUTO-004 business time: fixed New York clocks across the weekend and both DST changes -> no early warning and exact real elapsed business-minute totals.
PROBE AUTO-004 recipients: native issue and rotation changes before warning -> current assignee and responsible member receive one row when identical; former assignee gets zero; actor occupying both eligible roles gets zero.
PROBE AUTO-004 channels: explicitly selected native Slack then Discord team bindings -> exactly one minimal identifier, warning and authenticated link at each network edge; uncertainty stays terminal and revoked bindings send nothing further.
PROBE AUTO-004 preferences and privacy: native issue mute, type mute and private membership withdrawal -> zero recipient warnings and no backfill after unmute; hidden issue read returns 404; no private identifier in the channel payload.
PROBE AUTO-004 authority: both team-settings permission values -> Owner, Admin and team owner accepted, ordinary Member follows the setting, Guest and Viewer refused without changing SLA storage; missing session returns 401.
PROBE AUTO-004 withdrawal: native team archive at 10:04 and restoration at 10:06 with no tick between -> stopped clock with six minutes remaining, unchanged across later ticks, zero warning and breach occurrences.
PROBE AUTO-004 upgrade and archive: populated older schema and native HTTP export, pristine restore, fresh historical Owner, effect release and team restoration -> original stopped clock and occurrence history retained, no replay at the later scheduler instant.
PROBE AUTO-004 browser: rendered team Settings -> saved target after reload; built issue page -> 60 minutes remaining and later Stopped; native Inbox -> exactly one SLA warning; screenshots at 1440 and 390 and no hydration error.
PROBE AUTO-004 held remainder: none; the brief explicitly preserves customer-tier and triage-time targets, other policy combinations, Insights charts, external recipient qualification, commissioning and supplied interface qualification as owed.

## DONE-RIDERS assessment

No DONE flip or judge request is made. Each row is assessed against the exact candidate with its honest boundary:

1. PARTIAL for the complete clause: selected native resolution outcomes are reached by the named Worker and browser journeys; held customer-tier, triage-time and reporting outcomes remain unproved and are retained in the Gap. New native cases: `tests/worker/resolution-sla-state-scenario.ts:42` and `:70`; `tests/worker/resolution-sla-recipient-scenario.ts:84` through `:139`; archive restoration in `tests/worker/data-http.test.ts:297` onward.
2. PASS for selected outcomes: real native seeded issues are observed through API and browser doors; actor exclusion, current recipient changes and role refusals are exercised, not inferred from empty initial storage. The archive-stop regression fails without the correction, as the recorded reproduction shows.
3. Exact-head local proof PASS; recorded candidate Verify status remains the independent CI bar and is in `ci-receipt.json`. Worker proof is invoked by the existing test globs; browser proof is reached by `tests/e2e/integration-runtime.mjs` in the hosted-artifact shard. No new CI entry or workflow edit.
4. PASS: exact-head touched Worker and browser receipts. The final test-only commit changes no compiled application source from the successful build.
5. PASS for selected inherited duties: AUTO-004 explicitly names NOTIFY-001 Inbox and actor exclusion, SLACK-003 durable minimal bound posts, and ROLE-009 team settings authority in its existing clause text. No unbuilt receiving duty was silently claimed.
6. PASS as an honest PARTIAL record: Evidence names the added journeys and Gap retains every owed requirement. Generator write and check pass, views then restored as instructed. Main's unrelated historical Judged-from prose is left intact; no DONE provenance is claimed.
7. PASS: acceptance text, riders and all other Status rows are unchanged. No ruling, split or acceptance rewrite is introduced.
8. PASS for selected authority: `tests/worker/resolution-sla-scenario.ts:655` through `:698` exercises both setting values, Owner, Admin, team owner, ordinary Member, Guest, Viewer and missing-session cells, with refused SLA storage unchanged. Existing private access and erasure assertions remain at the end of the same journey.
9. PASS for honest boundary: Slack and Discord network-edge evidence only; no live provider, external Oncall or PagerDuty recipient, hosted commissioning or interface qualification is reported as proven.
10. PASS for no new policy choice: retain the existing conservative default verbatim in the Gap. No hold is released and no new consent, authority or destructive action is introduced. The inline ruling index contains no Vector ruling; no scope ASK is posted.
11. PENDING FLEET LANDING: candidate remains branch-only. Publication scanning, main equality, landing and exact-main Run site are not run or claimed by this cloud task.

## Pre-handoff checks and remaining custody

The selected user-visible behavior is covered by native journeys; the archive correction has an actual failing-before and passing-after public-door assertion. No existing assertion was removed, narrowed or put behind a width or branch condition. Current authority, revoked channel custody, erasure and restore replay fences remain covered. Configuration remains in Settings and no interface implementation changed. The existing SLA screens were inspected at both widths, with no new icon-only control or one-sided rounded border. The source lock is fresh and added product text has zero email-shaped strings.

Publication scan is NOT RUN in cloud; its complete result and zero-findings requirement remain with the guarded fleet lander. Candidate Run site and independent qualification remain pending. No hosted account, key or provider qualification is fabricated. The full clause cannot be called DONE while its supplied held requirements remain owed. The native correction is independently reviewable and pushed without claiming those holds are satisfied.

Evidence is published separately from product custody, only on the declared evidence ref. Packet files contain reports, actual receipts, sanitized assertion output and synthetic browser screenshots; no credential, environment dump, database, session, private gate material or symlink is selected.

## Terminal CI observation

At 2026-11-06T05:57:59Z, exact-head push Verify `42170959260` remained `in_progress`, with no conclusion. Discovery and this poll were separated by more than 300 seconds. Three GitHub calls were used in total: main baseline discovery, candidate discovery and one candidate poll. No workflow was dispatched or rerun and no green result from another SHA is substituted. Terminal product custody is PUSHED while the maintained fleet completes the exact-SHA CI and publication gates. No known real candidate failure is being hidden.
