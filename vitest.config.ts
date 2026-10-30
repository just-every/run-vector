import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

const migrations = await readD1Migrations('./migrations/core')
// Tracked restore ledgers describe the bytes that were actually applied.
const migrationDigests = Object.fromEntries(await Promise.all(migrations.map(async ({ name }) =>
  [name, createHash('sha256').update(await readFile(new URL('./migrations/core/' + name, import.meta.url))).digest('hex')],
)))

export default defineConfig({
  plugins: [cloudflareTest({ main: './tests/worker/entry.ts', miniflare: { durableObjects:{ARCHIVE_TARGET_COORDINATOR:{className:'ArchiveTargetCoordinator',useSQLite:true}},d1Databases:{ARCHIVE_TARGET_DB:'vector-archive-target'},r2Buckets:{ARCHIVE_TARGET_FILES:'vector-archive-target-files'}, bindings: {APP_ORIGIN:'http://127.0.0.1:15920',SEED_SAMPLE_DATA:'false',FIRST_OWNER_NAME:'Sarah',WORKSPACE_NAME:'Vector',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Flow',DEFAULT_TEAM_PREFIX:'FLW',SESSION_SECRET:'synthetic-local-test-auth-secret-with-at-least-32-characters',MAIL_MODE:'production',MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'test-only-no-provider-request',MAIL_FROM:'Vector <signin@vector.test>',FIRST_OWNER_EMAIL:'sarah@vector.test'} }, wrangler: { configPath: './wrangler.jsonc' } })],
  test: {
    maxWorkers: 1,
    // Each test migrates and seeds a real local D1; on a busy host that alone
    // can pass the 5 s default. The time limit is not a product assertion.
    testTimeout: 30_000,
    include: ['tests/worker/**/*.test.ts','tests/installer/**/*.test.ts'],
    provide: { migrations, migrationDigests },
  },
})
