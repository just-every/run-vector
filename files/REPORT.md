# sd-vector-security-team-perms-1

Outcome: BLOCKED by a missing product dependency on the required main base. No product commits, product push, PR, acceptance, READY or landing claim.

Repository: `just-every/run-vector`  
Local branch: `cloud/sd-vector-security-team-perms-1`  
Base and terminal product HEAD: `ea77c904c8e553bca43f152710a5d04e4e9e2587`  
Remote main advertised the same SHA. The clone used `git clone --filter=blob:none` without depth; `git rev-parse --is-shallow-repository` returned `false`.

## Blocking evidence and required next step

The assignment assumes the TEAM-006 sub-team implementation is on main. It is not on this main. `src/core/features/sub-teams/` is absent, `teams` has no `parent_team_id` column, and there is no native or bearer hierarchy route. `CONTRACT.md` still records TEAM-006 as missing. Commit `569212d1` is not an ancestor of origin/main (`git merge-base --is-ancestor` exit 1).

Read-only inspection of the existing remote-tracking ref `origin/cloud/sd-vector-c-f205-fix2-pc1` at `60b465d927881a05b01253df7743e3ac8c0456e9` locates the code described by the brief. Its permission-door resolver selects `teams.hierarchy` for a child, whereas this main selects `teams.permissions` unconditionally. Its `setTeamPermissions` includes `hierarchyAuthority`, inherited writes and hierarchy versioning, all absent on main. This ref was inspected without checking it out, merging, committing or pushing it.

The lane must land the approved TEAM-006 dependency on main and rerun this repair, or provide an explicit approved base containing that dependency. Importing the separate sub-team implementation would exceed this authority-only repair and violate the specified base. No additional role-policy decision is needed to understand the requested non-owner refusal.

## Plan and disposition

1. Configure fleet identity first, refresh the launcher, install the decrypted-bundle Git helper and publication hooks, then make a fresh full-history clone and the named branch: completed. Followed launcher and repository AGENTS.md; never accessed INBOX.md or STATE.md.
2. Reproduce the parent/child authority defect before product edits: blocked at child creation by the absent dependency. Ran a bounded diagnostic through the actual Hono application and real local Worker D1, with ordinary native sign-in/invitation and role-fixture sessions; no application mocks. All assertions and relevant input bodies are in `PROBE.test.ts`.
3. Audit all current-main permission and team visibility writers and aliases: completed below. No child/hierarchy behavior was invented.
4. Apply a shared team-owner/Owner/Admin authority rule for all accepted permission keys, add the requested public child-door regression to the existing permission test file, and validate Member 403 / Owner 200: deferred because the child subject and its routes do not exist on this base. Existing team-owner authority is retained. No production fix or new committed regression test is claimed.
5. Run public-door/membership checks, typecheck, contract write/check, restore generated views, then regenerate/check the source lock: completed as baseline diagnostics. Generated SDK and deployment spec were not regenerated: there is no product candidate or Verify report naming either stale.
6. Preserve actual non-secret reports separately and publish only to `refs/heads/evidence/sd-vector-security-team-perms-1`; remove clone and node_modules after successful evidence transfer. Product branch remains unpushed. Cleanup completion is recorded in the terminal response.

## Public-door observations

The Member is a plain workspace Member and a member of the probed team, not its owner. The Owner sets `settings=all_members`, `planning=team_owners` through the permission door before the Member attempts `planning=all_members`. Refused writes are compared against full snapshots of teams, team_members, audit_records and administration_audit_details.

- `REPRO root permission door: 403`
- `PROBE root permission door: Member -> 403; Owner -> 200`
- `POST /api/settings/teams` with `parentTeamId=<existing team>` as Owner: 400, because the strict creation schema has no parent field.
- `PUT /api/settings/teams/<existing>/hierarchy` as Owner: 404; this door is absent.
- `PRAGMA table_info(teams)`: no `parent_team_id` column.
- `REPRO child permission door: NOT RUN — child creation and schema unavailable on required main`.
- `PROBE child permission door: Member -> NOT RUN; Owner -> NOT RUN`.

These are baseline diagnostics, not a reproduction of the requested 200 child-door defect or proof that it is repaired. No claimed hierarchy Member 403 was fabricated from the unrelated Owner 404.

## Sibling-door audit on current main

