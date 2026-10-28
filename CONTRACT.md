# Vector target product contract

Vector is a self-hosted issue tracker and software delivery workspace for US engineering, product and design teams replacing Linear, Jira or GitHub Issues and Projects, and competing with Plane and Huly. It carries reports through evidence-led triage, projects and cycles, tested changes and verified fixes, with connected support, chat, code hosts and coding agents.

## Product target

| | |
| --- | --- |
| Category | Issue tracking and software project management |
| Incumbents a buyer switches from | Linear, Jira (Atlassian), GitHub Issues and Projects |
| Up-and-comers it must also beat | Plane, Huly |
| First buyer | A US software team of 5 to 500 engineering, product and design people, with support and leadership as readers; self-hosted on its own Cloudflare account, free and open source, customer revenue in USD and calendar rules in its chosen IANA workspace time zone |

The primary journey: Connect a report source, inspect the evidence, accept, defer or decline the report, plan issues into projects and cycles, delegate a tested fix, follow its deployment and verify the customer outcome.

## How to read this contract

- This follows the RER contract standard and describes the full target.
- Core is first-week switching work plus push further; Agent surface and Later are reported separately.
- Done means the cited journeys cover every acceptance point; partial and missing keep their named gaps.
- The Field proof register records real-world receipts separately from repository-producible acceptance.
- ACCEPTANCE.md, docs/CLAIMS.md and the Status summary counts are generated from this file.

## Door rules

- **D-1.** Historical imports create records and their import history without sending notifications, mail, webhooks or agent work.
- **D-2.** An inference keeps its evidence and uncertainty. The company's policy decides every agent call from its risk classes; it never becomes a fact merely because a model produced it.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | SETUP-001, OWNER-CLAIM-001, ROLE-010 | not run |
| BASE-ACCESS-002 | Sessions | SETUP-001, EDITOR-001 | not run |
| BASE-ACCESS-003 | Public endpoints | none | not run |
| BASE-ACCESS-004 | Server-side authorisation | OPS-001, OPS-002, OPS-003, OPS-004, API-001, API-002, OWNER-CLAIM-001, API-003, API-004, API-005 | not run |
| BASE-INPUT-001 | Validation | ISSUE-001, ISSUE-002, ISSUE-003, ISSUE-004, ISSUE-005, ISSUE-006, ISSUE-007, ISSUE-008, ISSUE-029, ISSUE-030, ISSUE-009, ISSUE-010, ISSUE-011, ISSUE-012, ISSUE-013, ISSUE-014, ISSUE-015, REL-001, REL-002, REL-003, REL-004, REL-005, REL-006, INTAKE-001, INTAKE-002, INTAKE-003, INTAKE-004, INTAKE-005, INTAKE-006, INTAKE-007, INTAKE-008, INTAKE-009, INTAKE-010, INTAKE-011, PROJ-001, PROJ-002, PROJ-003, PROJ-004, PROJ-005, PROJ-006, PROJ-007, PROJ-008, PROJ-009, API-001, API-002, ISSUE-016, ISSUE-017, ISSUE-018, ISSUE-019, ISSUE-020, ISSUE-031, ISSUE-032, ISSUE-021, ISSUE-022, ISSUE-023, ISSUE-024, ISSUE-033, ISSUE-034, ISSUE-035, ISSUE-036, ISSUE-025, ISSUE-026, ISSUE-027, ISSUE-028, REL-007, TRIAGE-001, TRIAGE-002, TRIAGE-003, TRIAGE-004, TRIAGE-005, CUST-001, CUST-002, CUST-003, CUST-004, CUST-005, CUST-006, CUST-007, CUST-008, PROJ-010, PROJ-011, PROJ-012, PROJ-013, PROJ-014, PROJ-015, PROJ-016, PROJ-046, PROJ-017, API-003, API-004, API-005 | not run |
| BASE-INPUT-002 | HTML | ISSUE-033 | not run |
| BASE-INPUT-003 | Uploads | ISSUE-024, ISSUE-033, ISSUE-034 | not run |
| BASE-SECRET-001 | No leakage | INTEG-001, INTEG-002, SEC-001, SEC-002, SEC-003 | not run |
| BASE-SECRET-002 | Startup | none | not run |
| BASE-DATA-001 | Export and import | DATA-001, DATA-002, DATA-003, DATA-004, DATA-005, DATA-006, DATA-007, DATA-008, DATA-009, DATA-010, DATA-011, DATA-012, DATA-013, DATA-014, DATA-015, DATA-016, DATA-017, DATA-018 | not run |
| BASE-DATA-002 | Retention | none | not run |
| BASE-DATA-003 | Erasure | ISSUE-009, DATA-011, ROLE-012, SEC-003 | not run |
| BASE-DATA-004 | Outbound flows | none | not run |
| BASE-DATA-005 | Independence | none | not run |
| BASE-PUBLIC-001 | Privacy | HOME-001 | not run |
| BASE-PUBLIC-002 | Origins | EDITOR-001 | not run |
| BASE-PUBLIC-003 | Accessibility | none | not run |
| BASE-OPS-001 | Health | none | not run |
| BASE-OPS-002 | Migrations | none | not run |
| BASE-OPS-003 | Idempotency | INTAKE-001, INTAKE-002, INTAKE-003, INTAKE-004, INTAKE-005, INTAKE-006, INTAKE-007, INTAKE-008, INTAKE-009, INTAKE-010, INTAKE-011, CYCLE-001, CYCLE-002, CYCLE-003, CYCLE-004, CYCLE-005, CYCLE-006, NOTIFY-001, NOTIFY-002, NOTIFY-003, NOTIFY-004, NOTIFY-005, NOTIFY-006, GITHUB-001, GITHUB-002, WEBHOOK-001, CYCLE-007, CYCLE-008, NOTIFY-007, NOTIFY-008, NOTIFY-009, NOTIFY-010, AUTO-001, AUTO-002, AUTO-003, AUTO-004, AUTO-005, AUTO-006, GITHUB-003, GITHUB-004, GITHUB-005, GITHUB-006, GITHUB-007, GITHUB-008, GITLAB-001, GITLAB-002, BITBUCKET-001, SLACK-001, SLACK-002, SLACK-003, SLACK-006, SLACK-007, SLACK-008, SLACK-009, SLACK-004, SLACK-010, SLACK-011, SLACK-012, SLACK-005, TEAMS-001, WEBHOOK-002 | not run |
| BASE-OPS-004 | Failure is visible | none | not run |
| BASE-OPS-005 | Audit | AUTO-001, AUTO-002, AUTO-003, AUTO-004, AUTO-005, AUTO-006 | not run |
| BASE-ROLE-001 | Roles through every door | OPS-001, OPS-002, OPS-003, OPS-004, TEAM-001, TEAM-002, TEAM-003, TEAM-004, ISSUE-001, ISSUE-002, ISSUE-003, ISSUE-004, ISSUE-005, ISSUE-006, ISSUE-007, ISSUE-008, ISSUE-029, ISSUE-030, ISSUE-009, ISSUE-010, ISSUE-011, ISSUE-012, ISSUE-013, ISSUE-014, ISSUE-015, PROJ-001, PROJ-002, PROJ-003, PROJ-004, PROJ-005, PROJ-006, PROJ-007, PROJ-008, PROJ-009, CYCLE-001, CYCLE-002, CYCLE-003, CYCLE-004, CYCLE-005, CYCLE-006, SEARCH-001, SEARCH-002, SEARCH-003, VIEW-001, VIEW-002, VIEW-003, VIEW-004, VIEW-005, EDITOR-001, ROLE-001, ROLE-002, ROLE-003, ROLE-004, ROLE-005, ROLE-006, ROLE-007, ROLE-008, ROLE-009, ROLE-010, ROLE-014, ROLE-011, ROLE-015, ROLE-016, ROLE-017, ROLE-012, ROLE-013, TEAM-005, TEAM-006, TEAM-007, TEAM-008, ISSUE-016, ISSUE-017, ISSUE-018, ISSUE-019, ISSUE-020, ISSUE-031, ISSUE-032, ISSUE-021, ISSUE-022, ISSUE-023, ISSUE-024, ISSUE-033, ISSUE-034, ISSUE-035, ISSUE-036, ISSUE-025, ISSUE-026, ISSUE-027, ISSUE-028, TRIAGE-001, TRIAGE-002, TRIAGE-003, TRIAGE-004, TRIAGE-005, CUST-001, CUST-002, CUST-003, CUST-004, CUST-005, CUST-006, CUST-007, CUST-008, PROJ-010, PROJ-011, PROJ-012, PROJ-013, PROJ-014, PROJ-015, PROJ-016, PROJ-046, PROJ-017, CYCLE-007, CYCLE-008, SEARCH-004, SEARCH-005, VIEW-006, VIEW-007, VIEW-008, VIEW-009, VIEW-010, VIEW-011, SYNC-001, SYNC-002, SYNC-003, MOBILE-001, MOBILE-002, MOBILE-003, MOBILE-004, MOBILE-005, REPORT-001, REPORT-002, REPORT-006, REPORT-003, REPORT-004, REPORT-005, INTEG-001, INTEG-002, SLACK-001, SLACK-002, SLACK-003, SLACK-006, SLACK-007, SLACK-008, SLACK-009, SLACK-004, SLACK-010, SLACK-011, SLACK-012, SLACK-005, TEAMS-001 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | WEBHOOK-001, ROLE-005, WEBHOOK-002 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | none | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | DATA-011, ROLE-012 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | ROLE-004, ROLE-010 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | ROLE-014 | not run |
| BASE-INSTALL-001 | Free self-host and removal | HOME-001 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | NOTIFY-006 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | INIT-003, VIEW-011, MOBILE-001, MOBILE-002, MOBILE-003, MOBILE-004, MOBILE-005, REPORT-001 | not run |
| BASE-DOCS-001 | On-site docs from one contract | none | not run |
| BASE-AGENT-001 | One MCP door per seed | AGENT-005 | not run |
| BASE-AGENT-002 | The seed's jobs are tools, through the UI's own actions | AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, AGENT-009, SURFACE-001, SURFACE-002, SURFACE-003, SURFACE-004, SURFACE-005, SURFACE-006, SURFACE-007, SURFACE-008, SURFACE-009, SURFACE-010, SURFACE-011, SURFACE-012, SURFACE-013 | not run |
| BASE-AGENT-003 | Records are resources | AGENT-005 | not run |
| BASE-AGENT-004 | Business identity and short-lived, audience-bound tokens | AGENT-005 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role, never more | AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, AGENT-009, PUSH-001, PUSH-002, PUSH-003, PUSH-004, PUSH-005, PUSH-006, PUSH-007, PUSH-008, PUSH-009, PUSH-010 | not run |
| BASE-AGENT-006 | Every action declares its risk class | AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, AGENT-009, PUSH-001, PUSH-002, PUSH-003, PUSH-004, PUSH-005, PUSH-006, PUSH-007, PUSH-008, PUSH-009, PUSH-010, SURFACE-001, SURFACE-002, SURFACE-003, SURFACE-004, SURFACE-005, SURFACE-006, SURFACE-007, SURFACE-008, SURFACE-009, SURFACE-010, SURFACE-011, SURFACE-012, SURFACE-013 | not run |
| BASE-AGENT-007 | The company's policy decides, at one chokepoint | AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, AGENT-009, PUSH-001, PUSH-002, PUSH-003, PUSH-004, PUSH-005, PUSH-006, PUSH-007, PUSH-008, PUSH-009, PUSH-010 | not run |
| BASE-AGENT-008 | Truthful attribution | ROLE-006, ROLE-008, AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, AGENT-009, PUSH-001, PUSH-002, PUSH-003, PUSH-004, PUSH-005, PUSH-006, PUSH-007, PUSH-008, PUSH-009, PUSH-010 | not run |
| BASE-AGENT-009 | Every agent action is audited with its class and decision | AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, AGENT-009, PUSH-001, PUSH-002, PUSH-003, PUSH-004, PUSH-005, PUSH-006, PUSH-007, PUSH-008, PUSH-009, PUSH-010 | not run |
| BASE-AGENT-010 | Agents can follow changes | none | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, AGENT-009, PUSH-001, PUSH-002, PUSH-003, PUSH-004, PUSH-005, PUSH-006, PUSH-007, PUSH-008, PUSH-009, PUSH-010 | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | none | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-002, SURFACE-003, SURFACE-004, SURFACE-005, SURFACE-006, SURFACE-007, SURFACE-008, SURFACE-009, SURFACE-010, SURFACE-011, SURFACE-012, SURFACE-013 | not run |

## Published clauses

- `HOME-001`: *Tier:* Core · *Cites:* BASE-PUBLIC-001, BASE-INSTALL-001
- `OPS-001`: *Tier:* Core · *Cites:* BASE-ACCESS-004, BASE-ROLE-001
- `SETUP-001`: *Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002
- `OPS-002`: *Tier:* Core · *Cites:* BASE-ACCESS-004, BASE-ROLE-001
- `OPS-003`: *Tier:* Core · *Cites:* BASE-ACCESS-004, BASE-ROLE-001
- `OPS-004`: *Tier:* Core · *Cites:* BASE-ACCESS-004, BASE-ROLE-001
- `TEAM-001`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `TEAM-002`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `TEAM-003`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `TEAM-004`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `ISSUE-001`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-002`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-003`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-004`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-005`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-006`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-007`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-008`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-029`: *Tier:* Core · *From:* ISSUE-008 · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-030`: *Tier:* Core · *From:* ISSUE-008 · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-009`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001, BASE-DATA-003
- `ISSUE-010`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-011`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-012`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-013`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-014`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `ISSUE-015`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `REL-001`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `REL-002`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `REL-003`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `REL-004`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `REL-005`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `REL-006`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `INTAKE-001`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003
- `INTAKE-002`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003
- `INTAKE-003`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003
- `INTAKE-004`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003 · *Rules:* D-2
- `INTAKE-005`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003
- `INTAKE-006`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003
- `INTAKE-007`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003
- `INTAKE-008`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003
- `INTAKE-009`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003
- `INTAKE-010`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003
- `INTAKE-011`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003
- `CURR-001`: *Tier:* Core
- `CURR-002`: *Tier:* Core
- `CURR-003`: *Tier:* Core
- `CURR-004`: *Tier:* Core
- `CURR-005`: *Tier:* Core
- `CURR-006`: *Tier:* Core
- `CURR-007`: *Tier:* Core
- `CURR-008`: *Tier:* Core
- `CURR-009`: *Tier:* Core
- `WORK-001`: *Tier:* Core
- `WORK-002`: *Tier:* Core
- `WORK-003`: *Tier:* Core
- `PROJ-001`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `PROJ-002`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `PROJ-003`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `PROJ-004`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `PROJ-005`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `PROJ-006`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `PROJ-007`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `PROJ-008`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `PROJ-009`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001
- `CYCLE-001`: *Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001
- `CYCLE-002`: *Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001
- `CYCLE-003`: *Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001
- `CYCLE-004`: *Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001
- `CYCLE-005`: *Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001
- `CYCLE-006`: *Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001
- `SEARCH-001`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `SEARCH-002`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `SEARCH-003`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `VIEW-001`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `VIEW-002`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `VIEW-003`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `VIEW-004`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `VIEW-005`: *Tier:* Core · *Cites:* BASE-ROLE-001
- `CMD-001`: *Tier:* Core
- `CMD-002`: *Tier:* Core
- `CMD-003`: *Tier:* Core
- `NOTIFY-001`: *Tier:* Core · *Cites:* BASE-OPS-003
- `NOTIFY-002`: *Tier:* Core · *Cites:* BASE-OPS-003
- `NOTIFY-003`: *Tier:* Core · *Cites:* BASE-OPS-003
- `NOTIFY-004`: *Tier:* Core · *Cites:* BASE-OPS-003
- `NOTIFY-005`: *Tier:* Core · *Cites:* BASE-OPS-003
- `NOTIFY-006`: *Tier:* Core · *Cites:* BASE-OPS-003, BASE-MAIL-001
- `GITHUB-001`: *Tier:* Core · *Cites:* BASE-OPS-003
- `GITHUB-002`: *Tier:* Core · *Cites:* BASE-OPS-003
- `API-001`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ACCESS-004
- `API-002`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ACCESS-004
- `WEBHOOK-001`: *Tier:* Core · *Cites:* BASE-OPS-003, BASE-AUDIT-001
- `DATA-001`: *Tier:* Core · *Cites:* BASE-DATA-001
- `DATA-002`: *Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1
- `DATA-003`: *Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1
- `DATA-004`: *Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1
- `DATA-005`: *Tier:* Core · *Cites:* BASE-DATA-001
- `DATA-006`: *Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1
- `DATA-007`: *Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1
- `DATA-008`: *Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1 · *Register:* R-10
- `DATA-009`: *Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1 · *Register:* R-10
- `DATA-010`: *Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1 · *Register:* R-10
- `DATA-011`: *Tier:* Core · *Cites:* BASE-DATA-001, BASE-DATA-003, BASE-DATA-006
- `OWNER-CLAIM-001`: *Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-004
- `EDITOR-001`: *Tier:* Core · *Cites:* BASE-ACCESS-002, BASE-ROLE-001, BASE-PUBLIC-002

### Public homepage

#### HOME-001 — Public homepage

**Requirement.** The owner-approved public marketing homepage at `/` remains exactly as approved, including its copy and assets and the line “100% free, open source alternative to Linear, Jira and Asana.” That line is product positioning; it does not promise feature parity or importer coverage for every named product. The installed-root choice follows RL-1.

**Acceptance.** Through the native product door and its declared counterpart:
1. The owner-approved public marketing homepage at `/` remains exactly as approved, including its copy and assets and the line “100% free, open source alternative to Linear, Jira and Asana.” That line is product positioning; it does not promise feature parity or importer coverage for every named product.
2. The page presents Vector with its headline, one supporting sentence, and source and docs links, followed by short sections (how Current explains each issue, free and open source, deferral, the rest of the product, trying it beside another tracker, a closing call to action), each drawing the product only from its real labels.
3. The public site's “Run Vector” action remains unchanged and points to `/run`, the installation page.
4. The installed application's root `/` serves the Base Lobby, whose Sign in entry satisfies this clause's sign-in requirement.
5. The page contains no pricing, hosting costs, customer testimonials or invented metrics, reads no installation data and is server-rendered.

### Workspace, people and permissions

#### OPS-001 — Workspace access

**Requirement.** Every workspace member sees every public team's issues, intake items, cycles, projects, initiatives, labels and shared saved views, and every notification addressed to them, and acts on them as the role matrix (ROLE-001, ROLE-008) allows; team membership organizes work and, for a public team, never restricts access.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every workspace member sees every public team's issues, intake items, cycles, projects, initiatives, labels and shared saved views, and every notification addressed to them, and acts on them as the role matrix (ROLE-001, ROLE-008) allows; team membership organizes work and, for a public team, never restricts access.
2. Roles (ROLE-001), private teams (ROLE-002) and guests (ROLE-003) are the only rules that narrow access, and a private saved view (VIEW-002) is visible only to its owner.

#### SETUP-001 — First workspace review

**Requirement.** Fresh configured owners review their workspace at `/setup` before entering an app route. Local entry follows RL-2.

**Acceptance.** Through the native product door and its declared counterpart:
1. Fresh configured owners review their workspace at `/setup` before entering an app route.
2. Signed-out visitors return there after ordinary sign-in.
3. Only the recorded installation owner may complete setup through a same-origin, current-session transaction.
4. Completion survives repeated setup, restart and local restore.
5. Existing configured installations retain completion through the additive upgrade.

#### OPS-002 — Member management

**Requirement.** Members are invited, removed by suspension (OPS-004, ROLE-011), reactivated and erased (ROLE-012) in Settings → Members, and every invitation names the invitee's role (ROLE-001) and, for a Guest, the teams they join (ROLE-003).

**Acceptance.** Through the native product door and its declared counterpart:
1. Members are invited, removed by suspension (OPS-004, ROLE-011), reactivated (ROLE-016) and erased (ROLE-012) in Settings → Members, and every invitation names the invitee's role (ROLE-001) and, for a Guest, the teams they join (ROLE-003).
2. Owners and Admins invite and remove Members and Guests; only Owners invite, promote to or remove Owners and Admins.
3. The installation owner can be removed only by themselves, and never while they are the last Owner (ROLE-001).
4. Members and Guests cannot remove anyone but themselves.

#### OPS-003 — Workspace time

**Requirement.** Settings hold one IANA workspace timezone.

**Acceptance.** Through the native product door and its declared counterpart:
1. Settings hold one IANA workspace timezone.
2. Every calendar day, due reminder, cycle start and end instant, and seven-day window named in this contract is evaluated in that timezone.
3. Changing it never rewrites stored instants, closed cycle snapshots, or reminders already delivered.

#### OPS-004 — Safe removal

**Requirement.** Removing a member from the workspace — by an Owner or Admin in Settings → Members (role matrix), by the member leaving themselves, or by SCIM deprovisioning (ROLE-004) — suspends them under ROLE-011 and never erases them; erasing their personal data is the separate, explicit action of ROLE-012.

**Acceptance.** Through the native product door and its declared counterpart:
1. Removing a member from the workspace — by an Owner or Admin in Settings → Members (role matrix), by the member leaving themselves, or by SCIM deprovisioning (ROLE-004) — suspends them under ROLE-011 and never erases them; erasing their personal data is the separate, explicit action of ROLE-012.
2. Vector rejects the suspension of the last Owner.
3. A suspension revokes the member's sessions and credentials (ROLE-011), transfers each project they lead and each shared saved view they own to the person performing it — or to the longest-standing remaining Owner when they left themselves or SCIM removed them — handles their non-terminal issues as the person performing it chooses (ROLE-011), keeps their name on every comment, activity and audit entry, and writes one activity entry per changed issue and project.
4. A failed step rolls back the whole removal.

### Teams and workflows

#### TEAM-001 — Team identity

**Requirement.** A team has a name and an identifier prefix, each unique across archived and non-archived teams.

**Acceptance.** Through the native product door and its declared counterpart:
1. A team has a name and an identifier prefix, each unique across archived and non-archived teams.
2. The prefix is two to ten uppercase letters and cannot be changed once the team has an issue, so existing identifiers stay resolvable.
3. Every issue belongs to exactly one team.

#### TEAM-002 — Team workflow

**Requirement.** Every team has an ordered list of workflow statuses with at least one status in each of the Intake, Backlog, Unstarted, Started, Completed, Canceled, and Duplicate categories, and status names unique within the team.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every team has an ordered list of workflow statuses with at least one status in each of the Intake, Backlog, Unstarted, Started, Completed, Canceled, and Duplicate categories, and status names unique within the team.
2. Owners, Admins and the team's owners (ROLE-007) can add, rename, and reorder statuses, and so can every member of the team while its *Who manages team settings* permission is All team members (ROLE-009); other Members and all Guests are refused.
3. A status never changes category, and no category is added or removed.
4. A team's *default status* in a category is the first status of that category in workflow order, and every clause naming a category as a destination moves the issue there.

#### TEAM-003 — Team archiving

**Requirement.** Archiving a team stops new issues, intake, and issue moves from targeting it while preserving its issues, cycles, projects, identifiers, and history; a signal source request naming an archived team creates nothing and returns 409.

**Acceptance.** Through the native product door and its declared counterpart:
1. Archiving a team stops new issues, intake, and issue moves from targeting it while preserving its issues, cycles, projects, identifiers, and history; a signal source request naming an archived team creates nothing and returns 409.
2. Unarchiving restores normal use.
3. Teams are never deleted; archiving is the only terminal state.

#### TEAM-004 — Status removal

**Requirement.** Removing a workflow status requires a destination status in the same category and atomically moves every issue to it.

**Acceptance.** Through the native product door and its declared counterpart:
1. Removing a workflow status requires a destination status in the same category and atomically moves every issue to it.
2. Vector rejects removal of a category's last status and records the status mapping in audit history.

### Issues

#### ISSUE-001 — Creation

**Requirement.** Vector provides creation for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. An operator can create an issue with a required title and team plus an optional Markdown description (written in the ISSUE-026 editor, with inline images and video under ISSUE-033, ISSUE-034 and checklists under ISSUE-025), assignee, project, cycle, priority, labels, estimate, due date, expected outcome, customer impact, and values for the custom fields defined for its team (FIELD-001, which carries their types and acceptance).
2. It starts in the team's default Backlog status unless another non-Intake status is explicitly chosen.

#### ISSUE-002 — Stable identifiers

**Requirement.** An issue identifier is its team's prefix, a hyphen, and an integer one higher than the highest ever allocated under that prefix, so a number is never reused after an issue is deleted.

**Acceptance.** Through the native product door and its declared counterpart:
1. An issue identifier is its team's prefix, a hyphen, and an integer one higher than the highest ever allocated under that prefix, so a number is never reused after an issue is deleted.
2. The identifier never changes, including when the issue moves teams (ISSUE-012); a prefix therefore records where an issue started, not where it lives.

#### ISSUE-003 — Priority

**Requirement.** An issue has exactly one priority: Urgent, High, Medium, Low, or No priority.

**Acceptance.** Through the native product door and its declared counterpart:
1. An issue has exactly one priority: Urgent, High, Medium, Low, or No priority.
2. No priority is the default and sorts after Low.

#### ISSUE-004 — Status transitions

**Requirement.** A version-checked operator mutation (ISSUE-006) can move an issue in any direction among the Backlog, Unstarted, Started, Completed, and Canceled statuses of its team's workflow.

**Acceptance.** Through the native product door and its declared counterpart:
1. A version-checked operator mutation (ISSUE-006) can move an issue in any direction among the Backlog, Unstarted, Started, Completed, and Canceled statuses of its team's workflow.
2. Vector rejects moving any issue into an Intake status.
3. Leaving Intake uses INTAKE-005, INTAKE-007, or REL-003; entering or leaving Duplicate uses REL-003 or REL-005.
4. Entering Completed records the completion time and entering Canceled records the cancellation time; leaving one of those categories clears the time it recorded and removes no activity.

#### ISSUE-005 — Assignment

**Requirement.** An issue has at most one assignee.

**Acceptance.** Through the native product door and its declared counterpart:
1. An issue has at most one assignee.
2. Assigning, reassigning, or unassigning it takes effect immediately and records the actor, the previous assignee, and the new assignee.

#### ISSUE-006 — Concurrent edits

**Requirement.** Every issue carries an integer version that increases by one on each mutation that appends an activity entry under ISSUE-007.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every issue carries an integer version that increases by one on each mutation that appends an activity entry under ISSUE-007.
2. An issue mutation carries the version the client last read; if the stored version is higher, Vector rejects the mutation with 409 and returns the current issue and version, changing nothing.
3. Adding a comment, evidence revision, follower, or notification does not change the version and is never rejected as stale.

#### ISSUE-007 — Activity history

**Requirement.** Vector provides activity history for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Creation and every change to title, description, team, status, priority, assignee, project, milestone (PROJ-011), cycle, estimate, due date, labels, expected outcome, customer impact, custom fields, duplicate target, parent, or dependency append an immutable activity entry recording the time, the previous value, the new value, and the actor — the operator, or the named automation when a cycle closure, deferral return, or import acted.

#### ISSUE-008 — Comments and safe comment removal

**Requirement.** Any member who can see an issue (a Guest only in invited teams) can add a Markdown comment in the ISSUE-026 editor, with inline images and video (ISSUE-033, ISSUE-034) and checklists (ISSUE-025).

**Acceptance.** Through the native product door and its declared counterpart:
1. Any member who can see an issue (a Guest only in invited teams) can add a Markdown comment in the ISSUE-026 editor, with inline images and video (ISSUE-033, ISSUE-034) and checklists (ISSUE-025).
2. Only a comment's author edits it; an edited comment shows its edit time.
3. Authors delete their own comments; Owners, Admins and the team's owners delete anyone's (role matrix, ROLE-001); the entry records who acted.
4. Deleting a comment removes its body, attachments, links, and search entry, leaves a tombstone and an activity entry in the thread, keeps its replies, and does not remove the follower state it created.

#### ISSUE-029 — Discussion threads and resolution

**Requirement.** Each top-level comment starts a thread: members reply to it, and replies show under it in order.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each top-level comment starts a thread: members reply to it, and replies show under it in order.
2. Any member who can comment can resolve a thread when its question is answered, which collapses it to one line naming who resolved it and when, and can reopen it; a new reply reopens a resolved thread.
3. A synced Slack or Teams thread maps to exactly one Vector comment thread (SLACK-002).

#### ISSUE-030 — Anchored inline comments

**Requirement.** A comment can also quote highlighted text of the issue description or a document (PROJ-013) as an inline comment, which anchors the thread to that text and shows it in the margin; if the text is later removed, the thread stays in the issue with the quoted text shown as removed.

**Acceptance.** Through the native product door and its declared counterpart:
1. A comment can also quote highlighted text of the issue description or a document (PROJ-013) as an inline comment, which anchors the thread to that text and shows it in the margin; if the text is later removed, the thread stays in the issue with the quoted text shown as removed.

#### ISSUE-009 — Attachments and links

**Requirement.** Operators can attach files and named HTTPS links to an issue or a comment.

**Acceptance.** Through the native product door and its declared counterpart:
1. Operators can attach files and named HTTPS links to an issue or a comment.
2. Removing either records the action.
3. An image or video pasted, dropped or uploaded into a description, comment or document is an attachment under this clause and is shown inline where it was placed (ISSUE-024).

#### ISSUE-010 — Deletion

**Requirement.** Deleting an issue first moves it to Recently deleted (ISSUE-031, ISSUE-032), from which it can be undone or restored intact for 30 days.

**Acceptance.** Through the native product door and its declared counterpart:
1. Deleting an issue first moves it to Recently deleted (ISSUE-031, ISSUE-032), from which it can be undone or restored intact for 30 days.
2. Permanent deletion happens when that retention ends, or at once when an Owner or Admin chooses "Delete permanently" (for erasure under SEC-003 and DATA-011): it removes the issue's comments, attachments, links, evidence revisions, dependencies, parent link, follower state, notifications, activity, and search entry; its children become root issues, and a duplicate is removed from its canonical issue's list.
3. Vector rejects deleting a canonical issue that still has duplicates.
4. Closed cycle snapshots (CYCLE-005) and audit entries keep only its identifier, and its source idempotency records (INTAKE-002) are retained so a re-delivery cannot resurrect it.

#### ISSUE-011 — Estimates

**Requirement.** An issue estimate is absent or an integer from 1 through 100 points.

**Acceptance.** Through the native product door and its declared counterpart:
1. An issue estimate is absent or an integer from 1 through 100 points.
2. Changing an estimate never rewrites a closed cycle snapshot.

#### ISSUE-012 — Moving teams

**Requirement.** Moving an issue requires a non-archived target team and an explicit target status in the same category as its current status, including Intake so a misrouted intake item reaches the right team without a decision.

**Acceptance.** Through the native product door and its declared counterpart:
1. Moving an issue requires a non-archived target team and an explicit target status in the same category as its current status, including Intake so a misrouted intake item reaches the right team without a decision.
2. The move preserves the identifier (ISSUE-002), uncommits the issue from any cycle (CYCLE-002), keeps its project, assignee, labels, custom-field values and history, and writes one activity entry.
3. Labels and custom-field values are preserved unchanged; the native move does not map them.
4. All of it happens or none of it does.

#### ISSUE-013 — Mentions

**Requirement.** Typing `@` in an issue description or comment offers matching operators, and choosing one records a mention of that operator.

**Acceptance.** Through the native product door and its declared counterpart:
1. Typing `@` in an issue description or comment offers matching operators, and choosing one records a mention of that operator.
2. Text resolving to no operator is stored and shown literally and mentions nobody.
3. A mention adds a follower (NOTIFY-002) and notifies once (NOTIFY-001); editing text to add a mention notifies only the newly mentioned operator, and removing a mention notifies nobody and withdraws no delivered notification.

#### ISSUE-014 — Labels

**Requirement.** A label belongs to the workspace or to one team, has a name unique among the labels visible in that scope and a color, and can sit in a label group (for example Area, Type) whose labels are mutually exclusive on an issue.

**Acceptance.** Through the native product door and its declared counterpart:
1. A label belongs to the workspace or to one team, has a name unique among the labels visible in that scope and a color, and can sit in a label group (for example Area, Type) whose labels are mutually exclusive on an issue.
2. Owners, Admins and Members create labels and apply them — Members through the inline Create label in the issue label picker, subject to the workspace label-creation setting, while Settings → Labels is written only by Owners and Admins and Members only read labels — and Guests apply existing labels in their invited teams; Owners and Admins rename, recolor, merge and delete workspace labels, and a team's owners — or all its members while its *Who manages team settings* permission is All team members (ROLE-009) — do so for that team's labels (role matrix, ROLE-001).
3. Merging one label into another relabels every issue and saved-view filter in one change.
4. Deleting a label removes it from every issue and from the filters of saved views naming it, and deletes no issue.
5. An issue carries up to the number of labels in `seed.json → limits`.

#### ISSUE-015 — Unsent drafts

**Requirement.** An unsubmitted new-issue form is retained in the operator's browser and restored the next time they open new issue there.

**Acceptance.** Through the native product door and its declared counterpart:
1. An unsubmitted new-issue form is retained in the operator's browser and restored the next time they open new issue there.
2. A draft is not a record: it appears in no list, search result, notification, or export, and becomes an issue only when that operator creates it.

### Relations

#### REL-001 — Dependencies

**Requirement.** An operator can record that one issue blocks another, across teams, and can remove the link.

**Acceptance.** Through the native product door and its declared counterpart:
1. An operator can record that one issue blocks another, across teams, and can remove the link.
2. Vector rejects self-links, a link that already exists in either direction, and any link that would create a directed cycle.

#### REL-002 — Blocked state

**Requirement.** An issue is shown as blocked while any issue that blocks it is outside a Completed, Canceled, or Duplicate category.

**Acceptance.** Through the native product door and its declared counterpart:
1. An issue is shown as blocked while any issue that blocks it is outside a Completed, Canceled, or Duplicate category.
2. Blocking never changes the issue's workflow status by itself.

#### REL-003 — Duplicate decision

**Requirement.** Marking an issue as a duplicate requires one canonical issue that is neither itself nor already a duplicate, moves it to the team's default Duplicate status, and preserves its description, comments, evidence, attachments, and activity under the duplicate issue.

**Acceptance.** Through the native product door and its declared counterpart:
1. Marking an issue as a duplicate requires one canonical issue that is neither itself nor already a duplicate, moves it to the team's default Duplicate status, and preserves its description, comments, evidence, attachments, and activity under the duplicate issue.

#### REL-004 — Canonical duplicates

**Requirement.** A canonical issue lists every direct duplicate.

**Acceptance.** Through the native product door and its declared counterpart:
1. A canonical issue lists every direct duplicate.
2. If it is later marked duplicate, Vector atomically repoints its duplicates to the new canonical issue, so a duplicate chain or cycle is never exposed.

#### REL-005 — Undo duplicate

**Requirement.** Undoing a duplicate decision removes the canonical link and restores the issue's most recent non-terminal status, or its team's default Backlog status if it has none, while preserving both decision activity entries.

**Acceptance.** Through the native product door and its declared counterpart:
1. Undoing a duplicate decision removes the canonical link and restores the issue's most recent non-terminal status, or its team's default Backlog status if it has none, while preserving both decision activity entries.

#### REL-006 — Parent and child

**Requirement.** An issue has at most one parent.

**Acceptance.** Through the native product door and its declared counterpart:
1. An issue has at most one parent.
2. An operator can set, replace, or clear it from issue details.
3. Vector rejects self-parenting and ancestry cycles; changing a parent never changes status, team, project, cycle, or assignee, and deleting a parent makes each direct child a root issue.
4. Issue lists can filter to roots or to children of one exact parent (VIEW-001).

### Intake and triage

#### INTAKE-001 — Intake creation

**Requirement.** A registered signal source (INTAKE-011) creates an intake issue with a title, team, observed time, its source ID, source display name, source record identifier, source revision identifier, summary, link, and optional structured measurements and customer reports.

**Acceptance.** Through the native product door and its declared counterpart:
1. A registered signal source (INTAKE-011) creates an intake issue with a title, team, observed time, its source ID, source display name, source record identifier, source revision identifier, summary, link, and optional structured measurements and customer reports.
2. An operator creates one with a title and team and any of the same descriptive fields, attributed to that operator instead of a source.
3. Either way it starts in the team's default Intake status and appears in Needs decision (CURR-002) within 5 seconds.

#### INTAKE-002 — Idempotent sources

**Requirement.** Re-delivery of the same source ID, source record identifier, source revision identifier, and normalized payload returns the original result and creates nothing.

**Acceptance.** Through the native product door and its declared counterpart:
1. Re-delivery of the same source ID, source record identifier, source revision identifier, and normalized payload returns the original result and creates nothing.
2. Re-delivery of an identity whose issue has since been deleted (ISSUE-010) returns 410 and creates nothing.
3. Reusing an identity with a different payload returns 409 and changes nothing.

#### INTAKE-003 — Evidence revisions

**Requirement.** A new source revision identifier for an existing source record appends immutable dated evidence even when revisions arrive out of order.

**Acceptance.** Through the native product door and its declared counterpart:
1. A new source revision identifier for an existing source record appends immutable dated evidence even when revisions arrive out of order.
2. The issue orders evidence by observed time, then receipt time, and shows a field-level change from the preceding observed revision.

#### INTAKE-004 — Inspectable assessment

**Requirement.** An intake issue shows the evidence behind its attention reason, impact measurements, likely cause, recommended assignee, suggested priority, suggested labels and likely duplicates.

**Acceptance.** Through the native product door and its declared counterpart:
1. An intake issue shows the evidence behind its attention reason, impact measurements, likely cause, recommended assignee, suggested priority, suggested labels and likely duplicates.
2. Each assertion names whether it came from a source, an operator, a policy or an agent; an agent assertion also names the model, the records it read and when, and carries the standard class for internal triage or external when it exposes information outside the business; the company's policy decides whether it fills fields or waits for a triager.
3. TRIAGE-003 inherits the agent provenance sentence and the agent-suggestion triage journey before agent suggestions ship.
4. Vector never presents an inferred assertion as a fact; the company's policy decides how its class is handled.

#### INTAKE-005 — Accept

**Requirement.** Owners, Admins and Members who can see an intake item's team accept, defer and decline it; Guests cannot (role matrix).

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners, Admins and Members who can see an intake item's team accept, defer and decline it; Guests cannot (role matrix).
2. Accepting an intake issue atomically records the actor, the time, and an optional reason; applies the chosen assignee, priority, cycle, and Started or Unstarted status; and clears any deferral.
3. It leaves Needs decision and reaches its new Current and My work sections within the CURR-008 window.

#### INTAKE-006 — Defer

**Requirement.** Deferring an intake issue (by an Owner, Admin or Member who can see its team; Guests cannot, role matrix) records who deferred it, an absolute return time strictly in the future, and an optional reason, and removes it from Needs decision.

**Acceptance.** Through the native product door and its declared counterpart:
1. Deferring an intake issue (by an Owner, Admin or Member who can see its team; Guests cannot, role matrix) records who deferred it, an absolute return time strictly in the future, and an optional reason, and removes it from Needs decision.
2. It returns there exactly once — within 5 minutes of the return time, or within 5 seconds of a new evidence revision (INTAKE-003), whichever comes first — and the return atomically clears the deferral and leaves the earlier decision visible.
3. The same roles can defer it again or end a deferral early.

#### INTAKE-007 — Decline

**Requirement.** Declining an intake issue — open to Owners, Admins and Members who can see its team, never to Guests (role matrix) — requires a reason, moves it to the team's default Canceled status, and removes it from Needs decision without deleting its evidence or decision history.

**Acceptance.** Through the native product door and its declared counterpart:
1. Declining an intake issue — open to Owners, Admins and Members who can see its team, never to Guests (role matrix) — requires a reason, moves it to the team's default Canceled status, and removes it from Needs decision without deleting its evidence or decision history.

#### INTAKE-008 — Evidence after a terminal decision

**Requirement.** Evidence received after an issue is Canceled or Duplicate is appended and visible but never reopens, reassigns, reprioritizes, or resurfaces the issue.

**Acceptance.** Through the native product door and its declared counterpart:
1. Evidence received after an issue is Canceled or Duplicate is appended and visible but never reopens, reassigns, reprioritizes, or resurfaces the issue.

#### INTAKE-009 — Source failure

**Requirement.** A signal source request from an unknown or revoked source, or carrying a wrong signature, returns 401; one whose body fails validation returns 400; one naming an archived team returns 409 (TEAM-003).

**Acceptance.** Through the native product door and its declared counterpart:
1. A signal source request from an unknown or revoked source, or carrying a wrong signature, returns 401; one whose body fails validation returns 400; one naming an archived team returns 409 (TEAM-003).
2. None of them creates anything.
3. A valid request that cannot be stored durably returns 503 so the source retries.
4. No request is acknowledged before its idempotency record and evidence are durable.

#### INTAKE-010 — Decision policy

**Requirement.** Suggested assignee, priority, and start state are selected by the intake recommendation policy and are always editable before acceptance.

**Acceptance.** Through the native product door and its declared counterpart:
1. Suggested assignee, priority, and start state are selected by the intake recommendation policy and are always editable before acceptance.

#### INTAKE-011 — Source registration

**Requirement.** An Owner or Admin registers a signal source (integration management in the role matrix; Members and Guests are refused 403) with a display name, a source ID unique in the workspace, and a signing secret; the `signal.source.v1` adapter normalizes that source's signed request into INTAKE-001.

**Acceptance.** Through the native product door and its declared counterpart:
1. An Owner or Admin registers a signal source (integration management in the role matrix; Members and Guests are refused 403) with a display name, a source ID unique in the workspace, and a signing secret; the `signal.source.v1` adapter normalizes that source's signed request into INTAKE-001.
2. Rotating a secret (by an Owner or Admin) accepts both secrets for a configurable overlap of at most 24 hours and then rejects the previous one.
3. An Owner or Admin revoking a source rejects every later request under INTAKE-009 and deletes no evidence.
4. A secret is shown once at registration or rotation and never again.

### Current

#### CURR-001 — Disjoint stream

**Requirement.** Current places an issue in at most one section using this precedence: Needs decision, Now, Next, then Recently done.

**Acceptance.** Through the native product door and its declared counterpart:
1. Current places an issue in at most one section using this precedence: Needs decision, Now, Next, then Recently done.
2. Canceled, Duplicate, deleted, and actively deferred issues do not appear.

#### CURR-002 — Needs decision

**Requirement.** Needs decision contains every Intake-category issue whose deferral has expired or is absent and which has not been accepted, declined, or marked duplicate.

**Acceptance.** Through the native product door and its declared counterpart:
1. Needs decision contains every Intake-category issue whose deferral has expired or is absent and which has not been accepted, declined, or marked duplicate.
2. Every expired deferral returns to Current: none is hidden, and more than one page is reachable through paging or an explicit total and Show more control (for example, “50 shown of 132, show more”), in CURR-007 order.

#### CURR-003 — Now

**Requirement.** Now contains non-terminal issues outside the Intake category that are overdue or in a Started status, excluding anything already in Needs decision.

**Acceptance.** Through the native product door and its declared counterpart:
1. Now contains non-terminal issues outside the Intake category that are overdue or in a Started status, excluding anything already in Needs decision.
2. An issue is *overdue* when its due date is earlier than the current calendar day in the workspace timezone (OPS-003).

#### CURR-004 — Next

**Requirement.** Next contains non-terminal issues in an Unstarted status that are committed to their team's active or next cycle (CYCLE-001) or due within the next seven calendar days, excluding anything already in a higher-precedence section.

**Acceptance.** Through the native product door and its declared counterpart:
1. Next contains non-terminal issues in an Unstarted status that are committed to their team's active or next cycle (CYCLE-001) or due within the next seven calendar days, excluding anything already in a higher-precedence section.

#### CURR-005 — Recently done

**Requirement.** Recently done contains issues moved to a Completed category in the previous seven calendar days, ordered by the completion-time exception in CURR-007.

**Acceptance.** Through the native product door and its declared counterpart:
1. Recently done contains issues moved to a Completed category in the previous seven calendar days, ordered by the completion-time exception in CURR-007.

#### CURR-006 — Explainable attention

**Requirement.** Every issue in Current shows one primary inclusion reason — Awaiting decision, Started work, Overdue, Cycle commitment, Due within seven days, or Completed within seven days — and every applicable context reason from Customer escalation, Unresolved dependency, Unassigned urgent work, Project risk, and New evidence since the most recent intake decision.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every issue in Current shows one primary inclusion reason — Awaiting decision, Started work, Overdue, Cycle commitment, Due within seven days, or Completed within seven days — and every applicable context reason from Customer escalation, Unresolved dependency, Unassigned urgent work, Project risk, and New evidence since the most recent intake decision.

#### CURR-007 — Ranking

**Requirement.** Within every Current section except Recently done, the default order sorts by priority (Urgent first, No priority last), then by due date (overdue first, then earliest first, then issues with no due date), then by most recent update, and finally by stable identifier, so the order is total and stable.

**Acceptance.** Through the native product door and its declared counterpart:
1. Within every Current section except Recently done, the default order sorts by priority (Urgent first, No priority last), then by due date (overdue first, then earliest first, then issues with no due date), then by most recent update, and finally by stable identifier, so the order is total and stable.
2. Recently done (CURR-005) instead sorts by completion time, newest first, with stable identifier as the tiebreak; priority, due date and last update do not affect that section.

#### CURR-008 — Freshness

**Requirement.** A decision or issue mutation that changes an issue's Current membership, section, or reasons is reflected in an already open Current view within 5 seconds without an operator-initiated reload, and in the next response to any other request.

**Acceptance.** Through the native product door and its declared counterpart:
1. A decision or issue mutation that changes an issue's Current membership, section, or reasons is reflected in an already open Current view within 5 seconds without an operator-initiated reload, and in the next response to any other request.

#### CURR-009 — Stream controls

**Requirement.** Operators can filter Current by team, project, priority, item type, assignee, and attention reason.

**Acceptance.** Through the native product door and its declared counterpart:
1. Operators can filter Current by team, project, priority, item type, assignee, and attention reason.
2. The default includes all teams and all operators and shows Recently done.

### My work

#### WORK-001 — Personal queue

**Requirement.** My work contains every non-terminal issue assigned to the signed-in operator outside the Intake category, grouped disjointly in this precedence: Waiting for issues blocked under REL-002, Now for those the CURR-003 rule would place in Now, and Next for every issue still remaining, each group ordered by CURR-007.

**Acceptance.** Through the native product door and its declared counterpart:
1. My work contains every non-terminal issue assigned to the signed-in operator outside the Intake category, grouped disjointly in this precedence: Waiting for issues blocked under REL-002, Now for those the CURR-003 rule would place in Now, and Next for every issue still remaining, each group ordered by CURR-007.
2. An issue assigned to the operator while in an Intake status appears in Current's Needs decision, not here.

#### WORK-002 — Personal defaults

**Requirement.** Completed, Canceled, Duplicate, and actively deferred issues never appear in My work; an operator reads their finished work from Current's Recently done filtered to themselves (CURR-005, CURR-009).

**Acceptance.** Through the native product door and its declared counterpart:
1. Completed, Canceled, Duplicate, and actively deferred issues never appear in My work; an operator reads their finished work from Current's Recently done filtered to themselves (CURR-005, CURR-009).
2. When no issue qualifies, the view states the operator is caught up and offers new issue and Current as next actions.

#### WORK-003 — Cycle context

**Requirement.** My work shows one row for each team that has an active cycle containing an issue assigned to the operator, giving that cycle's name, start and end dates, and progress, with completed and total committed scope labeled in the unit CYCLE-003 used.

**Acceptance.** Through the native product door and its declared counterpart:
1. My work shows one row for each team that has an active cycle containing an issue assigned to the operator, giving that cycle's name, start and end dates, and progress, with completed and total committed scope labeled in the unit CYCLE-003 used.
2. Inherited from ROLE-007: My work's team rows follow team membership when this clause changes them.

### Projects, initiatives and roadmaps

#### PROJ-001 — Project record

**Requirement.** Vector provides project record for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. A project has a name unique in the workspace, a Markdown description, exactly one lead who is a workspace member, an optional start date, an optional target date that is on or after the start date when both are set, a priority (Urgent, High, Medium, Low or No priority, as ISSUE-003), project labels (workspace labels marked for projects, filterable by PROJ-007), a status (PROJ-016), an optional color (`#rrggbb`, canonical lowercase), an optional icon (one Unicode emoji, default none), and values for the custom fields that apply to projects (FIELD-001).
2. Its status is one of the project statuses of its primary team or the workspace (PROJ-016, PROJ-046), each in one of the categories Backlog, Planned, Started, Paused, Completed and Canceled, and a new project starts in the default Planned status unless another is chosen.
3. Start date, target date, priority and labels are set in the project page, the projects list, the roadmap timeline (INIT-003) and the public API, and each change is a project activity entry.
4. Linear project start and target dates, priority and labels import onto these fields (DATA-014).
5. Owners, Admins and Members create projects and edit these fields; Guests see the projects their invited teams contribute to and cannot create or edit one (role matrix).

#### PROJ-002 — Manual lifecycle

**Requirement.** A project's status (PROJ-016) is changed explicitly by an Owner, Admin or Member, or their sponsored agent under the company's policy for standard; Guests are refused by the role matrix.

**Acceptance.** Through the native product door and its declared counterpart:
1. A project's status (PROJ-016) is changed explicitly by an Owner, Admin or Member, or their sponsored agent under the company's policy for standard; Guests are refused by the role matrix.
2. Completing or canceling all of its issues never completes or cancels the project.

#### PROJ-003 — Project membership

**Requirement.** An issue belongs to at most one project.

**Acceptance.** Through the native product door and its declared counterpart:
1. An issue belongs to at most one project.
2. Removing an issue from a project or archiving a project never deletes the issue; deleting a project detaches all of its issues but deletes none of them.

#### PROJ-004 — Progress

**Requirement.** Project progress counts issues: completed project issues divided by all project issues outside the Canceled and Duplicate categories.

**Acceptance.** Through the native product door and its declared counterpart:
1. Project progress counts issues: completed project issues divided by all project issues outside the Canceled and Duplicate categories.
2. The interface shows the completed and total counts beside the percentage and reports no progress when the denominator is zero.

#### PROJ-005 — Health

**Requirement.** Health is reported only for projects whose status is in the Started category (PROJ-016); a project in any other category, Paused included, reports no health and is excluded from health filters and counts.

**Acceptance.** Through the native product door and its declared counterpart:
1. Health is reported only for projects whose status is in the Started category (PROJ-016); a project in any other category, Paused included, reports no health and is excluded from health filters and counts.
2. A *remaining issue* is a project issue outside the Completed, Canceled, and Duplicate categories.
3. A Started project is Blocked, At risk, On track, or Unknown, evaluated in that order.
4. The default reports Blocked when at least one remaining issue exists and either an Urgent remaining issue has an unresolved blocker (REL-002) or every remaining issue is blocked; At risk when its target date is in the past, a remaining Urgent issue is unassigned, or its remaining estimated points committed to any team's active cycle exceed that cycle's capacity; On track when a target date in the future, every applicable capacity, and every remaining active-cycle estimate exist and no earlier rule matches; and Unknown otherwise.
5. Remaining scope exactly equal to capacity is not At risk.

#### PROJ-006 — Risk explanation

**Requirement.** Every Blocked or At risk project shows the exact issues and measurements that triggered its health, including unresolved dependencies, unowned urgent work, target-date exposure, and committed scope against capacity.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every Blocked or At risk project shows the exact issues and measurements that triggered its health, including unresolved dependencies, unowned urgent work, target-date exposure, and committed scope against capacity.

#### PROJ-007 — Portfolio

**Requirement.** The Projects view shows the count of projects in each health and lifecycle state and can filter by lifecycle, health, lead, team, target date, and label.

**Acceptance.** Through the native product door and its declared counterpart:
1. The Projects view shows the count of projects in each health and lifecycle state and can filter by lifecycle, health, lead, team, target date, and label.
2. Counts and rows use the same active filters.
3. The team filter selects contributing teams; target-date bounds are inclusive and exclude projects without a target date when either bound is set.
4. The label filter selects workspace labels marked for projects (PROJ-001).

#### PROJ-008 — Historical truth

**Requirement.** Later issue edits update live project progress and health but never rewrite a closed cycle snapshot shown in that project's history.

**Acceptance.** Through the native product door and its declared counterpart:
1. Later issue edits update live project progress and health but never rewrite a closed cycle snapshot shown in that project's history.

#### PROJ-009 — Project archiving

**Requirement.** Archiving a project removes it from the default portfolio and stops new issues from joining it while preserving its lifecycle, issues, history, and closed-cycle snapshots.

**Acceptance.** Through the native product door and its declared counterpart:
1. Archiving a project removes it from the default portfolio and stops new issues from joining it while preserving its lifecycle, issues, history, and closed-cycle snapshots.
2. Operators can include archived projects in filters or unarchive one.

### Cycles

#### CYCLE-001 — Time box

**Requirement.** A cycle belongs to one team and has a name unique within that team, a start instant, an end instant after the start, and an optional capacity in estimate points, all interpreted in the workspace timezone (OPS-003).

**Acceptance.** Through the native product door and its declared counterpart:
1. A cycle belongs to one team and has a name unique within that team, a start instant, an end instant after the start, and an optional capacity in estimate points, all interpreted in the workspace timezone (OPS-003).
2. Vector rejects a cycle whose dates overlap another cycle of the same team, so a team's *active cycle* — the one whose start is at or before now and whose end is after now — is unique, and its *next cycle* is the cycle of that team with the earliest start at or after the active cycle's end.
3. Owners, Admins and the team's owners create, edit, complete and delete its cycles, and so do all its members while its *Who manages cycles and templates* permission is All team members, the default (ROLE-009); Guests never do (role matrix).

#### CYCLE-002 — Commitment

**Requirement.** A non-terminal issue can be committed to at most one cycle, and only to a cycle of its own team.

**Acceptance.** Through the native product door and its declared counterpart:
1. A non-terminal issue can be committed to at most one cycle, and only to a cycle of its own team.
2. Anyone who can edit the issue commits, moves or uncommits it — Owners, Admins, Members who can see its team, and Guests in an invited team (role matrix).
3. Committing, moving, and uncommitting record both cycle identifiers and update both cycles atomically.

#### CYCLE-003 — Progress and capacity

**Requirement.** Cycle progress is completed committed estimate points divided by all non-Canceled, non-Duplicate committed estimate points when every included issue is estimated; otherwise it uses issue counts and labels the result `by issue count`.

**Acceptance.** Through the native product door and its declared counterpart:
1. Cycle progress is completed committed estimate points divided by all non-Canceled, non-Duplicate committed estimate points when every included issue is estimated; otherwise it uses issue counts and labels the result `by issue count`.
2. With no included issues it shows `No committed work` and no percentage.
3. Capacity risk is Unknown unless capacity and every remaining estimate exist, At risk when remaining points exceed capacity, and Within capacity otherwise.

#### CYCLE-004 — Closure and rollover

**Requirement.** Within 5 minutes of a cycle's end instant Vector closes it exactly once however many times the closing job runs, and by default moves committed issues in an Unstarted or Started status to the team's next cycle (CYCLE-001) and uncommits committed issues in an Intake, Backlog, Completed, Canceled, or Duplicate status.

**Acceptance.** Through the native product door and its declared counterpart:
1. Within 5 minutes of a cycle's end instant Vector closes it exactly once however many times the closing job runs, and by default moves committed issues in an Unstarted or Started status to the team's next cycle (CYCLE-001) and uncommits committed issues in an Intake, Backlog, Completed, Canceled, or Duplicate status.
2. A closed cycle's name, dates, capacity, and snapshot cannot be changed, and a closed cycle is never reopened.

#### CYCLE-005 — Closure snapshot

**Requirement.** Closing a cycle records committed and completed issue IDs, each issue's project ID at close, estimate totals, capacity, progress, additions and removals during the cycle, and the close time.

**Acceptance.** Through the native product door and its declared counterpart:
1. Closing a cycle records committed and completed issue IDs, each issue's project ID at close, estimate totals, capacity, progress, additions and removals during the cycle, and the close time.
2. The snapshot is immutable.

#### CYCLE-006 — Missing next cycle

**Requirement.** If rollover is required and no next cycle exists, the cycle still closes, its unfinished issues become uncommitted, and one visible failed-operation entry names the affected issues; creating a later cycle does not move them.

**Acceptance.** Through the native product door and its declared counterpart:
1. If rollover is required and no next cycle exists, the cycle still closes, its unfinished issues become uncommitted, and one visible failed-operation entry names the affected issues; creating a later cycle does not move them.

### Search, views and commands

#### SEARCH-001 — Global search

**Requirement.** Search covers issue identifiers, titles, descriptions, expected outcomes, customer impact, comments, evidence summaries, project names, label names, and saved-view names visible to the operator, and returns within 500ms.

**Acceptance.** Through the native product door and its declared counterpart:
1. Search covers issue identifiers, titles, descriptions, expected outcomes, customer impact, comments, evidence summaries, project names, label names, and saved-view names visible to the operator, and returns within 500ms.
2. Issues of archived teams and projects are excluded unless the operator asks for them.

#### SEARCH-002 — Exact identifier

**Requirement.** An exact issue identifier lookup reads the primary record and returns it even while full-text indexing is delayed or unavailable, subject to the archive choice in SEARCH-001.

**Acceptance.** Through the native product door and its declared counterpart:
1. An exact issue identifier lookup reads the primary record and returns it even while full-text indexing is delayed or unavailable, subject to the archive choice in SEARCH-001.
2. On a successful full-text read, that exact issue ranks first, without duplicating it or dropping other matching issues, projects or accessible saved views; results remain bounded.
3. Primary identity, archive choice and operator/session/workspace admission are rechecked before returning results, including after an index failure.

#### SEARCH-003 — Index freshness

**Requirement.** Created or changed searchable text appears in full-text results within 10 seconds.

**Acceptance.** Through the native product door and its declared counterpart:
1. Created or changed searchable text appears in full-text results within 10 seconds.
2. A committed searchable-text change is atomic with its index entry, so a committed source change cannot leave its corresponding entry behind.
3. If an index query fails, the exact primary-record lookup remains available under SEARCH-002; other searches are reported unavailable with the last successful index time; Vector never presents a known index failure as a complete empty result.

#### VIEW-001 — Issue controls

**Requirement.** Vector provides issue controls for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Issue lists can filter by status, status category, priority, assignee, team, project, cycle, label, due date, blocked state, and parent (all issues, root issues, or children of one exact parent identifier); sort by newest, oldest, Urgent-to-No-priority, workflow status order, due date, or last update; and group by none, status, assignee, priority, project, cycle, or team.
2. Completed issues are hidden by default outside Current.
3. Grouped pages order by the group key before the selected sort and stable identifier.
4. Only groups with rows on the page are rendered, with counts for the complete filtered result; a group may continue onto another page.
5. The issue-list HTTP response exposes page-present page-present groups with full filtered counts and the complete grouping aggregate with the complete filtered grouping aggregate.
6. Positive offsets require the response the query revision for the same query and workspace calendar date; invalidated or missing identity returns a visible pagination conflict without mixed rows, and browsing restarts visibly at offset zero.

#### VIEW-002 — Saved views

**Requirement.** Vector provides saved views for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Anyone signed in can save a named combination of filters, sort, grouping, and list or board layout as a private view, then update, duplicate, or delete it; Owners, Admins and Members can also save a view as shared with the workspace or a team or switch it to shared, and a Guest's views are always private (role matrix).
2. A private view is visible and editable only by its owner; anyone who can see a shared view's teams can open or duplicate it (a Guest only when it covers only their invited teams), but only its owner can update or delete it, and ownership changes only under OPS-004.
3. Deleting a view never changes an issue.

#### VIEW-003 — Control persistence

**Requirement.** The filters, sort, and grouping an operator last applied to Current, My work, the Projects portfolio, the issue list, and the board are stored for that operator and restored on their next visit from any browser, and one visible control resets them to the defaults.

**Acceptance.** Through the native product door and its declared counterpart:
1. The filters, sort, and grouping an operator last applied to Current, My work, the Projects portfolio, the issue list, and the board are stored for that operator and restored on their next visit from any browser, and one visible control resets them to the defaults.
2. A saved view's layout belongs to that view.
3. Opening a saved view never changes the stored controls of the list or board it was opened from.

#### VIEW-004 — Bulk edit

**Requirement.** An operator can select several issues in a list and set status, assignee, priority, project, cycle, or labels on all of them in one operation, up to the batch limit in `seed.json → limits`.

**Acceptance.** Through the native product door and its declared counterpart:
1. An operator can select several issues in a list and set status, assignee, priority, project, cycle, or labels on all of them in one operation, up to the batch limit in `seed.json → limits`.
2. The operation is atomic: if any selected issue fails ISSUE-004, ISSUE-006, or CYCLE-002, nothing is written and the response names the failing issues by identifier.
3. A successful operation writes one activity entry per issue and is undone as one action by Undo or Command/Ctrl-Z within the ISSUE-020 window.

#### VIEW-005 — Team board

**Requirement.** The board shows one explicitly selected team's workflow at a time; it never guesses a team in a multi-team workspace.

**Acceptance.** Through the native product door and its declared counterpart:
1. The board shows one explicitly selected team's workflow at a time; it never guesses a team in a multi-team workspace.
2. It displays every configured status as a column in that team's workflow order and places the matching issues from the current filtered page in those columns, ordered by the selected derived sort.
3. Each card has a labeled, keyboard-operable status selector.
4. A status change uses the existing version-checked issue mutation (ISSUE-004, ISSUE-006); intake and duplicate decision rules cannot be bypassed, and a stale conflict shows the current server issue and refreshes the board without applying the rejected move.
5. At 390px, a labeled column selector lets the operator choose which status column to view.
6. Board pages explicitly request a 100-card page grouped by status through the same issue-list URL and API; ordinary list requests default to 50 and the accepted page sizes are bounded to 50 or 100.
7. Status counts use the same SQL filters as cards across the complete result, with page counts distinguished from totals.
8. Paging reaches cards beyond the first page; completed work remains hidden until explicitly requested.

#### CMD-001 — Command palette

**Requirement.** The command palette searches issues, projects, saved views, and available commands from one input.

**Acceptance.** Through the native product door and its declared counterpart:
1. The command palette searches issues, projects, saved views, and available commands from one input.
2. The up and down arrows move the highlight, Enter opens the highlighted record or performs the highlighted command, and Escape closes the palette without acting.

#### CMD-002 — Keyboard navigation

**Requirement.** Outside editable controls, Command/Ctrl-K opens the palette, C opens new issue, G then M opens My work, G then C opens Current, G then P opens Projects, and Escape closes the topmost transient surface.

**Acceptance.** Through the native product door and its declared counterpart:
1. Outside editable controls, Command/Ctrl-K opens the palette, C opens new issue, G then M opens My work, G then C opens Current, G then P opens Projects, and Escape closes the topmost transient surface.
2. Every command also has a visible, keyboard-operable control.

#### CMD-003 — Focus and selection

**Requirement.** The up and down arrows move a visible focus indicator through the rows of the active list, Enter opens the focused row, X adds or removes it from the selection VIEW-004 acts on, and Escape returns focus from an open detail pane to the row it was opened from.

**Acceptance.** Through the native product door and its declared counterpart:
1. The up and down arrows move a visible focus indicator through the rows of the active list, Enter opens the focused row, X adds or removes it from the selection VIEW-004 acts on, and Escape returns focus from an open detail pane to the row it was opened from.
2. Changing a filter, sort, or grouping keeps the focused row focused while it remains in the list and focuses the first row when it does not.

### Notifications

#### NOTIFY-001 — Inbox events

**Requirement.** Vector provides inbox events for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Vector creates an in-app notification, visible within 5 seconds, for assignment of an issue to the member, a direct mention (ISSUE-013), a comment on an issue they follow, the return of an intake item they deferred, the resolution of the last blocker on an issue assigned to them, a due reminder (NOTIFY-005), a triage item they are responsible for (TRIAGE-001), a project or initiative update they follow (PROJ-010), a delegated agent's question or completion (AGENT-002), a review request or status change from Git (GITHUB-005) and an SLA warning (AUTO-004).
2. Members who follow an issue (NOTIFY-002) — its creator, assignee, commenters, mentioned members and explicit followers — are also notified when it is completed, when it is canceled or marked duplicate, when its status changes to another status (one notification per change, grouped with any other change made in the same mutation), when its priority is raised to Urgent, when it becomes blocked by a newly added blocker or a blocking relation on it is added or removed, when its due date changes, and when a resolved thread they took part in is reopened (ISSUE-029).
3. Each event notifies each follower once, never the actor (NOTIFY-003), and a completion caused by automation or Git (GITHUB-003) names that automation as actor.
4. The inbox is always delivered; email, Slack, Teams, mobile push and desktop follow NOTIFY-006 and NOTIFY-007.
5. A thread-reopened event reaches current issue followers who authored its top-level comment or any reply, excludes the reopener, and emits once for each actual resolved-to-open transition; reopening an already open thread emits nothing.
6. Explicit reopen and reply-reopens share this rule.
7. Its inbox label and per-type mute are available; it creates no email by default (NOTIFY-006/NOTIFY-007 own channels).
8. TRIAGE-001, PROJ-010, AGENT-002, GITHUB-005, GITHUB-003 and AUTO-004 inherit their unbuilt events and inbox obligations for those capabilities.

#### NOTIFY-002 — Followers

**Requirement.** Issue creators, assignees, commenters, and directly mentioned operators follow the issue automatically; an operator can follow or unfollow it explicitly without changing anyone else's following.

**Acceptance.** Through the native product door and its declared counterpart:
1. Issue creators, assignees, commenters, and directly mentioned operators follow the issue automatically; an operator can follow or unfollow it explicitly without changing anyone else's following.

#### NOTIFY-003 — No self-notification

**Requirement.** An action never notifies its actor.

**Acceptance.** Through the native product door and its declared counterpart:
1. An action never notifies its actor.
2. One event creates at most one notification per recipient and issue even when the recipient qualifies through several follower rules.

#### NOTIFY-004 — Read and mute

**Requirement.** Opening a notification marks it read, an operator can mark all of theirs read in one action, and the interface shows their unread count.

**Acceptance.** Through the native product door and its declared counterpart:
1. Opening a notification marks it read, an operator can mark all of theirs read in one action, and the interface shows their unread count.
2. An operator can mute an issue or an event type, which suppresses only their own later matching notifications and alters neither activity history nor another operator's notifications.

#### NOTIFY-005 — Due reminders

**Requirement.** Within 5 minutes of the configured daily reminder time — 09:00 in the workspace timezone by default — Vector notifies the assignee once for each incomplete issue assigned to them that is due that day, and once more on the first run after it becomes overdue.

**Acceptance.** Through the native product door and its declared counterpart:
1. Within 5 minutes of the configured daily reminder time — 09:00 in the workspace timezone by default — Vector notifies the assignee once for each incomplete issue assigned to them that is due that day, and once more on the first run after it becomes overdue.
2. Changing a due date makes the new date eligible and never repeats a reminder already delivered for the same issue and date.

#### NOTIFY-006 — Assignment and mention email

**Requirement.** A qualifying assignment or direct mention creates at most one durable email intent per event, recipient and issue in the same transaction as its source mutation.

**Acceptance.** Through the native product door and its declared counterpart:
1. A qualifying assignment or direct mention creates at most one durable email intent per event, recipient and issue in the same transaction as its source mutation.
2. With configured transactional mail and the recipient's enabled preference, Vector initiates delivery immediately after commit through Base mail.
3. Mutes, actor exclusion and active-recipient checks apply to each qualifying cause and are rechecked before submission.
4. Mail contains only the recipient address, issue title, identifier, readable actor and authenticated canonical app link; it includes no body, evidence, attachment or tracking.
5. Accepted and development outcomes are terminal; uncertain or interrupted claims are never automatically resent.
6. Definite rejection or rate limit permits finite scheduled retries, with failed and uncertain outcomes visible to the recipient.
7. Erasure removes addressed delivery state and anonymizes retained actors; a request already in flight cannot be recalled.

### Code host and delivery

#### GITHUB-001 — Signed PR links

**Requirement.** A current registered repository receiver verifies exact GitHub HMAC bytes before parsing an allowlisted pull_request delivery.

**Acceptance.** Through the native product door and its declared counterpart:
1. A current registered repository receiver verifies exact GitHub HMAC bytes before parsing an allowlisted pull_request delivery.
2. Native issue identifiers in the PR title or body link stable repository/PR identity, safe HTTPS URL, title and open/closed/merged state.
3. Unknown identifiers record diagnostics.
4. A PR event changes issue status only through the team's Git automation rules (GITHUB-003), recorded as automation activity.

#### GITHUB-002 — Durable latest PR state

**Requirement.** Delivery replay identity and native version/configuration fences commit with PR/link history.

**Acceptance.** Through the native product door and its declared counterpart:
1. Delivery replay identity and native version/configuration fences commit with PR/link history.
2. Conflicting replay refuses, older state cannot regress newer state, and merged state stays terminal.
3. Current authority gates both fresh and retained results.
4. Safe histories are portable; credentials require destination re-entry and restored historical deliveries never replay.

### API and platform

#### API-001 — Native scoped API

**Requirement.** Vector provides native scoped api for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Named reveal-once Base tokens admit only the explicit the public API routes under route-selected scopes: issue list/detail and description history use `issues:read`; issue create/version-checked update, description restore and description checklist mutations use `issues:write`; comment creation and author-only comment checklist mutations use `comments:write`; metadata uses `metadata:read`; project list/detail use `projects:read`; and project create/update use `projects:write`.
2. The project list applies portfolio filters and returns matching counts; create and update accept native project fields, validate dates and record planning-field activity.
3. Project lists  return the complete workspace list without pagination (API-003).
4. Token expiry, revocation, active issuer/workspace and resource authority are checked on every request; bearer tokens never admit documents, generated functions, private files or token administration.
5. Existing native mutation and notification rules apply; no deletion API or product role is added.

#### API-002 — Token authority and usage

**Requirement.** Settings exposes safe metadata/usage and revocation.

**Acceptance.** Through the native product door and its declared counterpart:
1. Settings exposes safe metadata/usage and revocation.
2. Issuance and each mutation retain current authority inside the same atomic transaction.
3. Usage-write failure denies admission.
4. Removal revokes issued tokens.
5. Stale writes and authority races publish no unauthorized changes; committed native notification intent remains durable after a response denial.

#### WEBHOOK-001 — Durable native delivery

**Requirement.** Registered public HTTPS destinations receive minimal native created/updated/completed issue events under stable business identities.

**Acceptance.** Through the native product door and its declared counterpart:
1. Registered public HTTPS destinations receive minimal native created/updated/completed issue events under stable business identities.
2. Base delivery attempts, backoff, cooldown and accepted/rejected/uncertain results survive restart.
3. Ambiguous sends never retry under fresh IDs; explicit reconciliation requires receiver evidence.
4. Mapped imports and restore create no delivery events.
5. Until Settings has verified the hosting account’s domain inventory or an enforcing service is bound, outbound is visibly unconfigured and native events are retained.
6. The built-in Base transport refuses private and account-owned destinations, pins TLS for non-Cloudflare answers, and uses its explicit all-Cloudflare platform-fetch route with the re-resolution and destination-zone TLS limits in docs/INTEGRATIONS.md.
7. Failed sends never switch transports.

### Import, export and portability

#### DATA-001 — Export contents

**Requirement.** The portable export contains a manifest, original attachment bytes, and every operator, team, workflow status, issue, comment, attachment metadata, link, relation, evidence revision, intake decision, project, cycle and snapshot, label, saved view, notification, custom field, non-secret setting, idempotency record, failed operation, and audit entry.

**Acceptance.** Through the native product door and its declared counterpart:
1. The portable export contains a manifest, original attachment bytes, and every operator, team, workflow status, issue, comment, attachment metadata, link, relation, evidence revision, intake decision, project, cycle and snapshot, label, saved view, notification, custom field, non-secret setting, idempotency record, failed operation, and audit entry.
2. It never contains a session, signing, source, or provider secret.

#### DATA-002 — Mapped import preflight

**Requirement.** Separately from portable restore, an Owner or Admin (role matrix; Members and Guests are refused 403) can preflight an import of issues supplied as CSV rows or as a JSON array of objects with the same field names, before anything is written.

**Acceptance.** Through the native product door and its declared counterpart:
1. Separately from portable restore, an Owner or Admin (role matrix; Members and Guests are refused 403) can preflight an import of issues supplied as CSV rows or as a JSON array of objects with the same field names, before anything is written.
2. The fields are title, description, team, status, priority, assignee, project, cycle, labels, estimate, due date, expected outcome, customer impact, source ID, and source record ID.
3. The preflight validates the mapping, the timestamps, and every team, status, assignee, project, cycle, label, duplicate, and dependency reference, and reports every row that would fail with its row number and reason, and every nonempty value it would not import.
4. One preflight covers the whole file of a run, up to the measured run limits in docs/MOVE-IN.md.

#### DATA-003 — Atomic mapped import

**Requirement.** An Owner or Admin (role matrix) applying a successful preflight records an import-run identifier and publishes the run in batches, each written atomically, preserving supplied creation and update times.

**Acceptance.** Through the native product door and its declared counterpart:
1. An Owner or Admin (role matrix) applying a successful preflight records an import-run identifier and publishes the run in batches, each written atomically, preserving supplied creation and update times.
2. A failed batch writes none of that batch and leaves earlier batches of the run in place for resume (DATA-006).

#### DATA-004 — Idempotent mapped import

**Requirement.** Reapplying the same import-run identifier and source record identifiers creates no duplicates and returns the first run's result.

**Acceptance.** Through the native product door and its declared counterpart:
1. Reapplying the same import-run identifier and source record identifiers creates no duplicates and returns the first run's result.
2. A mapped import creates normal activity and one audit entry for the run, and no operator notifications.

#### DATA-005 — Exact portable restore

**Requirement.** The local restore command restores a portable DATA-001 archive without synthesizing activity, audit entries, notifications, or new timestamps.

**Acceptance.** Through the native product door and its declared counterpart:
1. The local restore command restores a portable DATA-001 archive without synthesizing activity, audit entries, notifications, or new timestamps.

#### DATA-006 — Staged import run

**Requirement.** Only an Owner or Admin starts, resumes or repeats a run (role matrix).

**Acceptance.** Through the native product door and its declared counterpart:
1. Only an Owner or Admin starts, resumes or repeats a run (role matrix).
2. One reviewed run of up to the measured limits in docs/MOVE-IN.md (including a seeded 2,000-issue run; larger sources are split into the runs of one migration under DATA-017, never truncated) previews once and publishes in staged batches under one run identifier.
3. Status says truthfully how many of its batches are applied and whether the last batch failed.
4. An interrupted run (a stopped client or a failed batch) resumes from its last committed batch, and every source record lands exactly once.
5. Issues already published are visible and marked as part of an unfinished run.
6. Applying the same reviewed run again returns that run with no new rows; a different file under the same source name conflicts.
7. No notification, mail or webhook is sent for an imported issue.

#### DATA-007 — Reconciliation report

**Requirement.** Vector provides reconciliation report for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. For a finished or partial run, Settings and the terminal give one report and one CSV: source rows read against Vector issues written, by team, status, project, cycle and assignee; every omitted nonempty field with its count; every unresolved or ignored reference with its row; what the source file does not contain at all; and a mapping of each source ID to its Vector identifier.
2. An imported issue shows its source ID, and searching for that source ID finds it.

#### DATA-008 — Linear API enrichment file

**Requirement.** A JSON file the owner produces with Linear's GraphQL API (docs/LINEAR-API-FILE.md) merges with a Linear CSV run by source ID. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. A JSON file the owner produces with Linear's GraphQL API (docs/LINEAR-API-FILE.md) merges with a Linear CSV run by source ID.
2. Comments become imported comments with their original time and a read-only author name; attachment links become named HTTPS links that are never fetched; blocks and duplicate relations become dependencies and duplicate links when both issues are in the run, and are reported otherwise.
3. Attachment bytes are reported as not in the file.
4. A malformed file (an unsafe link scheme, an unknown source ID, or a comment for an issue outside the run) is refused with row-level reasons and nothing written.

#### DATA-009 — Jira CSV preflight and loss review

**Requirement.** A Jira All Fields file is reviewed before any write through the same staged import service. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. A Jira All Fields file is reviewed before any write through the same staged import service.
2. Source IDs remain distinct from mutable issue keys; repeated headers retain their positions and exact original bytes.
3. All date-bearing cells, including comments and attachment metadata, determine one calendar pattern; ambiguous, mixed or impossible dates are refused.
4. Offsetless instants require an explicitly supplied source offset.
5. Every unsupported occurrence remains visible as an omission; mappings must be confirmed and row errors fixed before apply.

#### DATA-010 — Jira staged apply and reconciliation

**Requirement.** The reviewed Jira CSV imports preserved issue times (Resolved for completion, or an explicitly confirmed fallback), due dates, estimates, exact labels, confirmed status/priority/operator/sprint mappings, in-file parents and Blocks, canonical Duplicate links and original-author/time comments. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. The reviewed Jira CSV imports preserved issue times (Resolved for completion, or an explicitly confirmed fallback), due dates, estimates, exact labels, confirmed status/priority/operator/sprint mappings, in-file parents and Blocks, canonical Duplicate links and original-author/time comments.
2. Stable source IDs remain authoritative; old keys are visible and searchable.
3. Outside-file and Relates targets are omissions and never bind a same-key native issue.
4. Attachment bytes are never fetched; named HTTPS links require explicit opt-in.
5. Preview, CLI review and stored report share one loss review and configuration fingerprint.
6. Staged apply/replay, record reconciliation and whole-run rollback use the existing lifecycle; later native edits refuse the entire rollback without changes.
7. Historical imports dispatch no notifications, mail, webhooks or agents.
8. The public route requires a current Owner or Admin session (role matrix) and same origin; API tokens are not admitted.

#### DATA-011 — Erasing an imported person

**Requirement.** An Owner or Admin (role matrix; Members and Guests are refused 403) can erase a person that imports carried, by exact email and/or up to five exact display names, after a counts-only preview and a typed confirmation.

**Acceptance.** Through the native product door and its declared counterpart:
1. An Owner or Admin (role matrix; Members and Guests are refused 403) can erase a person that imports carried, by exact email and/or up to five exact display names, after a counts-only preview and a typed confirmation.
2. One atomic operation removes the person from every import run, applied or still pending: records that hold them become permanent tombstones that never publish or replay, runs labeled with their email are retired, originals holding them are withdrawn, imported comments they wrote read as deleted with no author name, reconciliation reports lose those cells, and development mail naming them is dropped.
3. Issues already written stay; a pending run still finishes, without the erased records and without links to them.
4. A current or suspended member, or an open invitation, is refused here; a member's native and imported records are erased together by ROLE-012.
5. The erasure journal is append-only, and an archive made before the erasure is refused on restore when a later archive's journal is supplied.

### Installation and authority

#### OWNER-CLAIM-001 — Signed owner claim

**Requirement.** An explicitly configured signed installation claims its initial owner through Base native operator-auth using a five-minute signed claim bound to trusted issuer, installation, app origin and canonical owner email.

**Acceptance.** Through the native product door and its declared counterpart:
1. An explicitly configured signed installation claims its initial owner through Base native operator-auth using a five-minute signed claim bound to trusted issuer, installation, app origin and canonical owner email.
2. Confirmation GET/HEAD is inert; native same-origin POST admits exactly once.
3. No request provides configuration or setup secrets.
4. Existing initialization and permanent admission ledgers refuse all subsequent claims.
5. Ordinary local configured-owner setup remains the default without RER claim configuration.

#### EDITOR-001 — Owner-gated editor

**Requirement.** The optional same-origin Base editor is admitted only for a recorded installation owner with a current native Base owner session, active mapped Vector identity and restored-installation grant where applicable.

**Acceptance.** Through the native product door and its declared counterpart:
1. The optional same-origin Base editor is admitted only for a recorded installation owner with a current native Base owner session, active mapped Vector identity and restored-installation grant where applicable.
2. Its config endpoint returns a no-store non-secret lease of at most thirty seconds and exact trusted management origin.
3. Logout/authority loss removes the mount; lease expiry bounds silent revocation.
4. Each hydrated destination controls compiled-edit readiness.
5. Application CSP preserves unrelated directives and permits framing only by self and that exact management origin.
6. A hosted management session and independently registered frame-ancestors remain required; source adoption is not hosted acceptance.


## Target clauses

### Target: Workspace, people and permissions

#### ROLE-001 — Workspace roles

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Each member has one workspace role. The following matrix defines the permitted actors for every named job; ROLE-013 adds Viewer. Administrative role alone does not supply private-team content membership. Matrix cell wording stays verbatim for its reader. The legacy channel-creation label SLACK-003 is now SLACK-008; comment-thread resolution labelled ISSUE-029 is now ISSUE-029. The other split destinations are recorded in the ID map.

| Action | Owner | Admin | Member | Guest | Viewer (ROLE-013 target) |
|---|---|---|---|---|---|
| Read visible work (OPS-001, ROLE-002, ROLE-003, ROLE-013) | yes | public teams and private teams they belong to | public teams and private teams they belong to | invited teams only | public teams and private teams an Owner/Admin added them to |
| Invite or suspend Viewers; change between Member, Guest and Viewer (ROLE-013) | yes | yes | no | no | no |
| Invite, or remove by suspension, Members and Guests (OPS-002, OPS-004, ROLE-011) | yes | yes | no (yes when the invite setting is on, Members only) | no | no |
| Invite, promote to, or remove by suspension Owners and Admins (OPS-002, ROLE-001, ROLE-011) | yes | no | no | no | no |
| Leave the workspace oneself, which suspends (OPS-004, ROLE-011) | yes (not the last Owner) | yes | yes | yes | yes (own account only) |
| Open suspended members and their activity; reactivate a suspended Member or Guest (ROLE-011) | yes | yes | no | no | no |
| Reactivate a suspended former Owner or Admin (ROLE-011) | yes | no | no | no | no |
| Erase a suspended Member's or Guest's personal data (ROLE-012) | yes | yes | no | no | no |
| Erase a suspended former Owner's or Admin's personal data (ROLE-012) | yes | no | no | no | no |
| Change workspace settings: timezone, the invite, label-creation and deletion settings, notification defaults (OPS-003, OPS-002, ISSUE-014, ISSUE-010, NOTIFY-007) | yes | yes | no | no | no |
| Require SSO, restrict sign-up domains, connect SCIM (ROLE-004) | yes | no | no | no | no |
| Offer or withdraw Google sign-in and passkey sign-in (ROLE-010) | yes | no | no | no | no |
| Register or remove one's own passkey (ROLE-010) | yes | yes | yes | yes | yes (own account only) |
| Write, edit and comment on documents under projects, issues, initiatives and teams they can see (PROJ-013) | yes | yes | yes | under invited teams' issues and projects only | no |
| Set the Recently deleted retention for issues and projects (ISSUE-020, PROJ-017) | yes | no | no | no | no |
| Open Settings pages (ROLE-008) | every page | every page | Account, the member directory and Labels (read-only), the teams they belong to (writable only where a row allows), their personal integrations and tokens | Account only | Account and read-only directory and Labels only |
| Set who may create teams (TEAM-008) | yes | yes | no | no | no |
| Create a team (TEAM-008) | yes | yes | no (yes when the workspace permits Members; TEAM-008) | no | no |
| Make a team private or public (ROLE-002) | yes | yes | no | no | no |
| Manage a team's members and team owners (ROLE-007, TEAM-007, ROLE-013) | yes | yes | team owner only; adding Guests/Viewers requires Owner/Admin | no | no |
| Set a team's two permissions, *Who manages team settings* and *Who manages cycles and templates* (ROLE-009) | yes | yes | team owner only | no | no |
| Join an open public team or leave one's team (ROLE-007, TEAM-007) | yes | yes | yes (last-team-owner guard applies) | no | no |
| Set open or invite-only membership; approve join requests; add Members to an invite-only or private team (TEAM-007) | yes | yes | team owner only | no | no |
| Request membership of an invite-only or private team (TEAM-007) | yes (where request is visible) | yes (where request is visible) | where request is visible; no access until approved | no | no |
| Self-join an invite-only or private team without approval (TEAM-007) | no | no | no | no | no |
| Create or reparent a sub-team; change its inherited settings or overrides (TEAM-006) | yes | yes | team setting for both child and parent, plus TEAM-008 for creation | no | no |
| Change team settings: name and unused prefix, the sub-issue completion/reopening rule, triage, cycles and estimates on or off, estimate scale, default template, Git automation rules, auto-close and auto-archive (TEAM-001, ISSUE-019, TEAM-005, GITHUB-003, AUTO-003) | yes | yes | team setting | no | no |
| Add, rename, reorder or remove workflow statuses (TEAM-002, TEAM-004) | yes | yes | team setting | no | no |
| Archive or unarchive a team, whatever its *Who manages team settings* permission (TEAM-003) | yes | yes | team owner only | no | no |
| See customers, customer pages and customer requests (CUST-001, CUST-007) | yes | yes | yes | no | visible work only |
| Create and edit customers; add, edit their own or move customer requests (CUST-005, CUST-008) | yes | yes | yes | no | no |
| Delete another member's customer request (CUST-008) | yes | yes | no | no | no |
| Define customer status and tier values; map customer fields to a linked source; set the domain block list and new-domain setting (CUST-005, CUST-006) | yes | yes | no | no | no |
| Merge or delete customers (CUST-005, CUST-006) | yes | yes | no | no | no |
| Create, edit and comment on issues in the member's teams (ISSUE-001, ISSUE-008) | yes | yes | yes | invited teams only | no |
| Add or remove reactions on issue descriptions and comments (ISSUE-017) | yes | yes | yes | invited teams only | no |
| Copy an issue (ROLE-003/ROLE-008; ISSUE-023 action) | yes | yes | member's teams | invited teams only | no |
| Edit own comment; resolve or reopen any thread (ISSUE-008) | yes | yes | yes | invited teams only | no |
| Paste, drop or upload images and video into a description, comment or document they can edit, and tick its checklists (ISSUE-024, ISSUE-025) | yes | yes | yes | invited teams only | no |
| Edit another member's comment, including ticking its checklists (ISSUE-008, ISSUE-025) | no | no | no | no | no |
| Delete own comment (ISSUE-008) | yes | yes | yes | yes | no |
| Delete another member's comment (ISSUE-008) | yes | yes | team owner only | no | no |
| Delete an issue to Recently deleted (ISSUE-010, ISSUE-020) | yes | yes | own issues (any issue in the member's teams when the setting is on) | no | no |
| Restore from Recently deleted (ISSUE-020) | yes | yes | issues they deleted | no | no |
| Permanently delete an issue before retention ends (ISSUE-010) | yes | yes | no | no | no |
| Create and apply labels (ISSUE-014) | yes | yes | yes (unless creation is restricted to Admins) | apply only | no |
| Rename, recolor, merge or delete a workspace label (ISSUE-014) | yes | yes | no | no | no |
| Rename, recolor, merge or delete a team label (ISSUE-014) | yes | yes | team setting | no | no |
| Define, change or remove workspace custom fields (FIELD-001) | yes | yes | no | no | no |
| Define or change a team's custom fields (FIELD-001) | yes | yes | team setting | no | no |
| Create an intake item by hand or submit a request form (INTAKE-001, TRIAGE-004) | yes | yes | yes | invited teams only | no |
| Reply by email to an intake sender (TRIAGE-005) | yes | yes | member's teams | no | no |
| Accept, defer, end a deferral or decline an intake item (INTAKE-005, INTAKE-006, INTAKE-007) | yes | yes | member's teams | no | no |
| Accept, edit or dismiss an agent's triage suggestion (TRIAGE-003) | yes | yes | member's teams | no | no |
| Set a team's triage responsibility, routing rules, request forms and email intake (TRIAGE-001, TRIAGE-002, TRIAGE-004, TRIAGE-005) | yes | yes | team setting | no | no |
| Create or change workspace-wide routing rules (TRIAGE-002) | yes | yes | no | no | no |
| Register, rotate or revoke a signal source and its signing secret (INTAKE-011) | yes | yes | no | no | no |
| Create, edit or delete workspace issue and project templates (ISSUE-016, PROJ-012) | yes | yes | no | no | no |
| Create, edit or delete a team's issue and project templates (ISSUE-016, PROJ-012) | yes | yes | planning setting | no | no |
| Start an issue or project from a template (ISSUE-016, PROJ-012) | yes | yes | yes | issue templates in invited teams only | no |
| Create, edit, complete or delete a cycle (CYCLE-001) | yes | yes | planning setting | no | no |
| Set a team's cycle schedule (ROLE-007/ROLE-009; CYCLE-007 action) | yes | yes | planning setting | no | no |
| Commit, move or uncommit an issue in a cycle (CYCLE-002) | yes | yes | member's teams | invited teams only | no |
| Create a project and edit its fields, members and contributing teams (PROJ-001, PROJ-014) | yes | yes | yes | no | no |
| Change a project's status; archive or unarchive it (PROJ-002, PROJ-009, PROJ-016) | yes | yes | yes | no | no |
| Delete a project after its confirmation, keeping its issues (PROJ-003, PROJ-017) | yes | yes | the project's lead only after recoverable delete (PROJ-017); otherwise no | no | no |
| Restore a project from Recently deleted or Undo its deletion (PROJ-017) | yes | yes | the project's lead who deleted it | no | no |
| Permanently delete a project before retention ends (PROJ-017) | yes | yes | no | no | no |
| Add, rename, recolor, describe, reorder or remove workspace project statuses (PROJ-016) | yes | yes | no | no | no |
| Add, rename, recolor, describe, reorder or remove a team's project statuses (PROJ-016) | yes | yes | team setting | no | no |
| Set or remove project dependencies (PROJ-015) | yes | yes | yes | no | no |
| Create and edit milestones (PROJ-011) | yes | yes | yes | no | no |
| Post a project update (PROJ-010) | yes | yes | the project's lead and members | no | no |
| Create and edit initiatives; add projects to them (INIT-001) | yes | yes | yes | no | no |
| Create, edit or release a release (RELEASE-001) | yes | yes | member's teams and workspace releases | no | no |
| Save, update or delete a private view (VIEW-002) | yes | yes | yes | yes | no |
| Share a saved view with the workspace or a team (VIEW-002) | yes | yes | yes | no | no |
| Open or duplicate a shared view (VIEW-002) | yes | yes | yes | only views covering only invited teams | open visible views only; no saved duplicate |
| Update or delete a shared view (VIEW-002) | own | own | own | no | no |
| Create, pause or end a recurring issue (AUTO-001) | yes | yes | member's teams | no | no |
| Build or change workspace automation rules (AUTO-002, AUTO-006) | yes | yes | no | no | no |
| Build or change a team's automation rules and SLAs (AUTO-002, AUTO-004) | yes | yes | team setting | no | no |
| Connect, repair or remove integrations; manage OAuth apps, agents, their budgets and model providers (ROLE-001, INTEG-001, INTEG-002, API-004, AGENT-004, AGENT-009, SEC-002) | yes | yes | no | no | no |
| Have the Slack bot create a channel in the customer's Slack workspace for a new team or project (SLACK-003) | yes | yes | no | no | no |
| Bind a project to a Slack channel an Owner or Admin already bound or allowed, and post to it (SLACK-003) | yes | yes | yes | no | no |
| Bind an editable initiative to an eligible Owner- or Admin-approved destination and manage only that initiative’s selected events (INIT-001) | yes | yes | editable initiative and approved destination only | no | no |
| Create personal API tokens (API-001) | yes | yes | yes | no | no |
| Authorize an OAuth app for oneself; link one's own Slack or Teams identity (API-004, SLACK-001, SLACK-004, TEAMS-001) | yes | yes | yes | no | no |
| Delegate an issue to a coding agent (AGENT-001) | yes | yes | member's teams, for agents allowed under AGENT-004 | no | no |
| Open Insights and shared dashboards (REPORT-001) | yes | yes | yes (only what they can read) | no | yes |
| Create, edit or share a dashboard (REPORT-003) | yes | yes | yes (own dashboards) | no | no |
| Create, rotate or revoke a calendar feed (CAL-001) | yes | yes | yes (own feed and own teams’ feeds) | no | yes (own feed) |
| Export the portable archive (DATA-001) | yes | yes | no | no | no |
| Restore an archive over HTTP and review the restored workspace (DATA-005) | yes | no | no | no | no |
| Preflight, apply, resume, repeat or roll back an import run or migration (DATA-002, DATA-003, DATA-006, DATA-008, DATA-009, DATA-010, DATA-012, DATA-013, DATA-014, DATA-015, DATA-016, DATA-017) | yes | yes | no | no | no |
| Erase an imported person (DATA-011) | yes | yes | no | no | no |
| Schedule warehouse exports and Google Sheets syncs (REPORT-005) | yes | yes | no | no | no |
| Browse and export the audit log (ROLE-005) | yes | yes | no | no | no |

**Acceptance.** Through the native product door and its declared counterpart:
1. Each member has exactly one role: Owner, Admin, Member or Guest; ROLE-013 adds the read-only Viewer target.
2. Owners and Admins invite and remove members, create teams, manage integrations, API tokens, workspace automations, agents and workspace settings; Owners change any role, Admins change Member and Guest roles (Guest assignment follows ROLE-003) and never to or from Owner or Admin; Members create and change work in the teams they can see, manage the teams they own (ROLE-007) and, where a team's permissions allow it (ROLE-009), that team's settings, cycles and templates; Guests act only inside the teams they were invited to (ROLE-003).
3. The installation owner is an Owner and the last Owner cannot be demoted or removed.
4. Each action's permitted roles are exactly those in the role matrix below, every clause that names a permission states the same rule, and *operator* in any clause is resolved by ROLE-008.
5. The role-matrix journey carries the cells it inherited from INTAKE-005, INTAKE-006, INTAKE-007, INTAKE-011, PROJ-002, CYCLE-001, CYCLE-002, VIEW-002, DATA-002, DATA-003, DATA-006, DATA-010, DATA-011: Guest accept, defer, end-deferral, decline and project lifecycle changes are refused 403; a Guest commits only in invited teams (404 elsewhere) and cannot share views; another member cannot edit a shared view they do not own; Member/Guest source registration, rotation and revocation, import preflight/apply/start/resume/repeat/rollback and imported-person erasure preview/confirmation are refused 403 with no writes, while Owners/Admins succeed.
6. CYCLE-001 creation/edit/completion/deletion also checks team owners and both ROLE-009 planning permissions, with Guests refused.
7. A row with no door yet is checked by the clause it names when that clause builds the door.

#### ROLE-002 — Private teams

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** An Admin can make a team private. Slack identity and private notices follow RL-3.

**Acceptance.** Through the native product door and its declared counterpart:
1. An Admin can make a team private.
2. Its issues, comments, attachments, cycles, triage, project memberships and search entries are visible only to its members and to Owners; a project or initiative that spans a private team shows other viewers only the counts they may see, never titles.
3. Making a team public or private is audited and re-evaluates notifications, followers, Slack channel routes and webhooks.
4. Inherited from WORK-004: after a member loses access to a private-team issue, it is absent from Created, Subscribed and Activity; the private-team journey checks every tab.
5. Inherited from SLACK-003, SLACK-007: private-team content posts only to channels an Admin bound to that team; its acceptance journey verifies that project and saved-view bindings cannot bypass this rule.
6. SLACK-003, SLACK-007 channel posts and SLACK-004 direct messages for private/restricted items use only a generic notice without actor or text, or a DM to a permitted explicitly mapped member; its acceptance proves this for private teams.
7. Inherited from ROLE-007: a Member's self-join of a private team is refused 403, and once its team owner or an Admin adds them they see its issues; the private-team journey checks both.

#### ROLE-003 — Guests

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** ISSUE-023 inherits the Guest cell: copying requires source visibility and creation permission in the destination, and Guests may copy only within invited teams, through every browser and API door.

**Acceptance.** Through the native product door and its declared counterpart:
1. ISSUE-023 inherits the Guest cell: copying requires source visibility and creation permission in the destination, and Guests may copy only within invited teams, through every browser and API door.
2. A Guest (a contractor, agency or customer engineer) is invited to named teams only, sees only those teams' issues and projects, cannot see the member directory beyond those teams, cannot create API tokens or integrations, and is labeled as a guest wherever they appear.
3. Before Guests ship, inherit INTAKE-005/006/007, PROJ-002, CYCLE-002 and VIEW-002: accept, defer, end-deferral, decline and project lifecycle changes are refused 403; cycle commitment is allowed only in invited teams and refused 404 elsewhere; shared-view creation is refused, and view visibility is limited to invited teams.
4. INTAKE-011 and DATA-002/003/006/010/011 source management, import management and erasure are refused 403 with no writes.
5. CYCLE-001 cycle management is refused under both planning permissions.
6. PROJ-001 inherits Guest project visibility only through invited contributing teams and 403 refusal of Guest project creation and every project edit before Guests ship.
7. Inherited from ROLE-007: a Guest's access follows the teams an Admin added them to.

#### ROLE-004 — Single sign-on and provisioning

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-SIGNIN-001 · *Register:* R-3

**Requirement.** Owners can require SAML or OpenID Connect, allow verified company domains and select Okta, Microsoft Entra ID or Google Workspace. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners can require SAML or OpenID Connect, allow verified company domains and select Okta, Microsoft Entra ID or Google Workspace.
2. Run-auth proves the standards sign-in and SCIM paths against Vector membership; SCIM deactivation invokes ROLE-011 suspension without erasure, and reactivation keeps the member identity.

#### ROLE-005 — Audit log

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-ROLE-001

**Requirement.** The Vector audit covers sign-ins, roles and memberships, suspension, reactivation, erasure, team privacy, integrations, tokens, automation and agent runs, exports, imports and deletions, with person, automation, integration or agent as actor and the action subject.

**Acceptance.** Through the native product door and its declared counterpart:
1. The Vector audit covers sign-ins, roles and memberships, suspension, reactivation, erasure, team privacy, integrations, tokens, automation and agent runs, exports, imports and deletions, with person, automation, integration or agent as actor and the action subject.

#### ROLE-006 — Apps and agents as actors

*Tier:* Core · *Cites:* BASE-AGENT-008, BASE-ROLE-001

**Requirement.** Vector names its integrations, automations and coding-provider delegates as distinct actors on issue changes.

**Acceptance.** Through the native product door and its declared counterpart:
1. Vector names its integrations, automations and coding-provider delegates as distinct actors on issue changes.

#### ROLE-007 — Team membership and team owners

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Every team has a member list and one or more team owners. CYCLE-001 and CYCLE-007 carry cycle permissions; TRIAGE-001, NOTIFY-009, WORK-003 and PROJ-014 carry their membership-dependent behavior.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every team has a member list and one or more team owners.
2. Owners and Admins create teams and become their first team owner; TEAM-008 carries the future workspace setting that also permits Members to create teams; a team owner or an Admin adds and removes the team's members and team owners and sets the team's two permissions (ROLE-009), which decide whether all team members or only its team owners manage the team's settings (TEAM-002, TEAM-005) and its cycles and templates.
3. Members join and leave open public teams themselves from the team directory; TEAM-007 carries invite-only public teams and join requests; a private team (ROLE-002) is joined only when its team owner or an Admin adds the member; Guests are added to a team only by an Admin (ROLE-003).
4. Leaving or being removed from a team keeps the member's assigned issues assigned and listed for the team owner to reassign; it never deletes work.
5. A team's last team owner cannot leave until another is named, and an Admin can always act as team owner.
6. Every change is audited (ROLE-005).

#### ROLE-008 — Operator and permission coverage

*Tier:* Core · *Cites:* BASE-AGENT-008, BASE-ROLE-001

**Requirement.** An operator is a signed-in workspace person using their session or their own token. The word grants no additional permission: the role matrix, team permissions and subject visibility decide the action.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every state-changing door — each mutation route under the native API and the public API, each private server function, each Settings form and each terminal command that writes — is registered against exactly one role-matrix row.
2. A door with no row is refused to every role but Owner and the refusal is audited (ROLE-005), so a new feature cannot ship open to Members or Guests by omission.
3. Settings pages are reachable as the matrix's "Open Settings pages" row states, and every other Settings page and route returns 403.

#### ROLE-009 — Team-managed permissions

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Each team has two permissions, each either *All team members* or *Team owners only*, set by its team owners or an Owner or Admin. The permissions apply to the named settings and planning objects as their own clauses define them.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each team has two permissions, each either *All team members* or *Team owners only*, set by its team owners or an Owner or Admin.
2. *Who manages team settings* governs workflow statuses (TEAM-002, TEAM-004), team settings (TEAM-005), team labels (ISSUE-014), team custom fields (FIELD-001), triage responsibility, routing rules, request forms and email intake (TRIAGE-001, TRIAGE-002, TRIAGE-004, TRIAGE-005), Git automation rules (GITHUB-003), the team's project statuses (PROJ-016, PROJ-046), and the team's automation rules, SLAs, auto-close and auto-archive (AUTO-002, AUTO-003, AUTO-004).
3. *Who manages cycles and templates* governs creating, editing, completing and deleting cycles (CYCLE-001), the cycle schedule (CYCLE-007), and the team's issue and project templates (ISSUE-016, PROJ-012).
4. Owners and Admins pass both permissions whatever their value; Guests fail both whatever their value; a sub-team (TEAM-006) inherits its parent's values unless it sets its own.
5. A change is audited (ROLE-005) and takes effect on the next request.
6. The default for team settings is Team owners only and for cycles and templates is All team members. CYCLE-001 inherits cycle creation, edit, completion and deletion under both planning permissions: non-owner Members succeed under All team members and are refused 403 under Team owners only; Owners/Admins and team owners succeed, Guests are refused under both.

#### ROLE-010 — Offer Google sign-in

*Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ROLE-001, BASE-SIGNIN-001

**Requirement.** Beside the magic link (BASE-ACCESS-001), an Owner can offer "Continue with Google" and passkeys on the sign-in page without requiring either.

**Acceptance.** Through the native product door and its declared counterpart:
1. Beside the magic link (BASE-ACCESS-001), an Owner can offer "Continue with Google" and passkeys on the sign-in page without requiring either.
2. Google sign-in is OpenID Connect with Google as the identity provider: Settings → Sign-in shows this installation's exact authorized redirect URI and JavaScript origin to enter in a Google Cloud OAuth client, the Owner pastes its client ID and secret, and Vector runs a test sign-in before turning it on.
3. A Google sign-in admits only an email Google reports as verified that already belongs to a member or an open invitation, or that is in a domain the Owner allows for sign-up (ROLE-004); it links to the existing member by that email, and never creates a second account for the same person.
4. Enabling, disabling and each sign-in by either method are audited (ROLE-005).
5. The magic link stays available unless an Owner requires SSO under ROLE-004, which then overrides both methods.
6. The mobile apps (MOBILE-001) offer the same methods in the system browser.

#### ROLE-014 — Member passkeys

*Tier:* Core · *From:* ROLE-010 · *Cites:* BASE-ROLE-001, BASE-SIGNIN-002

**Requirement.** Once an Owner offers passkeys, every member, Guests included, can register one or more passkeys (WebAuthn, on the device or a security key) under Account and sign in with any of them; removing a passkey, or suspending the member (ROLE-011), revokes it.

**Acceptance.** Through the native product door and its declared counterpart:
1. Once an Owner offers passkeys, every member, Guests included, can register one or more passkeys (WebAuthn, on the device or a security key) under Account and sign in with any of them; removing a passkey, or suspending the member (ROLE-011), revokes it.
2. Viewers may register and remove only their own passkeys and cannot offer or withdraw sign-in methods.

#### ROLE-011 — Suspend a member and withdraw access

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Suspension is the default offboarding: Settings → Members' Suspend action (Owners and Admins; only an Owner suspends an Owner or Admin), a member's own Leave workspace, and SCIM `PATCH` with `active: false` or `DELETE` on the user (ROLE-004) all produce the same suspended state, which takes effect on the member's next request.

**Acceptance.** Through the native product door and its declared counterpart:
1. Suspension is the default offboarding: Settings → Members' Suspend action (Owners and Admins; only an Owner suspends an Owner or Admin), a member's own Leave workspace, and SCIM `PATCH` with `active: false` or `DELETE` on the user (ROLE-004) all produce the same suspended state, which takes effect on the member's next request.
2. It revokes every session on every device, every personal API token (API-001), every OAuth grant they authorized (API-004) and the MCP sessions under them (AGENT-005), every passkey (ROLE-014), every mobile, desktop and Web Push registration (MOBILE-002, MOBILE-005), and their linked Slack, Teams and GitHub identities (SLACK-001, SLACK-004, TEAMS-001, GITHUB-006), so a suspended member's SLACK-004 link is deleted, no Slack direct message reaches them and a signed Slack action from their account is refused; magic-link, Google and SSO sign-in for that email are refused while they are suspended.
3. A suspended member no longer counts in the member count or any seat limit, cannot be mentioned, assigned, added to a team or project, or delegated work, and receives no notification or digest; their team memberships and team ownerships are kept but inactive, and a team left with no active team owner is managed by Admins until one is named (ROLE-007).
4. Suspension, leaving and reactivation each write one audit entry with the actor and the method (Settings, self or SCIM), and neither suspension nor any SCIM call anonymizes anything (ROLE-012).
5. Viewers may leave the workspace themselves but cannot suspend or reactivate another member.

#### ROLE-015 — Suspended work and member directory

*Tier:* Core · *From:* ROLE-011 · *Cites:* BASE-ROLE-001

**Requirement.** Their name stays, labeled "Suspended", on every comment, description revision, activity entry, audit entry (ROLE-005), project update and customer request they wrote and on their profile, which Owners and Admins open from the member directory's Suspended filter to see their issue activity; the directory lists suspended members apart from active ones.

**Acceptance.** Through the native product door and its declared counterpart:
1. Their name stays, labeled "Suspended", on every comment, description revision, activity entry, audit entry (ROLE-005), project update and customer request they wrote and on their profile, which Owners and Admins open from the member directory's Suspended filter to see their issue activity; the directory lists suspended members apart from active ones.
2. In the same dialog the person suspending chooses whether the member's non-terminal issues stay assigned (each flagged "Assignee suspended" in lists, Current and the Members page for reassignment) or are unassigned; projects they led and shared views they owned transfer as OPS-004 states; their private saved views, favorites and drafts are kept hidden and return on reactivation; and coding-agent sessions they delegated (AGENT-001) are paused and listed for an Admin to reassign or cancel.

#### ROLE-016 — Reactivate the same member

*Tier:* Core · *From:* ROLE-011 · *Cites:* BASE-ROLE-001

**Requirement.** Vector provides reactivate the same member for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Reactivation — by an Owner or Admin from the Suspended filter (only an Owner reactivates a former Owner or Admin), by SCIM `active: true`, or by inviting the same email again — restores the same member record and ID with its role, history, team memberships and private views; it never restores a revoked session, token, OAuth grant, passkey, push registration or linked identity, so the member signs in afresh.

#### ROLE-017 — Portable suspended-member state

*Tier:* Core · *From:* ROLE-011 · *Cites:* BASE-ROLE-001

**Requirement.** The portable export (DATA-001) carries each member's state with the suspension time and actor, and a restore (DATA-005) brings a suspended member back suspended, with no session or credential.

**Acceptance.** Through the native product door and its declared counterpart:
1. The portable export (DATA-001) carries each member's state with the suspension time and actor, and a restore (DATA-005) brings a suspended member back suspended, with no session or credential.

#### ROLE-012 — Erase a member's personal data

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-003, BASE-DATA-006

**Requirement.** Vector provides erase a member's personal data for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Erasure is a separate, deliberate action, offered only on a suspended member (an active member is suspended first, ROLE-011), to Owners and Admins (only an Owner erases a former Owner or Admin), from the member's profile or the public API — for example to honor a departed employee's or contractor's deletion request under the CCPA.
2. It shows a counts-only preview (comments, revisions, activity and audit entries, project updates, customer requests, imported records under their email, and the external copies Vector cannot recall) and runs only after the actor types the member's email to confirm.
3. One transaction then replaces the member's name, email, avatar and profile with "Former member" and an opaque reference on every comment, revision, activity entry, project update, customer request and audit entry, keeping the content and the audit trail; deletes their private saved views, favorites, drafts, notifications, passkeys and preferences; applies DATA-011 to every imported record under their email; and runs SEC-003 for their Slack, Teams, GitHub and agent identities, listing the external copies it cannot recall.
4. An erased member can never be reactivated, a later invitation of the same email creates a new member, and the erasure writes exactly one audit entry with the actor and an opaque subject reference.
5. The erasure journal is append-only, so restoring an archive made before the erasure is refused when a later archive's journal is supplied (as DATA-011).
6. Suspension, leaving and SCIM deprovisioning never erase.

#### ROLE-013 — Read-only Viewers

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** A Viewer is a stakeholder who reads public teams' work and shared views, and private-team work only after an Owner or Admin explicitly adds them.

**Acceptance.** Through the native product door and its declared counterpart:
1. A Viewer is a stakeholder who reads public teams' work and shared views, and private-team work only after an Owner or Admin explicitly adds them.
2. Unlike a Guest, a Viewer never creates or changes work, including issues, comments, reactions, labels, projects, documents, memberships, integrations or API tokens.
3. Owners and Admins invite Viewers and change Member, Guest and Viewer roles; only Owners change a role to or from Owner or Admin.
4. The Viewer can open Account and the read-only directory and Labels, manage their own sign-in methods and leave the workspace.
5. Reads, search, exports, notifications, API and agent context apply the same visibility; changing to Viewer removes write authority on the next request.

### Target: Teams and workflows

#### TEAM-005 — Team settings

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Each team chooses whether it uses triage, cycles and estimates; its estimate scale (points 1–100 as ISSUE-011, Fibonacci, exponential or T-shirt sizes mapped to points); its default issue template; its triage responsibility (TRIAGE-001); its Git automation rules (GITHUB-003); and its auto-close and auto-archive periods (AUTO-003).

**Acceptance.** Through the native product door and its declared counterpart:
1. Each team chooses whether it uses triage, cycles and estimates; its estimate scale (points 1–100 as ISSUE-011, Fibonacci, exponential or T-shirt sizes mapped to points); its default issue template; its triage responsibility (TRIAGE-001); its Git automation rules (GITHUB-003); and its auto-close and auto-archive periods (AUTO-003).
2. Turning a feature off hides it for that team without deleting history.
3. Inherited from ROLE-009: these settings change under the team's *Who manages team settings* permission; Owners and Admins always may and Guests never (role matrix).

#### TEAM-006 — Sub-teams

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** A team can have sub-teams up to three levels deep (for example Platform → Infrastructure, Developer Experience).

**Acceptance.** Through the native product door and its declared counterpart:
1. A team can have sub-teams up to three levels deep (for example Platform → Infrastructure, Developer Experience).
2. A sub-team keeps its own identifier prefix, members and issues, inherits its parent's workflow, labels, custom fields, cycle cadence and Git rules unless it overrides them, and the parent team's issue lists, boards, cycles view, insights and triage can include sub-team issues with one toggle.
3. Linear team hierarchies import as sub-teams.
4. Moving a team under another parent never changes issue identifiers.
5. Inherited from ROLE-009: a sub-team keeps its parent's two permissions unless it sets its own.
6. Creating or reparenting a sub-team and changing inherited settings or overrides requires the team-setting permission on both child and parent; creation also requires TEAM-008.
7. Owners/Admins always may; Guests/Viewers never (role matrix).

#### TEAM-007 — Team join permissions

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Team membership is separate from visibility: a public team can allow open joining or require an invitation; private teams always require approval (ROLE-002).

**Acceptance.** Through the native product door and its declared counterpart:
1. Team membership is separate from visibility: a public team can allow open joining or require an invitation; private teams always require approval (ROLE-002).
2. Members join open public teams themselves, request membership only where the team has explicitly exposed a request action, and otherwise are added by an Owner, Admin or team owner.
3. A request grants no membership or read access; a hidden private team remains invisible.
4. Owners, Admins and team owners set the membership mode and approve requests or add Members; only Owners/Admins add Guests or Viewers.
5. The refusal for Viewers is delivered with ROLE-013; the refusal for Guests remains this clause's.
6. Leaving preserves assigned work and the last-team-owner guard (ROLE-007).
7. Public-team reads remain workspace-wide regardless of membership mode (OPS-001).

#### TEAM-008 — Who may create teams

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Owners and Admins set the workspace permission *Who may create teams* to *Owners and Admins only* or *Members too*.

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners and Admins set the workspace permission *Who may create teams* to *Owners and Admins only* or *Members too*.
2. Owners/Admins always create teams; Members create public teams only under Members too and become the new team's first team owner (ROLE-007).
3. Private-team creation authority is delivered with ROLE-002.
4. The refusal for Viewers is delivered with ROLE-013; the refusal for Guests remains this clause's.
5. Enforcement is identical through browser, HTTP and API, takes effect on the next request and records each permission change in audit (ROLE-005).

### Target: Issues

#### ISSUE-016 — Issue templates

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Owners and Admins create, edit and delete workspace templates.

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners and Admins create, edit and delete workspace templates.
2. A team's templates are created, edited and deleted by Owners, Admins and the team's owners, and by all its members while its *Who manages cycles and templates* permission is All team members, the default (ROLE-009).
3. Guests start issues from a team's templates in their invited teams but never create one (role matrix).
4. A template prefills title pattern, Markdown description, status, priority, labels, assignee, estimate, project, custom fields and sub-issues.
5. New issue, the command palette, Slack (SLACK-002), email intake (TRIAGE-005) and request forms (TRIAGE-004) can start from a template; applying one never overwrites fields already typed.
6. Linear and Jira templates are importable where the source export carries them.

#### ISSUE-017 — Reactions

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Members react to issue descriptions and comments with emoji; reactions show who reacted, never notify by default, sync with Slack thread reactions (SLACK-002) and are included in export.

**Acceptance.** Through the native product door and its declared counterpart:
1. Members react to issue descriptions and comments with emoji; reactions show who reacted, never notify by default, sync with Slack thread reactions (SLACK-002) and are included in export.
2. Owners, Admins and Members may react, Guests may react only where they may comment, and Viewers are refused 403 with no write.

#### ISSUE-018 — Description history

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Every saved description revision is kept with author and time, including the single revision each checklist tick writes (ISSUE-025); members can compare any two revisions and restore one, which writes a new revision and activity entry rather than rewriting history.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every saved description revision is kept with author and time, including the single revision each checklist tick writes (ISSUE-025); members can compare any two revisions and restore one, which writes a new revision and activity entry rather than rewriting history.

#### ISSUE-019 — Sub-issue progress

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** A parent issue shows its sub-issues in order with status, assignee and a completed-of-total count; members create, reorder and convert sub-issues inline.

**Acceptance.** Through the native product door and its declared counterpart:
1. A parent issue shows its sub-issues in order with status, assignee and a completed-of-total count; members create, reorder and convert sub-issues inline.
2. An optional team rule completes the parent when every sub-issue completes and reopens it when one reopens, recorded as automation activity.

#### ISSUE-020 — Undo an issue change

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides undo an issue change for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every member action that changes issues — a deletion, a property or status change, a bulk edit (VIEW-004), a move between teams or cycles, a duplicate decision — shows an Undo control for 10 seconds, and Command/Ctrl-Z outside an editable control undoes the member's most recent such action within that window, writing the reversal as a new activity entry under ISSUE-006 version checks (a stale undo shows the conflict and changes nothing).

#### ISSUE-031 — Recently deleted issues and restore

*Tier:* Core · *From:* ISSUE-020 · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** A deleted issue leaves every list, board, search result, Current and My work at once and appears in Settings → Recently deleted (and the team's Recently deleted list) for 30 days with who deleted it and when; members permitted by `issue.can-delete.v1` and its deleter restore it from there or by Undo.

**Acceptance.** Through the native product door and its declared counterpart:
1. A deleted issue leaves every list, board, search result, Current and My work at once and appears in Settings → Recently deleted (and the team's Recently deleted list) for 30 days with who deleted it and when; members permitted by `issue.can-delete.v1` and its deleter restore it from there or by Undo.
2. Restore brings back the same identifier, title, description, every comment and thread, attachment bytes, links, evidence, relations (blocks, related, duplicate, parent and children whose links were not since replaced), followers, labels, project, cycle (if still open, otherwise uncommitted), customer requests and activity, and appends one restore activity entry.
3. During retention, an exact identifier lookup or link answers "deleted — restorable" to members who could see it, source re-delivery returns 410 (INTAKE-002), and webhooks receive one deleted event and, on restore, one restored event.
4. Inherited from ROLE-001: only Owners set the Recently deleted retention; Owners and Admins delete any issue to Recently deleted and restore any, a Member deletes their own issues (any issue in their teams when the setting is on) and restores the issues they deleted, and Guests do neither (role matrix).

#### ISSUE-032 — Issue deletion retention and purge

*Tier:* Core · *From:* ISSUE-020 · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** After 30 days the scheduled purge runs the ISSUE-010 cascade exactly once, after which the identifier answers 404 and is never reused (ISSUE-002).

**Acceptance.** Through the native product door and its declared counterpart:
1. After 30 days the scheduled purge runs the ISSUE-010 cascade exactly once, after which the identifier answers 404 and is never reused (ISSUE-002).
2. The purge only completes a deletion a member started and could undo during retention; it is not automatic deletion under BASE-DATA-002, which holds unchanged: Vector never purges an issue, file or comment that no person deleted.

#### ISSUE-021 — Issue types

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** A team can enable issue types (default Bug, Feature, Task and Epic; renameable, with icons) so an issue has at most one type; a type can carry its own template (ISSUE-016), required custom fields (FIELD-001) and request form (TRIAGE-004), and lists, boards, filters, insights and SLAs (AUTO-004) can use it.

**Acceptance.** Through the native product door and its declared counterpart:
1. A team can enable issue types (default Bug, Feature, Task and Epic; renameable, with icons) so an issue has at most one type; a type can carry its own template (ISSUE-016), required custom fields (FIELD-001) and request form (TRIAGE-004), and lists, boards, filters, insights and SLAs (AUTO-004) can use it.
2. An Epic-type issue can parent other issues (REL-006) and roll up their progress (ISSUE-019).
3. Jira issue types import to types by explicit mapping (DATA-013), and Linear or GitHub issue types import where the source carries them (DATA-012, DATA-014).
4. Turning types off keeps each issue's last type in history.

#### ISSUE-022 — Issue start date

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** An issue has an optional start date, which must be on or before its due date when both are set.

**Acceptance.** Through the native product door and its declared counterpart:
1. An issue has an optional start date, which must be on or before its due date when both are set.
2. It is set in the issue editor, as a list and board property (VIEW-008), by bulk edit (VIEW-004), by dragging on the timeline (VIEW-007) and through the public API; it filters and sorts like the due date, appears in exports (DATA-001) and the API, and each change is an activity entry (ISSUE-007).
3. Jira's Start date field and a GitHub Projects date field mapped to it import onto it (DATA-012, DATA-013).

#### ISSUE-023 — Copy issue

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** From an issue's menu, the command palette (CMD-001) and the public API, anyone who can create issues in a team copies an issue into it. Guests copy only within invited teams. FIELD-001 and ISSUE-014 govern typed or team-scoped mapping; ISSUE-024 governs copying embedded files; ISSUE-012 governs native team moves.

**Acceptance.** Through the native product door and its declared counterpart:
1. From an issue's menu, the command palette (CMD-001) and the public API, anyone who can create issues in a team copies an issue into it.
2. The copy gets a new identifier and the original's title, description, priority, estimate, labels, project, custom-field values; its cycle when it stays in the same team; and, when chosen, copies of its sub-issues and its links.
3. It never copies comments, activity, attachments (except the files embedded in its description, which ISSUE-024 copies so the copy renders them), followers or customer requests, starts in the team's default Backlog status, and both issues record "copied from" / "copied to" in activity.
4. Copying into another team must map statuses, labels and custom-field values for the destination team and report any value it drops.
5. Destination statuses map to the first Backlog status; workspace labels and untyped custom fields and map by identity.
6. Cross-team cycle commitments are omitted and reported.

#### ISSUE-024 — Put files into issue text

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001, BASE-INPUT-003

**Requirement.** Vector provides put files into issue text for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. A member puts a screenshot, photo or screen recording into an issue description, a comment, a template (ISSUE-016) or a document (PROJ-013) by pasting it from the clipboard, dragging and dropping it onto the editor, choosing `/file` or `/image` from the slash menu (ISSUE-026), or pressing Command/Ctrl-Shift-U, one file or several at once (role matrix: anyone who can edit that text).
2. Each file uploads under ISSUE-009 as an attachment of that issue or document — listed in its attachments with uploader and time — while a placeholder with upload progress holds its place at the cursor; on completion the placeholder becomes an embed that references the attachment by ID, and a refused or failed upload (a type or size outside `seed.json → limits`) leaves a visible error in its place and stores nothing.
3. An embed resolves only to an attachment of the same issue or document; copying an issue (ISSUE-023) or starting from a template copies the embedded files into the new issue so it renders them.

#### ISSUE-033 — Inline image display

*Tier:* Core · *From:* ISSUE-024 · *Cites:* BASE-INPUT-001, BASE-ROLE-001, BASE-INPUT-002, BASE-INPUT-003

**Requirement.** Vector provides inline image display for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Images (PNG, JPEG, GIF, WebP) show inline where they were placed with no click to load: at most the editor's width, with their stored intrinsic size reserved so the text does not jump, GIFs animated, and editable alt text; clicking one opens a full-size viewer with zoom, arrow keys through the issue's images, Escape to close, and Download.
2. Inline display applies only to the installation's own uploads of the allow-listed image and video types, referenced by attachment ID.
3. The page shows it through an `<img>` or `<video>` element, which a browser renders without acting on the download disposition, so opening the file's URL directly still downloads it and BASE-INPUT-003 holds unchanged.
4. SVG, HTML and every other type are never shown inline.
5. Every image reference that is not one of the installation's own attachments of the same issue or document — an external URL, another issue's attachment, another origin — is a remote image and keeps BASE-INPUT-002's load-on-request button.
6. A member who cannot see the issue (a Guest outside the team, a non-member of a private team under ROLE-002) gets 404 from the file route, so a copied embed URL reveals nothing.

#### ISSUE-034 — Inline video and resumable upload

*Tier:* Core · *From:* ISSUE-024 · *Cites:* BASE-INPUT-001, BASE-ROLE-001, BASE-INPUT-003

**Requirement.** Vector provides inline video and resumable upload for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Videos (MP4, WebM, MOV) show as an inline player with a poster frame, play, pause, seek, full screen and Download; seeking works because the file route answers HTTP byte ranges requests with 206; a video whose codec the viewer's browser cannot play shows its name, size and Download in place of the player, never a broken element.
2. MP4, WebM and QuickTime video types join the supported attachment type list, and a video may be up to 250 MB, uploaded in resumable parts (R2 multipart) so a dropped connection resumes rather than restarts.

#### ISSUE-035 — Draft files and removed embeds

*Tier:* Core · *From:* ISSUE-024 · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides draft files and removed embeds for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. On a new issue not created, files stage with the member's draft (ISSUE-015) and attach when the issue is created; discarding the draft deletes them; staged files whose draft is gone are listed under Settings → Account → Unattached uploads, where the member attaches or deletes them, and they are never deleted automatically (BASE-DATA-002).
2. Removing an embed from the text keeps the attachment (removing the file is an ISSUE-009 action), and an embed whose attachment was removed shows "File removed"; restoring an older revision (ISSUE-018) that embeds a removed file shows the same marker.

#### ISSUE-036 — Embeds across clients and archives

*Tier:* Core · *From:* ISSUE-024 · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides embeds across clients and archives for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. The same embeds are captured, pasted and shown inline in the mobile apps (MOBILE-001), whose camera and photo picker remove location metadata before upload unless the member keeps it; synced Slack and Teams threads carry them both ways (SLACK-002, TEAMS-001); notification email links the issue and never attaches or hotlinks the file (NOTIFY-006); the API (API-003) returns embeds with their attachment IDs; and the portable export (DATA-001) keeps each embed as an archive-relative reference to the original bytes, so a restore (DATA-005) shows the same images.

#### ISSUE-025 — Checklists

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** A description, comment, template or document can hold checklists: typing `[]` or `- [ ]` at the start of a line, pressing Command/Ctrl-Shift-7, or choosing `/checklist` (ISSUE-026) starts one, and items nest and reorder like list items.

**Acceptance.** Through the native product door and its declared counterpart:
1. A description, comment, template or document can hold checklists: typing `[]` or `- [ ]` at the start of a line, pressing Command/Ctrl-Shift-7, or choosing `/checklist` (ISSUE-026) starts one, and items nest and reorder like list items.
2. They are stored as GitHub-flavored Markdown task-list items (`- [ ]`, `- [x]`), so they pass unchanged through the API, export, copying as Markdown, and imports from GitHub, Linear and Jira descriptions.
3. Items show as checkboxes that can be ticked and unticked in place without entering edit mode — in a description or document by anyone who can edit the issue (role matrix; a Guest in invited teams), in a comment only by its author, as ISSUE-008 limits comment edits; everyone else sees a read-only checkbox.
4. Each tick is one version-checked mutation (ISSUE-006) that writes exactly one description revision (ISSUE-018), attributed to the member, and one activity entry naming the item ("checked 'Repro on iOS'").
5. A tick sent against a stale version applies when that item's text is unchanged in the current version and is otherwise refused 409 with the current text; during a live editing session (SYNC-003) a tick merges like any other edit.
6. An issue whose description has a checklist shows its completed-of-total count ("2/5") as a list and board property (VIEW-008) and in the API; ticking never changes the issue's status by itself.
7. The mobile apps (MOBILE-001) tick items; a synced Slack or Teams comment (SLACK-002) shows a checklist as text (☐ and ☑), and ticks are made in Vector.

#### ISSUE-026 — Editor formatting and slash commands

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides editor formatting and slash commands for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Descriptions, comments, templates and documents share one editor that writes GitHub-flavored Markdown: three heading levels, bold, italic, strikethrough, inline code, links, bulleted, numbered and check lists (ISSUE-025), quotes, dividers, tables (insert, then add and remove rows and columns), collapsible sections, and fenced code blocks with a language picker, copy button and syntax highlighting for at least TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, Ruby, PHP, C, C++, C#, SQL, shell, YAML, JSON, HTML, CSS and diff.
2. Typing `/` opens a slash menu for every block above, `/file` and `/image` (ISSUE-024), mentions (ISSUE-013) and issue links.
3. Markdown shortcuts (`#`, `-`, `1.`, `>`, `---`, three backticks) and keyboard shortcuts (Command/Ctrl-B, -I, -K for a link, -Shift-7 for a checklist, -Shift-8 for a bulleted list, -Shift-U to upload) apply as typed.
4. Pasting rich text from Google Docs, Notion, Confluence or a web page keeps its headings, lists, links, tables and code as Markdown and drops scripts, styles, forms and remote tracking images, because raw HTML is never rendered (BASE-INPUT-002).
5. Pasting a Vector issue URL makes an issue link, and pasting a GitHub pull request, Figma or Loom URL makes a link that previews under its integration (GITHUB-001, DESIGN-001, DOCS-001).
6. The same Markdown shows the same way in the browser, the mobile apps (MOBILE-001) and exports, and as sanitized text in notification email.

#### ISSUE-027 — Issue references and backlinks

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Typing an issue identifier such as `VEC-123` in a description, comment, project update or document (PROJ-013) links it when it names an issue the reader can see, with its title and status on hover; an identifier that names no visible issue stays plain text.

**Acceptance.** Through the native product door and its declared counterpart:
1. Typing an issue identifier such as `VEC-123` in a description, comment, project update or document (PROJ-013) links it when it names an issue the reader can see, with its title and status on hover; an identifier that names no visible issue stays plain text.
2. When a subject first references an issue, the referenced issue gets one activity entry, "Mentioned in VEC-456" (or in the project, update or document), linking back, and later edits of the same subject add none; removing the reference keeps the entry and marks it removed.
3. A reference from an issue in a private team (ROLE-002) shows in the referenced issue's activity only to people who can see the referencing issue.
4. Old identifiers kept by DATA-018 resolve the same way, and the mobile apps (MOBILE-001) link them too.

#### ISSUE-028 — Drafts across devices

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** A new-issue draft and an unsent comment are saved to the member's account as they type and are offered on their other browsers and in the desktop and mobile apps (MOBILE-001, MOBILE-005); a Drafts list shows each open draft with its team and last edit, opens it and discards it.

**Acceptance.** Through the native product door and its declared counterpart:
1. A new-issue draft and an unsent comment are saved to the member's account as they type and are offered on their other browsers and in the desktop and mobile apps (MOBILE-001, MOBILE-005); a Drafts list shows each open draft with its team and last edit, opens it and discards it.
2. A draft stays private to its author — in no list, search result, notification or API response for anyone else — and is removed on every device once it is submitted or discarded on one; when two devices edit one draft, the later save wins and the other device shows the newer text before its next save.
3. Suspension keeps a member's drafts hidden and erasure deletes them (ROLE-011, ROLE-012).
4. ISSUE-015's in-browser restore still applies while a device is offline.

### Custom fields

#### FIELD-001 — Custom field definitions

*Tier:* Core

**Requirement.** Vector provides custom field definitions for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners and Admins define workspace custom fields, and a team's owners — or all its members while its *Who manages team settings* permission is All team members (ROLE-009) — define fields for that team (role matrix, ROLE-001), each with a name unique in its scope, an optional description and one type: text, number (with optional unit and decimals), single-select, multi-select (options with colors, reorderable, archivable), date, person (a workspace member), URL or checkbox.
2. A field applies to issues, projects or both, can be required for chosen issue types (ISSUE-021) or templates, and can be restricted to chosen teams.
3. An issue or project shows its applicable fields in the detail pane; values are validated by type on every door (browser, the public API, import, Slack forms, automation), and every change is an activity entry (ISSUE-007) with the previous and new value.
4. Renaming a field or option changes no stored value; archiving an option keeps it on issues that have it but removes it from pickers; deleting a field (Owners and Admins only) removes its values after a confirmation that counts affected issues and is recorded in the audit log.
5. PROJ-001 inherits project custom-field definitions, typed values, validation on every door and per-value project activity before project fields ship.

#### FIELD-002 — Custom fields in views, search, API and imports

*Tier:* Core

**Requirement.** Vector provides custom fields in views, search, api and imports for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every custom field is available as a list column, a board card property (VIEW-008), a filter with type-appropriate operators (text contains, number ranges, select is / is not / any of, date ranges, person is me, checkbox), a group-by for single-select, person and checkbox fields, and a sort; it is searchable (SEARCH-004), included in exports (DATA-001, REPORT-005), webhooks (WEBHOOK-002) and the API (API-003) with its definition, and usable in automation conditions and actions (AUTO-002).
2. Imports map source fields onto custom fields with an explicit mapping and create missing select options only after review: GitHub Projects single-select, iteration, number, text and date fields (DATA-012), Jira custom fields of select, multi-select, number, text, date, user and URL types (DATA-013), and Linear custom properties where present (DATA-014); unmappable types and values are reported as omissions (DATA-007).
3. PROJ-001 inherits project custom-field columns, filters, search, API, exports and reviewed import mapping before those project capabilities ship.

### Target: Relations

#### REL-007 — Related issues

*Tier:* Core · *Cites:* BASE-INPUT-001

**Requirement.** Members can mark two issues as related across teams, with no blocking effect; the link shows on both issues, survives team moves, imports from Jira "Relates" and Linear "related" links when both issues are in the same migration (DATA-017), and is removed when either issue is deleted.

**Acceptance.** Through the native product door and its declared counterpart:
1. Members can mark two issues as related across teams, with no blocking effect; the link shows on both issues, survives team moves, imports from Jira "Relates" and Linear "related" links when both issues are in the same migration (DATA-017), and is removed when either issue is deleted.

### Target: Intake and triage

#### TRIAGE-001 — Triage responsibility

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Each team names who triages (set under its *Who manages team settings* permission, ROLE-009): a fixed person, a weekly rotation, or the current on-call person from Oncall or PagerDuty.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each team names who triages (set under its *Who manages team settings* permission, ROLE-009): a fixed person, a weekly rotation, or the current on-call person from Oncall or PagerDuty.
2. The responsible person is notified of each new triage item (NOTIFY-007), sees a triage count in navigation, and hands over at rotation time with untouched items listed.
3. Inherited from NOTIFY-001: a new triage item for the responsible person notifies once in the inbox, never the actor; the receiving journey verifies this for that event.

#### TRIAGE-002 — Triage routing rules

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Owners and Admins define workspace-wide routing rules, and a team's rules are defined by its team owners or, while its *Who manages team settings* permission is All team members (ROLE-009), by all its members; Guests never do (role matrix).

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners and Admins define workspace-wide routing rules, and a team's rules are defined by its team owners or, while its *Who manages team settings* permission is All team members (ROLE-009), by all its members; Guests never do (role matrix).
2. Rules are ordered, read intake properties (source, label, customer tier, text match, form field) and set team, labels, priority, assignee or template, or send straight to Backlog for trusted sources.
3. Every routed item records which rule acted; a rule never declines or deletes.

#### TRIAGE-003 — Agent triage suggestions

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001 · *Rules:* D-2

**Requirement.** When an item enters triage, a triage agent proposes likely duplicates and related issues (by meaning, not only words), team, assignee, labels and priority, each with a one-line reason and the records it compared.

**Acceptance.** Through the native product door and its declared counterpart:
1. When an item enters triage, a triage agent proposes likely duplicates and related issues (by meaning, not only words), team, assignee, labels and priority, each with a one-line reason and the records it compared.
2. The company's policy for the standard class decides whether a triage suggestion is applied or held; in the held run the triager accepts, edits or dismisses each suggestion, including accepting all in one action.
3. Acceptance and dismissal rates are reported per team so the policy can be tuned.
4. Declining, merging and closing are classified by their actual effects, and the company's policy decides each call.
5. Inherited from INTAKE-004: an agent assertion names the model, the records it read and when, is handled under the company's policy for its class, and the triage journey shows its provenance and applies it according to that policy.
6. Inherited from ROLE-001: Owners and Admins, and Members in the member's teams, accept, edit or dismiss an agent's suggestion; Guests are refused (role matrix).

#### TRIAGE-004 — Request forms

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Owners, Admins and a team's owners — or all its members while its *Who manages team settings* permission is All team members (ROLE-009) — publish structured request forms for that team (bug report, feature request, access request) with required fields, help text and a template (ISSUE-016).

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners, Admins and a team's owners — or all its members while its *Who manages team settings* permission is All team members (ROLE-009) — publish structured request forms for that team (bug report, feature request, access request) with required fields, help text and a template (ISSUE-016).
2. Forms are available in the app, in Slack and Teams (SLACK-002, TEAMS-001) and through the public API; anyone who can create issues in the team, including a Guest in an invited team, can submit one, and each submission becomes a triage item with its answers as structured fields.
3. A form can include a Customer field, prefilled for a submitter whose email domain maps to a customer (CUST-006), and the submission then carries that customer's request (CUST-008).

#### TRIAGE-005 — Email intake

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides email intake for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each team can enable a private intake address (under its *Who manages team settings* permission, ROLE-009); mail forwarded from Gmail, Outlook or a shared inbox becomes a triage item with the sender, subject, body, inline images and attachments (within BASELINE file limits), threading later replies as comments and refusing senders outside an allow-list.
2. Mail is received through Cloudflare Email Routing or a SendGrid Inbound Parse webhook.
3. The sender needs no seat: they are recorded as the item's requester (and as a contact of the customer their domain maps to under CUST-006, which records the mail as that customer's request) and get no sign-in.
4. A team member replies to them by posting a comment marked "Reply by email" (role matrix): Vector sends it once from the team's intake address through the declared transactional-email external (SendGrid), to the sender and the addresses the original mail copied, with `In-Reply-To` and `References` naming the original message so it lands in the sender's existing mail thread, embedded images attached to the mail rather than linked, and shows the delivery outcome (accepted or bounced) on the comment; the sender's answer threads back as a reply in that comment's thread, so the conversation continues over email.
5. Internal comments, other fields and status never leave Vector, and an optional team setting sends the sender one acknowledgment with the identifier.

### Customer requests

#### CUST-001 — Customer requests on issues

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides customer requests on issues for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. An issue's Customers section lists each customer (CUST-005) who asked for it, with every request: its source and link — a manual request (CUST-008), a Penny request, a HappyToHelp conversation, a Zendesk, Intercom or Front ticket, a Salesforce or HubSpot opportunity, an Orbit account, a Gong call excerpt, a Slack message (SLACK-002), an intake email (TRIAGE-005) or a Spool error — the requester, and the requester's own words, with the customer's tier, status and annual revenue in USD from the customer record, whether entered by hand or synced from a linked source.
2. Each request is attached to a customer by the identity rule of CUST-006, and one customer is counted once per issue however many requests or requesters link it.
3. Requests move with duplicates (REL-003) and survive merges of issues and of customers (CUST-006).
4. Owners, Admins and Members see customers and requests; Guests see neither (role matrix).

#### CUST-002 — Customer-weighted planning

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Issue lists, projects and the roadmap can filter, sort and group by requesting-customer count, total revenue of the requesting customers (CUST-005, each customer counted once per issue or project), customer tier and newest request, and show these as columns; a saved view such as "Most-requested bugs from Enterprise" is shareable.

**Acceptance.** Through the native product door and its declared counterpart:
1. Issue lists, projects and the roadmap can filter, sort and group by requesting-customer count, total revenue of the requesting customers (CUST-005, each customer counted once per issue or project), customer tier and newest request, and show these as columns; a saved view such as "Most-requested bugs from Enterprise" is shareable.

#### CUST-003 — Close the loop with requesters

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** When an issue with customer requests completes, ships in a release (RELEASE-001) or is verified (PUSH-004), Vector notifies each linked source: it marks Penny requests shipped with the release, adds an internal note to the HappyToHelp, Zendesk, Intercom or Front ticket, and offers the support owner a drafted customer reply (PUSH-005).

**Acceptance.** Through the native product door and its declared counterpart:
1. When an issue with customer requests completes, ships in a release (RELEASE-001) or is verified (PUSH-004), Vector notifies each linked source: it marks Penny requests shipped with the release, adds an internal note to the HappyToHelp, Zendesk, Intercom or Front ticket, and offers the support owner a drafted customer reply (PUSH-005).
2. A customer-visible message carries external; the company's policy decides an agent's send, including approval where that policy asks for it.

#### CUST-004 — Penny keeps the board

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector never hosts a public feedback board, voting portal, public roadmap or public changelog; it links to Penny for those, and a Penny request linked to an issue keeps Penny as its source of truth for the customer's text, votes and status.

**Acceptance.** Through the native product door and its declared counterpart:
1. Vector never hosts a public feedback board, voting portal, public roadmap or public changelog; it links to Penny for those, and a Penny request linked to an issue keeps Penny as its source of truth for the customer's text, votes and status.

#### CUST-005 — Customer records

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides customer records for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. A customer is a record of the workspace with a name, one or more domains (each belonging to at most one customer), a logo (uploaded, or taken from a linked source), an owner who is a workspace member, a status and a tier chosen from ordered, colored select values the workspace defines (defaults: status Active, Trial and Churned; tier Enterprise, Growth and Starter), a size (employee count), annual revenue in whole US dollars, the external account IDs of linked sources (CUST-006), contacts (name and email, gathered from requests or added by hand), and values for workspace custom fields that apply to customers (FIELD-001).
2. Owners, Admins and Members create a customer by hand — from the command palette's Create new customer, the Customers list (CUST-007) or inline while adding a request (CUST-008) — and edit its fields; Owners and Admins define the status and tier values and merge or delete customers (role matrix).
3. An Owner or Admin can map chosen fields — owner, revenue, size, status and tier — to fields of a linked Salesforce, HubSpot, Orbit, Zendesk, Intercom, Front or HappyToHelp account; a mapped field shows "Synced from" its source with the last sync time, is read-only in Vector while mapped, and returns to manual entry, keeping its last value, when the mapping is removed.
4. Every change is a customer activity entry.
5. Customers and their requests are in the portable export (DATA-001) and restore exactly (DATA-005), are served by the public API (API-003) and webhooks (WEBHOOK-002), and Linear customers with their domains, owners, statuses, tiers, sizes, revenue and requests import through DATA-014.
6. A customer record is internal and never sent to the customer.

#### CUST-006 — Customer identity and merging

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides customer identity and merging for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every request from a linked source, Slack (SLACK-002), email intake (TRIAGE-005) or a request form (TRIAGE-004) is attached to a customer by one rule, in this order: (1) the source's account ID where the source has one — an Orbit account, Salesforce Account, HubSpot company, Zendesk organization, Intercom company, Front account or HappyToHelp organization ID — matching an external ID stored on a customer; (2) otherwise the requester's email domain, lower-cased, matching one of a customer's domains exactly or as a subdomain of it (`eu.acme.example` matches `acme.example`), with a Slack author's email read through `users.info` under the `users:read.email` scope; (3) otherwise, while the workspace setting Create customers from new company domains is on (the default), a new customer named after the domain, holding that domain and the source's account ID.
2. Free-mail and consumer domains never match or create a customer — a maintained list covering at least gmail.com, googlemail.com, outlook.com, hotmail.com, live.com, msn.com, yahoo.com, icloud.com, me.com, aol.com, proton.me, protonmail.com, gmx.com and zoho.com — and neither does any domain on the Admin's block list (for example the workspace's own domain or a reseller's); such a request keeps its requester as a contact under No customer, and a member can assign it to a customer by hand.
3. A request whose rule-1 ID and rule-2 domain point at different customers attaches by the ID and is flagged for review.
4. Owners and Admins merge two customers in one action after a counts preview: every request, domain, external ID, contact and favorite moves to the surviving customer, the actor chooses each conflicting field's value, every issue and project still counts the survivor once (CUST-001), the merged customer's page and API ID redirect to the survivor, and one audit entry records it.
5. Inherited from ROLE-001: only Owners and Admins define customer status and tier values, map customer fields, set the domain block list and new-domain setting, and merge or delete customers (role matrix).

#### CUST-007 — Customers list and customer pages

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides customers list and customer pages for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. A Customers list, opened from the sidebar, the palette or the shortcut G then Q, shows every customer with name, logo, domains, owner, status, tier, size, revenue, request count, open-issue count and newest request, and sorts and filters by revenue, tier, status, owner, size, request count and newest request, with the same save, share and display model as issue views (VIEW-002, VIEW-009).
2. Customers can be favorited (VIEW-010), opened from the palette (CMD-001) and found by name and domain in search (SEARCH-001).
3. A customer page shows its fields (CUST-005), contacts and activity, every request with the requester's words, source, date and linked issue or project, and the issues and projects it asked for grouped by status, with totals; for a request on an issue in a private team (ROLE-002), a non-member sees only that a request exists, never the issue's title.
4. The list and the page have a 390px layout and appear in the mobile apps (MOBILE-001).

#### CUST-008 — Adding customer requests by hand

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides adding customer requests by hand for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners, Admins and Members add a request to an issue or a project from its Customers section, from a customer page, from the palette (Add customer request) or with the shortcut Control-R (Alt-Shift-R on Windows and Linux): they pick a customer or create one inline (CUST-005), paste or write the requester's words (required, Markdown), and may name a contact by name and email and add a source link (a call recording, a Gong or Zoom link, a document).
2. The request is attributed to the member who added it, is an activity entry on the issue or project and on the customer, can be edited by its author, moved to another issue or project, and deleted by its author or an Owner or Admin (role matrix).
3. A project's Customers section lists its own requests and its issues' requests, each customer counted once.
4. When a member files an issue from a Slack message (SLACK-002), the dialog offers a Customer picker prefilled by CUST-006 from the message author's email domain, and the message becomes that customer's request in the author's words; a request form (TRIAGE-004) can include a Customer field; and an intake email (TRIAGE-005) becomes a request of the customer its sender's domain maps to.
5. Manual requests count everywhere CUST-001 and CUST-002 do.

### Target: My work

#### WORK-004 — Created, Subscribed and Activity tabs

*Tier:* Core

**Requirement.** Beside the assigned queue of WORK-001, My work has three tabs: Created (every issue the member created, newest first), Subscribed (every issue the member follows, NOTIFY-001, with an Unfollow action on each row) and Activity (the member's own recent changes and comments, newest first, each linking to its issue).

**Acceptance.** Through the native product door and its declared counterpart:
1. Beside the assigned queue of WORK-001, My work has three tabs: Created (every issue the member created, newest first), Subscribed (every issue the member follows, NOTIFY-001, with an Unfollow action on each row) and Activity (the member's own recent changes and comments, newest first, each linking to its issue).
2. Created and Subscribed take the same filters and display options as issue views and can be saved as views (VIEW-002); every tab applies OPS-001 and ROLE-002, has a 390px layout and appears in the mobile apps (MOBILE-001).
3. ROLE-002 inherits private-team narrowing and its lost-access acceptance cell for private teams; MOBILE-001 inherits the mobile-app tabs journey.

### Target: Projects, initiatives and roadmaps

#### PROJ-010 — Project updates

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** The project's lead and members (PROJ-014), Owners and Admins post dated updates (Guests cannot, role matrix) with a status of On track, At risk or Off track and a Markdown body; Vector prefills the draft with computed health (PROJ-005), progress since the last update, completed and newly added scope, and slipped milestones.

**Acceptance.** Through the native product door and its declared counterpart:
1. The project's lead and members (PROJ-014), Owners and Admins post dated updates (Guests cannot, role matrix) with a status of On track, At risk or Off track and a Markdown body; Vector prefills the draft with computed health (PROJ-005), progress since the last update, completed and newly added scope, and slipped milestones.
2. Updates appear in the project, roll up into initiatives (INIT-002), notify project followers, and post to the project's Slack or Teams channel (SLACK-003, SLACK-007).
3. Leads are reminded on the project's cadence (AUTO-005).
4. Computed health and the lead's stated status are shown side by side, never merged.
5. Inherited from NOTIFY-001: a followed project or initiative update notifies once in the inbox, never the actor; the receiving journey verifies this for that event.
6. Inherited from SLACK-003, SLACK-007: each project update posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.

#### PROJ-011 — Milestones

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** A project has ordered milestones with names, optional target dates and descriptions; issues belong to at most one milestone of their own project. Source import mapping belongs to DATA-013 and DATA-014, milestone grouping to VIEW-008, public API operations to API-003 and feed events to CAL-001.

**Acceptance.** Through the native product door and its declared counterpart:
1. A project has ordered milestones with names, optional target dates and descriptions; issues belong to at most one milestone of their own project.
2. Members create, edit, reorder, complete, reopen and delete milestones on the project page.
3. A milestone shows count-based progress by PROJ-004 (Canceled and Duplicate excluded).
4. It slips when its target date is before in the workspace timezone and it has open countable issues, including when the milestone itself was marked complete.
5. Changing an issue's milestone records one activity entry under ISSUE-007; leaving its project clears the milestone in that same issue change.
6. Copy, persisted Undo, bulk project changes, deletion preimages and native archive restore carry the assignment; deleting a milestone keeps its issues and clears their assignment.

#### PROJ-012 — Project templates

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Owners and Admins save a project as a workspace template, and a team's own project templates are saved by its team owners or, while its *Who manages cycles and templates* permission is All team members (ROLE-009), by all its members; Guests never do (role matrix). Team templates are visible only to their members; deletion preserves already-created projects. Member applications skip unavailable project labels and report their names. An interrupted sequential application identifies the partial project for inspection before retry. This carries RL-4.

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners and Admins save a project as a workspace template, and a team's own project templates are saved by its team owners or, while its *Who manages cycles and templates* permission is All team members (ROLE-009), by all its members; Guests never do (role matrix).
2. A template holds description, milestones, labels, default issues and update cadence, and anyone who can create projects creates new projects from it with relative dates.

#### PROJ-013 — Project documents and specs

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Projects, issues, initiatives (INIT-001) and teams can hold Markdown documents (specs, PRDs, decision records, team handbooks and runbooks) written in the ISSUE-026 editor, with inline images and video (ISSUE-033, ISSUE-034), checklists (ISSUE-025), revision history, mentions, comments, attachments and search; a spec document can be linked as an issue's specification (PUSH-001).

**Acceptance.** Through the native product door and its declared counterpart:
1. Projects, issues, initiatives (INIT-001) and teams can hold Markdown documents (specs, PRDs, decision records, team handbooks and runbooks) written in the ISSUE-026 editor, with inline images and video (ISSUE-033, ISSUE-034), checklists (ISSUE-025), revision history, mentions, comments, attachments and search; a spec document can be linked as an issue's specification (PUSH-001).
2. A team's documents are listed on the team's page and an initiative's on the initiative; a document under a private team (ROLE-002) is visible only to its members.
3. Documents export with their project, issue, initiative or team.
4. Inherited from ROLE-001: Owners, Admins and Members write, edit and comment on documents under what they can see, and Guests only under invited teams' issues and projects (role matrix); this clause's journey checks those cells.
5. Inherited from SLACK-005: a Vector document link pasted in Slack unfurls with the document's identifier and title (a document has no status, assignee or priority) only for linked members allowed to see that document; others, including a linked member who cannot see a private team's document, see the link alone.

#### PROJ-014 — Project members and teams

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** A project lists its lead, members and contributing teams; members follow it, appear in its filters, and receive its updates.

**Acceptance.** Through the native product door and its declared counterpart:
1. A project lists its lead, members and contributing teams; members follow it, appear in its filters, and receive its updates.
2. Projects can span teams, and a team's project list shows every project with that team's issues.
3. PROJ-001 inherits choosing and changing a primary team, defaulting to the lead's first contributing team, with explicit same-category status mapping under PROJ-016, PROJ-046 before primary teams ship.
4. Inherited from ROLE-007: a project's contributing teams follow team membership; Owners, Admins and Members edit its members and contributing teams, Guests never (role matrix).

#### PROJ-015 — Project dependencies

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** A project can be marked *blocked by* or *blocking* another project directly, from the project page, the projects list, the roadmap timeline (INIT-003) and the public API, independently of issue dependencies; a project cannot block itself and a dependency that would close a cycle is refused.

**Acceptance.** Through the native product door and its declared counterpart:
1. A project can be marked *blocked by* or *blocking* another project directly, from the project page, the projects list, the roadmap timeline (INIT-003) and the public API, independently of issue dependencies; a project cannot block itself and a dependency that would close a cycle is refused.
2. The timeline draws direct dependencies as solid connectors and those derived from issue dependencies (an issue in one project blocks an issue in another) as dashed ones, and flags both projects when the blocked project starts before the blocking project's target date.
3. Each change is a project activity entry and notifies both leads (NOTIFY-001); Linear project dependencies import onto it (DATA-014).
4. Inherited from ROLE-001: Owners, Admins and Members set or remove project dependencies; Guests are refused (role matrix).

#### PROJ-016 — Define project status categories

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Project statuses are named, ordered, colored values, each with an optional description, inside six fixed categories in this order: Backlog, Planned, Started, Paused, Completed and Canceled.

**Acceptance.** Through the native product door and its declared counterpart:
1. Project statuses are named, ordered, colored values, each with an optional description, inside six fixed categories in this order: Backlog, Planned, Started, Paused, Completed and Canceled.
2. The workspace set's defaults are Backlog, Planned, In Progress (Started), Paused, Completed and Canceled; an installation upgraded from the fixed four-value lifecycle names its Started default Active and maps every existing project onto the default of its category, so no project's displayed status changes.
3. Owners and Admins add, rename, recolor, describe and reorder workspace statuses within a category (for example Idea and Discovery in Backlog); a status never changes category, and every category keeps at least one status.
4. Removing a status requires a destination status in the same category and atomically moves every project to it, as TEAM-004 does for issue statuses, recording the mapping in the audit log.

#### PROJ-046 — Team project status mapping

*Tier:* Core · *From:* PROJ-016 · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Vector provides team project status mapping for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. A team can instead use its own project status set, managed under its *Who manages team settings* permission (ROLE-009); a project uses the set of its primary team (chosen on the project, defaulting to the lead's first contributing team, PROJ-014) or the workspace set when that team has none, and changing the primary team to one with another set maps the project's status, in an explicit step, to the first status of the same category.
2. Categories drive behavior everywhere: health is computed only for Started projects (PROJ-005); a Paused project shows as paused, with no health, no slip and no update reminder (AUTO-005), and keeps its dates; portfolio counts and filters (PROJ-007) offer both status and category; the roadmap timeline styles bars by category and draws Paused bars hatched with a pause marker (INIT-003); and initiative roll-ups and leadership digests count projects by category and never report a Paused project as slipping (INIT-002, INIT-004).
3. Linear project statuses, with their names, colors and types (`backlog`, `planned`, `started`, `paused`, `completed`, `canceled`), import onto statuses of the matching category through DATA-014 after an explicit mapping step that proposes matches by name and creates the missing statuses, and Jira epics imported as projects map by status category (DATA-013).

#### PROJ-017 — Recoverable project deletion

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ROLE-001

**Requirement.** Mirroring ISSUE-031, ISSUE-032, a confirmed project deletion removes it from active lists, search and roadmaps and places it in Recently deleted projects for 30 days with actor and time; the deleting session gets Undo for 10 seconds, including Command/Ctrl-Z outside editable controls.

**Acceptance.** Through the native product door and its declared counterpart:
1. Mirroring ISSUE-031, ISSUE-032, a confirmed project deletion removes it from active lists, search and roadmaps and places it in Recently deleted projects for 30 days with actor and time; the deleting session gets Undo for 10 seconds, including Command/Ctrl-Z outside editable controls.
2. Restore through Undo or Recently deleted keeps the same project ID, fields, milestones, updates, documents, relations and history, and reattaches surviving issues only where their membership has not since been replaced; issues are never deleted (PROJ-003).
3. Restore is version-checked, refuses stale Undo without writes and records one restore activity entry.
4. Owners/Admins delete or restore any project; after this recoverable flow ships the project's Member lead may delete it and restore their own deletion.
5. Until then deletion remains Owner/Admin only because it is irreversible.
6. Guests and Viewers never delete or restore.
7. Only Owners/Admins delete permanently before retention ends; the scheduled purge completes a person-started deletion once after retention, never deletes its issues, and leaves an opaque audit reference.
8. Owners alone configure retention from 7 to 90 days, default 30, as for ISSUE-031, ISSUE-032.

#### INIT-001 — Initiatives

*Tier:* Core

**Requirement.** An initiative groups projects (and sub-initiatives up to three levels) under an owner, description, target date and status (Planned, Active, Completed), across teams.

**Acceptance.** Through the native product door and its declared counterpart:
1. An initiative groups projects (and sub-initiatives up to three levels) under an owner, description, target date and status (Planned, Active, Completed), across teams.
2. A project can belong to several initiatives.
3. Owners, Admins and Members create and edit initiatives and add projects to them; Guests cannot (role matrix).
4. Inherited from SLACK-003, SLACK-007: initiatives bind chosen events to a Slack or Discord channel and each event posts to its bound channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the binding and bound post.

#### INIT-002 — Initiative roll-up

*Tier:* Core

**Requirement.** Vector provides initiative roll-up for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. An initiative shows each project's latest update status, computed health, progress, target date and slip since the last update, and its own owner-written updates on a cadence; a Paused project (PROJ-016) shows as paused with no health and no slip, and the roll-up counts its projects by status category; the initiatives list sorts and filters by these for leadership.

#### INIT-003 — Roadmap timeline

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001

**Requirement.** A roadmap view shows initiatives and projects on a timeline by their start and target dates (PROJ-001) with milestones, dependencies between projects (set directly under PROJ-015, and derived from issue dependencies), marker and zoom by week, month and quarter.

**Acceptance.** Through the native product door and its declared counterpart:
1. A roadmap view shows initiatives and projects on a timeline by their start and target dates (PROJ-001) with milestones, dependencies between projects (set directly under PROJ-015, and derived from issue dependencies), marker and zoom by week, month and quarter.
2. Bars are styled by project status category (PROJ-016): a Paused project's bar is hatched with a pause marker and is never flagged as slipping.
3. Placement is fixed for every combination of dates: a project with both dates is a bar from start to target; one with only a target date is a diamond on its target date; one with only a start date is a bar from its start to (or to the start date when that is in the future) with an open, faded end; one with neither is listed in an Unscheduled group beside the timeline, never drawn at an invented date.
4. An initiative spans the earliest start to the latest target of its projects, or shows its own target date as a diamond when none of them has dates.
5. Leads drag a bar's body to move both dates, drag either end to change one date, and drag an Unscheduled project onto the timeline to set both; each drag is recorded as a project change.
6. The view is keyboard-operable (arrow keys move a focused bar by one zoom unit) and has a list equivalent at 390px.
7. The timeline inherits VIEW-011: it follows the member's Light, Dark or System theme, bars by status category, the Paused hatch, connectors and the marker stay distinguishable in both, and its text and marks meet WCAG 2.2 AA contrast in both.
8. PROJ-001 inherits editing project start/target dates, priority and labels on the roadmap, with one activity entry per change, before the roadmap ships.

#### INIT-004 — Leadership digest

*Tier:* Core

**Requirement.** Owners of initiatives and anyone subscribed receive a weekly digest by email, Slack or Teams of initiative and project status, slipped dates, new risks and shipped milestones (a Paused project is reported as paused, never as slipped, PROJ-016), linking back to the source records and respecting ROLE-002.

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners of initiatives and anyone subscribed receive a weekly digest by email, Slack or Teams of initiative and project status, slipped dates, new risks and shipped milestones (a Paused project is reported as paused, never as slipped, PROJ-016), linking back to the source records and respecting ROLE-002.

### Target: Cycles

#### CYCLE-007 — Automatic cycle schedule

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** Owners, Admins and the team's owners set a team's cycle cadence, and so do all its members while its *Who manages cycles and templates* permission is All team members.

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners, Admins and the team's owners set a team's cycle cadence, and so do all its members while its *Who manages cycles and templates* permission is All team members.
2. The cadence comprises a duration of one to eight weeks, a start weekday, optional cooldown between cycles and the number of upcoming cycles to keep; Vector creates future cycles on schedule so rollover (CYCLE-004) always has a next cycle, and records each creation as automation.
3. Changing the cadence affects only cycles not started.

#### CYCLE-008 — Automatic cycle membership

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** A team can choose to add issues to the active cycle when they move to Started, and when they complete without a cycle, so the cycle reflects real work; each addition is recorded as an automation change.

**Acceptance.** Through the native product door and its declared counterpart:
1. A team can choose to add issues to the active cycle when they move to Started, and when they complete without a cycle, so the cycle reflects real work; each addition is recorded as an automation change.

### Releases and deployments

#### RELEASE-001 — Releases

*Tier:* Core

**Requirement.** Vector provides releases for the permitted workspace actors, with the records, outcomes and refusals below. A Released release is reopened before its scope is edited. This carries RL-5.

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners, Admins and Members define team or workspace releases (versions) — a Member a team's releases only for teams they can see, and Guests none (role matrix) — each with name, target date, status (Planned, In progress, Released) and description; issues and projects join a release; a release page shows scope, progress, blockers and linked PRs, and can be shared read-only inside the workspace.
2. Jira fix versions import as releases.
3. Inherited from SLACK-003, SLACK-007: a release posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.

#### RELEASE-002 — Deployment tracking

*Tier:* Core

**Requirement.** Vector receives deployment events from GitHub Deployments, GitLab environments, CircleCI, Vercel, Netlify and Cloudflare Workers/Pages through signed webhooks or the API, and attaches to each issue whose merged commits are included which environments it has reached (for example staging, production) and when.

**Acceptance.** Through the native product door and its declared counterpart:
1. Vector receives deployment events from GitHub Deployments, GitLab environments, CircleCI, Vercel, Netlify and Cloudflare Workers/Pages through signed webhooks or the API, and attaches to each issue whose merged commits are included which environments it has reached (for example staging, production) and when.
2. A team rule can move an issue to a chosen status on production deploy.

#### RELEASE-003 — Release notes

*Tier:* Core

**Requirement.** For a release or a date range, Vector drafts internal release notes from completed issues grouped by label or project, using each issue's title and an optional "release note" field, which the release owner edits and publishes to the workspace, Slack, or hands to Penny as a changelog draft.

**Acceptance.** Through the native product door and its declared counterpart:
1. For a release or a date range, Vector drafts internal release notes from completed issues grouped by label or project, using each issue's title and an optional "release note" field, which the release owner edits and publishes to the workspace, Slack, or hands to Penny as a changelog draft.
2. Inherited from SLACK-003, SLACK-007: publishing release notes posts the release event to its bound Slack or Discord channel once, without duplicating RELEASE-001’s post; its acceptance journey verifies the bound post.

### Target: Search, views and commands

#### SEARCH-004 — Advanced filters

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Vector provides advanced filters for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Filters combine with AND/OR groups and negation over every issue field, custom field (FIELD-002), relation, customer request (CUST-002), Git state (GITHUB-005), release, milestone and date expressions ("due before next Friday", "updated in the last 7 days"); a typed filter bar accepts the same expressions with autocomplete, and any filter can be saved as a view.
2. Jira JQL in imported saved filters is translated where every term maps and reported otherwise.

#### SEARCH-005 — Meaning-based search

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Search also returns issues, documents and comments that match the meaning of a query, labeled as semantic matches and ranked after exact identifier and full-text hits, under the same access rules.

**Acceptance.** Through the native product door and its declared counterpart:
1. Search also returns issues, documents and comments that match the meaning of a query, labeled as semantic matches and ranked after exact identifier and full-text hits, under the same access rules.

#### VIEW-006 — Manual order

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Besides the derived orders, lists and boards offer a Manual order that members set by dragging or keyboard (move up, move down, move to top); the order is shared per team and view, imported from Jira rank and Linear sort order, and never changes Current's derived ranking (CURR-007).

**Acceptance.** Through the native product door and its declared counterpart:
1. Besides the derived orders, lists and boards offer a Manual order that members set by dragging or keyboard (move up, move down, move to top); the order is shared per team and view, imported from Jira rank and Linear sort order, and never changes Current's derived ranking (CURR-007).

#### VIEW-007 — Timeline and calendar views

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Vector provides timeline and calendar views for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Issue lists can be shown as a timeline (by the issue start date (ISSUE-022) and the due date, with dependencies drawn; an issue with only a due date is a diamond, one with only a start date is open-ended to, and one with neither is listed as Unscheduled beside the timeline) and as a month calendar of due dates, cycles and milestones; dragging changes dates through the version-checked mutation.

#### VIEW-008 — Display options

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Vector provides display options for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Members choose the properties shown on rows and cards, show sub-issues nested or flat, group lists and add board swimlanes by assignee, project, priority, cycle, label (one label group at a time, ISSUE-014), project milestone (PROJ-011), parent issue (REL-006) or a single-select or person custom field (FIELD-002), and drag cards between columns and lanes (the labeled selector of VIEW-005 remains the keyboard path).
2. Display options save with a view.
3. VIEW-008 inherits PROJ-011's milestone grouping in saved views.

#### VIEW-009 — Workspace-wide views

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Views can span all teams the member can see, and also exist for projects, initiatives, releases, customers (CUST-007) and customer requests with the same filter, sort, group and save model.

**Acceptance.** Through the native product door and its declared counterpart:
1. Views can span all teams the member can see, and also exist for projects, initiatives, releases, customers (CUST-007) and customer requests with the same filter, sort, group and save model.

#### VIEW-010 — Sidebar favorites

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Vector provides sidebar favorites for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Members pin issues, projects, initiatives, cycles, releases, documents, customers (CUST-007), saved views and teams to a Favorites section of the sidebar, reorder them by drag or keyboard, group them in named folders, and see each favorite's unread or count badge; favorites are per member, sync across browsers and the mobile apps (MOBILE-001), and a favorite whose subject is deleted or becomes invisible (ROLE-002) disappears without revealing its title.

#### VIEW-011 — Light, dark and system themes

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-ROLE-001

**Requirement.** Each member chooses Light, Dark or System under Settings → Appearance; System, the default, follows the device's the device color-scheme preference and switches live when it changes.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each member chooses Light, Dark or System under Settings → Appearance; System, the default, follows the device's the device color-scheme preference and switches live when it changes.
2. The choice is stored per member on the installation, so every browser the member signs in to applies it, and the server renders it on the document so it applies before first paint, without a script and with no flash of the other theme.
3. status, priority, label, project-status and health colors and code highlighting (ISSUE-026) stay distinguishable in both.
4. Signed-out pages, sign-in and the public homepage (HOME-001) keep the light palette and are unchanged.
5. Charts (REPORT-001), the roadmap timeline (INIT-003) and the desktop and mobile apps (MOBILE-001, MOBILE-005) inherit this choice and its contrast rule for those capabilities.

#### CMD-004 — Keyboard-first editing

*Tier:* Core

**Requirement.** Every issue property has a single-key shortcut on a focused or selected issue (S status, A assignee, P priority, L labels, E estimate, D due date, M move team, Shift-D duplicate decision, Command/Ctrl-. copy branch name), shortcuts work on multiple selected issues, and a shortcut help sheet (?) lists them.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every issue property has a single-key shortcut on a focused or selected issue (S status, A assignee, P priority, L labels, E estimate, D due date, M move team, Shift-D duplicate decision, Command/Ctrl-. copy branch name), shortcuts work on multiple selected issues, and a shortcut help sheet (?) lists them.

### Speed, real time and mobile

#### SYNC-001 — Real-time sync

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Changes by any member, automation, integration or agent appear in every open view of every other member within one second (p95, measured) without a reload, through a live connection (Cloudflare Durable Objects WebSocket) scoped to what each member may see; the five-second CURR-008 window remains the worst case after a dropped connection.

**Acceptance.** Through the native product door and its declared counterpart:
1. Changes by any member, automation, integration or agent appear in every open view of every other member within one second (p95, measured) without a reload, through a live connection (Cloudflare Durable Objects WebSocket) scoped to what each member may see; the five-second CURR-008 window remains the worst case after a dropped connection.

#### SYNC-002 — Local-first speed

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** The web app keeps a permission-scoped local cache of the member's teams so issue lists, issue detail, filters and the palette open from local data in under 100ms (p95) and edits apply optimistically, reconciling with server versions (ISSUE-006) and showing a conflict when one is rejected.

**Acceptance.** Through the native product door and its declared counterpart:
1. The web app keeps a permission-scoped local cache of the member's teams so issue lists, issue detail, filters and the palette open from local data in under 100ms (p95) and edits apply optimistically, reconciling with server versions (ISSUE-006) and showing a conflict when one is rejected.
2. Offline edits queue and replay on reconnect in order.

#### SYNC-003 — Collaborative editing

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Two members editing the same description or document see each other's cursors and changes live and never lose text; the result is one revision per editing session in ISSUE-018 history.

**Acceptance.** Through the native product door and its declared counterpart:
1. Two members editing the same description or document see each other's cursors and changes live and never lose text; the result is one revision per editing session in ISSUE-018 history.

#### MOBILE-001 — iOS and Android apps

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESSIBILITY-001 · *Register:* R-5

**Requirement.** Vector provides ios and android apps for the permitted workspace actors, with the records, outcomes and refusals below. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. Native apps for iPhone and Android, built by Run Edit Run for the store distribution tracked in MOBILE-004, so a member installs them from the store with no developer account and no build step; on first launch the member enters their installation's URL (or scans a QR code from Settings → Mobile, or opens an invitation link), signs in through that installation's own sign-in (email link, SSO under ROLE-004) in the system browser, and may add several installations and switch between them.
2. The apps let members read and act on their inbox, triage (accept, defer, decline, duplicate), view My work, Current, projects and cycles, create issues with photos, screenshots, screen recordings and voice-to-text, with the images and video shown inline (ISSUE-033, ISSUE-034), tick checklists (ISSUE-025), comment with mentions, change properties and search.
3. They use the same the public API and permission rules, through a per-device OAuth token (API-004) that the member or an Admin can revoke from Settings.
4. The apps inherit VIEW-011: they apply the member's saved Light, Dark or System choice from the installation.
5. Inherited from WORK-004: the mobile-app journey exercises Created, Subscribed with row Unfollow and Activity using the same visibility, filters and display rules.
6. The iOS and Android simulator builds sign in to a local installation by URL, accept a triage item, create an issue with a photo and read both from the web, with the photo rendered inline in both clients. Store-distributed build receipts are R-5.

#### MOBILE-002 — Push notifications

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESSIBILITY-001 · *Register:* R-6

**Requirement.** Working hours gate every time-of-day push delivery under NOTIFY-010. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. Working hours gate every time-of-day push delivery under NOTIFY-010.
2. The mobile apps receive real-time push notifications through Apple Push Notification service and Firebase Cloud Messaging for the events a member enabled (NOTIFY-007), with quick actions (mark read, snooze, assign to me) that call the member's installation directly.
3. The installation never holds Apple or Google push credentials: it sends each push to the Run Edit Run push relay (MOBILE-004), which forwards it to APNs or FCM.
4. The payload the relay receives and forwards carries only the opaque device registration, the issue identifier, its title, the actor's display name, the notification kind and an installation-scoped notification ID — never descriptions, comments, customer data or attachments — and a member can choose "ID only", in which the title and actor are omitted and the app fetches them from the installation after it wakes.
5. A push is sent within 5 seconds of the inbox notification (NOTIFY-001), except during the member's push quiet hours: outside their working hours and working days in their personal time zone (NOTIFY-010), unless they turn quiet hours off, the inbox entry appears at once and the push is held and sent once when their working hours resume; revoking the device token or signing out deregisters the device at the relay.

#### MOBILE-003 — Responsive web

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESSIBILITY-001 · *Register:* R-1, R-2

**Requirement.** Every web page works at 390px width with no horizontal scroll, touch targets of at least 44px and the same actions as desktop. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every web page works at 390px width with no horizontal scroll, touch targets of at least 44px and the same actions as desktop.

#### MOBILE-004 — Distributed apps and push relay

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESSIBILITY-001 · *Register:* R-5, R-6

**Requirement.** Vector provides distributed apps and push relay for the permitted workspace actors, with the records, outcomes and refusals below. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. Release packages build the iOS, Android, macOS and Windows apps from source, declare the oldest supported installation API, and tell the member to upgrade an older installation rather than failing silently. Run Edit Run store and signed-distribution receipts are recorded in the register.
2. Run Edit Run operates the push relay those apps need: an installation registers with the relay once from Settings → Mobile (an Owner confirms; the relay issues an installation key, stored encrypted under SEC-001), devices register through the installation, and the relay accepts sends only signed with a registered installation key and only for devices registered to that installation.
3. The relay stores device registrations and installation keys, and keeps no notification payload after forwarding; its terms, data list and status page are linked from Settings → Mobile.
4. An Owner can turn push off for the whole installation, and a buyer who wants their own branded build publishes it under their own Apple and Google accounts with their own push credentials, pointing their installation at their own relay deployment from the same source (docs).

#### MOBILE-005 — Desktop apps and desktop notifications

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESSIBILITY-001 · *Register:* R-7

**Requirement.** Vector provides desktop apps and desktop notifications for the permitted workspace actors, with the records, outcomes and refusals below. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. Signed and notarized desktop apps for macOS and Windows (MOBILE-004 publishes them), and the installable web app (PWA) for any browser, open the member's installation by URL with its own window, keyboard shortcuts, a dock or taskbar unread badge and native operating-system notifications in real time for the events the member routes to desktop under NOTIFY-007.
2. In a browser, Web Push delivers the same desktop notifications through the browser's push service with the MOBILE-002 payload limits, while the tab is closed.
3. Clicking a notification opens the issue in the app.
4. The apps inherit VIEW-011: they apply the member's saved Light, Dark or System choice from the installation.

### Target: Notifications

#### NOTIFY-007 — Channels and digests

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** Each member chooses per event type whether it reaches them in the inbox only, by email, in a Slack direct message, and can take email as an immediate message or an hourly or daily digest; Admins set workspace defaults.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each member chooses per event type whether it reaches them in the inbox only, by email, in a Slack direct message, and can take email as an immediate message or an hourly or daily digest; Admins set workspace defaults.
2. Working hours gate every time-of-day digest delivery.
3. Digests follow the member's personal time zone and working hours (NOTIFY-010): a daily digest is sent once at the start of the member's working hours on each working day, and hourly digests are sent only within working hours, with anything collected outside them carried into the next digest.
4. Every channel honors mutes (NOTIFY-004), actor exclusion (NOTIFY-003) and access (OPS-001), and never repeats a delivered notification.
5. the per-event choice for push, desktop notifications and Teams direct messages is delivered with MOBILE-002, MOBILE-005 and TEAMS-001.

#### NOTIFY-008 — Snooze and reminders

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** A member can snooze an inbox item until a chosen time or until the issue changes, and set a personal reminder on any issue; snoozed items return once at that time.

**Acceptance.** Through the native product door and its declared counterpart:
1. A member can snooze an inbox item until a chosen time or until the issue changes, and set a personal reminder on any issue; snoozed items return once at that time.

#### NOTIFY-009 — Subscriptions

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** Members can subscribe to a team, project, initiative, label or saved view and receive notifications for new matching issues and status changes, with the same channel rules.

**Acceptance.** Through the native product door and its declared counterpart:
1. Members can subscribe to a team, project, initiative, label or saved view and receive notifications for new matching issues and status changes, with the same channel rules.
2. Inherited from ROLE-007: a member's team notifications and team subscriptions follow team membership.

#### NOTIFY-010 — Personal time zone and working hours

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** Each member can set a personal IANA time zone (defaulting to the workspace time zone of OPS-003) and working hours.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each member can set a personal IANA time zone (defaulting to the workspace time zone of OPS-003) and working hours.
2. Their due reminders (NOTIFY-005) arrive at the reminder time in their own time zone, and their snoozes (NOTIFY-008), email digests (NOTIFY-007), personal reminders and push quiet hours use it; workspace-level instants (cycle boundaries, SLAs, workspace calendar days) stay in the workspace time zone.
3. Dates and times in the interface show in the viewer's time zone with the zone named where it differs from the workspace's.

### Automation and follow-through

#### AUTO-001 — Recurring issues

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-005

**Requirement.** Vector provides recurring issues for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. A member creates a recurring issue from a template on a cadence (daily, weekdays, weekly, monthly on a date or weekday, every N weeks) in the workspace timezone, with assignee, team, project and due offset; a series can skip creation while the previous occurrence is still open, and can be paused, edited or ended.
2. Inherited from ROLE-001: Owners and Admins, and Members in the member's teams, create, pause or end a recurring issue; Guests are refused (role matrix).

#### AUTO-002 — Workflow rules

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-005

**Requirement.** Owners and Admins build workspace rules, and a team's rules are built by its team owners or, while its *Who manages team settings* permission is All team members (ROLE-009), by all its members; other Members and all Guests cannot (role matrix).

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners and Admins build workspace rules, and a team's rules are built by its team owners or, while its *Who manages team settings* permission is All team members (ROLE-009), by all its members; other Members and all Guests cannot (role matrix).
2. A rule has a trigger (issue created or changed, status entered, comment, label added, PR event, deploy, due-date approaching, SLA warning, schedule), conditions over any field and actions (set fields, assign, move status or team, add to cycle or project, add a comment, apply a template, notify a person or channel, call a webhook, start an agent with AGENT-001).
3. Each rule shows a dry run over recent issues before saving, a run log with every change it made, a monthly run budget, and a failure state that notifies its owner; rules cannot trigger themselves in a loop.

#### AUTO-003 — Auto-close and auto-archive

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-005

**Requirement.** Vector provides auto-close and auto-archive for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Per team, under Settings → Auto-close and auto-archive, an Owner, an Admin or the team's owners (and every team member while its *Who manages team settings* permission is All team members, ROLE-009) set an auto-close period (days without activity: no issue change, activity entry or comment) and an auto-archive period (days since the issue closed), each 1 to 3650 days or off, and preview exactly which issues the next scheduled run would close and archive.
2. The scheduled run moves each open (Backlog, Unstarted or Started) issue past its period to the team's first Canceled status with a comment-equivalent automation entry explaining why, and archives each completed, canceled or duplicate issue past its period with an automation entry; both are guarded by the issue version and held during a restore.
3. Bugs are exempt by default: until issue types exist (ISSUE-021), an issue carrying a label named Bug is never auto-closed while the team's exemption is on.
4. Archived issues keep every row and link; they leave the issue list, board, saved views, My work and project issue lists and default search, open by their identifier with an Archived notice, appear in search with archived records included, stay in archive exports, and return to lists when another status is chosen.
5. Who may change these periods follows ROLE-009's *Who manages team settings*.
6. The automation entry is the comment: it sits in the issue's own activity with its reason ("Closed automatically after 30 days without activity", "Archived automatically 90 days after it closed") for everyone who can read the issue, and the issue's followers (NOTIFY-002) receive the notification a manual status change gives them, once per automated change, naming the automation as actor: a cancellation for an auto-close and an archive notification (its own kind, mutable like the others) for an auto-archive.

#### AUTO-004 — SLAs

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-005

**Requirement.** Teams set SLA targets by priority, label or customer tier (for example: Urgent bugs from Enterprise customers resolved in 24 hours, triage within 4 business hours in the workspace timezone); issues show time remaining, warn the assignee and triage owner before breach, and record breaches for reporting (REPORT-001).

**Acceptance.** Through the native product door and its declared counterpart:
1. Teams set SLA targets by priority, label or customer tier (for example: Urgent bugs from Enterprise customers resolved in 24 hours, triage within 4 business hours in the workspace timezone); issues show time remaining, warn the assignee and triage owner before breach, and record breaches for reporting (REPORT-001).
2. Inherited from NOTIFY-001: an SLA warning notifies once in the inbox, never the actor; the receiving journey verifies this for that event.
3. Inherited from SLACK-003, SLACK-007: an SLA warning posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.
4. Inherited from ROLE-009: a team's SLAs change under its *Who manages team settings* permission; Owners and Admins always may and Guests never (role matrix).

#### AUTO-005 — Update reminders

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-005

**Requirement.** Project leads and initiative owners are reminded on the chosen cadence (weekly on a weekday, every two weeks) to post an update, with a prefilled draft (PROJ-010); missing updates are flagged on the project and in the initiative roll-up.

**Acceptance.** Through the native product door and its declared counterpart:
1. Project leads and initiative owners are reminded on the chosen cadence (weekly on a weekday, every two weeks) to post an update, with a prefilled draft (PROJ-010); missing updates are flagged on the project and in the initiative roll-up.

#### AUTO-006 — Due-soon rules

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-005

**Requirement.** Rules on due dates can act before the due day (for example two days before: notify the assignee and move to the active cycle), complementing the fixed due-today and overdue reminders of NOTIFY-005.

**Acceptance.** Through the native product door and its declared counterpart:
1. Rules on due dates can act before the due day (for example two days before: notify the assignee and move to the active cycle), complementing the fixed due-today and overdue reminders of NOTIFY-005.
2. Inherited from ROLE-001: only Owners and Admins build or change workspace automation rules (role matrix).

### Reporting

#### REPORT-001 — Insights

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-ROLE-001

**Requirement.** Vector provides insights for the permitted workspace actors, with the records, outcomes and refusals below. Owners, Admins and Members read only visible issues; Guests are refused. This carries RL-6.

**Acceptance.** Through the native product door and its declared counterpart:
1. Members chart any filtered set of issues by count or estimate over time and by any field: created vs completed, throughput, cycle time and lead time (from Started or created to Completed, with percentiles), time in each status, triage time, SLA breaches, bug inflow and open bug age, grouped by team, project, label, assignee, priority or customer tier.
2. Each chart drills down to its issues and exports as CSV.
3. Every chart inherits VIEW-011: it follows the member's Light, Dark or System theme, its series stay distinguishable in both, and its text and marks meet WCAG 2.2 AA contrast in both.

#### REPORT-002 — Cycle and project charts

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Each cycle shows a burn-up of scope and completion by day, with added and removed scope marked, and a final report (completed, carried over, added mid-cycle, by assignee).

**Acceptance.** Through the native product door and its declared counterpart:
1. Each cycle shows a burn-up of scope and completion by day, with added and removed scope marked, and a final report (completed, carried over, added mid-cycle, by assignee).
2. At each workspace-zone day close, per-project and per-cycle daily scope and completion counts are recorded as counts only, without issue identifiers, titles, assignees or people.
3. Later issue deletion does not rewrite those closed days; days before recording starts say history not recorded.
4. Membership events retain identifiers and timestamps only, and erasure is unchanged.

#### REPORT-006 — Project completion forecast

*Tier:* Core · *From:* REPORT-002 · *Cites:* BASE-ROLE-001

**Requirement.** Each project shows scope and completion over time with the projected completion date.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each project shows scope and completion over time with the projected completion date.
2. Projected completion uses open issues divided by completions recorded in the last 28 closed workspace days / 28, rounded up to whole workspace calendar days.
3. A day counts issues entering Completed while in the project, including creation in Completed; same-day events are deduplicated, and a reopened issue completed on a later day counts again.
4. Today enters the rate only after day close.
5. Fewer than three recorded completions shows Not enough history; zero remaining issues has no projected date.
6. Completed, canceled and archived projects retain their last aggregate state; reopening resumes live history.

#### REPORT-003 — Dashboards

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Members compose dashboards of saved charts, counts and issue lists for a team or for leadership, share them inside the workspace, and filter the whole dashboard by team, date range or project.

**Acceptance.** Through the native product door and its declared counterpart:
1. Members compose dashboards of saved charts, counts and issue lists for a team or for leadership, share them inside the workspace, and filter the whole dashboard by team, date range or project.

#### REPORT-004 — Workload

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** For a cycle or date range, a workload view shows each person's assigned estimate and issue count against their stated capacity, including delegated agent work, so a lead can rebalance; it never ranks people by output.

**Acceptance.** Through the native product door and its declared counterpart:
1. For a cycle or date range, a workload view shows each person's assigned estimate and issue count against their stated capacity, including delegated agent work, so a lead can rebalance; it never ranks people by output.

#### REPORT-005 — Warehouse and spreadsheet export

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Vector provides warehouse and spreadsheet export for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Owners and Admins (role matrix) schedule incremental exports of issues, history, cycles, projects and customer links as CSV or JSON to an S3-compatible bucket (Amazon S3, Cloudflare R2), expose a read-only export API that Fivetran and Airbyte connectors can page through, and sync a saved view to a Google Sheets spreadsheet through the Sheets API (batch value updates), refreshed on a schedule of at least hourly with one row per issue and one column per visible view property.

### Connecting integrations

#### INTEG-001 — Guided connection from Settings

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-ROLE-001 · *Register:* R-4

**Requirement.** Settings → Integrations lists every integration with its state (not connected, connecting, connected, needs attention). The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. Settings → Integrations lists every integration with its state (not connected, connecting, connected, needs attention).
2. An Owner or Admin connects one through the provider setup path documented in docs/contract/MECHANISMS.md: Vector generates every value the provider needs — this installation's request, event, OAuth redirect and sidebar URLs, least-privilege scopes, event subscriptions, a fresh signing secret, and any app package or plugin manifest — and either submits them through the provider's app-creation API or manifest flow, or prefills the provider's creation page, so the Admin never types or edits a scope, URL or manifest by hand; the only values an Admin copies are the credentials a provider shows once, which Vector stores encrypted (SEC-001).
3. Each path ends with a live check: Vector calls the provider with the new credentials and asks the Admin to perform one real action (send `@Vector` a message, open a PR), and marks the integration connected only when that event arrives signed.
4. From then on every member uses it without further setup, linking their own provider identity where the integration acts as them (SLACK-001, DOCS-001).
5. Disconnecting revokes tokens, deletes the provider webhook where the provider's API allows it, and lists anything the Admin must remove in the provider.
6. For every provider in the documented setup table, an official-schema provider-edge fixture completes Settings setup without hand-entered scopes, URLs or manifest text, receives the first signed business event and refuses a Member opening setup. The real Slack and GitHub connection receipts remain in R-4.

#### INTEG-002 — Integration health and repair

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-ROLE-001

**Requirement.** Each connected integration shows its last received event, last successful call, failure count and token expiry; a failing integration notifies the Admins who connected it and shows the provider's error.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each connected integration shows its last received event, last successful call, failure count and token expiry; a failing integration notifies the Admins who connected it and shows the provider's error.
2. When the installation's origin changes or a provider rotates a secret, Settings repairs the integration in place — updating the request URLs through the provider's API where one exists (Slack Slack manifest repair, GitHub GitHub webhook repair, GitLab hook update) or re-running the setup path with the existing app otherwise — without losing links, synced threads or identity mappings.
3. After a restore (SEC-001) each integration shows "needs attention" until its credentials are re-entered.

### Target: Code host and delivery

#### GITHUB-003 — Branches and status automation

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** Vector provides branches and status automation for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each issue offers a copyable branch name (for example `vec-123-fix-checkout`); Vector links a PR whose branch, title or body names an issue, understands closing words ("Fixes VEC-123") and contributing words ("Part of VEC-123"), and moves the issue by team rules: draft PR opened → In Progress, review requested → In Review, merged → Done (or the status chosen per rule, including on deploy with RELEASE-002).
2. Each move is recorded as Git automation and never moves an issue backwards out of Completed without a rule saying so.
3. Inherited from NOTIFY-001: a Git status/completion event, naming the Git automation as actor notifies once in the inbox, never the actor; the receiving journey verifies this for that event.
4. The inherited merged-PR fixture completes a followed issue and its follower receives exactly one notification naming Git automation; the actor receives none and replay adds none.
5. Inherited from ROLE-009: a team's Git automation rules change under its *Who manages team settings* permission (role matrix).
6. Provider-backed "create branch" is tracked in GITHUB-008.

#### GITHUB-004 — Commits

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** Push events link commits whose message names an issue, showing author, message and link on the issue; closing words in a commit on the default branch act like a merged PR under the team rules.

**Acceptance.** Through the native product door and its declared counterpart:
1. Push events link commits whose message names an issue, showing author, message and link on the issue; closing words in a commit on the default branch act like a merged PR under the team rules.

#### GITHUB-005 — Review and checks on the issue

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** A linked PR shows its review state (review requested, approved, changes requested, with reviewers), required check status from GitHub Actions or other CI, mergeability and stacked-PR parent; issue lists can filter by these, and reviewers get a notification in Vector when their review is requested on a linked PR.

**Acceptance.** Through the native product door and its declared counterpart:
1. A linked PR shows its review state (review requested, approved, changes requested, with reviewers), required check status from GitHub Actions or other CI, mergeability and stacked-PR parent; issue lists can filter by these, and reviewers get a notification in Vector when their review is requested on a linked PR.
2. Inherited from NOTIFY-001: a Git review request notifies once in the inbox, never the actor; the receiving journey verifies this for that event.

#### GITHUB-006 — GitHub App

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** Vector provides github app for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each installation creates its own GitHub App through the GitHub App manifest flow from Settings → Integrations → GitHub (the INTEG-001 setup table in docs/contract/MECHANISMS.md): the Admin chooses a personal account or organization (or a GitHub Enterprise Server host), approves the prefilled app on GitHub, and Vector converts the returned code into the app's ID, private key and webhook secret, then sends the Admin to choose repositories.
2. The app has least-privilege scopes on chosen repositories (GitHub.com and GitHub Enterprise Server), posts a linkback comment on linked PRs, reads PR and check state for enrichment, and maps GitHub users to members; tokens are short-lived installation tokens stored encrypted, and uninstalling stops all calls.
3. The webhook-only mode of GITHUB-001 remains available without a token.
4. Inherited from SEC-001: credentials are sealed, shown once, least-scoped, excluded from archives, re-entered on restore, rotated on demand and revoked on removal; an archive-then-restore journey proves no credential is exported and the restored connection needs re-entry.

#### GITHUB-007 — GitHub Issues sync

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** A team can sync with one or more GitHub repositories' Issues: new GitHub issues appear in triage (or Backlog by rule), and title, description, state, labels, assignee and comments sync both ways with stable source identity; conflicts take the latest change and are shown in activity.

**Acceptance.** Through the native product door and its declared counterpart:
1. A team can sync with one or more GitHub repositories' Issues: new GitHub issues appear in triage (or Backlog by rule), and title, description, state, labels, assignee and comments sync both ways with stable source identity; conflicts take the latest change and are shown in activity.
2. Sync can be one-way for public open-source repositories.

#### GITHUB-008 — Provider-backed create branch

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** Each issue offers a copyable branch name (for example `vec-123-fix-checkout`) and a "create branch" action.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each issue offers a copyable branch name (for example `vec-123-fix-checkout`) and a "create branch" action.

#### GITLAB-001 — GitLab

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** For GitLab.com and self-managed GitLab, Vector links merge requests, branches and commits that name issues, moves status by the same team rules as GITHUB-003, shows approvals and pipeline status, and receives environment deployments for RELEASE-002, through signed webhooks and a least-privilege access token.

**Acceptance.** Through the native product door and its declared counterpart:
1. For GitLab.com and self-managed GitLab, Vector links merge requests, branches and commits that name issues, moves status by the same team rules as GITHUB-003, shows approvals and pipeline status, and receives environment deployments for RELEASE-002, through signed webhooks and a least-privilege access token.
2. Setup is INTEG-001's API registration: the Admin pastes a group or project access token with `api` scope, chooses projects, and Vector creates each project webhook (or a group webhook where the tier provides one) with a generated secret token, without the Admin entering a URL.

#### GITLAB-002 — GitLab Issues sync

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** A team can sync with GitLab project issues with the same behavior as GITHUB-007.

**Acceptance.** Through the native product door and its declared counterpart:
1. A team can sync with GitLab project issues with the same behavior as GITHUB-007.

#### BITBUCKET-001 — Bitbucket

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** Bitbucket Cloud pull requests, branches, commits and pipelines link to issues and drive the same team rules.

**Acceptance.** Through the native product door and its declared counterpart:
1. Bitbucket Cloud pull requests, branches, commits and pipelines link to issues and drive the same team rules.

#### CI-001 — CI and deploy providers

*Tier:* Core

**Requirement.** CircleCI, GitHub Actions, GitLab CI, Vercel, Netlify and Cloudflare deployments report build and deploy results for linked commits through signed webhooks or the API, shown on the issue and usable as rule triggers.

**Acceptance.** Through the native product door and its declared counterpart:
1. CircleCI, GitHub Actions, GitLab CI, Vercel, Netlify and Cloudflare deployments report build and deploy results for linked commits through signed webhooks or the API, shown on the issue and usable as rule triggers.

### Chat

#### SLACK-001 — Slack app

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001 · *Register:* R-4

**Requirement.** Vector provides slack app for the permitted workspace actors, with the records, outcomes and refusals below. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each installation has its own Slack app, created from Settings → Integrations → Slack through Slack's app manifest (the INTEG-001 setup table in docs/contract/MECHANISMS.md): with a one-time app configuration token Vector calls app creation from a generated manifest with the generated manifest (this installation's event, interactivity, slash-command, unfurl and OAuth redirect URLs and least scopes) and receives the app's credentials; without a token, Vector opens Slack's create-from-manifest page prefilled and the Admin pastes the signing secret, client ID and client secret Slack shows.
2. The Admin then clicks Install, which completes OAuth v2 to the company's Slack workspace (or an Enterprise Grid org) and stores the bot token encrypted.
3. Members link their Slack identity to their Vector member; uninstalling or unlinking stops all calls and removes stored tokens.
4. Inherited from SEC-001: credentials are sealed, shown once, least-scoped, excluded from archives, re-entered on restore, rotated on demand and revoked on removal; an archive-then-restore journey proves no credential is exported and the restored connection needs re-entry.
5. SLACK-003 already covers the sealed bot-token paste path and its archive/re-entry proof; SLACK-004 covers member-confirmed linking by the member's own sign-in email, the pasted signing secret and the interactivity door; the manifest/OAuth installation, Events API, @Vector issue creation, explicit Admin mapping and uninstall remain this clause’s acceptance.

#### SLACK-002 — Issues from Slack with synced threads

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** Vector provides issues from slack with synced threads for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. From any message, a shortcut, an emoji reaction or `@Vector` creates an issue (or adds the message to an existing one) with the message, author, attachments and a link, using a template or request form (TRIAGE-004), with a Customer picker prefilled from the message author's email domain so the message becomes that customer's request (CUST-006, CUST-008); the Slack thread then syncs both ways with exactly one Vector comment thread (ISSUE-029): the originating message becomes that thread's root comment, each Slack reply becomes a reply in it, a Vector reply in that thread posts once to the Slack thread, resolving the Vector thread adds a resolved marker in Slack, and comments outside that thread never post to Slack; a second Slack thread linked to the same issue maps to its own comment thread.
2. Status changes post into every linked Slack thread.
3. Request channels can be configured so every top-level message becomes a triage item.
4. Files in Slack messages and replies become attachments shown inline in the mapped comment (ISSUE-033, ISSUE-034); an image or video embedded in a Vector reply in that thread is uploaded into the Slack thread once through Slack's external upload API (an external upload allocation, then completion of an external upload), and a checklist (ISSUE-025) posts as text.
5. A Slack user with no Vector seat and no linked identity (SLACK-001) — someone in sales or support — can file in the same ways in any channel the Vector app is in: Vector records them as the issue's requester by Slack user ID and display name (and as a contact of the customer their email domain maps to under CUST-006), never as a member, and gives them no sign-in and no access to Vector; they receive the confirmation with the identifier and title, and the issue's status changes and the Vector replies in the mapped thread reach them in that Slack thread like anyone in it.
6. For an issue in a private team (ROLE-002), the thread receives only the identifier and status changes.

#### SLACK-003 — Slack and Discord channel bindings

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** Teams, projects, initiatives and saved views can post chosen events (new triage item, new issue, status change, project update, release, SLA warning, agent completion) to a Slack channel, respecting ROLE-002 so private-team content only posts to channels the Admin bound to that team. Slack identity and private notices follow RL-3.

**Acceptance.** Through the native product door and its declared counterpart:
1. Teams, projects, initiatives and saved views can post chosen events (new triage item, new issue, status change, project update, release, SLA warning, agent completion) to a Slack channel, respecting ROLE-002 so private-team content only posts to channels the Admin bound to that team.
2. Owners and Admins connect Slack and bind channels in Settings → Integrations, and only they may have the Slack bot create a channel in the customer's Slack workspace, which a team or project created with it binds automatically; a Member who may create a project may bind it to a channel an Owner or Admin already bound or allowed, and post to it (role matrix, ROLE-001); ROLE-002 inherits the private-team channel restriction for private teams.
3. Saved-view membership uses the same list predicates at dispatch.
4. PROJ-010, RELEASE-001/RELEASE-003, AUTO-004, AGENT-002/AGENT-003 and INIT-001 inherit their future objects’ bound-channel events and acceptance before shipping.

#### SLACK-006 — Connect and remove channel credentials

*Tier:* Core · *From:* SLACK-003 · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** Vector provides connect and remove channel credentials for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. An Admin enters a Slack bot token in Settings → Integrations once; a provider credential check validates it, per-workspace encryption seal it per workspace, settings never reveal it again, archives exclude it, restored installations need attention until re-entry, and removal calls provider credential revocation, deletes local custody and disables bindings (a provider error refuses removal visibly).

#### SLACK-007 — Durable minimal channel posts

*Tier:* Core · *From:* SLACK-003 · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** Existing new-triage, new-issue and status-change events post through the shared native outbound claim, bounded-retry, uncertain-result and visible Settings failure machinery, once per event per binding.

**Acceptance.** Through the native product door and its declared counterpart:
1. Existing new-triage, new-issue and status-change events post through the shared native outbound claim, bounded-retry, uncertain-result and visible Settings failure machinery, once per event per binding.
2. Messages carry identifier, title, readable actor, old → new status and the canonical canonical issue link, never description or comment bodies.
3. Unbinding, issue deletion and operator removal stop future posts; already-posted Slack or Discord messages cannot be recalled by local erasure (SEC-003).
4. Actor display names are allowed for current workspace-visible items; ROLE-002 inherits generic notices without actor or text, or a DM to a permitted explicitly mapped member, for private/restricted items for those capabilities.

#### SLACK-008 — Create and bind a Slack channel

*Tier:* Core · *From:* SLACK-003 · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** A team or project can create its own Slack channel when it is created (`channel creation`, named from its identifier or name) and bind it automatically, and a Discord channel can receive the same events through a Discord webhook URL.

**Acceptance.** Through the native product door and its declared counterpart:
1. A team or project can create its own Slack channel when it is created (`channel creation`, named from its identifier or name) and bind it automatically, and a Discord channel can receive the same events through a Discord webhook URL.
2. Channel creation makes one channel creation call with a lowercase hyphenated identifier or name of at most 80 characters, public channels only; an already-used name and other Slack errors are shown without a retry loop and refuse object creation.
3. Discord accepts only HTTPS discord.com or discordapp.com URLs whose path starts the provider webhook prefix, seals the URL and refuses redirects; this fixed-host rule does not depend on arbitrary resolved-address egress.

#### SLACK-009 — Channel safety and explicit mapping

*Tier:* Core · *From:* SLACK-003 · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** Vector provides channel safety and explicit mapping for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Slack channel selection and each post explicitly check the channel safety check: bot membership and a channel type, no archived or shared state, and not frozen; the held Slack conversation object omits the frozen flag, recorded as an assumption that an absent the frozen flag means not frozen (revisable if a provider run contradicts it).
2. Unsafe channels and archived/frozen/not-joined post refusals suspend routing visibly until an Admin confirms a fresh binding; held events are not replayed.
3. Channel IDs are explicitly mapped by the Admin, never inferred from email or name.

#### SLACK-004 — Link and unlink your Slack identity

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** Vector provides link and unlink your slack identity for the permitted workspace actors, with the records, outcomes and refusals below. Slack identity and private notices follow RL-3.

**Acceptance.** Through the native product door and its declared counterpart:
1. A signed-in member chooses Link Slack in Settings → Notifications; Vector calls an own-email provider lookup (scope users:read.email) with that member's own Vector sign-in email, shows the Slack account it found and links it only when the member confirms; no match shows "No Slack account found for this email" and stores nothing, and a lookup error is shown and not retried.
2. There is no silent or background lookup, no lookup by an Admin for someone else's email, no bulk directory read (a provider directory scan) and no matching on names; explicit Admin mapping remains SLACK-001's.
3. The link is shown, audited (`slack.member_linked`, `slack.member_unlinked`) and revocable with Unlink; unlinking, member removal, suspension (ROLE-011 inherits) and removal of the workspace's Slack credential delete it and stop every direct message.

#### SLACK-010 — Personal Slack delivery

*Tier:* Core · *From:* SLACK-004 · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** Members can receive their notifications as Slack direct messages under NOTIFY-007 with actions (assign to me, change status, open).

**Acceptance.** Through the native product door and its declared counterpart:
1. Members can receive their notifications as Slack direct messages under NOTIFY-007 with actions (assign to me, change status, open).
2. A linked member turns on Slack direct messages separately for assignments and for direct mentions, the assignment and mention events (NOTIFY-006); the option is unavailable, with the reason shown, while the workspace has no valid Slack credential or the member has no link, and NOTIFY-007 keeps the choice for every other event.
3. Each qualifying notification creates at most one direct-message intent per recipient in the same transaction as its source mutation, in the native outbound ledger (no second queue); immediately after commit, like immediate mail, and before every later attempt Vector rechecks mutes (NOTIFY-004), actor exclusion (NOTIFY-003), the active recipient, issue access (OPS-001) and the member's link and choice, then calls opening a direct conversation (im:write) and posting the direct message.
4. A delivered message is never repeated: rate limits and an unanswered opening a direct conversation (which posts nothing) retry at most three attempts, after one and then five minutes; an unknown posting the direct message result is uncertain and never resent; failed and uncertain messages are listed to the recipient in Settings → Notifications.
5. A message carries only the event kind, issue identifier and title, actor display name, status change, due date and the authenticated canonical `canonical issue` link, in plain-text blocks with automatic link and media previews disabled — never a description, comment or mention body, free text or AI output; private or restricted items get a generic notice with no actor or text under ROLE-002.

#### SLACK-011 — Signed Slack notification actions

*Tier:* Core · *From:* SLACK-004 · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** Open is the canonical link button; Assign to me and Change status (an inline select of the team's workflow states the issue-edit door accepts) appear only while the workspace's Slack signing secret is stored, and Settings says they are off until it is entered .

**Acceptance.** Through the native product door and its declared counterpart:
1. Open is the canonical link button; Assign to me and Change status (an inline select of the team's workflow states the issue-edit door accepts) appear only while the workspace's Slack signing secret is stored, and Settings says they are off until it is entered .
2. Slack's interactivity requests reach the signed Slack interaction door, which verifies the Slack request signature (HMAC-SHA256 over the exact signed request bytes) in constant time, refuses a timestamp more than 5 minutes from the Worker clock and a replayed request key, maps the Slack user to the Vector member only through the confirmed link and runs the change through the version-checked issue-edit door with that member's own authority and the issue version the message carried.
3. A changed issue is refused with a threaded Slack reply carrying Open and is never overwritten; an applied change refreshes the message with the new version.
4. The door answers before Slack's 3-second limit and replies afterwards.
5. An unlinked, removed or suspended Slack user, a bad or missing signature, a stale timestamp and a replay change nothing.

#### SLACK-012 — Slack interactivity secret custody

*Tier:* Core · *From:* SLACK-004 · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** An Admin enters the Slack app's signing secret beside the bot token in Settings → Integrations; it is sealed with per-workspace encryption per workspace, never shown again, excluded from archives with the member links (SEC-001: after a restore it is entered again and members re-link) and removed with the credential.

**Acceptance.** Through the native product door and its declared counterpart:
1. An Admin enters the Slack app's signing secret beside the bot token in Settings → Integrations; it is sealed with per-workspace encryption per workspace, never shown again, excluded from archives with the member links (SEC-001: after a restore it is entered again and members re-link) and removed with the credential.
2. docs/INTEGRATIONS.md names the Interactivity Request URL the Admin sets in their Slack app until SLACK-001's manifest sets it, and what leaves the deployment in a direct message.

#### SLACK-005 — Link previews

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001 · *Register:* R-4

**Requirement.** Vector issue, project and document links pasted in Slack unfurl with title, status, assignee and priority only for linked members allowed to see them; others see the link alone. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. Vector issue, project and document links pasted in Slack unfurl with title, status, assignee and priority only for linked members allowed to see them; others see the link alone.

#### TEAMS-001 — Microsoft Teams

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-ROLE-001

**Requirement.** A Microsoft Teams app offers SLACK-001 to SLACK-005's behavior in Teams: install and identity linking, issues from messages with synced threads, channel notifications, personal notifications and link previews.

**Acceptance.** Through the native product door and its declared counterpart:
1. A Microsoft Teams app offers SLACK-001 to SLACK-005's behavior in Teams: install and identity linking, issues from messages with synced threads, channel notifications, personal notifications and link previews.
2. Each installation has its own bot and Teams app (the INTEG-001 setup table in docs/contract/MECHANISMS.md): the Admin creates a bot in the Teams Developer Portal with the messaging endpoint Vector shows and pastes its app ID and client secret, Vector generates the complete Teams app package with that bot ID, valid domains and resource-specific consent permissions, and the Admin uploads it in the Teams admin center as a custom app for the organization; no manifest is edited by hand.

### Support, errors, design and knowledge

#### SUPPORT-001 — Zendesk, Intercom and Front

*Tier:* Core

**Requirement.** Support agents create or link a Vector issue from a Zendesk ticket, Intercom conversation or Front message through the provider's app sidebar; the ticket shows the issue's status and release, and the issue shows the ticket and customer as a customer request (CUST-001).

**Acceptance.** Through the native product door and its declared counterpart:
1. Support agents create or link a Vector issue from a Zendesk ticket, Intercom conversation or Front message through the provider's app sidebar; the ticket shows the issue's status and release, and the issue shows the ticket and customer as a customer request (CUST-001).
2. Status changes add internal notes on the ticket (CUST-003).
3. Setup follows the INTEG-001 setup table in docs/contract/MECHANISMS.md: Vector generates a private Zendesk app package (a ticket-sidebar app pointing at this installation) for upload in Zendesk Admin Center and creates the Zendesk webhook and trigger through the Zendesk API with an API token the Admin pastes; for Intercom and Front the Admin creates an app in the provider's developer settings from the copy fields Vector shows (Intercom Inbox app URLs and webhook topics; Front plugin and webhook URLs) and pastes its token and signing secret.
4. Support agents then use the sidebar with no setup of their own, linking their Vector identity on first use.

#### SUPPORT-002 — HappyToHelp

*Tier:* Core

**Requirement.** HappyToHelp conversations link to Vector issues with the same behavior as SUPPORT-001 through the sibling's API, so a team running Run Edit Run products needs no third-party support tool.

**Acceptance.** Through the native product door and its declared counterpart:
1. HappyToHelp conversations link to Vector issues with the same behavior as SUPPORT-001 through the sibling's API, so a team running Run Edit Run products needs no third-party support tool.

#### ERROR-001 — Sentry and Datadog

*Tier:* Core

**Requirement.** A Sentry issue or Datadog case or monitor alert can create or link a Vector issue with the error, frequency, affected users, release and stack-trace link; resolving the Vector issue can resolve the Sentry issue, and a regression reopens or comments on the Vector issue by team rule.

**Acceptance.** Through the native product door and its declared counterpart:
1. A Sentry issue or Datadog case or monitor alert can create or link a Vector issue with the error, frequency, affected users, release and stack-trace link; resolving the Vector issue can resolve the Sentry issue, and a regression reopens or comments on the Vector issue by team rule.
2. Setup follows the INTEG-001 setup table in docs/contract/MECHANISMS.md: a Sentry internal integration created from the webhook URL, scopes and subscriptions Vector shows, and a Datadog webhook Vector registers through the Datadog API.

#### ERROR-002 — Spool

*Tier:* Core

**Requirement.** Spool error groups link to Vector issues with live counts, first and last seen, affected users and releases, and a Spool regression after the issue's fix deploys reopens it for PUSH-004.

**Acceptance.** Through the native product door and its declared counterpart:
1. Spool error groups link to Vector issues with live counts, first and last seen, affected users and releases, and a Spool regression after the issue's fix deploys reopens it for PUSH-004.

#### DESIGN-001 — Figma

*Tier:* Core

**Requirement.** Figma files, frames and prototypes linked in an issue or document show a live preview and last-modified time; a Figma comment can create an issue through the Figma plugin with a link back.

**Acceptance.** Through the native product door and its declared counterpart:
1. Figma files, frames and prototypes linked in an issue or document show a live preview and last-modified time; a Figma comment can create an issue through the Figma plugin with a link back.
2. Setup follows the INTEG-001 setup table in docs/contract/MECHANISMS.md: the Admin registers the installation's Figma OAuth app from the callback URL Vector shows and members connect their own Figma accounts for previews; Vector generates the plugin manifest with this installation in its allowed network domains, published by an Admin as a private organization plugin or imported by members from the manifest.

#### DOCS-001 — Notion, Confluence and Google Drive

*Tier:* Core

**Requirement.** Vector provides notion, confluence and google drive for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Links to Notion pages, Confluence pages, Google Docs and Drive files, Microsoft OneDrive and SharePoint, and Dropbox files (through OAuth clients the Admin registers from the redirect URLs Vector shows, INTEG-001) show title, owner and last-updated previews for members who connected that account, and specs written there can be linked as an issue's specification (PUSH-001).
2. Loom and YouTube video links embed as players through their public oEmbed endpoints, with no account connection.

#### CAL-001 — Calendar feeds

*Tier:* Core

**Requirement.** Each member and team has a private calendar feed (ICS) of due dates, cycles, milestones and releases for Google Calendar, Outlook and Apple Calendar; revoking the feed URL stops it.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each member and team has a private calendar feed (ICS) of due dates, cycles, milestones and releases for Google Calendar, Outlook and Apple Calendar; revoking the feed URL stops it.
2. CAL-001 inherits PROJ-011's milestone events in calendar feeds.

#### CONNECT-001 — Zapier and Make

*Tier:* Core · *Register:* R-9

**Requirement.** A Zapier app and a Make app expose triggers (issue created, status changed, comment added, project update) and actions (create issue, update issue, comment) over API-003 and WEBHOOK-002 so buyers can connect tools Vector does not integrate natively. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. A Zapier app and a Make app expose triggers (issue created, status changed, comment added, project update) and actions (create issue, update issue, comment) over API-003 and WEBHOOK-002 so buyers can connect tools Vector does not integrate natively.
2. Run Edit Run publishes both as public apps in the Zapier and Make directories; each connection asks for the installation URL, authorizes by OAuth (API-004) against that installation, and registers its triggers as REST-hook webhooks (WEBHOOK-002) on it, so no buyer builds or hosts a private app.

### Coding agents

#### AGENT-001 — Delegate an issue to an agent

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** A member can delegate an issue to a coding agent — Claude Code, OpenAI Codex, Cursor's background agent, GitHub Copilot coding agent or any agent registered through AGENT-006 — from the issue, a shortcut, Slack or a rule (AUTO-002).

**Acceptance.** Through the native product door and its declared counterpart:
1. A member can delegate an issue to a coding agent — Claude Code, OpenAI Codex, Cursor's background agent, GitHub Copilot coding agent or any agent registered through AGENT-006 — from the issue, a shortcut, Slack or a rule (AUTO-002).
2. The human assignee stays accountable; the issue shows the agent as delegate beside the assignee.
3. Delegation sends the issue, its spec (PROJ-013), linked evidence and the team's agent guidance (AGENT-008), scoped to what the delegating member may see, through that provider's own delegation mechanism as AGENT-009 names it — Vector drives each provider's API or the buyer's runner itself, because provider agent apps built for hosted trackers cannot reach a self-hosted installation.
4. Inherited from ROLE-001: Owners and Admins, and Members in the member's teams, delegate to agents allowed under AGENT-004; Guests are refused (role matrix).

#### AGENT-002 — Agent session on the issue

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** Vector provides agent session on the issue for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each delegation opens an agent session shown on the issue, fed by the provider mechanism of AGENT-009, with live progress (plan, steps, files touched, commands run, elapsed time and cost in USD when the provider reports it), questions the agent asks a person (answered in the issue or Slack), and a cancel action that stops the session within one minute and records who stopped it.
2. Where a provider has no mid-run question channel, the session says so and a member's answer starts a follow-up run on the same branch (AGENT-009).
3. Inherited from NOTIFY-001: a delegated agent question or completion notifies once in the inbox, never the actor; the receiving journey verifies this for that event.
4. Inherited from SLACK-003, SLACK-007: agent completion posts to its bound Slack or Discord channel once, using the shared durable delivery and minimal-message rules; its acceptance journey verifies the bound post.

#### AGENT-003 — Reviewable agent output and policy-decided completion

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** An agent's work lands as a branch and pull request linked to the issue (GITHUB-003), with the tests it added or ran and a summary; the issue moves to In Review; subsequent review, merge and completion follow the team rules and the company's policy for each call's classes.

**Acceptance.** Through the native product door and its declared counterpart:
1. An agent's work lands as a branch and pull request linked to the issue (GITHUB-003), with the tests it added or ran and a summary; the issue moves to In Review; subsequent review, merge and completion follow the team rules and the company's policy for each call's classes.
2. Merging and deploying carry live, customer messages carry external, and reversible priority, due-date and assignee changes carry standard; the company's policy decides every call.
3. Inherited from SLACK-003, SLACK-007: reviewable agent completion posts to its bound Slack or Discord channel once, without duplicating AGENT-002’s completion event; its acceptance journey verifies the bound post.

#### AGENT-004 — Agent permissions and budgets

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** Admins choose which agents may be delegated to, by which teams, on which repositories, with company-set monthly cost and session budgets and an installation concurrency limit; every agent call uses a scoped token (ROLE-006), and a budget or permission stop is visible on the issue and to the delegating member.

**Acceptance.** Through the native product door and its declared counterpart:
1. Admins choose which agents may be delegated to, by which teams, on which repositories, with company-set monthly cost and session budgets and an installation concurrency limit; a budget or permission stop is visible on the issue and to the delegating member.
2. Inherited from SEC-001: credentials are sealed, shown once, least-scoped, excluded from archives, re-entered on restore, rotated on demand and revoked on removal; an archive-then-restore journey proves no credential is exported and the restored connection needs re-entry.

#### AGENT-005 — MCP server

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011, BASE-AGENT-001, BASE-AGENT-003, BASE-AGENT-004 · *Rules:* D-2

**Requirement.** Vector exposes a Model Context Protocol server (streamable HTTP, OAuth 2.1) so Claude, ChatGPT, Cursor, VS Code and other clients can search, read, create and update issues, comments, projects, cycles and documents for the sponsoring member on the Vector records named here.

**Acceptance.** Through the native product door and its declared counterpart:
1. The Vector MCP jobs search and read, create and update issues, comments, projects, cycles and documents for the sponsoring workspace member.

#### AGENT-006 — Agent platform

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** Third-party agents register as Vector apps (OAuth with an application actor), receive delegation and mention events by signed webhook, post session activities (thought, action, question, result) and request input through a documented API, so new coding or ops agents plug in without changes to Vector.

**Acceptance.** Through the native product door and its declared counterpart:
1. Third-party agents register as Vector apps (OAuth with an application actor), receive delegation and mention events by signed webhook, post session activities (thought, action, question, result) and request input through a documented API, so new coding or ops agents plug in without changes to Vector.
2. The same API is the callback channel for the runner-based providers of AGENT-009 (Claude Code and Codex on the buyer's runners), each run holding a token scoped to its one session.

#### AGENT-007 — Ask Vector

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** Vector provides ask vector for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Members ask questions in plain English ("what is blocking the 2.4 release?", "which Enterprise customers asked for SSO?") and get answers with cited issues, projects and comments drawn only from records they can see; when the answer implies a change (create issues, update statuses), the assistant declares the exact changes and their computed classes; the company's policy decides whether they run, enter review, wait for approval or are refused.

#### AGENT-008 — Agent guidance

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** Teams and members keep reusable agent instructions (repository, coding conventions, test commands, definition of done) and saved prompts that apply to delegations and triage agents in their scope, versioned and audited.

**Acceptance.** Through the native product door and its declared counterpart:
1. Teams and members keep reusable agent instructions (repository, coding conventions, test commands, definition of done) and saved prompts that apply to delegations and triage agents in their scope, versioned and audited.

#### AGENT-009 — Provider delegation protocols

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2 · *Register:* R-8

**Requirement.** Vector provides provider delegation protocols for the permitted workspace actors, with the records, outcomes and refusals below. The listed register rows hold the external proof.

**Acceptance.** Through the native product door and its declared counterpart:
1. Vector delegates to each named coding agent through the provider protocol documented in docs/contract/MECHANISMS.md, configured by an Admin in Settings → Agents with the buyer's own provider account, keys and runners (INTEG-001); every mechanism supports the same five steps — start with the AGENT-001 context, progress into the AGENT-002 session, a question and its answer, cancel, and a PR returned and linked (GITHUB-003) — and the session records which provider call carried each step.
2. Repositories must be connected through GITHUB-006 or GITLAB-001 first.
3. For each named provider, a protocol-faithful provider-edge fixture drives start, progress, question and answer, cancel and linked PR end to end; it accepts the signed callback and refuses an unsigned callback without changes. Real-account delegation is R-8.

### Target: API and platform

#### API-003 — Complete public API

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ACCESS-004

**Requirement.** Vector provides complete public api for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. A documented, versioned API covers every object a member can see or change — issues, comments, attachments, relations, labels, teams, workflow states, cycles, projects, milestones, initiatives, releases, documents, views, customers, customer requests, notifications and members — with cursor pagination, filtering, idempotency keys, rate limits with a retry delay, and the same version checks and access rules as the app.
2. API-003 inherits PROJ-011's milestone field and complete public milestone object operations.

#### API-004 — OAuth apps

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ACCESS-004

**Requirement.** Developers register OAuth 2.0 applications with chosen scopes; members authorize them from a consent screen; Admins can see and revoke every authorized app.

**Acceptance.** Through the native product door and its declared counterpart:
1. Developers register OAuth 2.0 applications with chosen scopes; members authorize them from a consent screen; Admins can see and revoke every authorized app.
2. Inherited from ROLE-001: Owners, Admins and Members authorize an OAuth app for themselves; Guests are refused (role matrix).

#### API-005 — SDK and docs

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-ACCESS-004

**Requirement.** A TypeScript SDK generated from the API schema and public developer documentation with examples for intake, sync and agents ship with each release.

**Acceptance.** Through the native product door and its declared counterpart:
1. A TypeScript SDK generated from the API schema and public developer documentation with examples for intake, sync and agents ship with each release.

#### WEBHOOK-002 — Webhooks for every object

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-AUDIT-001

**Requirement.** Webhook destinations can subscribe to create, update and delete events for issues, comments, reactions, projects, project updates, cycles, initiatives, releases, labels, customers, customer requests and agent sessions, filtered by team, with the delivery guarantees of WEBHOOK-001.

**Acceptance.** Through the native product door and its declared counterpart:
1. Webhook destinations can subscribe to create, update and delete events for issues, comments, reactions, projects, project updates, cycles, initiatives, releases, labels, customers, customer requests and agent sessions, filtered by team, with the delivery guarantees of WEBHOOK-001.

### Target: Import, export and portability

#### DATA-012 — GitHub Issues and Projects import

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1

**Requirement.** Vector provides github issues and projects import for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. An Owner or Admin imports from GitHub through a fine-grained token or the GitHub App (GITHUB-006): issues and pull-request references, comments with authors and times, labels, assignees, milestones (to milestones or cycles by mapping), Projects (v2) items, single-select, iteration and number fields (to status, cycles and custom fields), sub-issues and issue types, with attachment bytes fetched from GitHub's asset hosts, the same preflight, loss review, staged apply, reconciliation and rollback as DATA-006 and DATA-007, and an optional continuing sync (GITHUB-007).
2. An API import is one migration (DATA-017): it pages the whole organization or chosen repositories itself, splitting into runs as needed.

#### DATA-013 — Jira Cloud and Data Center API import

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1

**Requirement.** Vector provides jira cloud and data center api import for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. An Owner or Admin imports directly from Jira Cloud (API token or OAuth) or Jira Data Center: projects, issue types, workflows mapped to statuses, epics to projects (their Jira status category To Do, In Progress or Done mapped onto project statuses in an explicit step, PROJ-016, PROJ-046) or parents, sprints to cycles, fix versions to releases, components to labels, story points, custom fields, comments, worklogs reported as omissions, attachments with bytes, links (Blocks, Duplicates, Relates) and users matched by email, through the same reviewed staged runs as one migration (DATA-017), re-runnable so a second pass imports only issues created or changed in Jira since the first.
2. DATA-013 inherits PROJ-011's sentence "Jira fix versions and Linear milestones import to milestones or releases (RELEASE-001) by explicit mapping": the Jira importer reviews that choice, assignments and reconciliation before shipping.

#### DATA-014 — Linear API import

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1

**Requirement.** Vector provides linear api import for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. An Owner or Admin imports directly from Linear with an API key: teams, workflow states, issues, comments, attachments with bytes, projects, project updates, milestones, initiatives, cycles, labels, relations, customers with their domains, owners, statuses, tiers, sizes and revenue, customer requests, project statuses mapped by category (PROJ-016, PROJ-046) and templates, through the same reviewed staged runs as one migration (DATA-017), paging Linear's GraphQL API within its rate limits and resuming after a limit or interruption.
2. PROJ-001 inherits Linear project start and target dates, priority and project labels onto the native fields, checked in reconciliation, before Linear project import ships.
3. DATA-014 inherits PROJ-011's sentence "Jira fix versions and Linear milestones import to milestones or releases (RELEASE-001) by explicit mapping": the Linear importer reviews that choice, assignments and reconciliation before shipping.

#### DATA-015 — Plane, Huly and Shortcut import

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1

**Requirement.** Exports from Plane (CSV or API), Huly (JSON export) and Shortcut (CSV or API) import with documented field mappings through the reviewed staged run.

**Acceptance.** Through the native product door and its declared counterpart:
1. Exports from Plane (CSV or API), Huly (JSON export) and Shortcut (CSV or API) import with documented field mappings through the reviewed staged run.

#### DATA-016 — Transition sync

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1

**Requirement.** During a migration, a team can keep a Jira project or Linear team in one-way or two-way sync for issues, status, comments and assignee for a bounded period, with every unsynced field listed and an explicit end that freezes the source mapping.

**Acceptance.** Through the native product door and its declared counterpart:
1. During a migration, a team can keep a Jira project or Linear team in one-way or two-way sync for issues, status, comments and assignee for a bounded period, with every unsynced field listed and an explicit end that freezes the source mapping.

#### DATA-017 — Whole-workspace migration

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1

**Requirement.** An Owner or Admin starts one migration per source workspace (a Linear workspace, a Jira site, a GitHub organization, or a set of files from one of them).

**Acceptance.** Through the native product door and its declared counterpart:
1. An Owner or Admin starts one migration per source workspace (a Linear workspace, a Jira site, a GitHub organization, or a set of files from one of them).
2. A migration has one identifier and holds any number of reviewed runs — file runs the owner adds (DATA-002 to DATA-010) or runs the API importers create as they page the source (DATA-012 to DATA-014) — and is sized for at least 50,000 issues with their comments, attachment bytes and history.
3. Across every run of a migration: a relation (blocks, duplicate, related, parent, epic) whose other end is in an earlier or later run is held as pending and bound as soon as both issues exist, in whichever order the runs arrive, so no cross-run relation is lost; source people, teams, statuses, labels, projects, cycles, milestones and custom-field options are mapped once for the migration and reused by every run; and a source record lands exactly once even when it appears in two runs.
4. Re-running the migration (or adding a newer export) imports only records that are new or changed at the source since the last run and skips everything already imported, with no duplicates.
5. The migration has one reconciliation report and CSV (DATA-007's contents for all runs together) that also lists every relation still pending because its other end was never supplied, and an Owner or Admin finishes the migration only by explicitly accepting that list, which converts each into a reported omission.
6. Rollback acts per run as or on the whole migration.
7. A seeded Linear fixture imports 50,000 issues across six teams with comments, attachment bytes and 5,000 blocking, duplicate and parent links, at least 2,000 crossing run boundaries, in at least thirteen out-of-order runs. One report reconciles team, status, project, cycle and assignee counts and zero pending links; changing 100 source issues imports exactly those 100 on repeat, and a file migration missing its last run finishes only after the owner accepts the pending list.

#### DATA-018 — Old identifiers and links after a move

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1

**Requirement.** Vector provides old identifiers and links after a move for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every imported issue keeps its source key (for example `ENG-123` from Linear or `PROJ-45` from Jira) as an alias that stays resolvable after cutover: pasting a source URL (`linear.app/<workspace>/issue/ENG-123/...`, `<site>.atlassian.net/browse/PROJ-45`, a GitHub issue URL) into search, the command palette or a Vector link opens the imported issue; the imported-key bookmark redirect redirects to it for bookmarks; and a branch name, PR title or body, or commit message that names an old key ("Fixes ENG-123") links and moves the imported issue under GITHUB-003 and GITHUB-004 exactly as its Vector identifier would, while the owner keeps the alias active for each source prefix.
2. An alias that collides with a native Vector identifier never shadows it: the native issue wins and the alias is reported in the migration report.

### Security, privacy and agents' data

#### SEC-001 — Integration credentials

*Tier:* Core · *Cites:* BASE-SECRET-001

**Requirement.** Every integration and agent credential (GitHub App keys, Slack and Teams tokens, provider API tokens, OAuth refresh tokens) is stored encrypted, shown once, scoped to the least access the feature needs, excluded from archives, re-entered on restore, rotated on demand and revoked when the integration is removed.

**Acceptance.** Through the native product door and its declared counterpart:
1. Every integration and agent credential (GitHub App keys, Slack and Teams tokens, provider API tokens, OAuth refresh tokens) is stored encrypted, shown once, scoped to the least access the feature needs, excluded from archives, re-entered on restore, rotated on demand and revoked when the integration is removed.
2. The Slack bot-token paste path (SLACK-003), the Slack signing secret and member-confirmed Slack links (SLACK-004) and Discord webhook URLs are covered now.
3. SLACK-001’s manifest/OAuth install, Events API, @Vector issue creation and explicit identity linking beyond the member-confirmed email link remain SLACK-001’s.
4. SLACK-001, GITHUB-006 and AGENT-004 inherit these credential rules and their provider archive/re-entry acceptance cells for those capabilities.

#### SEC-002 — Model and agent data handling

*Tier:* Core · *Cites:* BASE-SECRET-001

**Requirement.** Vector provides model and agent data handling for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. Admins choose the model provider for triage suggestions, semantic search, Ask Vector and drafting (for example Anthropic, OpenAI, Amazon Bedrock, Google Vertex AI or a self-hosted model), see exactly which data categories each feature sends (declared in `seed.json` externals), can turn each feature off per workspace or team, and private-team content is never sent for members who cannot see it.
2. Every model provider entry in `seed.json` externals names the provider's commercial or API terms URL, states that customer content is not used for training under those terms, and lists the data categories and retention; Settings shows that entry beside the provider choice, and a provider with no such entry (including a self-hosted model the Admin adds) cannot be enabled until an Owner records its terms URL and confirms its no-training status, which is audited (ROLE-005).
3. An agent changing model configuration carries security, with commitment or gated when the provider step meets those definitions; the company's policy decides the call and a person's confirmation is never fabricated.

#### SEC-003 — Erasure across integrations

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-DATA-003

**Requirement.** Erasing a member or an issue (ROLE-012, ISSUE-010, DATA-011) also unlinks their Slack, Teams, GitHub and agent identities, removes their content from synced threads Vector posted, deletes cached previews and embeddings, and records which external copies (in GitHub, Slack or a ticketing tool) Vector cannot recall.

**Acceptance.** Through the native product door and its declared counterpart:
1. Erasing a member or an issue (ROLE-012, ISSUE-010, DATA-011) also unlinks their Slack, Teams, GitHub and agent identities, removes their content from synced threads Vector posted, deletes cached previews and embeddings, and records which external copies (in GitHub, Slack or a ticketing tool) Vector cannot recall.

### Agent surface

**Specialist: software delivery coordinator.** It carries incoming reports through triage, planning, delegated fixes, verification and customer follow-up.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company's policy decides every call; this surface presets no disposition.

**How Vector computes each class.**

- **standard:** reversible internal issues, comments, triage, plans and reads, measured by items.
- **external:** a provider message, customer reply or record newly visible outside the workspace, measured by recipients and known, new or public counterparty.
- **money:** paid model or coding-agent dispatch, measured by estimated amount, currency and provider.
- **accounts:** creating an outside account or paid resource, measured by provider.
- **gated:** a provider-owned personal consent, card-entry, identity or terms step, measured by provider and step.
- **access:** staff, team, role, device and grant authority, measured by people and widening or narrowing.
- **security:** protective settings and credential handling, measured by the setting or credential kind.
- **destructive:** permanent deletion and erasure without product Undo, measured by affected items.
- **sensitive:** typed health, identity, bank, card or payroll records, measured by records and data kind.
- **commitment:** a relied-on spec, verification or review sign-off, measured by value and counterparty when present.
- **live:** a merge or deployment that changes a running service, measured by the service.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `vector.ops.workspace_access` | Workspace access | OPS-001 | standard | not implemented |
| `vector.ops.member_management` | Member management | OPS-002 | standard | not implemented |
| `vector.ops.workspace_time` | Workspace time | OPS-003 | standard | not implemented |
| `vector.ops.safe_removal` | Safe removal | OPS-004 | security | not implemented |
| `vector.team.team_identity` | Team identity | TEAM-001 | standard | not implemented |
| `vector.team.team_workflow` | Team workflow | TEAM-002 | standard | not implemented |
| `vector.team.team_archiving` | Team archiving | TEAM-003 | standard | not implemented |
| `vector.team.status_removal` | Status removal | TEAM-004 | standard | not implemented |
| `vector.issue.creation` | Creation | ISSUE-001 | standard | not implemented |
| `vector.issue.stable_identifiers` | Stable identifiers | ISSUE-002 | standard | not implemented |
| `vector.issue.priority` | Priority | ISSUE-003 | standard | not implemented |
| `vector.issue.status_transitions` | Status transitions | ISSUE-004 | standard | not implemented |
| `vector.issue.assignment` | Assignment | ISSUE-005 | standard | not implemented |
| `vector.issue.concurrent_edits` | Concurrent edits | ISSUE-006 | standard | not implemented |
| `vector.issue.activity_history` | Activity history | ISSUE-007 | standard | not implemented |
| `vector.issue.comments_and_safe_comment_removal` | Comments and safe comment removal | ISSUE-008 | standard | not implemented |
| `vector.issue.discussion_threads_and_resolution` | Discussion threads and resolution | ISSUE-029 | standard | not implemented |
| `vector.issue.anchored_inline_comments` | Anchored inline comments | ISSUE-030 | standard | not implemented |
| `vector.issue.attachments_and_links` | Attachments and links | ISSUE-009 | standard | not implemented |
| `vector.issue.deletion` | Deletion | ISSUE-010 | standard | not implemented |
| `vector.issue.estimates` | Estimates | ISSUE-011 | standard | not implemented |
| `vector.issue.moving_teams` | Moving teams | ISSUE-012 | standard | not implemented |
| `vector.issue.mentions` | Mentions | ISSUE-013 | standard | not implemented |
| `vector.issue.labels` | Labels | ISSUE-014 | standard | not implemented |
| `vector.rel.dependencies` | Dependencies | REL-001 | standard | not implemented |
| `vector.rel.blocked_state` | Blocked state | REL-002 | standard | not implemented |
| `vector.rel.duplicate_decision` | Duplicate decision | REL-003 | standard | not implemented |
| `vector.rel.canonical_duplicates` | Canonical duplicates | REL-004 | standard | not implemented |
| `vector.rel.undo_duplicate` | Undo duplicate | REL-005 | standard | not implemented |
| `vector.rel.parent_and_child` | Parent and child | REL-006 | standard | not implemented |
| `vector.intake.intake_creation` | Intake creation | INTAKE-001 | standard | not implemented |
| `vector.intake.idempotent_sources` | Idempotent sources | INTAKE-002 | standard | not implemented |
| `vector.intake.evidence_revisions` | Evidence revisions | INTAKE-003 | standard | not implemented |
| `vector.intake.inspectable_assessment` | Inspectable assessment | INTAKE-004 | standard | not implemented |
| `vector.intake.accept` | Accept | INTAKE-005 | standard | not implemented |
| `vector.intake.defer` | Defer | INTAKE-006 | standard | not implemented |
| `vector.intake.decline` | Decline | INTAKE-007 | standard | not implemented |
| `vector.intake.evidence_after_a_terminal_decision` | Evidence after a terminal decision | INTAKE-008 | standard | not implemented |
| `vector.intake.source_failure` | Source failure | INTAKE-009 | standard | not implemented |
| `vector.intake.decision_policy` | Decision policy | INTAKE-010 | standard | not implemented |
| `vector.intake.source_registration` | Source registration | INTAKE-011 | standard | not implemented |
| `vector.curr.disjoint_stream` | Disjoint stream | CURR-001 | standard | not implemented |
| `vector.curr.needs_decision` | Needs decision | CURR-002 | standard | not implemented |
| `vector.curr.now` | Now | CURR-003 | standard | not implemented |
| `vector.curr.next` | Next | CURR-004 | standard | not implemented |
| `vector.curr.recently_done` | Recently done | CURR-005 | standard | not implemented |
| `vector.curr.explainable_attention` | Explainable attention | CURR-006 | standard | not implemented |
| `vector.curr.ranking` | Ranking | CURR-007 | standard | not implemented |
| `vector.curr.freshness` | Freshness | CURR-008 | standard | not implemented |
| `vector.curr.stream_controls` | Stream controls | CURR-009 | standard | not implemented |
| `vector.work.personal_queue` | Personal queue | WORK-001 | standard | not implemented |
| `vector.work.personal_defaults` | Personal defaults | WORK-002 | standard | not implemented |
| `vector.work.cycle_context` | Cycle context | WORK-003 | standard | not implemented |
| `vector.proj.project_record` | Project record | PROJ-001 | standard | not implemented |
| `vector.proj.manual_lifecycle` | Manual lifecycle | PROJ-002 | standard | not implemented |
| `vector.proj.project_membership` | Project membership | PROJ-003 | standard | not implemented |
| `vector.proj.progress` | Progress | PROJ-004 | standard | not implemented |
| `vector.proj.health` | Health | PROJ-005 | standard | not implemented |
| `vector.proj.risk_explanation` | Risk explanation | PROJ-006 | standard | not implemented |
| `vector.proj.portfolio` | Portfolio | PROJ-007 | standard | not implemented |
| `vector.proj.historical_truth` | Historical truth | PROJ-008 | standard | not implemented |
| `vector.proj.project_archiving` | Project archiving | PROJ-009 | standard | not implemented |
| `vector.cycle.time_box` | Time box | CYCLE-001 | standard | not implemented |
| `vector.cycle.commitment` | Commitment | CYCLE-002 | standard | not implemented |
| `vector.cycle.progress_and_capacity` | Progress and capacity | CYCLE-003 | standard | not implemented |
| `vector.cycle.closure_and_rollover` | Closure and rollover | CYCLE-004 | standard | not implemented |
| `vector.cycle.closure_snapshot` | Closure snapshot | CYCLE-005 | standard | not implemented |
| `vector.cycle.missing_next_cycle` | Missing next cycle | CYCLE-006 | standard | not implemented |
| `vector.search.global_search` | Global search | SEARCH-001 | standard | not implemented |
| `vector.search.exact_identifier` | Exact identifier | SEARCH-002 | standard | not implemented |
| `vector.search.index_freshness` | Index freshness | SEARCH-003 | standard | not implemented |
| `vector.view.issue_controls` | Issue controls | VIEW-001 | standard | not implemented |
| `vector.view.saved_views` | Saved views | VIEW-002 | standard | not implemented |
| `vector.view.control_persistence` | Control persistence | VIEW-003 | standard | not implemented |
| `vector.view.bulk_edit` | Bulk edit | VIEW-004 | standard | not implemented |
| `vector.view.team_board` | Team board | VIEW-005 | standard | not implemented |
| `vector.notify.inbox_events` | Inbox events | NOTIFY-001 | standard | not implemented |
| `vector.notify.followers` | Followers | NOTIFY-002 | standard | not implemented |
| `vector.notify.no_self_notification` | No self-notification | NOTIFY-003 | standard | not implemented |
| `vector.notify.read_and_mute` | Read and mute | NOTIFY-004 | standard | not implemented |
| `vector.notify.due_reminders` | Due reminders | NOTIFY-005 | standard | not implemented |
| `vector.notify.assignment_and_mention_email` | Assignment and mention email | NOTIFY-006 | standard | not implemented |
| `vector.api.native_scoped_api` | Native scoped API | API-001 | standard | not implemented |
| `vector.api.token_authority_and_usage` | Token authority and usage | API-002 | security | not implemented |
| `vector.role.workspace_roles` | Workspace roles | ROLE-001 | access (+ security) | not implemented |
| `vector.role.private_teams` | Private teams | ROLE-002 | access (+ security) | not implemented |
| `vector.role.guests` | Guests | ROLE-003 | access (+ security) | not implemented |
| `vector.role.single_sign_on_and_provisioning` | Single sign-on and provisioning | ROLE-004 | security | not implemented |
| `vector.role.audit_log` | Audit log | ROLE-005 | standard | not implemented |
| `vector.role.apps_and_agents_as_actors` | Apps and agents as actors | ROLE-006 | access (+ security) | not implemented |
| `vector.role.team_membership_and_team_owners` | Team membership and team owners | ROLE-007 | access (+ security) | not implemented |
| `vector.role.operator_and_permission_coverage` | Operator and permission coverage | ROLE-008 | standard | not implemented |
| `vector.role.team_managed_permissions` | Team-managed permissions | ROLE-009 | access (+ security) | not implemented |
| `vector.role.offer_google_sign_in` | Offer Google sign-in | ROLE-010 | access (+ security) | not implemented |
| `vector.role.member_passkeys` | Member passkeys | ROLE-014 | access (+ security) | not implemented |
| `vector.role.suspend_a_member_and_withdraw_access` | Suspend a member and withdraw access | ROLE-011 | security | not implemented |
| `vector.role.suspended_work_and_member_directory` | Suspended work and member directory | ROLE-015 | security | not implemented |
| `vector.role.reactivate_the_same_member` | Reactivate the same member | ROLE-016 | security | not implemented |
| `vector.role.portable_suspended_member_state` | Portable suspended-member state | ROLE-017 | security | not implemented |
| `vector.role.erase_a_member_s_personal_data` | Erase a member's personal data | ROLE-012 | destructive (+ sensitive) | not implemented |
| `vector.role.read_only_viewers` | Read-only Viewers | ROLE-013 | access (+ security) | not implemented |
| `vector.team.team_settings` | Team settings | TEAM-005 | standard | not implemented |
| `vector.team.sub_teams` | Sub-teams | TEAM-006 | standard | not implemented |
| `vector.team.team_join_permissions` | Team join permissions | TEAM-007 | standard | not implemented |
| `vector.team.who_may_create_teams` | Who may create teams | TEAM-008 | standard | not implemented |
| `vector.issue.issue_templates` | Issue templates | ISSUE-016 | standard | not implemented |
| `vector.issue.reactions` | Reactions | ISSUE-017 | standard | not implemented |
| `vector.issue.description_history` | Description history | ISSUE-018 | standard | not implemented |
| `vector.issue.sub_issue_progress` | Sub-issue progress | ISSUE-019 | standard | not implemented |
| `vector.issue.undo_an_issue_change` | Undo an issue change | ISSUE-020 | standard | not implemented |
| `vector.issue.recently_deleted_issues_and_restore` | Recently deleted issues and restore | ISSUE-031 | standard | not implemented |
| `vector.issue.issue_deletion_retention_and_purge` | Issue deletion retention and purge | ISSUE-032 | destructive (+ sensitive) | not implemented |
| `vector.issue.issue_types` | Issue types | ISSUE-021 | standard | not implemented |
| `vector.issue.issue_start_date` | Issue start date | ISSUE-022 | standard | not implemented |
| `vector.issue.copy_issue` | Copy issue | ISSUE-023 | standard | not implemented |
| `vector.issue.put_files_into_issue_text` | Put files into issue text | ISSUE-024 | standard | not implemented |
| `vector.issue.inline_image_display` | Inline image display | ISSUE-033 | standard | not implemented |
| `vector.issue.inline_video_and_resumable_upload` | Inline video and resumable upload | ISSUE-034 | standard | not implemented |
| `vector.issue.draft_files_and_removed_embeds` | Draft files and removed embeds | ISSUE-035 | standard | not implemented |
| `vector.issue.embeds_across_clients_and_archives` | Embeds across clients and archives | ISSUE-036 | standard | not implemented |
| `vector.issue.checklists` | Checklists | ISSUE-025 | standard | not implemented |
| `vector.issue.editor_formatting_and_slash_commands` | Editor formatting and slash commands | ISSUE-026 | standard | not implemented |
| `vector.issue.issue_references_and_backlinks` | Issue references and backlinks | ISSUE-027 | standard | not implemented |
| `vector.field.custom_field_definitions` | Custom field definitions | FIELD-001 | standard | not implemented |
| `vector.field.custom_fields_in_views_search_api_and_imports` | Custom fields in views, search, API and imports | FIELD-002 | standard | not implemented |
| `vector.rel.related_issues` | Related issues | REL-007 | standard | not implemented |
| `vector.triage.triage_responsibility` | Triage responsibility | TRIAGE-001 | standard | not implemented |
| `vector.triage.triage_routing_rules` | Triage routing rules | TRIAGE-002 | standard | not implemented |
| `vector.triage.agent_triage_suggestions` | Agent triage suggestions | TRIAGE-003 | standard | not implemented |
| `vector.triage.request_forms` | Request forms | TRIAGE-004 | standard | not implemented |
| `vector.triage.email_intake` | Email intake | TRIAGE-005 | standard | not implemented |
| `vector.cust.customer_requests_on_issues` | Customer requests on issues | CUST-001 | standard | not implemented |
| `vector.cust.customer_weighted_planning` | Customer-weighted planning | CUST-002 | standard | not implemented |
| `vector.cust.close_the_loop_with_requesters` | Close the loop with requesters | CUST-003 | standard or external | not implemented |
| `vector.cust.customer_records` | Customer records | CUST-005 | standard | not implemented |
| `vector.cust.customer_identity_and_merging` | Customer identity and merging | CUST-006 | standard | not implemented |
| `vector.cust.customers_list_and_customer_pages` | Customers list and customer pages | CUST-007 | standard | not implemented |
| `vector.cust.adding_customer_requests_by_hand` | Adding customer requests by hand | CUST-008 | standard | not implemented |
| `vector.work.created_subscribed_and_activity_tabs` | Created, Subscribed and Activity tabs | WORK-004 | standard | not implemented |
| `vector.proj.project_updates` | Project updates | PROJ-010 | standard | not implemented |
| `vector.proj.milestones` | Milestones | PROJ-011 | standard | not implemented |
| `vector.proj.project_templates` | Project templates | PROJ-012 | standard | not implemented |
| `vector.proj.project_documents_and_specs` | Project documents and specs | PROJ-013 | standard | not implemented |
| `vector.proj.project_members_and_teams` | Project members and teams | PROJ-014 | standard | not implemented |
| `vector.proj.project_dependencies` | Project dependencies | PROJ-015 | standard | not implemented |
| `vector.proj.define_project_status_categories` | Define project status categories | PROJ-016 | standard | not implemented |
| `vector.proj.team_project_status_mapping` | Team project status mapping | PROJ-046 | standard | not implemented |
| `vector.proj.recoverable_project_deletion` | Recoverable project deletion | PROJ-017 | standard | not implemented |
| `vector.init.initiatives` | Initiatives | INIT-001 | standard | not implemented |
| `vector.init.initiative_roll_up` | Initiative roll-up | INIT-002 | standard | not implemented |
| `vector.init.roadmap_timeline` | Roadmap timeline | INIT-003 | standard | not implemented |
| `vector.init.leadership_digest` | Leadership digest | INIT-004 | standard | not implemented |
| `vector.cycle.automatic_cycle_schedule` | Automatic cycle schedule | CYCLE-007 | standard | not implemented |
| `vector.cycle.automatic_cycle_membership` | Automatic cycle membership | CYCLE-008 | standard | not implemented |
| `vector.release.releases` | Releases | RELEASE-001 | standard | not implemented |
| `vector.release.deployment_tracking` | Deployment tracking | RELEASE-002 | standard | not implemented |
| `vector.release.release_notes` | Release notes | RELEASE-003 | standard | not implemented |
| `vector.search.advanced_filters` | Advanced filters | SEARCH-004 | standard | not implemented |
| `vector.search.meaning_based_search` | Meaning-based search | SEARCH-005 | standard | not implemented |
| `vector.view.manual_order` | Manual order | VIEW-006 | standard | not implemented |
| `vector.view.timeline_and_calendar_views` | Timeline and calendar views | VIEW-007 | standard | not implemented |
| `vector.view.display_options` | Display options | VIEW-008 | standard | not implemented |
| `vector.view.workspace_wide_views` | Workspace-wide views | VIEW-009 | standard | not implemented |
| `vector.view.sidebar_favorites` | Sidebar favorites | VIEW-010 | standard | not implemented |
| `vector.notify.channels_and_digests` | Channels and digests | NOTIFY-007 | standard | not implemented |
| `vector.notify.snooze_and_reminders` | Snooze and reminders | NOTIFY-008 | standard | not implemented |
| `vector.notify.subscriptions` | Subscriptions | NOTIFY-009 | standard | not implemented |
| `vector.notify.personal_time_zone_and_working_hours` | Personal time zone and working hours | NOTIFY-010 | standard | not implemented |
| `vector.auto.recurring_issues` | Recurring issues | AUTO-001 | standard | not implemented |
| `vector.auto.workflow_rules` | Workflow rules | AUTO-002 | standard | not implemented |
| `vector.auto.auto_close_and_auto_archive` | Auto-close and auto-archive | AUTO-003 | standard | not implemented |
| `vector.auto.slas` | SLAs | AUTO-004 | standard | not implemented |
| `vector.auto.update_reminders` | Update reminders | AUTO-005 | standard | not implemented |
| `vector.auto.due_soon_rules` | Due-soon rules | AUTO-006 | standard | not implemented |
| `vector.report.insights` | Insights | REPORT-001 | standard | not implemented |
| `vector.report.cycle_and_project_charts` | Cycle and project charts | REPORT-002 | standard | not implemented |
| `vector.report.project_completion_forecast` | Project completion forecast | REPORT-006 | standard | not implemented |
| `vector.report.dashboards` | Dashboards | REPORT-003 | standard | not implemented |
| `vector.report.workload` | Workload | REPORT-004 | standard | not implemented |
| `vector.report.warehouse_and_spreadsheet_export` | Warehouse and spreadsheet export | REPORT-005 | standard | not implemented |
| `vector.integ.guided_connection_from_settings` | Guided connection from Settings | INTEG-001 | security (+ access, accounts, gated, external) | not implemented |
| `vector.integ.integration_health_and_repair` | Integration health and repair | INTEG-002 | security (+ access, accounts, gated, external) | not implemented |
| `vector.github.github_app` | GitHub App | GITHUB-006 | security (+ access, accounts, gated, external) | not implemented |
| `vector.github.provider_backed_create_branch` | Provider-backed create branch | GITHUB-008 | standard (+ external) | not implemented |
| `vector.slack.slack_app` | Slack app | SLACK-001 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.issues_from_slack_with_synced_threads` | Issues from Slack with synced threads | SLACK-002 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.slack_and_discord_channel_bindings` | Slack and Discord channel bindings | SLACK-003 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.connect_and_remove_channel_credentials` | Connect and remove channel credentials | SLACK-006 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.durable_minimal_channel_posts` | Durable minimal channel posts | SLACK-007 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.create_and_bind_a_slack_channel` | Create and bind a Slack channel | SLACK-008 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.channel_safety_and_explicit_mapping` | Channel safety and explicit mapping | SLACK-009 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.link_and_unlink_your_slack_identity` | Link and unlink your Slack identity | SLACK-004 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.personal_slack_delivery` | Personal Slack delivery | SLACK-010 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.signed_slack_notification_actions` | Signed Slack notification actions | SLACK-011 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.slack_interactivity_secret_custody` | Slack interactivity secret custody | SLACK-012 | external (+ access, security, accounts, gated) | not implemented |
| `vector.slack.link_previews` | Link previews | SLACK-005 | external (+ access, security, accounts, gated) | not implemented |
| `vector.cal.calendar_feeds` | Calendar feeds | CAL-001 | external (+ access) | not implemented |
| `vector.agent.delegate_an_issue_to_an_agent` | Delegate an issue to an agent | AGENT-001 | standard (+ external, money, accounts, gated, sensitive, security) | not implemented |
| `vector.agent.agent_session_on_the_issue` | Agent session on the issue | AGENT-002 | standard | not implemented |
| `vector.agent.reviewable_agent_output_and_policy_decided_completion` | Reviewable agent output and policy-decided completion | AGENT-003 | standard (+ commitment, external, live) | not implemented |
| `vector.agent.agent_permissions_and_budgets` | Agent permissions and budgets | AGENT-004 | security | not implemented |
| `vector.agent.mcp_server` | MCP server | AGENT-005 | standard | not implemented |
| `vector.agent.agent_platform` | Agent platform | AGENT-006 | standard (+ external, money, accounts, gated, sensitive, security) | not implemented |
| `vector.agent.ask_vector` | Ask Vector | AGENT-007 | standard | not implemented |
| `vector.agent.agent_guidance` | Agent guidance | AGENT-008 | standard | not implemented |
| `vector.agent.provider_delegation_protocols` | Provider delegation protocols | AGENT-009 | standard | not implemented |
| `vector.api.complete_public_api` | Complete public API | API-003 | standard | not implemented |
| `vector.api.oauth_apps` | OAuth apps | API-004 | standard | not implemented |
| `vector.api.sdk_and_docs` | SDK and docs | API-005 | standard | not implemented |
| `vector.sec.integration_credentials` | Integration credentials | SEC-001 | security | not implemented |
| `vector.sec.model_and_agent_data_handling` | Model and agent data handling | SEC-002 | standard (+ external, money, accounts, gated, sensitive, security) | not implemented |
| `vector.sec.erasure_across_integrations` | Erasure across integrations | SEC-003 | security | not implemented |
| `vector.push.issue_to_spec` | Issue to spec | PUSH-001 | standard (+ commitment) | not implemented |
| `vector.push.spec_to_tested_pr` | Spec to tested PR | PUSH-002 | standard (+ commitment, external, live) | not implemented |
| `vector.push.verified_deployment` | Verified deployment | PUSH-003 | standard (+ commitment, external, live) | not implemented |
| `vector.push.outcome_verification_before_close` | Outcome verification before close | PUSH-004 | standard (+ commitment) | not implemented |
| `vector.push.customer_follow_through` | Customer follow-through | PUSH-005 | standard or external | not implemented |
| `vector.push.blocked_work_follow_up` | Blocked-work follow-up | PUSH-006 | standard or external | not implemented |
| `vector.push.plans_with_uncertainty` | Plans with uncertainty | PUSH-007 | standard (+ commitment) | not implemented |
| `vector.push.incident_follow_up_loop` | Incident follow-up loop | PUSH-008 | standard or external | not implemented |
| `vector.push.standups_and_cycle_summaries` | Standups and cycle summaries | PUSH-009 | standard or external | not implemented |
| `vector.push.agent_accountability_ledger` | Agent accountability ledger | PUSH-010 | standard | not implemented |

**Resources.** Vector URI templates use `vector://{installation}/{kind}/{id}` for issues, comments, files, evidence, intake decisions, projects, milestones, documents, cycles, initiatives, releases, customers, requests, views, notifications and delegated sessions.

**Events.** Issue, comment, triage, project, cycle, release, customer-request and session changes; linked provider and incident events carry their record URIs. **Prompts.** Triage (TRIAGE-003), plan-cycle (CYCLE-002, PUSH-007), delegate-issue (AGENT-001), verify-fix (PUSH-004) and close-customer-loop (CUST-003, PUSH-005).

**Not tools, and why.**

- HOME-001: a person’s interactive screen or device capability.
- SETUP-001: a person’s interactive screen or device capability.
- ISSUE-015: a person’s interactive screen or device capability.
- CMD-001: a person’s interactive screen or device capability.
- CMD-002: a person’s interactive screen or device capability.
- CMD-003: a person’s interactive screen or device capability.
- GITHUB-001: a provider connector and its configured event door.
- GITHUB-002: a provider connector and its configured event door.
- WEBHOOK-001: a provider connector and its configured event door.
- DATA-001: the import/export door and its archive format.
- DATA-002: the import/export door and its archive format.
- DATA-003: the import/export door and its archive format.
- DATA-004: the import/export door and its archive format.
- DATA-005: the import/export door and its archive format.
- DATA-006: the import/export door and its archive format.
- DATA-007: the import/export door and its archive format.
- DATA-008: the import/export door and its archive format.
- DATA-009: the import/export door and its archive format.
- DATA-010: the import/export door and its archive format.
- DATA-011: the import/export door and its archive format.
- OWNER-CLAIM-001: an installation fact and its owner-claim door.
- EDITOR-001: a person’s interactive screen or device capability.
- ISSUE-028: a person’s interactive screen or device capability.
- CUST-004: the published product boundary.
- VIEW-011: a person’s interactive screen or device capability.
- CMD-004: a person’s interactive screen or device capability.
- SYNC-001: a person’s interactive screen or device capability.
- SYNC-002: a person’s interactive screen or device capability.
- SYNC-003: a person’s interactive screen or device capability.
- MOBILE-001: a person’s interactive screen or device capability.
- MOBILE-002: a person’s interactive screen or device capability.
- MOBILE-003: a person’s interactive screen or device capability.
- MOBILE-004: a person’s interactive screen or device capability.
- MOBILE-005: a person’s interactive screen or device capability.
- GITHUB-003: a provider connector and its configured event door.
- GITHUB-004: a provider connector and its configured event door.
- GITHUB-005: a provider connector and its configured event door.
- GITHUB-007: a provider connector and its configured event door.
- GITLAB-001: a provider connector and its configured event door.
- GITLAB-002: a provider connector and its configured event door.
- BITBUCKET-001: a provider connector and its configured event door.
- CI-001: a provider connector and its configured event door.
- TEAMS-001: a provider connector and its configured event door.
- SUPPORT-001: a provider connector and its configured event door.
- SUPPORT-002: a provider connector and its configured event door.
- ERROR-001: a provider connector and its configured event door.
- ERROR-002: a provider connector and its configured event door.
- DESIGN-001: a provider connector and its configured event door.
- DOCS-001: a provider connector and its configured event door.
- CONNECT-001: a provider connector and its configured event door.
- WEBHOOK-002: a provider connector and its configured event door.
- DATA-012: the import/export door and its archive format.
- DATA-013: the import/export door and its archive format.
- DATA-014: the import/export door and its archive format.
- DATA-015: the import/export door and its archive format.
- DATA-016: the import/export door and its archive format.
- DATA-017: the import/export door and its archive format.
- DATA-018: the import/export door and its archive format.

**Limits.** Request rate, body and attachment capacities are installation capacities documented in the product limits. Business thresholds and provider spend caps are the company's policy.

**Handoffs.** Receives Spool regressions, resolved Oncall/PagerDuty incidents, support conversations and Penny requests; emits linked issue, release and verification outcomes for those specialists.

#### SURFACE-001 — Registry of Vector jobs

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. The action registry and the tool table name exactly the same Vector jobs and Core clauses, including the explicit non-tool reasons.
2. A fixture completes each issue, discussion, triage, planning, customer, reporting and delegated-work job through its named tool.

#### SURFACE-002 — Internal work and outside exposure

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. A reversible internal issue, comment, triage or planning change carries standard with its item count.
2. A share, customer reply, provider message or change exposing a record outside the workspace carries external with recipient count and known, new or public counterparty.
3. Changing a destination to an outsider changes the class, including a comment or move into an already externally visible subject.

#### SURFACE-003 — Provider spend and resources

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. A paid model or coding-agent dispatch carries money with estimated amount, currency and provider counterparty.
2. Creating a provider account or paid resource carries accounts with the provider.
3. A provider-owned consent, hosted card entry or identity/terms step carries gated with its provider and step; an available company-credential API route is classified from its actual effects.

#### SURFACE-004 — Membership and credentials

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. A member, team, role, device or agent-grant change carries access with affected people and the direction of authority.
2. Changing protective settings or handling provider credentials carries security with the setting or credential kind.

#### SURFACE-005 — Irreversible work and regulated records

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. Permanent deletion, personal erasure and irreversible cleanup carry destructive with affected item count; recoverable trash and Undo remain standard.
2. A call touching regulated identity, health, bank, card or payroll fields carries sensitive with record count and data kind, derived from stored typed records rather than agent-supplied labels.

#### SURFACE-006 — Sign-off and running services

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. A relied-on specification, verification or code-review sign-off carries commitment with value and counterparty where present.
2. A merge or deployment that changes a running service carries live with the affected service; merely reading a deployment receipt remains standard.

#### SURFACE-007 — Vector record resources

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. Resources cover issues, comments, attachments, evidence, intake decisions, projects, milestones, documents, cycles, initiatives, releases, customers, requests, views, notifications and agent sessions.
2. An issue mutation returns the changed issue resource; a delegation returns the session and linked issue resources.

#### SURFACE-008 — Vector event handoffs

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. Issue, triage, project, cycle, release, customer-request and delegated-session changes expose the same record identities as their resources.
2. A Spool regression or resolved Oncall incident enters the linked issue or follow-up job, and completion emits the linked Penny or support handoff once.

#### SURFACE-009 — Specialist prompts and documentation

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. Prompts cover triage, plan-cycle, delegate-issue, verify-fix and close-customer-loop, naming their Core clauses.
2. The on-site agent guide describes each Vector job, its computed-class scenario, resource and handoff from the registry.

#### SURFACE-010 — Embedded and external specialist parity

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. The triage suggester, Ask Vector, specification drafter and verification agent use the same Vector jobs as an outside specialist.
2. On the same issue fixture each produces the same product outcome under the company policy revision in force.

#### SURFACE-011 — Capacity and provider costs

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. A bulk issue call exercises the documented 250-issue operation size and one-MiB request-body boundary on Vector issue records; those capacities limit each call rather than daily business volume.
2. An expensive delegation shows its provider estimate and recorded cost against the company-set budget, without making customer revenue into a payment.

#### SURFACE-012 — Recoverable planning and safe removal

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. A specialist edits an issue, undoes the change and reads its restored state and activity.
2. A specialist attempts permanent deletion of a canonical issue with duplicates and reads the unchanged records and refusal; removing the duplicate relation permits the allowed deletion.

#### SURFACE-013 — Software delivery specialist week

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** The software delivery specialist performs this Vector-specific job through the shared agent door.

**Acceptance.** Through the native product door and its declared counterpart:
1. A stranger agent given only the installation URL triages reports, finds duplicate evidence, plans a cycle, delegates a fix, reads the returned PR and deployment evidence, verifies the outcome and closes the linked customer loop through MCP.
2. Under a company policy with every class autonomous, the seeded week completes with no policy-held call.
3. Under the held company policy, the same week shows internal work in review and every other declared class held until the signed-in test person takes the step that policy names; rejection leaves the pending change unapplied.
4. The week reads each issue, session, customer reply and outcome through its resource, and reconciles their events and class decisions.


## Push further

### Push further

#### PUSH-001 — Issue to spec

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** For an accepted issue, an agent drafts a spec: the problem in the reporter's and customers' words (CUST-001), the evidence (Spool errors, tickets, measurements), acceptance criteria written as checkable statements, the code areas likely affected (from repository search through GITHUB-006 or GITLAB-001), open questions and a test plan.

**Acceptance.** Through the native product door and its declared counterpart:
1. For an accepted issue, an agent drafts a spec: the problem in the reporter's and customers' words (CUST-001), the evidence (Spool errors, tickets, measurements), acceptance criteria written as checkable statements, the code areas likely affected (from repository search through GITHUB-006 or GITLAB-001), open questions and a test plan.
2. Attaching a specification or using it for delegation carries standard, adding commitment when it records a sign-off others rely on; the company's policy decides.
3. In the held run the assignee edits and approves the exact revision before it is attached or used.

#### PUSH-002 — Spec to tested PR

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** Vector provides spec to tested pr for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. When an issue with a specification accepted under the company's policy is delegated (AGENT-001), the agent must return a PR whose tests map to the spec's acceptance criteria; Vector shows each criterion with the test that covers it, the CI result (GITHUB-005) and any criterion left uncovered, and refuses to mark the session done while required checks fail.
2. A code-host review carries commitment when it records a relied-on sign-off; the company's policy decides an agent's review, and a person's review remains attributed to that person.

#### PUSH-003 — Verified deployment

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** After merge, Vector follows the merged commit through CI and deployments (RELEASE-002, CI-001) and records when it reached production; if it does not deploy within the team's expected window, the assignee is asked why.

**Acceptance.** Through the native product door and its declared counterpart:
1. After merge, Vector follows the merged commit through CI and deployments (RELEASE-002, CI-001) and records when it reached production; if it does not deploy within the team's expected window, the assignee is asked why.

#### PUSH-004 — Outcome verification before close

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** After production deploy, a verification agent watches the issue's evidence for a team-set window (default 72 hours): linked Spool or Sentry error groups (rate and regressions in the new release), Uptime checks, HappyToHelp, Zendesk or Intercom tickets reopening, Penny requests and the spec's measurable criteria.

**Acceptance.** Through the native product door and its declared counterpart:
1. After production deploy, a verification agent watches the issue's evidence for a team-set window (default 72 hours): linked Spool or Sentry error groups (rate and regressions in the new release), Uptime checks, HappyToHelp, Zendesk or Intercom tickets reopening, Penny requests and the spec's measurable criteria.
2. It then proposes "Verified — problem gone" with the before and after evidence, or "Not fixed" with what it saw.
3. Recording Verified or reopening carries standard, adding commitment for a relied-on verification sign-off; the company's policy decides, and the held-policy run has the assignee confirm the evidence before that change.
4. Issues without linked evidence say so instead of claiming verification.

#### PUSH-005 — Customer follow-through

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** Vector provides customer follow-through for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. When an issue with customer requests is verified, an agent drafts a reply for each linked ticket and request, in the customer's context and without private engineering details, and classifies each customer-visible send as external; the company's policy decides whether it runs or is held for the support owner to edit, approve or skip; sends go through HappyToHelp, Zendesk, Intercom, Front or Penny, never directly from Vector, and are never sent twice.

#### PUSH-006 — Blocked-work follow-up

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** An agent watches dependencies, overdue work, stale reviews and unanswered questions; it identifies the missing decision or evidence, asks the accountable person a precise question in Vector or Slack, and revisits at the time they promise, within the team's reminder budget.

**Acceptance.** Through the native product door and its declared counterpart:
1. An agent watches dependencies, overdue work, stale reviews and unanswered questions; it identifies the missing decision or evidence, asks the accountable person a precise question in Vector or Slack, and revisits at the time they promise, within the team's reminder budget.
2. Priority, due-date and assignee changes carry standard and follow the company's policy; a person's stop ends the follow-ups.

#### PUSH-007 — Plans with uncertainty

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** For a project, release or cycle, an agent uses historical throughput (REPORT-001), current scope, dependencies, unestimated work and people's capacity to propose two or three feasible scope/date options with confidence ranges and the assumptions behind them.

**Acceptance.** Through the native product door and its declared counterpart:
1. For a project, release or cycle, an agent uses historical throughput (REPORT-001), current scope, dependencies, unestimated work and people's capacity to propose two or three feasible scope/date options with confidence ranges and the assumptions behind them.
2. Choosing a plan carries standard, adding commitment when it binds a sign-off; the company's policy decides, and the selected plan is recorded and later compared with what happened.
3. It never ranks individuals.

#### PUSH-008 — Incident follow-up loop

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** Vector provides incident follow-up loop for the permitted workspace actors, with the records, outcomes and refusals below.

**Acceptance.** Through the native product door and its declared counterpart:
1. When an Oncall incident or a PagerDuty incident resolves, an agent drafts follow-up issues from the timeline and postmortem, links them to the incident, declares proposed owners and due dates as standard and a channel post as external where it reaches outsiders; the company's policy decides, and the held run has the incident commander approve the exact changes, and tracks them to completion with weekly status in the incident channel.

#### PUSH-009 — Standups and cycle summaries

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** Each morning and at cycle end, an agent writes a short summary per team of what moved, what is blocked, what slipped and what shipped, citing issues and PRs, posted to the team's inbox and Slack channel; members can correct it, and corrections are kept.

**Acceptance.** Through the native product door and its declared counterpart:
1. Each morning and at cycle end, an agent writes a short summary per team of what moved, what is blocked, what slipped and what shipped, citing issues and PRs, posted to the team's inbox and Slack channel; members can correct it, and corrections are kept.

#### PUSH-010 — Agent accountability ledger

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011 · *Rules:* D-2

**Requirement.** The coding-work ledger links suggestions, drafts, delegation steps and verification proposals to their source issue or spec, model, consulted records and cost in USD.

**Acceptance.** Through the native product door and its declared counterpart:
1. The coding-work ledger links suggestions, drafts, delegation steps and verification proposals to their source issue or spec, model, consulted records and cost in USD.
2. Admins see per-team acceptance rates and cost, .

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Human screen-reader review | MOBILE-003 | not run | | |
| R-2 | Accessibility VPAT | MOBILE-003 | not run | | |
| R-3 | Actual Okta, Entra and Google Workspace tenant interoperability | ROLE-004 | not run | | |
| R-4 | Real Slack and GitHub installation connection | INTEG-001, SLACK-001, SLACK-005 | not run | | |
| R-5 | App Store and Google Play listing and distributed-build receipt | MOBILE-001, MOBILE-004 | not run | | |
| R-6 | Real device push through the production relay | MOBILE-002, MOBILE-004 | not run | | |
| R-7 | Signed and notarized macOS and Windows distribution | MOBILE-005 | not run | | |
| R-8 | Real Claude Code, Codex, Cursor and Copilot delegation accounts | AGENT-009 | not run | | |
| R-9 | Published Zapier and Make directory listings | CONNECT-001 | not run | | |
| R-10 | Actual owner-produced Linear and Jira exports | DATA-008, DATA-009, DATA-010 | not run | | |

## Boundaries

Vector does not do these jobs, and buyers get them as follows (US-first):

- **Code hosting, CI runners and production deploys.** Vector links to GitHub, GitLab or Bitbucket and the buyer's CI and deploy platform (GitHub Actions, CircleCI, Vercel, Cloudflare); it never hosts repositories, runs builds or deploys.
- **Running coding agents.** Agents run in their providers' sandboxes (Claude Code, OpenAI Codex, Cursor, GitHub Copilot) or the buyer's own runners; Vector holds delegation state, context and evidence, never source checkouts or production credentials inside its Worker.
- **Customer feedback board, public roadmap and changelog.** Penny.
- **Support inbox, CRM, error tracking, uptime checks, paging.** HappyToHelp, Orbit, Spool, Uptime and Oncall, with [Porthole](https://github.com/just-every/run-porthole) as the Run Edit Run observability sibling, or Zendesk, Intercom, Front, Salesforce, HubSpot, Sentry, Datadog and PagerDuty through the integrations above.
- **Cross-functional work management for marketing, operations and agencies.** [Pegboard](https://github.com/just-every/run-pegboard) is the Run Edit Run sibling for this job; buyers may also use Asana, monday.com or ClickUp. Vector serves software delivery.
- **Wiki and design tools.** Project documents and specs are a target (PROJ-013), alongside links to Notion, Confluence, Google Drive and Figma; Vector does not take on the company wiki or design-tool job.
- **Timesheets, billing and capitalized-labor reports.** Not provided; buyers use Harvest, Toggl or Clockify linked by issue identifier, and REPORT-005 exports for finance.
- **Enterprise service management (help-desk ITSM, change approval boards) and regulated validation.** Not provided; an issue status is not a legal approval or a compliance record. Buyers use Jira Service Management or ServiceNow alongside.
- **Perpetual parity with every incumbent field and app.** Imports report every omission, and transition syncs (DATA-016) are bounded; Vector does not promise ongoing two-way parity with Jira or Linear.
- **Buyer-branded mobile apps.** Members install Run Edit Run's store-listed apps and receive push through Run Edit Run's relay (MOBILE-001, MOBILE-002, MOBILE-004). A buyer who wants apps under their own name and developer accounts builds them from source and publishes them with their own Apple and Google push credentials; Vector does not publish to a buyer's store accounts for them (Linear does not offer branded apps either).

## Homepage claims

| # | Claim | Clauses |
| --- | --- | --- |
| 1 | 100% free, open source alternative to Linear, Jira and Asana | HOME-001 |
| 2 | Every report gets a clear decision. Your team sees what is now, what is next, and why. | INTAKE-005, INTAKE-006, INTAKE-007, CURR-006 |
| 3 | Current is the one list your whole team shares; each issue sits in exactly one section, ordered by priority and due date, with no hidden score. | OPS-001, CURR-001, CURR-007 |
| 4 | Needs decision contains reports waiting for a call. | CURR-002 |
| 5 | Now contains started or overdue work. | CURR-003 |
| 6 | Next contains cycle commitments and work due within seven days. | CURR-004 |
| 7 | Recently done contains work finished in the last seven days. | CURR-005 |
| 8 | MIT licensed: free to use, change and run, with no seats, plans or product fees. | HOME-001 |
| 9 | Defer to a date and time; it returns to Needs decision and Inbox then, or sooner with new evidence. | INTAKE-006, CURR-002, NOTIFY-001 |
| 10 | My work, Issues, Board, Projects, Cycles, saved views, Search and Inbox are in the same free code. | WORK-001, VIEW-005, PROJ-001, CYCLE-001, VIEW-002, SEARCH-001, NOTIFY-001 |
| 11 | Project health names the exact issue putting the project at risk. | PROJ-005, PROJ-006 |
| 12 | When a cycle ends, unfinished work rolls into the next one. | CYCLE-004, CYCLE-006 |
| 13 | Every change and decision is kept with who made it and when. | ISSUE-007, INTAKE-005, INTAKE-006, INTAKE-007 |
| 14 | Command K jumps to an issue by identifier or words. | CMD-001, CMD-002, SEARCH-001, SEARCH-002 |
| 15 | Try it on your computer beside your current tracker without changing that tracker. | HOME-001, SETUP-001 |
| 16 | Reports from a monitoring or support source land in Needs decision. | INTAKE-001, INTAKE-011 |
| 17 | Invite the team and share what is now and next. | OPS-001, OPS-002, CURR-001 |

## Status

Judged from the code and tests at commit `bdcd9599eb64411a48657fc8394a438a3675f5a8` (27 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 21 | 84 | 1 | 106 |
| Target and push further | 2 | 89 | 96 | 187 |
| All | 23 | 173 | 97 | 293 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `HOME-001` | Public homepage | published | partial | `tests/e2e/core-runtime.mjs` | The cited core runtime exercises installed entry and public pages. Missing the full approved-marketing-page journey that reads the complete fixed copy/assets, installation action and exclusions; the public-site journey is outside this old Evidence set. |
| `OPS-001` | Workspace access | published | partial | `tests/worker/search-access.test.ts`, `tests/worker/removal-boundary.test.ts`, `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-access-journey.mjs`, `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/project-report.test.ts` | Mobile payloads (MOBILE-001/002) and agent contexts (AGENT-001/005) inherit this rule when built; complete registered-door coverage remains ROLE-008. A receiving-clause browser census of Viewer exports/notifications, attachment bytes and webhook privacy transitions is not proved here. |
| `SETUP-001` | First workspace review | published | partial | `tests/worker/first-run.test.ts` | The first-run journey covers owner-only completion, refusal, repeat, persisted sign-in and additive upgrade. Missing the first workspace review through local archive restore and a real runtime restart. |
| `OPS-002` | Member management | published | partial | `tests/worker/base-auth.test.ts`, `tests/worker/role-matrix.test.ts` | Role-restricted invitation and removal are enforced; removal is not yet a suspension (ROLE-011), reactivation and erasure are ROLE-011's and ROLE-012's, and native Guest invitations name their allowed teams (ROLE-003) |
| `OPS-003` | Workspace time | published | partial | `tests/e2e/admin-workspace-time-journey.mjs` | The cited workspace-time journey saves and restarts the setting without changing reminder configuration. Missing a timezone-change journey reading delivered reminder history and closed-cycle snapshots alongside calendar windows. |
| `OPS-004` | Safe removal | published | partial | `tests/worker/removal-boundary.test.ts`, `tests/worker/role-matrix.test.ts` | Removal revokes sessions, unassigns, transfers and rolls back as one unit, refuses the last Owner and transfers to the longest-standing remaining Owner when a member leaves, but today every removal also deletes the member's private views and anonymizes their references at once; suspension that keeps the name is open with ROLE-011 and the separate erase with ROLE-012 |
| `TEAM-001` | Team identity | published | partial | `tests/e2e/admin-team-journey.mjs` | The cited authoring journey creates a team, reads its prefix and freezes the prefix after issue creation. Missing the team identity journey that attempts duplicate names and prefixes against both archived and active teams. |
| `TEAM-002` | Team workflow | published | partial | `tests/e2e/admin-team-journey.mjs`, `tests/worker/role-matrix.test.ts` | The cited evidence exercises the existing team workflow behavior. Missing an audited "complete team workflow through its public doors" journey that performs and reads the full retained outcome: A team's *default status* in a category is the first status of that category in workflow order, and every clause naming a category as a destination moves the issue there. |
| `TEAM-003` | Team archiving | published | partial | `tests/e2e/admin-archive-team-journey.mjs` | The cited archive journey refuses authoring/intake and preserves a populated issue, then unarchives. Missing an archive journey with populated cycles, projects and history that reads them after archive and attempts a team move and signed source delivery. |
| `TEAM-004` | Status removal | published | partial | `tests/e2e/admin-team-journey.mjs` | The cited status-removal journey reads issue mapping and its durable audit, and shows the last-status control disabled. Missing a public-door attempted last-category removal that reads the refusal and unchanged records. |
| `ISSUE-001` | Creation | published | partial | `tests/e2e/core-runtime.mjs` | The cited core runtime creates native issues. Missing the creation journey with typed team custom fields, inline media and checklist outcomes now named in the full issue record; the fields are carried without narrowing. |
| `ISSUE-002` | Stable identifiers | published | partial | `tests/worker/issue-deletion-relations.test.ts` | The cited duplicate/deletion journey proves non-reuse after deleting the highest identifier. Missing the same stable-identifier journey that then moves that issue across teams and reads the preserved identifier. |
| `ISSUE-003` | Priority | published | partial | `tests/e2e/core-board-journey.mjs`, `evidence/keyboard-board/ISSUE-003/` | The cited evidence exercises the existing priority behavior. Missing an audited "complete priority through its public doors" journey that performs and reads the full retained outcome: No priority is the default and sorts after Low. |
| `ISSUE-004` | Status transitions | published | partial | `tests/worker/issue-session-projection.test.ts` | The cited evidence exercises the existing status transitions behavior. Missing an audited "complete status transitions through its public doors" journey that performs and reads the full retained outcome: Entering Completed records the completion time and entering Canceled records the cancellation time; leaving one of those categories clears the time it recorded and removes no activity. |
| `ISSUE-005` | Assignment | published | partial | `tests/worker/removal-assignment.test.ts` | The cited assignment file exercises removal races during create, accept and edit. Missing a positive assignment journey that assigns, reassigns and unassigns and reads actor plus old/new assignees. |
| `ISSUE-006` | Concurrent edits | published | partial | `tests/e2e/core-runtime.mjs` | The cited evidence exercises the existing concurrent edits behavior. Missing an audited "complete concurrent edits through its public doors" journey that performs and reads the full retained outcome: Adding a comment, evidence revision, follower, or notification does not change the version and is never rejected as stale. |
| `ISSUE-007` | Activity history | published | partial | `tests/worker/dependencies.test.ts` | The cited dependency journey reads versioned dependency activity. Missing an issue-history journey that covers the other named field kinds, parent/duplicate changes and the named import/cycle/deferral actors with the previous and new values read. |
| `ISSUE-008` | Comments and safe comment removal | published | partial | `tests/worker/discussion-threads.test.ts`, `tests/worker/discussion-access.test.ts`, `tests/e2e/core-threads-journey.mjs`, `evidence/comment-threads/ISSUE-008/` | Threads, ordered replies, resolve/reopen, reopen on reply, author-only editing and author/Owner/Admin deletion are implemented; inline quoted-text comments are not built; team-owner deletion waits on ROLE-007, Guests on ROLE-003, inline images and video on ISSUE-033, ISSUE-034, Slack threads on SLACK-002 |
| `ISSUE-029` | Discussion threads and resolution | published | partial | `tests/worker/discussion-threads.test.ts`, `tests/worker/discussion-access.test.ts`, `tests/e2e/core-threads-journey.mjs`, `evidence/comment-threads/ISSUE-008/` | Threads, ordered replies, resolve/reopen, reopen on reply, author-only editing and author/Owner/Admin deletion are implemented; inline quoted-text comments are not built; team-owner deletion waits on ROLE-007, Guests on ROLE-003, inline images and video on ISSUE-033, ISSUE-034, Slack threads on SLACK-002 |
| `ISSUE-030` | Anchored inline comments | published | missing | `tests/worker/discussion-threads.test.ts`, `tests/worker/discussion-access.test.ts`, `tests/e2e/core-threads-journey.mjs`, `evidence/comment-threads/ISSUE-008/` | Threads, ordered replies, resolve/reopen, reopen on reply, author-only editing and author/Owner/Admin deletion are implemented; inline quoted-text comments are not built; team-owner deletion waits on ROLE-007, Guests on ROLE-003, inline images and video on ISSUE-033, ISSUE-034, Slack threads on SLACK-002 |
| `ISSUE-009` | Attachments and links | published | partial | `tests/worker/discussion-file-admission.test.ts` | The cited file-admission journeys cover attachment boundaries. Missing the combined attach/remove journey for named links and comment files, with the new inline embedding door exercised; that door remains a separate retained obligation. |
| `ISSUE-010` | Deletion | published | partial | `tests/worker/issue-deletion-cascade.test.ts`, `tests/worker/role-matrix.test.ts` | Release debt: until ISSUE-031, ISSUE-032's Recently deleted lands, Members cannot delete issues, their own included (only Owners and Admins delete, and only permanently; no creator exception); deletion by an issue's creator or, with the setting, its team's Members, Recently deleted and undo are open with ISSUE-031, ISSUE-032 |
| `ISSUE-011` | Estimates | published | partial | `tests/worker/cycle-closure.test.ts` | The cited evidence exercises the existing estimates behavior. Missing an audited "complete estimates through its public doors" journey that performs and reads the full retained outcome: Changing an estimate never rewrites a closed cycle snapshot. |
| `ISSUE-012` | Moving teams | published | partial | `tests/worker/bulk-commands.test.ts`, `tests/e2e/core-stream-planning-journey.mjs`, `evidence/keyboard-planning/ISSUE-012/` | The cited evidence exercises the existing moving teams behavior. Missing an audited "complete moving teams through its public doors" journey that performs and reads the full retained outcome: All of it happens or none of it does. |
| `ISSUE-013` | Mentions | published | partial | `tests/e2e/collaboration-events.mjs` | The cited evidence exercises the existing mentions behavior. Missing an audited "complete mentions through its public doors" journey that performs and reads the full retained outcome: A mention adds a follower (NOTIFY-002) and notifies once (NOTIFY-001); editing text to add a mention notifies only the newly mentioned operator, and removing a mention notifies nobody and withdraws no delivered notification. |
| `ISSUE-014` | Labels | published | partial | `tests/e2e/admin-label-journey.mjs`, `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-access-journey.mjs` | Workspace labels follow the role matrix; Settings → Labels is Owner/Admin write and Member read-only. Inline issue-picker creation and session/scoped API creation enforce the audited workspace permission on the next request. Workspace merge rewrites issues, projects and saved-view filters atomically. Team labels and groups remain absent |
| `ISSUE-015` | Unsent drafts | published | partial | `tests/e2e/core-draft-journey.mjs` | The cited evidence exercises the existing unsent drafts behavior. Missing an audited "complete unsent drafts through its public doors" journey that performs and reads the full retained outcome: A draft is not a record: it appears in no list, search result, notification, or export, and becomes an issue only when that operator creates it. |
| `REL-001` | Dependencies | published | partial | `tests/worker/dependencies.test.ts` | The cited evidence exercises the existing dependencies behavior. Missing an audited "complete dependencies through its public doors" journey that performs and reads the full retained outcome: Vector rejects self-links, a link that already exists in either direction, and any link that would create a directed cycle. |
| `REL-002` | Blocked state | published | partial | `tests/worker/dependencies.test.ts` | The cited evidence exercises the existing blocked state behavior. Missing an audited "complete blocked state through its public doors" journey that performs and reads the full retained outcome: Blocking never changes the issue's workflow status by itself. |
| `REL-003` | Duplicate decision | published | partial | `tests/worker/issue-deletion-relations.test.ts` | The cited duplicate journey retains a description and comment discussion and refuses unsafe canonical choices. Missing a duplicate decision on an issue populated with evidence and attachment bytes that reads those retained artifacts afterwards. |
| `REL-004` | Canonical duplicates | published | done | `tests/worker/issue-deletion-relations.test.ts` — "[REL-003 REL-004 REL-005 ISSUE-010 ISSUE-002] public duplicate decisions repoint atomically, retain content and history, undo status and protect canonical deletion" |  |
| `REL-005` | Undo duplicate | published | done | `tests/worker/issue-deletion-relations.test.ts` — "[REL-003 REL-004 REL-005 ISSUE-010 ISSUE-002] public duplicate decisions repoint atomically, retain content and history, undo status and protect canonical deletion" |  |
| `REL-006` | Parent and child | published | partial | `tests/worker/issue-deletion-preimage.test.ts` | The cited evidence exercises the existing parent and child behavior. Missing an audited "complete parent and child through its public doors" journey that performs and reads the full retained outcome: Issue lists can filter to roots or to children of one exact parent (VIEW-001). |
| `INTAKE-001` | Intake creation | published | partial | `tests/worker/source-ingest.test.ts` | The cited evidence exercises the existing intake creation behavior. Missing an audited "complete intake creation through its public doors" journey that performs and reads the full retained outcome: Either way it starts in the team's default Intake status and appears in Needs decision (CURR-002) within 5 seconds. |
| `INTAKE-002` | Idempotent sources | published | done | `tests/worker/source-ingest.test.ts` — "[INTAKE-001 INTAKE-002 INTAKE-003 INTAKE-011] signed native source publication and replay are atomic, source-attributed and restart-safe" |  |
| `INTAKE-003` | Evidence revisions | published | done | `tests/worker/source-ingest.test.ts` — "[INTAKE-001 INTAKE-002 INTAKE-003 INTAKE-011] signed native source publication and replay are atomic, source-attributed and restart-safe" |  |
| `INTAKE-004` | Inspectable assessment | published | partial | `tests/e2e/core-runtime.mjs` | The cited native provenance journey covers source/operator information. Missing the agent-provenance and company-policy journey showing model, consulted records, observation time and policy-decided application. |
| `INTAKE-005` | Accept | published | partial | `tests/e2e/core-runtime.mjs` | The cited evidence exercises the existing accept behavior. Missing an audited "complete accept through its public doors" journey that performs and reads the full retained outcome: It leaves Needs decision and reaches its new Current and My work sections within the CURR-008 window. |
| `INTAKE-006` | Defer | published | partial | `tests/worker/source-ingest.test.ts`, `tests/e2e/core-runtime.mjs`, `evidence/issue-follow-up/INTAKE-006/` | The cited evidence exercises the existing defer behavior. Missing an audited "complete defer through its public doors" journey that performs and reads the full retained outcome: The same roles can defer it again or end a deferral early. |
| `INTAKE-007` | Decline | published | partial | `tests/worker/source-ingest.test.ts` | The cited decline journey refuses absent reasons and retains evidence/history after restart. Missing decline reason readback and the destination Current membership after the decision; entering a reason alone is not readback. |
| `INTAKE-008` | Evidence after a terminal decision | published | done | `tests/worker/source-ingest.test.ts` — "[INTAKE-001 INTAKE-002 INTAKE-003 INTAKE-011] signed native source publication and replay are atomic, source-attributed and restart-safe" |  |
| `INTAKE-009` | Source failure | published | done | `tests/worker/source-ingest.test.ts` — "[INTAKE-001 INTAKE-002 INTAKE-003 INTAKE-011] signed native source publication and replay are atomic, source-attributed and restart-safe" |  |
| `INTAKE-010` | Decision policy | published | partial | `tests/worker/intake-policy.test.ts`, `tests/e2e/core-intake-policy-journey.mjs` | The cited evidence exercises the existing decision policy behavior. Missing an audited "complete decision policy through its public doors" journey that performs and reads the full retained outcome: Suggested assignee, priority, and start state are selected by the intake recommendation policy and are always editable before acceptance. |
| `INTAKE-011` | Source registration | published | done | `tests/worker/source-ingest.test.ts` — "[INTAKE-001 INTAKE-002 INTAKE-003 INTAKE-011] signed native source publication and replay are atomic, source-attributed and restart-safe" |  |
| `CURR-001` | Disjoint stream | published | done | `tests/worker/current-disjoint.test.ts` — "[CURR-001] Current assigns overlapping work to one section and excludes canceled, duplicate, deferred and deleted issues" |  |
| `CURR-002` | Needs decision | published | done | `tests/worker/current-intake-pagination.test.ts` — "[CURR-002] Current exposes every expired deferral in ranked order before the bounded return job has drained" |  |
| `CURR-003` | Now | published | done | `tests/worker/current-now.test.ts` — "[CURR-003] Now uses workspace midnight, includes overdue backlog and started work, and excludes intake, terminal and deferred work" |  |
| `CURR-004` | Next | published | done | `tests/worker/current-next.test.ts` — "[CURR-004] Next uses seven workspace calendar days and each team's active or next cycle, with Now and Intake taking precedence" |  |
| `CURR-005` | Recently done | published | done | `tests/worker/current-recently-done.test.ts` — "[CURR-005] Recently done includes the whole seventh workspace date, excludes future completions, and expires at local midnight across DST"; `tests/worker/current-recently-done.test.ts` — "[CURR-005] Recently done ranks by completion then identifier while Now keeps priority order; later edits and reopening do not fake completion" |  |
| `CURR-006` | Explainable attention | published | partial | `tests/worker/dependencies.test.ts` | The cited evidence exercises the existing explainable attention behavior. Missing an audited "complete explainable attention through its public doors" journey that performs and reads the full retained outcome: Every issue in Current shows one primary inclusion reason — Awaiting decision, Started work, Overdue, Cycle commitment, Due within seven days, or Completed within seven days — and every applicable context reason from Customer escalation, Unresolved dependency, Unassigned urgent work, Project risk, and New evidence since the most recent intake decision. |
| `CURR-007` | Ranking | published | partial | `tests/e2e/core-stream-controls-ranking.mjs`, `evidence/current-controls/CURR-007/` | The cited evidence exercises the existing ranking behavior. Missing an audited "complete ranking through its public doors" journey that performs and reads the full retained outcome: Recently done (CURR-005) instead sorts by completion time, newest first, with stable identifier as the tiebreak; priority, due date and last update do not affect that section. |
| `CURR-008` | Freshness | published | done | `tests/e2e/core-current-journey.mjs` — "currentJourney" |  |
| `CURR-009` | Stream controls | published | partial | `tests/e2e/core-stream-controls-journey.mjs`, `evidence/current-controls/CURR-009/` | The cited evidence exercises the existing stream controls behavior. Missing an audited "complete stream controls through its public doors" journey that performs and reads the full retained outcome: The default includes all teams and all operators and shows Recently done. |
| `WORK-001` | Personal queue | published | partial | `tests/worker/dependencies.test.ts` | The cited evidence exercises the existing personal queue behavior. Missing an audited "complete personal queue through its public doors" journey that performs and reads the full retained outcome: An issue assigned to the operator while in an Intake status appears in Current's Needs decision, not here. |
| `WORK-002` | Personal defaults | published | partial | `tests/worker/dependencies.test.ts` | The cited evidence exercises the existing personal defaults behavior. Missing an audited "complete personal defaults through its public doors" journey that performs and reads the full retained outcome: When no issue qualifies, the view states the operator is caught up and offers new issue and Current as next actions. |
| `WORK-003` | Cycle context | published | partial | `tests/e2e/core-stream-controls-journey.mjs`, `evidence/current-controls/WORK-003/` | The cited evidence exercises the existing cycle context behavior. Missing an audited "complete cycle context through its public doors" journey that performs and reads the full retained outcome: Inherited from ROLE-007: My work's team rows follow team membership when this clause changes them. |
| `PROJ-001` | Project record | published | partial | `tests/worker/project-fields.test.ts`, `tests/e2e/core-project-fields-journey.mjs`, `tests/worker/project-fields-upgrade.test.ts`, `tests/worker/data-http.test.ts` | The cited native project field journeys cover dates, priority, labels and activity. Missing the full project record journey with typed project fields, primary-team configurable statuses, roadmap edits and Linear field import. |
| `PROJ-002` | Manual lifecycle | published | partial | `tests/e2e/admin-project-cycle-journey.mjs` | The cited lifecycle and role journeys change status explicitly. Missing a lifecycle journey that completes or cancels all project issues and reads the project still unchanged; agent calls also need the company-policy path. |
| `PROJ-003` | Project membership | published | partial | `tests/worker/project-membership.test.ts`, `tests/e2e/core-project-membership-journey.mjs` | The cited evidence exercises the existing project membership behavior. Missing an audited "complete project membership through its public doors" journey that performs and reads the full retained outcome: Removing an issue from a project or archiving a project never deletes the issue; deleting a project detaches all of its issues but deletes none of them. |
| `PROJ-004` | Progress | published | partial | `tests/e2e/core-runtime.mjs` | The cited evidence exercises the existing progress behavior. Missing an audited "complete progress through its public doors" journey that performs and reads the full retained outcome: The interface shows the completed and total counts beside the percentage and reports no progress when the denominator is zero. |
| `PROJ-005` | Health | published | partial | `tests/worker/project-health.test.ts`, `tests/e2e/core-project-health-journey.mjs` | The cited evidence exercises the existing health behavior. Missing an audited "complete health through its public doors" journey that performs and reads the full retained outcome: Remaining scope exactly equal to capacity is not At risk. |
| `PROJ-006` | Risk explanation | published | done | `tests/e2e/core-project-risk-journey.mjs` — "projectRiskJourney" |  |
| `PROJ-007` | Portfolio | published | partial | `tests/worker/project-fields.test.ts`, `tests/e2e/core-project-fields-journey.mjs` | The cited evidence exercises the existing portfolio behavior. Missing an audited "complete portfolio through its public doors" journey that performs and reads the full retained outcome: The label filter selects workspace labels marked for projects (PROJ-001). |
| `PROJ-008` | Historical truth | published | done | `tests/worker/cycle-closure.test.ts` — "scheduled closure rolls every category once and preserves frozen public project history after edits" |  |
| `PROJ-009` | Project archiving | published | partial | `tests/e2e/admin-project-cycle-journey.mjs` | The cited evidence exercises the existing project archiving behavior. Missing an audited "complete project archiving through its public doors" journey that performs and reads the full retained outcome: Operators can include archived projects in filters or unarchive one. |
| `CYCLE-001` | Time box | published | partial | `tests/e2e/admin-project-cycle-journey.mjs` | The cited journeys cover creating a time box and role-matrix creation cells. Missing the complete time-box journey exercising the retained edit, completion and deletion doors under both planning permissions. |
| `CYCLE-002` | Commitment | published | partial | `tests/e2e/admin-cycle-list-journey.mjs` | The cited evidence exercises the existing commitment behavior. Missing an audited "complete commitment through its public doors" journey that performs and reads the full retained outcome: Committing, moving, and uncommitting record both cycle identifiers and update both cycles atomically. |
| `CYCLE-003` | Progress and capacity | published | partial | `tests/worker/cycle-closure.test.ts` | The cited evidence exercises the existing progress and capacity behavior. Missing an audited "complete progress and capacity through its public doors" journey that performs and reads the full retained outcome: Capacity risk is Unknown unless capacity and every remaining estimate exist, At risk when remaining points exceed capacity, and Within capacity otherwise. |
| `CYCLE-004` | Closure and rollover | published | done | `tests/worker/cycle-closure.test.ts` — "scheduled closure rolls every category once and preserves frozen public project history after edits" |  |
| `CYCLE-005` | Closure snapshot | published | done | `tests/worker/cycle-closure.test.ts` — "scheduled closure rolls every category once and preserves frozen public project history after edits"; `tests/worker/cycle-closure.test.ts` — "snapshot records scope additions and removals in the interval and empty scope remains explicit" |  |
| `CYCLE-006` | Missing next cycle | published | done | `tests/worker/cycle-closure.test.ts` — "concurrent first closure without a next cycle records one visible failure and never retroactively moves issues" |  |
| `SEARCH-001` | Global search | published | partial | `tests/worker/search-access.test.ts` | The cited evidence exercises the existing global search behavior. Missing an audited "complete global search through its public doors" journey that performs and reads the full retained outcome: Issues of archived teams and projects are excluded unless the operator asks for them. |
| `SEARCH-002` | Exact identifier | published | partial | `tests/worker/search-exact-admission.test.ts` | The cited evidence exercises the existing exact identifier behavior. Missing an audited "complete exact identifier through its public doors" journey that performs and reads the full retained outcome: Primary identity, archive choice and operator/session/workspace admission are rechecked before returning results, including after an index failure. |
| `SEARCH-003` | Index freshness | published | partial | `tests/worker/search-access.test.ts` | The cited evidence exercises the existing index freshness behavior. Missing an audited "complete index freshness through its public doors" journey that performs and reads the full retained outcome: If an index query fails, the exact primary-record lookup remains available under SEARCH-002; other searches are reported unavailable with the last successful index time; Vector never presents a known index failure as a complete empty result. |
| `VIEW-001` | Issue controls | published | partial | `tests/e2e/dev-runtime.mjs` | The cited evidence exercises the existing issue controls behavior. Missing an audited "complete issue controls through its public doors" journey that performs and reads the full retained outcome: Positive offsets require the response the query revision for the same query and workspace calendar date; invalidated or missing identity returns a visible pagination conflict without mixed rows, and browsing restarts visibly at offset zero. |
| `VIEW-002` | Saved views | published | partial | `tests/worker/views-removal.test.ts` | The cited evidence exercises the existing saved views behavior. Missing an audited "complete saved views through its public doors" journey that performs and reads the full retained outcome: Deleting a view never changes an issue. |
| `VIEW-003` | Control persistence | published | partial | `tests/worker/views-removal.test.ts` | The cited evidence exercises the existing control persistence behavior. Missing an audited "complete control persistence through its public doors" journey that performs and reads the full retained outcome: Opening a saved view never changes the stored controls of the list or board it was opened from. |
| `VIEW-004` | Bulk edit | published | partial | `tests/e2e/core-keyboard-journey.mjs`, `tests/e2e/core-undo-journey.mjs`, `tests/worker/issue-undo.test.ts`, `evidence/issue-undo/VIEW-004/` | The cited evidence exercises the existing bulk edit behavior. Missing an audited "complete bulk edit through its public doors" journey that performs and reads the full retained outcome: A successful operation writes one activity entry per issue and is undone as one action by Undo or Command/Ctrl-Z within the ISSUE-020 window. |
| `VIEW-005` | Team board | published | partial | `tests/e2e/core-board-journey.mjs`, `evidence/keyboard-board/VIEW-005/` | The cited evidence exercises the existing team board behavior. Missing an audited "complete team board through its public doors" journey that performs and reads the full retained outcome: Paging reaches cards beyond the first page; completed work remains hidden until explicitly requested. |
| `CMD-001` | Command palette | published | done | `tests/e2e/core-palette-journey.mjs` — "paletteJourney" |  |
| `CMD-002` | Keyboard navigation | published | done | `tests/e2e/core-keyboard-journey.mjs` — "keyboardJourney" |  |
| `CMD-003` | Focus and selection | published | partial | `tests/e2e/core-stream-planning-journey.mjs`, `tests/e2e/core-keyboard-journey.mjs`, `evidence/keyboard-planning/CMD-003/` | The cited evidence exercises the existing focus and selection behavior. Missing an audited "complete focus and selection through its public doors" journey that performs and reads the full retained outcome: Changing a filter, sort, or grouping keeps the focused row focused while it remains in the list and focuses the first row when it does not. |
| `NOTIFY-001` | Inbox events | published | partial | `tests/worker/follower-events.test.ts`, `tests/worker/follower-last-blocker.test.ts`, `tests/e2e/core-follower-journey.mjs`, `tests/worker/source-ingest.test.ts`, `tests/e2e/collaboration-events.mjs`, `evidence/issue-follow-up/NOTIFY-001/` | The cited follower journeys cover current native issue notifications. Missing the complete inbox-events journey for inherited triage responsibility, project/initiative updates, delegated-agent questions, Git review requests and SLA warnings. |
| `NOTIFY-002` | Followers | published | partial | `tests/e2e/collaboration-events.mjs` | The cited evidence exercises the existing followers behavior. Missing an audited "complete followers through its public doors" journey that performs and reads the full retained outcome: Issue creators, assignees, commenters, and directly mentioned operators follow the issue automatically; an operator can follow or unfollow it explicitly without changing anyone else's following. |
| `NOTIFY-003` | No self-notification | published | partial | `tests/worker/due-reminders.test.ts` | The cited evidence exercises the existing no self-notification behavior. Missing an audited "complete no self-notification through its public doors" journey that performs and reads the full retained outcome: One event creates at most one notification per recipient and issue even when the recipient qualifies through several follower rules. |
| `NOTIFY-004` | Read and mute | published | partial | `tests/e2e/collaboration-preferences.mjs` | The cited evidence exercises the existing read and mute behavior. Missing an audited "complete read and mute through its public doors" journey that performs and reads the full retained outcome: An operator can mute an issue or an event type, which suppresses only their own later matching notifications and alters neither activity history nor another operator's notifications. |
| `NOTIFY-005` | Due reminders | published | partial | `tests/worker/due-reminders.test.ts` | The cited evidence exercises the existing due reminders behavior. Missing an audited "complete due reminders through its public doors" journey that performs and reads the full retained outcome: Changing a due date makes the new date eligible and never repeats a reminder already delivered for the same issue and date. |
| `NOTIFY-006` | Assignment and mention email | published | partial | `tests/e2e/collaboration-delivery-ui.mjs` | The cited evidence exercises the existing assignment and mention email behavior. Missing an audited "complete assignment and mention email through its public doors" journey that performs and reads the full retained outcome: Erasure removes addressed delivery state and anonymizes retained actors; a request already in flight cannot be recalled. |
| `GITHUB-001` | Signed PR links | published | partial | `tests/worker/github-links.test.ts` | The cited evidence exercises the existing signed pr links behavior. Missing an audited "complete signed pr links through its public doors" journey that performs and reads the full retained outcome: A PR event changes issue status only through the team's Git automation rules (GITHUB-003), recorded as automation activity. |
| `GITHUB-002` | Durable latest PR state | published | partial | `tests/worker/github-links.test.ts` | The cited evidence exercises the existing durable latest pr state behavior. Missing an audited "complete durable latest pr state through its public doors" journey that performs and reads the full retained outcome: Safe histories are portable; credentials require destination re-entry and restored historical deliveries never replay. |
| `API-001` | Native scoped API | published | partial | `tests/worker/integration-api.test.ts` | The cited evidence exercises the existing native scoped api behavior. Missing an audited "complete native scoped api through its public doors" journey that performs and reads the full retained outcome: Existing native mutation and notification rules apply; no deletion API or product role is added. |
| `API-002` | Token authority and usage | published | partial | `tests/worker/integration-authority.test.ts` | The cited evidence exercises the existing token authority and usage behavior. Missing an audited "complete token authority and usage through its public doors" journey that performs and reads the full retained outcome: Stale writes and authority races publish no unauthorized changes; committed native notification intent remains durable after a response denial. |
| `WEBHOOK-001` | Durable native delivery | published | partial | `tests/worker/outbound-webhooks.test.ts` | The cited evidence exercises the existing durable native delivery behavior. Missing an audited "complete durable native delivery through its public doors" journey that performs and reads the full retained outcome: Failed sends never switch transports. |
| `DATA-001` | Export contents | published | partial | `tests/worker/data-http.test.ts` | The cited evidence exercises the existing export contents behavior. Missing an audited "complete export contents through its public doors" journey that performs and reads the full retained outcome: It never contains a session, signing, source, or provider secret. |
| `DATA-002` | Mapped import preflight | published | partial | `tests/worker/linear-import.test.ts` | The cited evidence exercises the existing mapped import preflight behavior. Missing an audited "complete mapped import preflight through its public doors" journey that performs and reads the full retained outcome: One preflight covers the whole file of a run, up to the measured run limits in docs/MOVE-IN.md. |
| `DATA-003` | Atomic mapped import | published | partial | `tests/worker/data-import-atomic.test.ts` | The cited evidence exercises the existing atomic mapped import behavior. Missing an audited "complete atomic mapped import through its public doors" journey that performs and reads the full retained outcome: A failed batch writes none of that batch and leaves earlier batches of the run in place for resume (DATA-006). |
| `DATA-004` | Idempotent mapped import | published | partial | `tests/worker/data-import-atomic.test.ts` | The cited evidence exercises the existing idempotent mapped import behavior. Missing an audited "complete idempotent mapped import through its public doors" journey that performs and reads the full retained outcome: A mapped import creates normal activity and one audit entry for the run, and no operator notifications. |
| `DATA-005` | Exact portable restore | published | partial | `tests/worker/data-archive-failure.test.ts` | The cited evidence exercises the existing exact portable restore behavior. Missing an audited "complete exact portable restore through its public doors" journey that performs and reads the full retained outcome: The local restore command restores a portable DATA-001 archive without synthesizing activity, audit entries, notifications, or new timestamps. |
| `DATA-006` | Staged import run | published | partial | `tests/e2e/data-staged-cli.mjs` | The cited evidence exercises the existing staged import run behavior. Missing an audited "complete staged import run through its public doors" journey that performs and reads the full retained outcome: No notification, mail or webhook is sent for an imported issue. |
| `DATA-007` | Reconciliation report | published | partial | `tests/e2e/jira-public-journey.mjs` | tests/e2e/jira-public-journey.mjs registers no tests and no push/pull_request Verify job or named scheduled job reaches it |
| `DATA-008` | Linear API enrichment file | published | done | `tests/worker/linear-api-import.test.ts` — "[DATA-008 REL-007] a Linear CSV and API file pair imports comments with original times and authors, safe links, dependencies and duplicates with no outbound effect; a malformed file is refused row by row" |  |
| `DATA-009` | Jira CSV preflight and loss review | published | partial | `tests/worker/jira-import.test.ts` | The cited evidence exercises the existing jira csv preflight and loss review behavior. Missing an audited "complete jira csv preflight and loss review through its public doors" journey that performs and reads the full retained outcome: Every unsupported occurrence remains visible as an omission; mappings must be confirmed and row errors fixed before apply. |
| `DATA-010` | Jira staged apply and reconciliation | published | partial | `tests/worker/jira-apply.test.ts` | The cited evidence exercises the existing jira staged apply and reconciliation behavior. Missing an audited "complete jira staged apply and reconciliation through its public doors" journey that performs and reads the full retained outcome: The public route requires a current Owner or Admin session (role matrix) and same origin; API tokens are not admitted. |
| `DATA-011` | Erasing an imported person | published | partial | `tests/worker/imported-person-erasure.test.ts` | The cited evidence exercises the existing erasing an imported person behavior. Missing an audited "complete erasing an imported person through its public doors" journey that performs and reads the full retained outcome: The erasure journal is append-only, and an archive made before the erasure is refused on restore when a later archive's journal is supplied. |
| `OWNER-CLAIM-001` | Signed owner claim | published | partial | `tests/worker/owner-claim.test.ts` | The cited evidence exercises the existing signed owner claim behavior. Missing an audited "complete signed owner claim through its public doors" journey that performs and reads the full retained outcome: Ordinary local configured-owner setup remains the default without RER claim configuration. |
| `EDITOR-001` | Owner-gated editor | published | partial | `tests/worker/editor.test.ts` | The cited evidence exercises the existing owner-gated editor behavior. Missing an audited "complete owner-gated editor through its public doors" journey that performs and reads the full retained outcome: A hosted management session and independently registered frame-ancestors remain required; source adoption is not hosted acceptance. |
| `ROLE-001` | Workspace roles | target | partial | `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-access-journey.mjs` | Complete coverage remains ROLE-008; unbuilt matrix doors inherit their source clauses. Private 404 evidence is this clause's own case, separate from ROLE-002. |
| `ROLE-002` | Private teams | target | partial | `tests/worker/role-matrix.test.ts`, `tests/worker/search-access.test.ts`, `tests/worker/outbound-broken-destination.test.ts`, `tests/e2e/admin-access-journey.mjs`, `tests/e2e/admin-team-journey.mjs` | Private reads, membership withdrawal, identifier/search/Current/Created/Subscribed/Activity, counted CSV, exposed requests and team-only generic Slack delivery are implemented. The existing calendar, dashboard, Insights, template and reference journeys exercise their own private/Viewer cells. Browser attachment bytes and webhook privacy transitions remain unproved; their current network-edge and HTTP checks do not establish every-door browser acceptance. Unbuilt Slack unfurls inherit SLACK-005, mobile payloads MOBILE-001/002, documents PROJ-013 and agent contexts AGENT-001/005. Non-member Admins see private-team metadata, owners, membership, counts and privacy controls in Settings without content access; saved definitions re-evaluate current visibility without edits. Ruled archive behavior: Admin archives must exclude unreadable private-team rows and carry only an excluded-team count; Owner archives carry everything. BLOCKED ROLE-002(c): Base portability per-export row scope and manifest count are unavailable in rer 0.2.77; the safe Admin refusal remains until Base supplies them. |
| `ROLE-003` | Guests | target | partial | `tests/worker/role-matrix.test.ts`, `tests/worker/role-guest-journey.ts`, `tests/e2e/role-ui-support.mjs`, `tests/e2e/admin-access-journey.mjs` | The cited evidence exercises the existing guests behavior. Missing an audited "complete guests through its public doors" journey that performs and reads the full retained outcome: Inherited from ROLE-007: a Guest's access follows the teams an Admin added them to. |
| `ROLE-004` | Single sign-on and provisioning | target | missing |  | No implementation yet |
| `ROLE-005` | Audit log | target | partial | `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-audit-journey.mjs` | The cited evidence exercises the existing audit log behavior. Missing an audited "complete audit log through its public doors" journey that performs and reads the full retained outcome: The Vector audit covers sign-ins, roles and memberships, suspension, reactivation, erasure, team privacy, integrations, tokens, automation and agent runs, exports, imports and deletions, with person, automation, integration or agent as actor and the action subject. |
| `ROLE-006` | Apps and agents as actors | target | missing |  | No implementation yet |
| `ROLE-007` | Team membership and team owners | target | partial | `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-team-journey.mjs` | The cited evidence exercises the existing team membership and team owners behavior. Missing an audited "complete team membership and team owners through its public doors" journey that performs and reads the full retained outcome: Every change is audited (ROLE-005). |
| `ROLE-008` | Operator and permission coverage | target | partial | `src/core/features/roles/doors.ts`, `tests/worker/role-matrix.test.ts` | Every state-changing door is registered against one role-matrix row, a door with no row admits Owners only and Settings pages open as the matrix row says; the coverage check, auditing of refusals, the Guest Settings sweep and agents' own identities (ROLE-006) are open |
| `ROLE-009` | Team-managed permissions | target | partial | `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-team-journey.mjs` | The cited evidence exercises the existing team-managed permissions behavior. Missing an audited "complete team-managed permissions through its public doors" journey that performs and reads the full retained outcome: The default for team settings is Team owners only and for cycles and templates is All team members. CYCLE-001 inherits cycle creation, edit, completion and deletion under both planning permissions: non-owner Members succeed under All team members and are refused 403 under Team owners only; Owners/Admins and team owners succeed, Guests are refused under both. |
| `ROLE-010` | Offer Google sign-in | target | missing |  | No implementation yet |
| `ROLE-014` | Member passkeys | target | missing |  | No implementation yet |
| `ROLE-011` | Suspend a member and withdraw access | target | missing | `src/core/features/settings/removal.ts`, `tests/worker/removal-boundary.test.ts` | Removal revokes sessions and invitations, transfers led projects and owned shared views, and unassigns issues; the suspended state, kept names, the assignment choice, token, OAuth, passkey and push revocation, and reactivation are absent |
| `ROLE-015` | Suspended work and member directory | target | missing | `src/core/features/settings/removal.ts`, `tests/worker/removal-boundary.test.ts` | Removal revokes sessions and invitations, transfers led projects and owned shared views, and unassigns issues; the suspended state, kept names, the assignment choice, token, OAuth, passkey and push revocation, and reactivation are absent |
| `ROLE-016` | Reactivate the same member | target | missing | `src/core/features/settings/removal.ts`, `tests/worker/removal-boundary.test.ts` | Removal revokes sessions and invitations, transfers led projects and owned shared views, and unassigns issues; the suspended state, kept names, the assignment choice, token, OAuth, passkey and push revocation, and reactivation are absent |
| `ROLE-017` | Portable suspended-member state | target | missing | `src/core/features/settings/removal.ts`, `tests/worker/removal-boundary.test.ts` | Removal revokes sessions and invitations, transfers led projects and owned shared views, and unassigns issues; the suspended state, kept names, the assignment choice, token, OAuth, passkey and push revocation, and reactivation are absent |
| `ROLE-012` | Erase a member's personal data | target | partial | `src/core/features/settings/removal.ts`, `src/core/features/settings/removal-history.ts`, `tests/worker/removal-boundary.test.ts` | Today's removal anonymizes the member's references in comments, activity and audit and deletes their private views as part of every removal; a separate erase action on a suspended member, its preview, the typed confirmation and the single audit entry are absent |
| `ROLE-013` | Read-only Viewers | target | partial | `tests/worker/role-matrix.test.ts`, `tests/worker/project-fields-upgrade.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/admin-access-journey.mjs`, `tests/worker/role-matrix.test.ts`, `tests/e2e/viewer-role-journey.mjs`, `tests/e2e/admin-runtime.mjs`, `tests/worker/role-viewer-journey.ts`, `tests/worker/role-viewer-census.ts`, `tests/worker/role-matrix.test.ts`, `tests/worker/role-viewer-journey.ts`, `tests/worker/project-report.test.ts`, `tests/worker/role-matrix.test.ts`, `tests/worker/role-viewer-census.ts` | Unresolved: (b) agent contexts apply Viewer visibility: a duty of AGENT-001/005 (missing, unbuilt), no Viewer assertion yet; (c) own passkey management for Viewers has no asserting test (carried by ROLE-010, missing). ROLE-013 re-proposes DONE only after PROJ-013 and agent-context Viewer assertions exist, or when ROLE-010 and those clauses name the inheritance in both documents and are asserted. |
| `TEAM-005` | Team settings | target | missing |  | No implementation yet |
| `TEAM-006` | Sub-teams | target | missing |  | No implementation yet |
| `TEAM-007` | Team join permissions | target | partial | `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-team-journey.mjs` | The cited evidence exercises the existing team join permissions behavior. Missing an audited "complete team join permissions through its public doors" journey that performs and reads the full retained outcome: Public-team reads remain workspace-wide regardless of membership mode (OPS-001). |
| `TEAM-008` | Who may create teams | target | partial | `tests/worker/role-matrix.test.ts`, `tests/e2e/admin-team-journey.mjs` | The cited evidence exercises the existing who may create teams behavior. Missing an audited "complete who may create teams through its public doors" journey that performs and reads the full retained outcome: Enforcement is identical through browser, HTTP and API, takes effect on the next request and records each permission change in audit (ROLE-005). |
| `ISSUE-016` | Issue templates | target | missing |  | No implementation yet |
| `ISSUE-017` | Reactions | target | partial | `src/core/features/reactions/`, `tests/worker/role-matrix.test.ts`, `tests/e2e/collaboration-runtime.mjs`, `tests/e2e/data-roundtrip.mjs` | Slack thread reaction synchronization awaits SLACK-002. |
| `ISSUE-018` | Description history | target | partial | `tests/worker/description-history.test.ts`, `evidence/issue-writing/ISSUE-018/` | The cited evidence exercises the existing description history behavior. Missing an audited "complete description history through its public doors" journey that performs and reads the full retained outcome: Every saved description revision is kept with author and time, including the single revision each checklist tick writes (ISSUE-025); members can compare any two revisions and restore one, which writes a new revision and activity entry rather than rewriting history. |
| `ISSUE-019` | Sub-issue progress | target | partial | `tests/worker/subissues.test.ts`, `tests/worker/subissues-access.test.ts`, `tests/worker/subissues-import.test.ts`, `tests/e2e/core-subissues-journey.mjs` | The cited evidence exercises the existing sub-issue progress behavior. Missing an audited "complete sub-issue progress through its public doors" journey that performs and reads the full retained outcome: An optional team rule completes the parent when every sub-issue completes and reopens it when one reopens, recorded as automation activity. |
| `ISSUE-020` | Undo an issue change | target | partial | `tests/worker/issue-undo.test.ts`, `tests/e2e/core-undo-journey.mjs`, `tests/e2e/core-undo-properties.mjs`, `evidence/issue-undo/ISSUE-020/` | Native property, bulk, team/cycle and duplicate changes offer session-bound, version-checked Undo for ten seconds and append reversal activity. The 1440/390 journeys exercise status timestamps, assignee, priority, labels, cycle/team restoration, stale refusal and expiry; selectors wait for hydration and reversed team confirmations clear. Deletion/Recently deleted, intake decisions and other issue relation actions still lack Undo; retention, restore and purge remain unbuilt |
| `ISSUE-031` | Recently deleted issues and restore | target | missing | `tests/worker/issue-undo.test.ts`, `tests/e2e/core-undo-journey.mjs`, `tests/e2e/core-undo-properties.mjs`, `evidence/issue-undo/ISSUE-020/` | Native property, bulk, team/cycle and duplicate changes offer session-bound, version-checked Undo for ten seconds and append reversal activity. The 1440/390 journeys exercise status timestamps, assignee, priority, labels, cycle/team restoration, stale refusal and expiry; selectors wait for hydration and reversed team confirmations clear. Deletion/Recently deleted, intake decisions and other issue relation actions still lack Undo; retention, restore and purge remain unbuilt |
| `ISSUE-032` | Issue deletion retention and purge | target | missing | `tests/worker/issue-undo.test.ts`, `tests/e2e/core-undo-journey.mjs`, `tests/e2e/core-undo-properties.mjs`, `evidence/issue-undo/ISSUE-020/` | Native property, bulk, team/cycle and duplicate changes offer session-bound, version-checked Undo for ten seconds and append reversal activity. The 1440/390 journeys exercise status timestamps, assignee, priority, labels, cycle/team restoration, stale refusal and expiry; selectors wait for hydration and reversed team confirmations clear. Deletion/Recently deleted, intake decisions and other issue relation actions still lack Undo; retention, restore and purge remain unbuilt |
| `ISSUE-021` | Issue types | target | missing |  | No implementation yet |
| `ISSUE-022` | Issue start date | target | missing |  | No implementation yet |
| `ISSUE-023` | Copy issue | target | partial | `tests/worker/issue-copy.test.ts`, `tests/e2e/issue-copy-runtime.mjs` | The cited evidence exercises the existing copy issue behavior. Missing an audited "complete copy issue through its public doors" journey that performs and reads the full retained outcome: Cross-team cycle commitments are omitted and reported. |
| `ISSUE-024` | Put files into issue text | target | partial | `src/core/features/discussion/routes.ts`, `tests/worker/discussion-file-admission.test.ts` | PNG, JPEG, WebP and GIF attachments upload and are served same-origin with an attachment disposition and nosniff; paste, drop, the upload command, inline display, the viewer, video types, Range responses and resumable upload are absent, and src/core/features/markdown/ui/markdown.tsx refuses image paths on the installation itself |
| `ISSUE-033` | Inline image display | target | missing | `src/core/features/discussion/routes.ts`, `tests/worker/discussion-file-admission.test.ts` | PNG, JPEG, WebP and GIF attachments upload and are served same-origin with an attachment disposition and nosniff; paste, drop, the upload command, inline display, the viewer, video types, Range responses and resumable upload are absent, and src/core/features/markdown/ui/markdown.tsx refuses image paths on the installation itself |
| `ISSUE-034` | Inline video and resumable upload | target | missing | `src/core/features/discussion/routes.ts`, `tests/worker/discussion-file-admission.test.ts` | PNG, JPEG, WebP and GIF attachments upload and are served same-origin with an attachment disposition and nosniff; paste, drop, the upload command, inline display, the viewer, video types, Range responses and resumable upload are absent, and src/core/features/markdown/ui/markdown.tsx refuses image paths on the installation itself |
| `ISSUE-035` | Draft files and removed embeds | target | missing | `src/core/features/discussion/routes.ts`, `tests/worker/discussion-file-admission.test.ts` | PNG, JPEG, WebP and GIF attachments upload and are served same-origin with an attachment disposition and nosniff; paste, drop, the upload command, inline display, the viewer, video types, Range responses and resumable upload are absent, and src/core/features/markdown/ui/markdown.tsx refuses image paths on the installation itself |
| `ISSUE-036` | Embeds across clients and archives | target | missing | `src/core/features/discussion/routes.ts`, `tests/worker/discussion-file-admission.test.ts` | PNG, JPEG, WebP and GIF attachments upload and are served same-origin with an attachment disposition and nosniff; paste, drop, the upload command, inline display, the viewer, video types, Range responses and resumable upload are absent, and src/core/features/markdown/ui/markdown.tsx refuses image paths on the installation itself |
| `ISSUE-025` | Checklists | target | partial | `tests/worker/description-history.test.ts`, `tests/markdown-rendering.test.tsx`, `evidence/issue-writing/ISSUE-025/` | Browser description and author-only comment ticks, independent stale description ticks, revision/activity attribution and list/board/API counts implemented; comment ticks use body checks; templates, documents, native mobile, live editing and role/private-team enforcement remain open |
| `ISSUE-026` | Editor formatting and slash commands | target | partial | `tests/markdown-rendering.test.tsx`, `src/core/features/markdown/editor/`, `evidence/issue-writing/ISSUE-026/` | Shared browser editor has slash/formatting commands, shortcuts, safe rich paste, tables, collapsible sections, highlighting and copy; inline file/image commands, provider previews, templates/documents and native mobile editing remain open |
| `ISSUE-027` | Issue references and backlinks | target | partial | `tests/worker/description-history.test.ts`, `tests/worker/role-matrix.test.ts`, `tests/e2e/collaboration-references.mjs`, `tests/worker/data-http.test.ts`, `tests/e2e/data-roundtrip.mjs` | Project updates (PROJ-010), documents (PROJ-013), mobile links (MOBILE-001), DATA-018 aliases and historical/provider backlink backfill remain. tests/e2e/collaboration-references.mjs (referenceAccessCells at 1440/390 and HTTP) exercises private-source backlinks for Member/Viewer before membership, after addition and after withdrawal. |
| `ISSUE-028` | Drafts across devices | target | missing |  | No implementation yet |
| `FIELD-001` | Custom field definitions | target | partial | `src/core/features/issues/repository.ts`, `src/core/features/issues/input.ts` | Issues store an untyped key/value custom-field map and its changes reach activity through src/core/features/issue-edit/plan.ts; typed definitions, scopes, project fields, validation and the role rule are absent |
| `FIELD-002` | Custom fields in views, search, API and imports | target | missing |  | No implementation yet |
| `REL-007` | Related issues | target | partial | `tests/worker/related-issues.test.ts`, `tests/worker/jira-apply.test.ts`, `tests/worker/linear-api-import.test.ts`, `tests/e2e/core-related-journey.mjs` | The cited evidence exercises the existing related issues behavior. Missing an audited "complete related issues through its public doors" journey that performs and reads the full retained outcome: Members can mark two issues as related across teams, with no blocking effect; the link shows on both issues, survives team moves, imports from Jira "Relates" and Linear "related" links when both issues are in the same migration (DATA-017), and is removed when either issue is deleted. |
| `TRIAGE-001` | Triage responsibility | target | missing |  | No implementation yet |
| `TRIAGE-002` | Triage routing rules | target | partial | `src/core/features/issues/mutations.ts` | Manual acceptance chooses team, status and assignee; rules are absent |
| `TRIAGE-003` | Agent triage suggestions | target | missing |  | No implementation yet |
| `TRIAGE-004` | Request forms | target | partial | `src/core/features/operator-intake/input.ts` | One fixed internal intake form; configurable forms are absent |
| `TRIAGE-005` | Email intake | target | partial | `tests/worker/collaboration-mail.test.ts`, `tests/worker/role-matrix.test.ts`, `tests/e2e/integration-settings-journey.mjs` | Customer/contact/domain mapping and customer-request records under CUST-006 (patterns 1/2) are unbuilt: requesters remain unmapped email senders until CUST-006 exists. Signed SendGrid Event Webhooks update reply comments with accepted or bounced outcomes; unsigned, altered, stale, replayed and foreign events write nothing. Customer-domain attachment at the email door remains BLOCKED TRIAGE-005 (DONE): CUST-005 customer records. Cloudflare routing, SendGrid sender-domain and signed Event Webhook installation remain deployment steps; no hosted inbox receipt is claimed. Provider-edge proof covers attachments within BASELINE limits, allow-list rejection, In-Reply-To reply threading, once-only replies, internal-comment isolation, Guest denial and acknowledgement opt-in. Intake is disabled by default. Cloudflare routing and SendGrid sender-domain configuration remain installation steps; no hosted mailbox receipt is claimed. |
| `CUST-001` | Customer requests on issues | target | missing |  | No implementation yet |
| `CUST-002` | Customer-weighted planning | target | missing |  | No implementation yet |
| `CUST-003` | Close the loop with requesters | target | missing |  | No implementation yet |
| `CUST-004` | Penny keeps the board | target | partial | `tests/e2e/core-runtime.mjs` | The cited inventory is a product boundary record. Missing a public-door linked Penny request journey reading Penny-owned text, votes and status; inventory alone does not prove that link. |
| `CUST-005` | Customer records | target | missing |  | No implementation yet |
| `CUST-006` | Customer identity and merging | target | missing |  | No implementation yet |
| `CUST-007` | Customers list and customer pages | target | missing |  | No implementation yet |
| `CUST-008` | Adding customer requests by hand | target | missing |  | No implementation yet |
| `WORK-004` | Created, Subscribed and Activity tabs | target | partial | `tests/worker/my-work-tabs.test.ts`, `tests/e2e/core-my-work-tabs-journey.mjs`, `evidence/my-work-tabs/WORK-004/` | The cited evidence exercises the existing created, subscribed and activity tabs behavior. Missing an audited "complete created, subscribed and activity tabs through its public doors" journey that performs and reads the full retained outcome: ROLE-002 inherits private-team narrowing and its lost-access acceptance cell for private teams; MOBILE-001 inherits the mobile-app tabs journey. |
| `PROJ-010` | Project updates | target | missing |  | No implementation yet |
| `PROJ-011` | Milestones | target | partial | `tests/e2e/admin-project-cycle-journey.mjs`, `tests/worker/project-fields.test.ts`, `tests/worker/issue-copy.test.ts`, `tests/worker/data-http.test.ts` | The cited evidence exercises the existing milestones behavior. Missing an audited "complete milestones through its public doors" journey that performs and reads the full retained outcome: Copy, persisted Undo, bulk project changes, deletion preimages and native archive restore carry the assignment; deleting a milestone keeps its issues and clears their assignment. |
| `PROJ-012` | Project templates | target | partial | `tests/worker/project-fields.test.ts`, `tests/worker/data-http.test.ts`, `tests/worker/project-fields-upgrade.test.ts`, `tests/e2e/admin-project-cycle-journey.mjs`, `tests/e2e/project-templates-journey.mjs` | Update cadence is stored and shown; its effect awaits PROJ-010/AUTO-005. Issue templates await ISSUE-016. tests/e2e/admin-project-cycle-journey.mjs (projectTemplateAccessCells) exercises current private-template visibility and Viewer creation/edit/application refusals at 1440/390 and HTTP.  Member applications skip unavailable project labels and report their names. Application uses native services in order; an interrupted creation names the partial project for inspection before retry. |
| `PROJ-013` | Project documents and specs | target | partial | `tests/worker/project-report.test.ts`, `tests/worker/documents-scenario.ts`, `tests/worker/role-matrix.test.ts`, `tests/worker/role-viewer-census.ts`, `tests/e2e/project-documents-journey.mjs`, `tests/e2e/project-report-runtime.mjs`, `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/slack-unfurl-scenario.ts` | Unproved parts of "Projects, issues, initiatives (INIT-001) and teams can hold Markdown documents (specs, PRDs, decision records, team handbooks and runbooks) written in the ISSUE-026 editor, with inline images and video (ISSUE-033, ISSUE-034), checklists (ISSUE-025), revision history, mentions, comments, attachments and search; a spec document can be linked as an issue's specification (PUSH-001).": "inline images and video (ISSUE-033, ISSUE-034)" needs document media integration/assertions; "checklists (ISSUE-025)" needs a document checklist mutation/assertion; "mentions" needs document-specific ISSUE-013 integration/assertions; "attachments" needs a document ISSUE-009 attachment door/assertion; "a spec document can be linked as an issue's specification (PUSH-001)" has native linking asserted, while PUSH-001 checkout consumption remains unbuilt. Native create/read/edit/comments, revision history, parent lists, search, visibility, role cells and parent export are asserted; this is PARTIAL, not a DONE proposal. |
| `PROJ-014` | Project members and teams | target | partial | `src/core/features/administration/projects.ts` | Lead and cross-team issues exist; members, contributing teams and following are absent |
| `PROJ-015` | Project dependencies | target | missing |  | No implementation yet |
| `PROJ-016` | Define project status categories | target | partial | `src/core/features/administration/schema.ts`, `tests/e2e/admin-project-cycle-journey.mjs` | A fixed lifecycle of Planned, Active, Completed and Canceled set by hand; named, ordered and colored statuses, the Backlog and Paused categories, team sets, removal with a destination and status import are absent |
| `PROJ-046` | Team project status mapping | target | missing | `src/core/features/administration/schema.ts`, `tests/e2e/admin-project-cycle-journey.mjs` | A fixed lifecycle of Planned, Active, Completed and Canceled set by hand; named, ordered and colored statuses, the Backlog and Paused categories, team sets, removal with a destination and status import are absent |
| `PROJ-017` | Recoverable project deletion | target | missing |  | Recently deleted projects, deletion Undo, retention, restore and purge are not implemented; current deletion remains Owner/Admin only |
| `INIT-001` | Initiatives | target | partial | `tests/worker/project-membership.test.ts`, `tests/worker/role-matrix.test.ts`, `tests/e2e/initiatives-journey.mjs`, `tests/worker/channel-notifications-scenario.ts`, `tests/e2e/initiatives-journey.mjs`, `tests/worker/initiatives-scenario.ts`, `tests/worker/channel-notifications-scenario.ts`, `tests/worker/role-probes.ts`, `tests/e2e/initiatives-journey.mjs`, `tests/e2e/data-integration-history.mjs`, `tests/e2e/data-roundtrip.mjs` | INIT-001 unproved: assertion sensitivity for approval refusal when the connected Slack workspace changes. Candidate landing, exact-SHA Run site and complete clean publication-scan proof remain outstanding. INIT-002 roll-ups remain separately assigned. |
| `INIT-002` | Initiative roll-up | target | missing |  | No implementation yet |
| `INIT-003` | Roadmap timeline | target | missing |  | No implementation yet |
| `INIT-004` | Leadership digest | target | missing |  | No implementation yet |
| `CYCLE-007` | Automatic cycle schedule | target | partial | `tests/worker/cycle-schedule.test.ts`, `tests/e2e/cycle-schedule-runtime.mjs` | The cited evidence exercises the existing automatic cycle schedule behavior. Missing an audited "complete automatic cycle schedule through its public doors" journey that performs and reads the full retained outcome: Changing the cadence affects only cycles not started. |
| `CYCLE-008` | Automatic cycle membership | target | partial | `tests/worker/cycle-membership.test.ts`, `tests/e2e/core-cycle-membership-journey.mjs` | The cited evidence exercises the existing automatic cycle membership behavior. Missing an audited "complete automatic cycle membership through its public doors" journey that performs and reads the full retained outcome: A team can choose to add issues to the active cycle when they move to Started, and when they complete without a cycle, so the cycle reflects real work; each addition is recorded as an automation change. |
| `RELEASE-001` | Releases | target | partial | `tests/worker/project-membership.test.ts`, `tests/worker/role-matrix.test.ts`, `tests/worker/integration-api.test.ts`, `tests/e2e/releases-journey.mjs` | Slack/Discord release bindings are absent: the existing durable channel model binds issue-bearing team/project/view subjects. Jira fix versions import remains DATA-013. |
| `RELEASE-002` | Deployment tracking | target | partial | `tests/worker/github-links.test.ts`, `tests/e2e/integrations/github-chain.mjs` | GitLab environments, CircleCI, Vercel, Netlify and Cloudflare Workers/Pages have no receiver or signed fixture. Unrecorded ancestry, missing non-forced push proof and unknown SHAs remain unproven and never attach an issue. |
| `RELEASE-003` | Release notes | target | missing |  | No implementation yet |
| `SEARCH-004` | Advanced filters | target | partial | `src/core/features/issues/list.ts` | Single-value filters per field; grouped and negated expressions are absent |
| `SEARCH-005` | Meaning-based search | target | missing |  | No implementation yet |
| `VIEW-006` | Manual order | target | partial | `tests/worker/manual-order.test.ts`, `tests/worker/manual-order-import.test.ts`, `tests/e2e/core-manual-order-journey.mjs`, `tests/worker/data-http.test.ts` | The cited evidence exercises the existing manual order behavior. Missing an audited "complete manual order through its public doors" journey that performs and reads the full retained outcome: Besides the derived orders, lists and boards offer a Manual order that members set by dragging or keyboard (move up, move down, move to top); the order is shared per team and view, imported from Jira rank and Linear sort order, and never changes Current's derived ranking (CURR-007). |
| `VIEW-007` | Timeline and calendar views | target | partial | `tests/worker/base-auth.test.ts`, `tests/e2e/calendar-month-journey.mjs`, `tests/e2e/cycle-report-runtime.mjs` | Timeline, dependency drawing and start-date combinations await ISSUE-022. Target-dated releases are included by current creator visibility: personal feeds carry own-team and readable workspace releases, and private-team releases require membership at each request. tests/e2e/calendar-access-cells.mjs (calendarAccessCells) asserts the readable team release in its team feed and excludes workspace releases and release descriptions. Team feed authority loss returns 404. Release channel binding remains RELEASE-001. tests/e2e/calendar-feeds-journey.mjs (calendarAccessCells at 1440/390 and HTTP) exercises current private-team omission and Viewer read-only month access. Calendar uses the feed event reader, workspace-local cycle days, native version-checked due-date edits and Undo. Guests retain the Calendar page refusal adopted for CAL-001. |
| `VIEW-008` | Display options | target | partial | `src/core/features/issues/ui/issue-board.tsx` | Columns by status with a keyboard selector; swimlanes, drag and property choices are absent |
| `VIEW-009` | Workspace-wide views | target | partial | `src/core/features/views/service.ts` | Saved issue views; project, initiative and request views are absent |
| `VIEW-010` | Sidebar favorites | target | missing |  | No implementation yet |
| `VIEW-011` | Light, dark and system themes | target | partial | `tests/e2e/theme-runtime.mjs`, `tests/e2e/theme-contrast.mjs`, `tests/e2e/theme-control-contrast.mjs`, `src/core/app/ui/palette.css`, `src/core/app/app.css`, `src/core/features/settings/appearance.ts` | The cited evidence exercises the existing light, dark and system themes behavior. Missing an audited "complete light, dark and system themes through its public doors" journey that performs and reads the full retained outcome: Charts (REPORT-001), the roadmap timeline (INIT-003) and the desktop and mobile apps (MOBILE-001, MOBILE-005) inherit this choice and its contrast rule for those capabilities. |
| `CMD-004` | Keyboard-first editing | target | partial | `tests/e2e/core-stream-planning-journey.mjs`, `tests/worker/bulk-commands.test.ts`, `evidence/keyboard-planning/CMD-004/` | The cited evidence exercises the existing keyboard-first editing behavior. Missing an audited "complete keyboard-first editing through its public doors" journey that performs and reads the full retained outcome: Every issue property has a single-key shortcut on a focused or selected issue (S status, A assignee, P priority, L labels, E estimate, D due date, M move team, Shift-D duplicate decision, Command/Ctrl-. copy branch name), shortcuts work on multiple selected issues, and a shortcut help sheet (?) lists them. |
| `SYNC-001` | Real-time sync | target | partial | `tests/e2e/core-current-journey.mjs` | Refresh within five seconds without reload; a live connection is absent |
| `SYNC-002` | Local-first speed | target | missing |  | No implementation yet |
| `SYNC-003` | Collaborative editing | target | missing |  | No implementation yet |
| `MOBILE-001` | iOS and Android apps | target | missing |  | No implementation yet |
| `MOBILE-002` | Push notifications | target | missing |  | No implementation yet; the new inherited NOTIFY-007 acceptance point for mobile push (per-event member choice, Admin defaults, working hours/digests, mutes, actor exclusion, access and no repeated delivery) is unbuilt: this channel door does not exist yet |
| `MOBILE-003` | Responsive web | target | partial | `tests/e2e/dev-runtime.mjs` | 390px checks exist for current pages; new pages in this contract are open |
| `MOBILE-004` | Distributed apps and push relay | target | missing |  | No implementation yet |
| `MOBILE-005` | Desktop apps and desktop notifications | target | missing |  | No implementation yet; the new inherited NOTIFY-007 acceptance point for desktop notification (per-event member choice, Admin defaults, working hours/digests, mutes, actor exclusion, access and no repeated delivery) is unbuilt: this channel door does not exist yet |
| `NOTIFY-007` | Channels and digests | target | partial | `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/personal-time.test.ts`, `tests/worker/role-matrix.test.ts`, `tests/e2e/integrations/notification-channel-controls.mjs`, `tests/e2e/integrations/slack-dm-settings.mjs` | The cited evidence exercises the existing channels and digests behavior. Missing an audited "complete channels and digests through its public doors" journey that performs and reads the full retained outcome: the per-event choice for push, desktop notifications and Teams direct messages is delivered with MOBILE-002, MOBILE-005 and TEAMS-001. |
| `NOTIFY-008` | Snooze and reminders | target | done | `tests/worker/notification-followups.test.ts` — "snoozes return once by time or issue change and personal reminders deliver privately once" |  |
| `NOTIFY-009` | Subscriptions | target | partial | `tests/worker/follower-events.test.ts`, `tests/worker/subscriptions-scenario.ts`, `tests/e2e/subscriptions-journey.mjs`, `tests/worker/project-membership.test.ts`, `tests/worker/initiatives-scenario.ts`, `tests/worker/follower-events.test.ts`, `tests/worker/subscriptions-scenario.ts`, `tests/worker/follower-events.test.ts`, `tests/worker/subscriptions-scenario.ts` | The cited evidence exercises the existing subscriptions behavior. Missing an audited "complete subscriptions through its public doors" journey that performs and reads the full retained outcome: Inherited from ROLE-007: a member's team notifications and team subscriptions follow team membership. |
| `NOTIFY-010` | Personal time zone and working hours | target | partial | `tests/worker/personal-time.test.ts`, `tests/e2e/personal-time-runtime.mjs`, `src/core/app/viewer-time.tsx` | The cited evidence exercises the existing personal time zone and working hours behavior. Missing an audited "complete personal time zone and working hours through its public doors" journey that performs and reads the full retained outcome: Dates and times in the interface show in the viewer's time zone with the zone named where it differs from the workspace's. |
| `AUTO-001` | Recurring issues | target | missing |  | No implementation yet |
| `AUTO-002` | Workflow rules | target | partial | `src/core/features/due-reminders/service.ts`, `src/core/features/intake-return/service.ts` | Fixed due reminders and deferral return; configurable rules are absent |
| `AUTO-003` | Auto-close and auto-archive | target | partial | `tests/worker/housekeeping.test.ts`, `tests/e2e/housekeeping-runtime.mjs`, `src/core/features/housekeeping/`, `src/core/features/notifications/events.ts` | The cited evidence exercises the existing auto-close and auto-archive behavior. Missing an audited "complete auto-close and auto-archive through its public doors" journey that performs and reads the full retained outcome: The automation entry is the comment: it sits in the issue's own activity with its reason ("Closed automatically after 30 days without activity", "Archived automatically 90 days after it closed") for everyone who can read the issue, and the issue's followers (NOTIFY-002) receive the notification a manual status change gives them, once per automated change, naming the automation as actor: a cancellation for an auto-close and an archive notification (its own kind, mutable like the others) for an auto-archive. |
| `AUTO-004` | SLAs | target | missing |  | No implementation yet |
| `AUTO-005` | Update reminders | target | missing |  | No implementation yet |
| `AUTO-006` | Due-soon rules | target | partial | `src/core/features/due-reminders/service.ts` | Due-today and overdue notifications only |
| `REPORT-001` | Insights | target | partial | `tests/worker/cycle-report.test.ts`, `tests/e2e/insights-journey.mjs`, `tests/e2e/cycle-report-runtime.mjs` | Triage time (TRIAGE-001), SLA breaches (AUTO-004), customer tier (CUST-*), issue types and unavailable historical data; tests/e2e/insights-journey.mjs (insightsAccessCells at 1440/390 and HTTP) exercises Member omission and Viewer chart/count/drill/CSV reads after explicit membership. Bug series require a current Bug label. No /api/v1 series read. |
| `REPORT-002` | Cycle and project charts | target | partial | `tests/worker/cycle-report.test.ts`, `tests/e2e/cycle-report-runtime.mjs`, `tests/worker/project-report.test.ts`, `tests/e2e/project-report-runtime.mjs`, `tests/worker/data-http.test.ts` | The cited evidence exercises the existing cycle and project charts behavior. Missing an audited "complete cycle and project charts through its public doors" journey that performs and reads the full retained outcome: Membership events retain identifiers and timestamps only, and erasure is unchanged. |
| `REPORT-006` | Project completion forecast | target | partial | `tests/worker/cycle-report.test.ts`, `tests/e2e/cycle-report-runtime.mjs`, `tests/worker/project-report.test.ts`, `tests/e2e/project-report-runtime.mjs`, `tests/worker/data-http.test.ts` | The cited evidence exercises the existing project completion forecast behavior. Missing an audited "complete project completion forecast through its public doors" journey that performs and reads the full retained outcome: Completed, canceled and archived projects retain their last aggregate state; reopening resumes live history. |
| `REPORT-003` | Dashboards | target | partial | `tests/e2e/dashboards-journey.mjs` | The cited evidence exercises the existing dashboards behavior. Missing an audited "complete dashboards through its public doors" journey that performs and reads the full retained outcome: Members compose dashboards of saved charts, counts and issue lists for a team or for leadership, share them inside the workspace, and filter the whole dashboard by team, date range or project. |
| `REPORT-004` | Workload | target | partial | `tests/worker/workload.test.ts`, `tests/e2e/core-workload-journey.mjs` | The cited workload journey reads three people, estimates, issue counts and capacities. Missing the workload journey populated by a delegated agent session which verifies the accountable person retains that work; delegation is unbuilt. |
| `REPORT-005` | Warehouse and spreadsheet export | target | missing |  | No implementation yet |
| `INTEG-001` | Guided connection from Settings | target | partial | `src/core/features/integrations/ui/github-setup.tsx`, `src/core/features/integrations/ui/source-setup.tsx`, `src/core/features/integrations/ui/copy-field.tsx`, `src/core/features/integrations/test-webhook.ts` | Settings → Integrations exists for signed sources, GitHub repository webhooks and outbound destinations, with copyable payload URLs, reveal-once secrets and a test delivery; provider app creation, manifest flows, OAuth installs and the live first-event check are absent |
| `INTEG-002` | Integration health and repair | target | partial | `src/core/features/integrations/reenter.ts`, `src/core/features/integrations/ui/delivery-setup.tsx` | Credential re-entry after restore and outbound delivery state; health for inbound providers and in-place repair are absent |
| `GITHUB-003` | Branches and status automation | target | partial | `tests/worker/github-links.test.ts`, `tests/e2e/integrations/github-chain.mjs`, `tests/e2e/integrations/github-team-permissions.mjs`, `tests/worker/role-probes.ts` | The cited evidence exercises the existing branches and status automation behavior. Missing an audited "complete branches and status automation through its public doors" journey that performs and reads the full retained outcome: Provider-backed "create branch" is tracked in GITHUB-008. |
| `GITHUB-004` | Commits | target | partial | `tests/worker/github-links.test.ts`, `tests/e2e/integrations/github-chain.mjs` | The cited evidence exercises the existing commits behavior. Missing an audited "complete commits through its public doors" journey that performs and reads the full retained outcome: Push events link commits whose message names an issue, showing author, message and link on the issue; closing words in a commit on the default branch act like a merged PR under the team rules. |
| `GITHUB-005` | Review and checks on the issue | target | missing |  | No implementation yet |
| `GITHUB-006` | GitHub App | target | missing |  | No implementation yet |
| `GITHUB-007` | GitHub Issues sync | target | missing |  | No implementation yet |
| `GITHUB-008` | Provider-backed create branch | target | missing |  | Requires GITHUB-006 and a provider write credential; carved verbatim from GITHUB-003. |
| `GITLAB-001` | GitLab | target | missing |  | No implementation yet |
| `GITLAB-002` | GitLab Issues sync | target | missing |  | No implementation yet |
| `BITBUCKET-001` | Bitbucket | target | missing |  | No implementation yet |
| `CI-001` | CI and deploy providers | target | missing |  | No implementation yet |
| `SLACK-001` | Slack app | target | partial | `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/slack-app-scenario.ts`, `tests/e2e/integration-runtime.mjs`, `tests/e2e/integrations/slack-app-installation.mjs`, `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/slack-app-scenario.ts`, `tests/worker/slack-events-scenario.ts`, `tests/worker/slack-app-recovery-scenario.ts`, `tests/e2e/integration-runtime.mjs`, `tests/e2e/integrations/slack-app-installation.mjs`, `tests/e2e/integrations/slack-app-archive.mjs`, `tests/worker/role-matrix.test.ts`, `tests/worker/role-viewer-census.ts` | Carried partial without promotion; a fresh judgment must assess the cited setup or unfurl journeys against all native outcomes. Real-workspace proof is tracked separately in R-4 and does not gate DONE. |
| `SLACK-002` | Issues from Slack with synced threads | target | missing |  | No implementation yet |
| `SLACK-003` | Slack and Discord channel bindings | target | partial | `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/channel-settings.mjs`, `tests/worker/role-matrix.test.ts`, `src/core/features/integrations/channels/`, `evidence/slack-003/SAFE_PROVIDER.md`, `evidence/slack-003/REAL_PROVIDER.md`, `evidence/slack-003/CHANNEL_SAFETY.md` | The cited journeys cover current team/project/view bindings and role refusals. Missing channel bindings for initiatives and the inherited project-update/release/SLA/agent events, with private-team routing read at dispatch. |
| `SLACK-006` | Connect and remove channel credentials | target | partial | `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/channel-settings.mjs`, `tests/worker/role-matrix.test.ts`, `src/core/features/integrations/channels/`, `evidence/slack-003/SAFE_PROVIDER.md`, `evidence/slack-003/REAL_PROVIDER.md`, `evidence/slack-003/CHANNEL_SAFETY.md` | The cited evidence exercises the existing connect and remove channel credentials behavior. Missing an audited "complete connect and remove channel credentials through its public doors" journey that performs and reads the full retained outcome: An Admin enters a Slack bot token in Settings → Integrations once; a provider credential check validates it, per-workspace encryption seal it per workspace, settings never reveal it again, archives exclude it, restored installations need attention until re-entry, and removal calls provider credential revocation, deletes local custody and disables bindings (a provider error refuses removal visibly). |
| `SLACK-007` | Durable minimal channel posts | target | partial | `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/channel-settings.mjs`, `tests/worker/role-matrix.test.ts`, `src/core/features/integrations/channels/`, `evidence/slack-003/SAFE_PROVIDER.md`, `evidence/slack-003/REAL_PROVIDER.md`, `evidence/slack-003/CHANNEL_SAFETY.md` | The cited journeys show minimal current native channel posts and held failures. Missing the private-team notice journey reading no actor or text across every bound target after a privacy transition. |
| `SLACK-008` | Create and bind a Slack channel | target | partial | `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/channel-settings.mjs`, `tests/worker/role-matrix.test.ts`, `src/core/features/integrations/channels/`, `evidence/slack-003/SAFE_PROVIDER.md`, `evidence/slack-003/REAL_PROVIDER.md`, `evidence/slack-003/CHANNEL_SAFETY.md` | The cited evidence exercises the existing create and bind a slack channel behavior. Missing an audited "complete create and bind a slack channel through its public doors" journey that performs and reads the full retained outcome: Discord accepts only HTTPS discord.com or discordapp.com URLs whose path starts the provider webhook prefix, seals the URL and refuses redirects; this fixed-host rule does not depend on arbitrary resolved-address egress. |
| `SLACK-009` | Channel safety and explicit mapping | target | partial | `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/channel-settings.mjs`, `tests/worker/role-matrix.test.ts`, `src/core/features/integrations/channels/`, `evidence/slack-003/SAFE_PROVIDER.md`, `evidence/slack-003/REAL_PROVIDER.md`, `evidence/slack-003/CHANNEL_SAFETY.md` | The cited evidence exercises the existing channel safety and explicit mapping behavior. Missing an audited "complete channel safety and explicit mapping through its public doors" journey that performs and reads the full retained outcome: Channel IDs are explicitly mapped by the Admin, never inferred from email or name. |
| `SLACK-004` | Link and unlink your Slack identity | target | partial | `src/core/features/integrations/slack-dm/`, `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/slack-dm-settings.mjs`, `evidence/slack-004/REAL_PROVIDER.md` | The cited evidence exercises the existing link and unlink your slack identity behavior. Missing an audited "complete link and unlink your slack identity through its public doors" journey that performs and reads the full retained outcome: The link is shown, audited (`slack.member_linked`, `slack.member_unlinked`) and revocable with Unlink; unlinking, member removal, suspension (ROLE-011 inherits) and removal of the workspace's Slack credential delete it and stop every direct message. |
| `SLACK-010` | Personal Slack delivery | target | partial | `src/core/features/integrations/slack-dm/`, `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/slack-dm-settings.mjs`, `evidence/slack-004/REAL_PROVIDER.md` | The cited evidence exercises the existing personal slack delivery behavior. Missing an audited "complete personal slack delivery through its public doors" journey that performs and reads the full retained outcome: A message carries only the event kind, issue identifier and title, actor display name, status change, due date and the authenticated canonical `canonical issue` link, in plain-text blocks with automatic link and media previews disabled — never a description, comment or mention body, free text or AI output; private or restricted items get a generic notice with no actor or text under ROLE-002. |
| `SLACK-011` | Signed Slack notification actions | target | partial | `src/core/features/integrations/slack-dm/`, `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/slack-dm-settings.mjs`, `evidence/slack-004/REAL_PROVIDER.md` | The cited evidence exercises the existing signed slack notification actions behavior. Missing an audited "complete signed slack notification actions through its public doors" journey that performs and reads the full retained outcome: An unlinked, removed or suspended Slack user, a bad or missing signature, a stale timestamp and a replay change nothing. |
| `SLACK-012` | Slack interactivity secret custody | target | partial | `src/core/features/integrations/slack-dm/`, `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/integrations/slack-dm-settings.mjs`, `evidence/slack-004/REAL_PROVIDER.md` | The cited evidence exercises the existing slack interactivity secret custody behavior. Missing an audited "complete slack interactivity secret custody through its public doors" journey that performs and reads the full retained outcome: docs/INTEGRATIONS.md names the Interactivity Request URL the Admin sets in their Slack app until SLACK-001's manifest sets it, and what leaves the deployment in a direct message. |
| `SLACK-005` | Link previews | target | partial | `tests/worker/outbound-broken-destination.test.ts`, `tests/worker/slack-unfurl-scenario.ts` | Carried partial without promotion; a fresh judgment must assess the cited setup or unfurl journeys against all native outcomes. Real-workspace proof is tracked separately in R-4 and does not gate DONE. |
| `TEAMS-001` | Microsoft Teams | target | missing |  | No implementation yet; the new inherited NOTIFY-007 acceptance point for Teams direct message (per-event member choice, Admin defaults, working hours/digests, mutes, actor exclusion, access and no repeated delivery) is unbuilt: this channel door does not exist yet |
| `SUPPORT-001` | Zendesk, Intercom and Front | target | partial | `src/core/features/integrations/source-ingest.ts` | Signed generic source intake with replay identity; provider apps, linking and status sync are absent |
| `SUPPORT-002` | HappyToHelp | target | missing |  | No implementation yet |
| `ERROR-001` | Sentry and Datadog | target | partial | `src/core/features/integrations/source-ingest.ts` | Generic signed source intake; Sentry and Datadog adapters, resolution sync and regression handling are absent |
| `ERROR-002` | Spool | target | missing |  | No implementation yet |
| `DESIGN-001` | Figma | target | missing |  | No implementation yet |
| `DOCS-001` | Notion, Confluence and Google Drive | target | partial | `src/core/features/links/repository.ts` | Named HTTPS links; previews and provider connections are absent |
| `CAL-001` | Calendar feeds | target | partial | `tests/worker/base-auth.test.ts`, `tests/worker/calendar-feed-proof.ts`, `tests/worker/data-http.test.ts`, `tests/e2e/calendar-feeds-journey.mjs`, `tests/e2e/cycle-report-runtime.mjs`, `tests/e2e/calendar-access-cells.mjs`, `tests/e2e/calendar-feeds-journey.mjs`, `tests/e2e/cycle-report-runtime.mjs`, `tests/worker/calendar-feed-proof.ts`, `tests/worker/base-auth.test.ts` | The cited feed journeys cover native due dates, cycles and milestones and revocation. Missing the complete feed journey reading release events in the same exported calendar. |
| `CONNECT-001` | Zapier and Make | target | partial | `src/core/features/integrations/api.ts`, `src/core/features/integrations/outbound.ts` | The API and webhooks they need exist in part; the apps are absent |
| `AGENT-001` | Delegate an issue to an agent | target | missing |  | No implementation yet |
| `AGENT-002` | Agent session on the issue | target | missing |  | No implementation yet |
| `AGENT-003` | Reviewable agent output and policy-decided completion | target | missing |  | No implementation yet |
| `AGENT-004` | Agent permissions and budgets | target | missing |  | No implementation yet |
| `AGENT-005` | MCP server | target | missing |  | No implementation yet |
| `AGENT-006` | Agent platform | target | partial | `src/core/features/integrations/api.ts`, `src/core/features/integrations/outbound.ts` | Scoped tokens and signed outbound events; app actors, delegation events and activity types are absent |
| `AGENT-007` | Ask Vector | target | missing |  | No implementation yet |
| `AGENT-008` | Agent guidance | target | missing |  | No implementation yet |
| `AGENT-009` | Provider delegation protocols | target | missing |  | No implementation yet |
| `API-003` | Complete public API | target | partial | `tests/worker/integration-api.test.ts`, `tests/worker/api-rate-limit.test.ts`, `schema/api-v1.json` | Idempotency keys and their concurrency/retention proofs; issue deletion through the native receipt/policy door; cycle update/delete; complete list/get/create/update/delete coverage for attachments, relations, labels, teams, workflow states, views, notifications and members; attachment bytes excluded by API-001; initiative and release deletion; documents PROJ-013, customers CUST-005 and customer requests CUST-001 not built; real private-team refusal under ROLE-002; full schema-coverage acceptance. API-001 published wording is retained pending a valid next-release amendment representation: the issued RELEASE.json fails its pinned validator and the schema has no NEXT envelope. |
| `API-004` | OAuth apps | target | missing |  | No implementation yet |
| `API-005` | SDK and docs | target | missing |  | No implementation yet |
| `WEBHOOK-002` | Webhooks for every object | target | partial | `src/core/features/integrations/outbound.ts` | Issue created, updated and completed events |
| `DATA-012` | GitHub Issues and Projects import | target | missing |  | No implementation yet |
| `DATA-013` | Jira Cloud and Data Center API import | target | partial | `src/core/features/data/import/jira.ts` | All Fields CSV file profile; the live API, attachment bytes, versions and Data Center are absent |
| `DATA-014` | Linear API import | target | partial | `src/core/features/data/import/linear.ts`, `src/core/features/data/import/api-file.ts` | Workspace CSV plus an owner-produced API file; direct API, bytes, initiatives and updates are absent |
| `DATA-015` | Plane, Huly and Shortcut import | target | done | `tests/worker/plane-huly-shortcut-import.test.ts` — "[DATA-015] $format imports its source fixture through reviewed staged runs and reconciles mapped fields and explicit losses" |  |
| `DATA-016` | Transition sync | target | missing |  | No implementation yet |
| `DATA-017` | Whole-workspace migration | target | partial | `src/core/features/data/import/ids.ts`, `src/core/features/data/import/runs.ts`, `tests/e2e/data-staged-cli.mjs` | Stable per-source import identities, staged runs with resume, repeat and rollback, and in-run relations; migrations, cross-run relation binding, the migration report, incremental re-runs and the 50,000-issue run are absent |
| `DATA-018` | Old identifiers and links after a move | target | partial | `tests/e2e/jira-public-journey.mjs` | Imported issues show and find their source ID in search under DATA-007; URL resolution, alias redirects and Git magic words on old keys are absent |
| `SEC-001` | Integration credentials | target | partial | `tests/worker/data-http.test.ts`, `tests/worker/outbound-broken-destination.test.ts` | The cited archive journeys cover the current native integration secrets and Slack paste path. Missing the credential-custody journey for the future coding-provider accounts, GitHub App and complete connected-provider set, including rotation and removal. |
| `SEC-002` | Model and agent data handling | target | missing |  | No implementation yet |
| `SEC-003` | Erasure across integrations | target | partial | `src/core/features/issue-deletion/service.ts` | Native, file and webhook erasure; posted Slack channel messages, already-sent Slack direct messages and Discord messages cannot be recalled by local erasure; member removal deletes SLACK-004 Slack links; synced-thread erasure, other external identities and embeddings are absent |
| `PUSH-001` | Issue to spec | push-further | missing |  | No implementation yet |
| `PUSH-002` | Spec to tested PR | push-further | missing |  | No implementation yet |
| `PUSH-003` | Verified deployment | push-further | missing |  | No implementation yet |
| `PUSH-004` | Outcome verification before close | push-further | missing |  | No implementation yet |
| `PUSH-005` | Customer follow-through | push-further | missing |  | No implementation yet |
| `PUSH-006` | Blocked-work follow-up | push-further | partial | `src/core/features/dependencies/repository.ts`, `src/core/features/due-reminders/service.ts` | Waiting state and due reminders; questions, promised times and Slack are absent |
| `PUSH-007` | Plans with uncertainty | push-further | partial | `src/core/features/projects/service.ts` | Explainable health and capacity risk; forecasts and options are absent |
| `PUSH-008` | Incident follow-up loop | push-further | missing |  | No implementation yet |
| `PUSH-009` | Standups and cycle summaries | push-further | partial | `src/core/features/cycle-closure/read.ts` | Numeric closed-cycle summaries; written summaries are absent |
| `PUSH-010` | Agent accountability ledger | push-further | missing |  | No implementation yet |
| `SURFACE-001` | Registry of Vector jobs | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-002` | Internal work and outside exposure | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-003` | Provider spend and resources | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-004` | Membership and credentials | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-005` | Irreversible work and regulated records | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-006` | Sign-off and running services | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-007` | Vector record resources | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-008` | Vector event handoffs | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-009` | Specialist prompts and documentation | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-010` | Embedded and external specialist parity | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-011` | Capacity and provider costs | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-012` | Recoverable planning and safe removal | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
| `SURFACE-013` | Software delivery specialist week | target | missing |  | No Vector action registry and Base conformance journey implements these specialist outcomes. |
