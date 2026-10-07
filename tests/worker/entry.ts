// Hono/D1/R2 domain tests. Start transport is verified against the emitted Worker.
import { createServerApp } from '../../src/core/app/server'
const app = createServerApp()
export default { fetch: app.fetch }
