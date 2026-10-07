import { assert, validatePlan, resourceName } from '../../vendor/base/deploy-kit/validation.mjs';
import { validatePublicConfiguration } from './input-validation.mjs';
const fields = ['FIRST_OWNER_EMAIL', 'FIRST_OWNER_NAME', 'WORKSPACE_NAME', 'WORKSPACE_TIMEZONE', 'DEFAULT_TEAM_NAME', 'DEFAULT_TEAM_PREFIX', 'MAIL_FROM'];
/** Reviewed controller-owned JSON. Never load candidate JavaScript or Wrangler configuration. */
export function vectorPlan(artifact, configuration, origin) {
  assert(configuration?.version === 1 && configuration.workersDev === true, 'plan-requires-reviewed-workers-dev');
  assert(Object.keys(configuration).every(key => ['version', 'workersDev', 'worker', ...fields].includes(key)), 'unexpected-plan-input');
  const worker = configuration.worker;
  assert(resourceName(worker) && resourceName(`${worker}-files`), 'invalid-reviewed-worker-name');
  for (const key of fields) assert(typeof configuration[key] === 'string' && configuration[key].trim() && configuration[key].length <= 512, `missing-plan-${key}`);
  validatePublicConfiguration(configuration);
  assert(new URL(origin).protocol === 'https:' && new URL(origin).hostname.startsWith(worker + '.') && new URL(origin).hostname.endsWith('.workers.dev') && new URL(origin).origin === origin, 'invalid-controller-origin');
  assert(artifact.migrations.every(item => item.binding === 'DB'), 'unexpected-migration-binding');
  return validatePlan({ version: 1, worker, compatibilityDate: '2026-09-08', compatibilityFlags: ['nodejs_compat'],
    d1: [{ binding: 'DB', name: `${worker}-db`, migrations: artifact.migrations.map(({ binding, ...rest }) => rest) }],
    r2: [{ binding: 'FILES', name: `${worker}-files` }], queues: [], durableObjects: [], crons: ['* * * * *'],
    secrets: [{ binding: 'SESSION_SECRET', environment: 'SESSION_SECRET' }, { binding: 'MAIL_API_KEY', environment: 'MAIL_API_KEY' }],
    vars: { ...Object.fromEntries(fields.map(key => [key, configuration[key]])), APP_ORIGIN: origin, SEED_SAMPLE_DATA: 'false', MAIL_PROVIDER: 'sendgrid', MAIL_MODE: 'sendgrid' } });
}
