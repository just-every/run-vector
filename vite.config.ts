import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig(({ command }) => ({
  plugins: [
    cloudflare({
      configPath: 'wrangler.jsonc',
      inspectorPort: false,
      viteEnvironment: { name: 'ssr' },
      persistState: { path: '.wrangler/vector-dev' },
      config: (config) =>
        command === 'serve'
          ? {
              vars: {
                ...config.vars,
                APP_ORIGIN:
                  process.env.VECTOR_DEV_ORIGIN ?? 'http://127.0.0.1:15928',
              },
            }
          : undefined,
    }),
    tanstackStart({
      prerender: {
        enabled: false,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
      },
    }),
    react(),
    tailwindcss(),
  ],
}))
