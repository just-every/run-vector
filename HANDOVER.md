# Vector 0.1.0 maintenance handover

Vector is a deployable issue tracker with a Cloudflare Worker, D1 records and R2 private files. README.md covers installation and commands; DEPLOY.md defines artifact preparation and the trusted deployment controller; OPERATIONS.md describes local runtime and recovery behavior.

## Implemented

- Email sign-in and confirmation, durable sessions, invitations, revocation and first-owner bootstrap for an empty workspace, team and seven workflow categories.
- Current, My work, issue editing, projects, operator-attributed intake, accept/defer/decline decisions and scheduled deferral return.
- Safe Markdown comments, named HTTPS links, private files, durable removal intents, dependencies and optimistic version conflicts with preserved activity history.
- Workspace timezone settings and operator removal, including transactional session checks, assignment/ownership transfer, anonymized retained history, last-operator and setup-owner protection.
- Source integrity metadata, credential-free deploy artifact preparation, deterministic Cloudflare resource reconciliation, immutable migration validation, repeated-deploy preservation and health checks.

The maintained environment is Node 26.8.1 / pnpm 8.15.6. `pnpm verify` runs source checks, Node/Markdown/Worker/deployment suites, types/build, emitted Worker and browser checks, Base invitation journeys and clause registration. `pnpm test:dev` checks the actual development runtime separately. `pnpm test:foundation` and `pnpm test:removal` cover additional focused journeys after building. CI uses a frozen install and runs full verification plus development hydration. Generated reports stay under ignored output directories.

## Known limits

Portable application export/restore is not implemented. Use provider backups for D1/R2 and validate recovery before upgrades. Workflow administration, source signature validation and idempotency, notifications, duplicate/parent authoring, saved-view authoring, cycle closure/rollover, complete search and bulk operations still have broader requirements in CONTRACT.md. Requirement tags indicate partial evidence unless the generated report establishes a specific guarantee.

An ambiguous file upload without a durable receipt retains pending cleanup and quota: absent bytes or elapsed time cannot establish that an in-flight writer stopped. Provider Cron delivery, real email arrival, capacity and full accessibility acceptance require separate deployment-specific validation. Local success alone does not prove these outcomes.

## Updating

Preserve migrations 0001–0011 and installation data. Review RELEASE.json for migration and authentication changes. The current vendored Base sources and authoring tools are checked in. Recorded upstream revisions and retained runtime-source snapshots preserve provenance without historical reports or upstream development notes. Source locks are generated from the local edition using `pnpm sources:lock`, checked with `pnpm sources:check`, and included in full verification. No remote source repository is required for these commands.

Publish, tag or deploy only when explicitly requested. This handover describes source behavior and verification procedures, not a claim that a particular installation has been commissioned.
