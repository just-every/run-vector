# sd-vector-c-f206-fix1

Repository: just-every/run-vector  
Product branch: cloud/sd-vector-c-f206-fix1  
Product head: 442b61455234c57befcb642bf4afdaa2dc459922  
Source candidate: f2f92d8297107b0f690da10efb778a0dd9e2cce8  
Fresh main: 0e8a686c06eddd55943ed1d2690df32a8fc82213  
PR: none; branch Verify is available and the fleet owns landing.

## Plan and scope

The complete plan is in PLAN.md. Confirm the source and fresh main; reproduce each blocking behavior through signed Slack/native comment doors; fix only shortcut normalization, broadcast reply admission and Guest delivery; rerun the identical probes plus touched checks; regenerate and check mechanical outputs; audit all candidate identities, publish the named branch, observe exact-SHA Verify, publish this separate evidence packet, and remove the clone after confirmed transfer.

A fresh full-history clone used git clone --filter=blob:none, with no depth. The fetched cloud/sd-vector-c-f206 head printed exactly f2f92d8297107b0f690da10efb778a0dd9e2cce8 before creating the fix branch. git merge --no-commit --no-ff origin/main reported Already up to date. Fresh main was also fetched immediately before the commit and remained an ancestor. No rebase, force push, default-branch write or published-history rewrite occurred.

The fix commit changes only:
- src/core/features/integrations/slack-app/shortcut.ts
- src/core/features/integrations/slack-app/thread-mapping.ts
- src/core/features/integrations/slack-app/thread-delivery.ts
- tests/worker/slack-thread-scenario.ts
- sources.lock.json, regenerated last

The original candidate's other files remain unchanged. No UI code changed. No test was deleted, skipped or weakened. The targeted reproduction command intentionally selects one existing test; the complete file subsequently ran with all eight tests passing.

## Reproduction and fixed results

Both phases ran the same hard-bounded public-door command, directly in this dedicated cloud VM:

cloud_run timeout 180 pnpm exec vitest run --config vitest.config.ts tests/worker/outbound-broken-destination.test.ts -t 'Signed Slack Events'

The first run added regression assertions but left product source at the original candidate. It failed all three findings (six soft assertions). Soft assertions retain failure while allowing every finding to be observed in one native scenario. The fixed run passed, including the existing populated upgrade proof.

REPRO A: head -> HTTP 200, bot-authored shortcut mapped roots 0; human-source control 1.  
PROBE A: fixed -> HTTP 200, mapped root 1, original Slack author retained and linked human attributed; replay HTTP 409 without writes.

The signed human shortcut now constructs its actor/source fields explicitly. A source message's bot_id no longer marks the human action as a bot event. Actual bot event echo suppression remains active.

REPRO B: head -> HTTP 200, thread_broadcast mapped replies 0.  
PROBE B: fixed -> HTTP 200, mapped reply 1 in the original root; replay HTTP 409; message_changed writes 0.

Only message subtype thread_broadcast with a distinct thread timestamp is admitted as a reply. Other subtype and bot-echo guards remain active, and the normal mapping and current native authority checks still apply.

REPRO C: head -> native HTTP 201, Guest posts 0, Owner control posts 1; Guest delivery ledger absent.  
PROBE C: fixed -> native HTTP 201, Guest posts 1, Owner control posts 1; Guest ledger accepted with attempts 1 after repeated dispatch and restart. Guest membership withdrawal during channel safety lookup suppresses the queued post.

The outbound reply actor's current visibility check now admits an active Guest with access to this issue. The original mapper's linked-member role restriction remains unchanged. Private-team redaction, source-link withdrawal, deleted replies, restore holds, removed/inactive identities, one-send receipts and uncertain outcomes retain existing coverage.

## Validation and mechanical results

Actual command/result receipts are in validation-receipt.json and the selected logs.

