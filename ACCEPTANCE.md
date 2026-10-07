# Vector acceptance

CONTRACT.md and BASELINE.md define the full target. HANDOVER.md records implemented scope and known limitations. A verified installation lets an operator sign in, inspect evidence, make an intake decision, create and update work, discuss it, retain private files, manage operators and sign out. Data, session revocation and authorization must survive new requests and runtime restart. Concurrent edits must preserve history and reject stale writes without stray activity.

`pnpm verify` runs source integrity, unit and Worker tests, deployment tests, types/build, emitted Worker/browser checks, Base authentication journeys and clause registration. Run `pnpm test:dev` against a running development server; focused foundation/removal commands exercise further journeys. Generated diagnostic output is ignored.

For a hosted installation, separately validate the exact source and deployment identities, received email sign-in and invitations, revocation, empty bootstrap, Cron delivery and repeat-deploy preservation of D1/R2 data. Provider submission alone does not establish inbox arrival. Portable export/restore, capacity and complete contract acceptance remain broader requirements.
