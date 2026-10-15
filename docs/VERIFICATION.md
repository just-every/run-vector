# Verification and manual commands

`rer verify` runs the build, artifact and command-contract checks through the
native rer verifier. It does not run the contributor test suites. `pnpm verify:ci`
is the CI application wall: it validates sources, runs installer, Node, Markdown,
Worker and deployment tests, builds, and runs the emitted Worker and browser
journeys. GitHub CI additionally runs the actual development setup and hydration
journey, the slow installer and the literal fresh-clone README journey. `.github/workflows/ci.yml` and `scripts/verify.mjs` are the executable
registration, rather than this document being an independent list of gates.

The workspace foundation and removal flows belong to those existing suites.
`test:admin` submits workspace time from real Settings on mobile,
preserves the reminder time and reads it after restart. `test:base-auth` exercises
sign-in, invitation, removal, responsive Settings and native session persistence.
`test:worker` covers the native transaction boundaries, held bodies and retained
history; `test:collaboration` checks removal with loaded mobile Inbox
pages. The core browser journey runs one representative accessibility and overflow pass.
There are no separate foundation or removal suites to keep synchronized.

## Scripts outside the wall

These are intentional manual tools, not additional unattended acceptance gates.
Use `rer describe` for the native rer command's flags and effects. Commands that
publish, deploy, release or reset remain subject to the owner's instruction.

| Scripts | Purpose and instructions |
| --- | --- |
| `dev`, `preview` | Run and inspect the local app; stop the owned server when finished. See README. |
| `setup`, `deps`, `rer` | Configure the owner/workspace, install dependencies, or invoke the native rer CLI. See README and `describe`. |
| `reset` | Confirmed local reset; stop development first. See README. |
| `export`, `import` | Local portable archives and confirmed empty-destination restore. See ARCHIVES.md and README. |
| `doctor`, `describe` | Safe configuration diagnosis and CLI usage. See README. |
| `release` | Explicit owner-authorized release operation; inspect `describe` before using it. |
| `sources:lock` | Update the authoring lock after staging changes; then run `sources:check`. See AGENTS.md. |
| `typegen` | Maintenance-only regeneration of Worker binding declarations from Wrangler configuration. Review the generated diff; it is not a product acceptance test. |
| `deploy`, `deploy:health` | Owner-account deployment and health under the declared credential boundary. See DEPLOY.md. |
| `deploy:prepare`, `artifact:setup`, `artifact:deploy`, `artifact:health` | The separate reviewed source-artifact deployment controller. See DEPLOY.md; source preparation is not hosted commissioning. |
| `import:issues` | Reviewed mapped issue import preview, apply, status, resume, rollback and report. See MOVE-IN.md. |
| `smoke` | Focused shortcut for `tests/smoke.test.ts`, already included by the gated `test:node` file glob. |

Other convenience and plumbing scripts are already reached by the wall:
`test` groups the independently gated Node/Markdown/Worker suites;
`build:source` and `typecheck` are reached by `build` through the rer adapter;
`verify:app` is build verification plumbing and `sources:check` validates source custody; `test:dev:setup` and
`test:dev` are invoked by CI's `test:dev:ci`. They do not represent missing CI suites.

Iterate with the public-flow tests for the change and typecheck. The final CI wall
is broader. Local native Worker/browser evidence proves local behavior; provider
delivery, hosted resource identity and commissioning need their own evidence.
