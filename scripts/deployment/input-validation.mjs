import { assert } from '../../vendor/base/deploy-kit/validation.mjs';

// Reviewed controller rules, deliberately independent of candidate/runtime imports.
// Keep these aligned with bootstrap/config.ts and Base mail's parseAddress and
// SendGrid serializer; the deployment tests compare against those real validators.
const bootstrapEmail = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
function mailAddress(value, code, sender = false) {
  assert(!/[\x00-\x1f\x7f]/.test(value), code);
  const match = value.trim().match(/^(?:(.*?)\s*<([^<>]+)>|([^<>]+))$/u);
  const email = (match?.[2] ?? match?.[3] ?? '').trim();
  const parts = email.split('@');
  assert(parts.length === 2 && parts[0] && parts[0].length <= 64 && email.length <= 254 &&
    /^[^\s@<>(),:;"\\]+$/u.test(parts[0]) && !parts[0].startsWith('.') && !parts[0].endsWith('.') && !parts[0].includes('..') &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(parts[1]), code);
  let name = match?.[1]?.trim();
  if (name?.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
  assert(!name || !/[<>"\\]/.test(name), code);
  if (sender) assert(!/[^\x00-\x7f]/.test(email), code);
}

export function validatePublicConfiguration(configuration) {
  for (const key of ['FIRST_OWNER_NAME', 'WORKSPACE_NAME', 'DEFAULT_TEAM_NAME'])
    assert(configuration[key].trim().length <= 200, `invalid-plan-${key}`);
  assert(configuration.FIRST_OWNER_EMAIL.length <= 254 && bootstrapEmail.test(configuration.FIRST_OWNER_EMAIL), 'invalid-owner-email');
  // The configured owner must also be a deliverable sign-in recipient.
  mailAddress(configuration.FIRST_OWNER_EMAIL, 'invalid-owner-email');
  mailAddress(configuration.MAIL_FROM, 'invalid-mail-from', true);
  assert(/^[A-Z]{2,10}$/.test(configuration.DEFAULT_TEAM_PREFIX), 'invalid-team-prefix');
  const timezone = configuration.WORKSPACE_TIMEZONE.trim();
  assert(timezone.length <= 100 && !/^[+-]/.test(timezone), 'invalid-workspace-timezone');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw new Error('invalid-workspace-timezone'); }
}

// Base operator-auth/config.mjs and mail/src/core/validation.mjs constraints.
// Omitted secrets may be inherited; the deploy kit requires missing bindings
// before resource writes. Never expose values or write them into plan/receipt.
export function validateSuppliedSecrets(env) {
  if (env.SESSION_SECRET !== undefined)
    assert(typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.trim() && env.SESSION_SECRET.length >= 32 && env.SESSION_SECRET.length <= 1024, 'invalid-secret-SESSION_SECRET');
  if (env.MAIL_API_KEY !== undefined)
    assert(typeof env.MAIL_API_KEY === 'string' && env.MAIL_API_KEY.length > 0 && env.MAIL_API_KEY.length <= 4096 && !/[\s\x00-\x1f\x7f]/.test(env.MAIL_API_KEY), 'invalid-secret-MAIL_API_KEY');
}
