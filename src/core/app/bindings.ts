import type { BootstrapEnvironment } from '../features/bootstrap/config'

export type WorkerBindings = Pick<VectorBindings, 'DB' | 'FILES' | 'APP_ORIGIN'> & BootstrapEnvironment & {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
  SESSION_SECRET?: string
  MAIL_PROVIDER?: string
  MAIL_API_KEY?: string
  MAIL_FROM?: string
  RER_DEPLOY_SOURCE?: string
  RER_DEPLOY_FINGERPRINT?: string
  RER_VERSION?: { id: string }
  MAIL_MODE?: string
  SEED_SAMPLE_DATA?: string
}

export type AppEnvironment = {
  Bindings: WorkerBindings
  Variables: {
    operatorId: string
  }
}
