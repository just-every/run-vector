import type { DevPersona } from '../../../../vendor/base/operator-auth/dev/index.mjs'
// Local dev personas: real operators at <as>@dev.localhost, created only by local dev sign-in and suspended
// in exports. Vector has no product roles: every admitted operator holds Base's owner authority, so the
// persona is a second operator in the same workspace, who gets a product record on first admission.
export function devPersonas(): DevPersona[] {
  return [{ as: 'teammate', role: 'owner', displayName: 'Dev teammate' }]
}
