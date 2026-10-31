import { demoSockets } from './vendor/base/demo/vite.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { archiveOutputGuard } from '@runeditrun/rer/archive-output'
import { docsSite } from './src/core/app/site/docs/build/plugin.ts'
import { appChunks } from './scripts/app-chunks.ts'

// Resolving this config must not throw: rer resolves it to check that an export path is not served,
// also before setup. Only starting the dev server requires the origin setup wrote.
const localOrigin = () => existsSync('.dev.vars') ? parseEnv(readFileSync('.dev.vars', 'utf8')).APP_ORIGIN : undefined
const requireLocalOrigin = { name: 'vector:local-origin', apply: 'serve' as const, configureServer() {
  if (process.env.RER_DEV_ORIGIN || localOrigin()) return
  throw new Error(existsSync('.dev.vars') ? 'APP_ORIGIN is missing; run pnpm run setup -- --owner-email EMAIL.' : 'Run pnpm run setup -- --owner-email EMAIL before starting development.')
} }

// Only `vite dev` loads the local-only entry and the checkout's dev key; a build keeps the deployed
// main and never sees either (rer build checks its output for the dev layer).
const local = (name: string, as = name, fallback?: string) => {
  const value = process.env[name] ?? fallback
  return value ? { [as]: value } : {}
}

// Setting `deny` replaces Vite's own list, so it repeats those entries: the dev key and installer state stay unreadable.
const deny = ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.rer/**', '**/.seed/**', '**/.wrangler/**', '**/.dev.vars*', '**/exports/**', '**/*.rer']
// Native app modules import these Base libraries, the archive engine, sample data and seed limits.
const allow = ['src', 'public', 'node_modules', 'vendor/base/agent-door', 'vendor/base/business-settings', 'vendor/foundation/runtime', 'vendor/base/demo', 'vendor/base/editor', 'vendor/base/mail', 'vendor/base/operator-auth', 'vendor/base/dependencies', 'vendor/base/owner-claim', 'vendor/base/import-kit', 'vendor/base/d1-transport', 'vendor/base/integrations', 'vendor/base/egress-service', 'node_modules/@runeditrun/rer/modules/portability', 'sample-data', 'seed.json', 'deploy-site.json', 'schema/api-v1.json']

export default defineConfig(({ command }) => ({
  server: { fs: { strict: true, allow, deny } },
  ...(command === 'serve' ? { define: { __VECTOR_DEV_ORIGIN__: JSON.stringify(process.env.RER_DEV_ORIGIN ?? '') } } : {}),
  plugins: [
    demoSockets(),
    requireLocalOrigin,
    cloudflare({
      configPath: 'wrangler.jsonc',
      inspectorPort: false,
      viteEnvironment: { name: 'ssr' },
      persistState: { path: process.env.RER_STATE_DIR ?? '.wrangler/state' },
      config: (config) =>
        command === 'serve'
          ? {
              main: './src/core/app/worker.dev.ts',
              vars: {
                ...config.vars,
                ...local('RER_DEMO'),
                ...local('RER_DEMO_EXPIRES'),
                ...(process.env.RER_DEMO === '1' ? { SEED_SAMPLE_DATA: 'false' } : {}),
                ...local('RER_DEV_KEY'),
                ...local('RER_DEV_IDENTITY'),
              },
            }
          : undefined,
    }),
    docsSite(),
    tanstackStart({
      prerender: {
        enabled: false,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
      },
    }),
    appChunks(),
    react(),
    tailwindcss(),
    // Refuses a build whose output (copied public files included) holds an installation archive.
    archiveOutputGuard(),
  ],
}))
