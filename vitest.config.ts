import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

const migrations = await readD1Migrations('./migrations/core')

export default defineConfig({
  plugins: [cloudflareTest({ main: './tests/worker/entry.ts', wrangler: { configPath: './wrangler.jsonc' } })],
  test: {
    maxWorkers: 1,
    include: ['tests/worker/**/*.test.ts'],
    provide: { migrations },
  },
})
