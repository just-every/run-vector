import { assert } from '@runeditrun/rer/internal/modules/deploy-kit/validation.mjs';

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

const name = key => value => assert(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 200, `invalid-plan-${key}`);
export const publicValidators = {
  FIRST_OWNER_NAME: name('FIRST_OWNER_NAME'),
  WORKSPACE_NAME: name('WORKSPACE_NAME'),
  DEFAULT_TEAM_NAME: name('DEFAULT_TEAM_NAME'),
  FIRST_OWNER_EMAIL(value) {
    assert(typeof value === 'string' && value.length <= 254 && bootstrapEmail.test(value), 'invalid-owner-email');
    mailAddress(value, 'invalid-owner-email');
  },
  MAIL_FROM(value) { assert(typeof value === 'string', 'invalid-mail-from'); mailAddress(value, 'invalid-mail-from', true); },
  DEFAULT_TEAM_PREFIX(value) { assert(typeof value === 'string' && /^[A-Z]{2,10}$/.test(value), 'invalid-team-prefix'); },
  WORKSPACE_TIMEZONE(value) {
    assert(typeof value === 'string' && value.trim() && value.trim().length <= 100 && !/^[+-]/.test(value.trim()), 'invalid-workspace-timezone');
    try { new Intl.DateTimeFormat('en', { timeZone: value.trim() }); } catch { throw new Error('invalid-workspace-timezone'); }
  },
};
export const secretValidators = {
  SESSION_SECRET(value) { assert(typeof value === 'string' && value.trim() && value.length >= 32 && value.length <= 1024, 'invalid-secret-SESSION_SECRET'); },
  MAIL_API_KEY(value) { assert(typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/[\s\x00-\x1f\x7f]/.test(value), 'invalid-secret-MAIL_API_KEY'); },
};
export function validatePublicConfiguration(configuration) {
  for (const [key, validate] of Object.entries(publicValidators)) validate(configuration[key]);
}
// Omitted secrets may be inherited; the deploy kit requires missing bindings
// before resource writes. Never expose values or write them into plan/receipt.
export function validateSuppliedSecrets(env) {
  for (const [key, validate] of Object.entries(secretValidators)) if (env[key] !== undefined) validate(env[key]);
}
// The operations inspector applies exactly the same per-field validators while
// collecting every invalid name instead of stopping at the first failure.
export function invalidConfigurationNames(env, validators) {
  return Object.entries(validators).filter(([key, validate]) => {
    if (typeof env[key] !== 'string' || !env[key].trim()) return false;
    try { validate(env[key]); return false; } catch { return true; }
  }).map(([key]) => key);
}
