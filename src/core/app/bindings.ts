import type { BootstrapEnvironment } from '../features/bootstrap/config'

export type WorkerBindings = Pick<VectorBindings, 'DB' | 'FILES' | 'APP_ORIGIN'> & BootstrapEnvironment & {
  RESTORE_COORDINATOR?: VectorBindings['RESTORE_COORDINATOR']
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
  INTEGRATION_EGRESS?: import("../../../vendor/base/integrations").TrustedTransport
  INTEGRATION_EGRESS_POLICY?: string
  SETUP_TOKEN?: string
  RER_MANAGEMENT_ORIGIN?: string
  RER_INSTALLATION_ID?: string
  RER_OWNER_CLAIM_ISSUER?: string
  RER_OWNER_CLAIM_INSTALLATION_ID?: string
  RER_OWNER_CLAIM_APP_ORIGIN?: string
  RER_OWNER_CLAIM_PUBLIC_KEYS?: string
  SESSION_SECRET?: string
  NOTIFICATION_EMAIL_ENABLED?: string
  MAIL_PROVIDER?: string
  MAIL_API_KEY?: string
  MAIL_FROM?: string
  RER_DEPLOY_SOURCE?: string
  RER_DEPLOY_FINGERPRINT?: string
  RER_VERSION?: { id: string }
  MAIL_MODE?: string
  /** Local runtimes only: the checkout's key gate and dev identity switch. Deploy refuses both. */
  RER_DEV_KEY?: string
  RER_DEV_IDENTITY?: string
  SEED_SAMPLE_DATA?: string
}

export type AppEnvironment = {
  Bindings: WorkerBindings
  Variables: {
    operatorId: string
    concealWorkspaceChange?: boolean
  }
}