- Full outbound-broken-destination.test.ts: 8 passed, 0 failed, 0 skipped. This includes Slack installation, member mapping, signed events and thread sync, populated 0134 upgrade, archive/recovery, uninstall, direct-message access and unfurls.
- Typecheck: passed.
- Pinned rer setup with fleet owner: passed; private setup output and runtime settings/databases are excluded.
- npx -y @runeditrun/rer build through cloud_run: passed.
- npx -y @runeditrun/rer check --profile first-party through cloud_run: passed.
- node sdk/generate.mjs --check: passed, 56 published operations; no stale SDK, so no regeneration or SDK edit.
- Contract generator write and check with touched-clause argument SLACK-002: passed, then ACCEPTANCE.md and docs/CLAIMS.md restored whole from origin/main. Neither view is committed.
- pnpm integration:sync and pnpm integration:check: passed. Regeneration produces the existing deployment spec unchanged.
- Product changes staged before pnpm sources:lock; regenerated lock staged, then pnpm sources:check: passed.
- Git whitespace check: passed.

MECHANICAL ledger=cloud_run timeout 180 node --test scripts/deployment/tests/migration-head.test.mjs exit=0; spec=pnpm integration:sync plus pnpm integration:check exit=0; lock=pnpm sources:lock plus pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write SLACK-002 plus node scripts/contract-docs.mjs check SLACK-002 exit=0.

The ledger proof applies the complete migration set, verifies recorded names and digests, retains owner/invitation guards and repeats without writes. The signed Slack test also executes the populated pre-0134 upgrade, retaining every old row, empty new Slack ledgers and foreign-key integrity. Main's highest migration is 0133_release_notes.sql; candidate 0134_slack_threads.sql does not collide. No migration was edited or renumbered.

The supplied cloud toolchain selected Node 24.19.0 for direct pnpm checks, emitting the expected package-engine warning; rer commands used the project's Node 22.20.0. pnpm was pinned at 10.12.4.

## Clause judgments and counts

No clause judgment changes. Every one of the 272 parent status rows is retained.

Before -> after: done 136 -> 136; partial 72 -> 72; missing 64 -> 64; total 272 -> 272.

The brief calls the candidate PARTIAL and forbids promotion. Both the exact source candidate and fresh main actually record SLACK-002 as missing in CONTRACT.md, with the narrative and Status row agreeing. This fix preserves that existing source judgment (missing -> missing) and makes no promotion. The externally described PARTIAL scope remains incomplete; attachment, customer, unlinked-requester and other nonblocked requirements were not added.

## Product custody and CI

Commit 442b61455234c57befcb642bf4afdaa2dc459922 is authored and committed by Run Edit Run fleet <fleet@runeditrun.com>, with no co-author trailers. The active cleanup hook preserves repository hooks. Before the push, all eight commits reachable in origin/main..HEAD, including side parents, passed the fleet identity and full-message/trailer audit.

The product branch was pushed once, with no skip-ci marker, through the required cloud-push guard. It succeeded on attempt 1. Complete sanitized output is in push-receipt.log.

Exact-SHA Verify run: 42520783647  
https://github.com/just-every/run-vector/actions/runs/42520783647

Verify completed with conclusion success on the exact product SHA. No generated-view exception was needed. Seven GitHub calls were used: one discovery and six status reads, each spaced at least 300 seconds apart. No failed-job log reads or extra workflow dispatches were needed. There are no blockers.

Product custody is READY: the named branch is pushed and exact-SHA Verify is green. Evidence is published separately to refs/heads/evidence/sd-vector-c-f206-fix1 using the provided report-only entrypoint; its exact returned ref/head is carried in the terminal message. The packet was scanned for injected values and credential patterns, and only explicitly selected regular report/receipt files are transferred. The local clone and node_modules will be deleted after the transfer succeeds.

The Mac fleet still performs its independent publication scan and landing checks. No acceptance, provider commissioning, deployment or landing is claimed by this packet.
