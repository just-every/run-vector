// Local-only Worker entry. vite.config.ts loads it only for `vite dev`; the deployed main stays worker.ts,
// and `rer build` refuses any output that contains the dev layer. It adds dev sign-in, personas without a dev bar.
// Dev labels rewrite HTML, so they must receive the uncompressed document.
// Production applies its compression only after its document decorators finish.
import { documentWorker } from './worker'
export { VectorRestoreCoordinator } from './worker'
import { withDevIdentity } from '../../../vendor/base/operator-auth/dev/index.mjs'
import { authConfig } from '../features/auth/base.server'
import { devPersonas } from '../features/auth/dev-personas'
import type { WorkerBindings } from './bindings'

// Vector names its origin APP_ORIGIN and marks a local runtime by MAIL_MODE; the dev layer reads the common names.
const local = (env: WorkerBindings) => ({ ...env, AUTH_ORIGIN: env.APP_ORIGIN, AUTH_LOCAL: env.MAIL_MODE === 'local-outbox' ? 'true' : 'false' })

export default withDevIdentity<WorkerBindings, typeof documentWorker>(documentWorker, { bindings: local as (env: WorkerBindings) => WorkerBindings, config: authConfig, personas: devPersonas })