| Door or writer | Result |
| --- | --- |
| `PUT /api/settings/teams/:id/permissions` | Only `settings` and `planning`, each team_owners/all_members, are accepted by a strict schema. The `teams.permissions` row admits Owner/Admin/team owner and refuses other Members regardless of settings. All four value combinations, including no-op, return Member 403; Owner 200. Refusals change no rows. |
| `setTeamPermissions` in team-membership/permissions.ts | Sole current-main permission UPDATE. Only called by the permission route; request middleware carries role/team authority into the mutation transaction. No hierarchy-dependent resolver on this base. |
| `PUT /api/settings/teams/:id/privacy` | Member 403; Owner 200. Registered `teams.privacy` row; service additionally guards current Owner/Admin. |
| `PUT /api/v1/teams/:id/privacy` | Same service and matrix row; Member 403; Owner 200 (reverts public). |
| `POST /api/settings/teams` and `POST /api/v1/teams` | Private creation selects `teams.privacy`; Member 403 on both, even with public member creation enabled. Owner creation with parentTeamId is rejected 400 on both. Defaults are the only permission values created. |
| `PATCH /api/settings/teams/:id` | Strict schema accepts neither permission nor isPrivate nor parentTeamId. Member with settings=all_members gets 400 for permission injection and privacy injection; service UPDATE has no permission/privacy columns. |
| Native/bearer hierarchy permission or visibility overrides | No registered route, source module or team-parent schema on this main. Native Owner probe returns 404. Not auditable as the shipped child path described in the assignment. |
| Bootstrap team INSERT | Creates the initial local workspace team with schema defaults; no caller-specified permission or visibility fields. Not an existing-workspace user override route. |
| UI and server-function/command aliases | The team permission control uses the native PUT above; roles/settings-doors.ts records no writing server-function alias. No bearer permission route exists; local setup/reset/restore are resource commands, not additional workspace team-setting doors. |

Source searches covered all `settings_permission`, `planning_permission`, `is_private`, `INSERT INTO teams`, and permission/visibility route registrations under src. Only the permission service, privacy service, team creation and bootstrap write these columns on this base. No sibling public route bypass was observed on this base. This conclusion does not certify the separate unlanded hierarchy branch.

## Validation and mechanical results

- Setup: `cloud_run timeout 900 npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive`: exit 0; commit hooks reinstalled afterward. No provider account, deploy or hosted operation.
- Full current role-matrix test file plus diagnostic: `cloud_run timeout 300 pnpm exec vitest run --config vitest.config.ts tests/worker/fleet-team-permissions-probe.test.ts tests/worker/role-matrix.test.ts --reporter=verbose --reporter=json --outputFile.json=../packet/TEST-RESULTS.json`: exit 0; 7/7 tests passed in two files (six existing tests plus one diagnostic), 202.45 seconds. Initial toolchain selected Node 24.19.0 / pnpm 10.12.4.
- Pinned Node 22.20.0 targeted membership/permission/diagnostic rerun and pinned typecheck: exit 0 for both; 3/3 selected tests passed (four other cases were unselected by the filter and had all passed in the full run). Actual outcomes are recorded in RECEIPT.json, PINNED-TEST-RESULTS.json, PINNED-TESTS.log and PINNED-TYPECHECK.log. Selected tests are ordinary test filtering; no existing test was edited, deleted, skipped in source or weakened. The diagnostic source was moved out to this packet after use; product files remain unchanged.
- Initial `cloud_run timeout 240 pnpm typecheck`: exit 0. See TYPECHECK.log.
- `MECHANICAL lock=pnpm sources:lock exit=0; views=node scripts/contract-docs.mjs write exit=0`.
- `node scripts/contract-docs.mjs check`: exit 0. No touched clause arguments because no clause was edited; default documented generation/check was used. `git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md` restored both views whole.
- `pnpm sources:check`: exit 0, after lock regeneration last. `git add -u` staged no changes; regenerated source lock and CONTRACT.md are byte-identical to main.
- CI: no product candidate, product push, PR or exact-SHA Verify run. Run IDs: none. GitHub API calls: 0/10. There is no generated-view-only failure exemption to apply.

## Counts, custody and limitations

| Status counts | Before | After |
| --- | ---: | ---: |
| Done | 136 | 136 |
| Partial | 72 | 72 |
| Missing | 64 | 64 |
| Total | 272 | 272 |

Published counts remain 98 done / 6 partial / 0 missing (104); target counts remain 38 done / 66 partial / 64 missing (168). Clause status changes: none. ROLE-009 remains done; TEAM-006 remains missing. CONTRACT.md, all existing tests, generated views, SDK, deployment spec and source lock are unchanged. No product commits exist beyond origin/main. The full requested parent+child repro, child regression, repair and exact-SHA Verify remain blocked on the dependency and are not claimed complete.

Packet files are selected explicitly, checked as regular files, and exclude credentials, private settings, environment dumps, runtime databases, held-out material and symlinks. Evidence publication is report transport only; it does not indicate product READY or landing.
