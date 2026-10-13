# Installation and operator foundation

For the full deployment procedure use [DEPLOY.md](../DEPLOY.md). The committed Wrangler configuration describes the local sample environment. Production uses the prepared artifact and trusted controller, configured with explicit Cloudflare, mail and session inputs.

## Installation inputs

A fresh installation accepts `FIRST_OWNER_EMAIL`, `FIRST_OWNER_NAME`, `WORKSPACE_NAME`, `WORKSPACE_TIMEZONE`, `DEFAULT_TEAM_NAME` and `DEFAULT_TEAM_PREFIX`. All are required together. Prefix is 2–10 uppercase letters; timezone is a named IANA zone. The controller sets the exact `APP_ORIGIN` and `SEED_SAMPLE_DATA=false`.

Bootstrap creates one workspace, one active setup operator, one team and seven workflow categories in a single D1 transaction. No sample issues, projects, cycles or labels are created; the first issue is number 1. Bootstrap runs before the first health/auth/API request. Changing installation inputs never rewrites existing data or authorizes an arbitrary incoming email as owner.

For an existing workspace, the configured owner email must match an existing active operator to attach its setup-owner marker. Removal is refused without that mapping. Changing environment inputs does not reassign an existing marker.

## Authentication and operator lifecycle

Production sign-in and invitations use the checked-in Base auth/mail integration and configured SendGrid delivery. The local outbox is loopback-only. Settings exposes invitations, timezone and operator removal. Removal revokes sessions and pending links, clears active issue assignments, transfers project leads/shared views, erases private views/preferences and anonymizes retained actors. Legacy comments/decisions/files preserve their anonymized operator tombstone and content. Last-operator and setup-owner guards remain enforced at the transaction boundary.

Future notifications and closed-cycle snapshots must integrate with removal when implemented. See [OPERATOR-REMOVAL.md](OPERATOR-REMOVAL.md) for transactional and storage details.

## Validation

After building, `pnpm test:admin` checks the empty installation and real desktop/mobile Settings journey, including workspace-time submission, reminder preservation and readback after restart. `pnpm test:base-auth` checks Base sign-in, invitation, removal and session persistence. `pnpm test:worker` covers bootstrap, settings validation and last-operator protection through native routes. All three belong to the verification wall; see [VERIFICATION.md](VERIFICATION.md). A hosted deployment additionally needs actual received-email journeys and exact deployment/resource identities; local outbox tests cannot establish real delivery.
