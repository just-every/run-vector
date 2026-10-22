// Hono/D1/R2 domain tests. Start transport is verified against the emitted Worker.
import { createServerApp } from '../../src/core/app/server'
import { receiveIntakeMail } from '../../src/core/features/email-intake/inbound'
import { scheduled } from '../../src/core/app/scheduled'
import { VectorRestoreCoordinator } from '../../src/core/features/data/restore-coordinator'
import type { WorkerBindings } from '../../src/core/app/bindings'
export { VectorRestoreCoordinator }
/** A real second namespace with isolated destination D1/R2, matching the
 * ordinary target server bindings used by the HTTP archive journey. */
export class ArchiveTargetCoordinator extends VectorRestoreCoordinator {
  constructor(ctx: DurableObjectState, env: WorkerBindings & {ARCHIVE_TARGET_DB:D1Database;ARCHIVE_TARGET_FILES:R2Bucket}) {
    super(ctx,{...env,DB:env.ARCHIVE_TARGET_DB,FILES:env.ARCHIVE_TARGET_FILES,MAIL_MODE:'local-outbox',
      FIRST_OWNER_EMAIL:'owner@base.test',FIRST_OWNER_NAME:'Owner',WORKSPACE_NAME:'Base integration',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Delivery',DEFAULT_TEAM_PREFIX:'BASE'});
  }
}
const app = createServerApp()
export default { fetch: app.fetch, scheduled, email: receiveIntakeMail }
