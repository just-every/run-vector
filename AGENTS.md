# Working on Vector

Vector is a deployable, self-hosted issue tracker. Read README.md, HANDOVER.md, CONTRACT.md, BASELINE.md, seed.json and the actual package scripts before changing behavior. CLAUDE.md refers to this guide; AGENTS.consumer.md provides complementary owner-fork guidance.

## Architecture and ownership

One Cloudflare Worker combines TanStack Start React documents and generated server functions with explicit Hono health, authentication and API routes. D1 stores records and R2 stores private files. Start serves `/`, `/signin` and session-protected `/app`; every private API and generated function independently validates its session. Preserve Origin checks, data ownership and server-only secrets.

All product and vendored source is editable. Keep files cohesive and small, remove dead code, and preserve owner customizations. No production mocks, silent failures or semantic fallbacks. Test fixtures belong in tests. Runtime sample data is explicitly selected local demonstration content, never a replacement for installation data.

## Changes and verification

Preserve applied migrations and their order. Use forward migrations with a tested recovery procedure for schema changes. Keep stable requirement IDs and observable assertions; deliberate requirement changes must document their replacement and security consequences. Never weaken a test to hide a regression.

Use Node 26.8.1 and pnpm 8.15.6. Install with `pnpm install --frozen-lockfile`. Local development is `pnpm dev`; the full gate is `pnpm verify`. With development running, `pnpm test:dev` checks hydration and navigation. Focused runtime commands in package.json exercise foundation, removal and authentication journeys. These launch local Workers and headless browsers; close processes you start.

Stage intentional changes, run `pnpm sources:lock`, and verify with `pnpm sources:check`. The lock covers tracked effective source. Fresh diagnostic output belongs in the ignored `.artifacts/verification` directory. Retained upstream baselines select runtime source; the checked-in local source and lock remain authoritative for this edition.

## Deployment and recovery

Follow DEPLOY.md for isolated credential-free artifact preparation (`pnpm deploy:prepare`) and the separate trusted controller (`pnpm run setup`, `pnpm run deploy`, `pnpm deploy:health`). Never put controller credentials in the build environment. Keep resource identities, migration hashes, prior receipts and installation data. Ordinary CI does not deploy.

No application export/restore command exists yet. Preserve D1/R2 backups and prior source before upgrades; verify recovery before switching traffic. Keep local test results, hosted provider delivery and complete product acceptance distinct. Record remaining gaps in HANDOVER.md and release changes in RELEASE.json and CHANGELOG.md.
