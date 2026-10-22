import { developmentSender } from '../auth/development.server';
import { hostedMailSender } from '../../platform/mail';
import type { WorkerBindings } from '../../app/bindings';
export function notificationSender(env: WorkerBindings, network?: typeof fetch) {
  return env.RER_DEMO === '1' || env.MAIL_MODE === 'local-outbox'
    ? developmentSender(env) : hostedMailSender(env,network);
}
