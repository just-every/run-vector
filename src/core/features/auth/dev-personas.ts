import type { DevPersona } from '../../../../vendor/base/operator-auth/dev/index.mjs'
// Local dev personas: real operators at <as>@dev.localhost, created only by local dev sign-in and suspended
// in exports. Base's owner role is an implementation detail; the persona gets a product record on first
// admission with no invitation behind it, so it is a Member of the same workspace (ROLE-001).
export function devPersonas(): DevPersona[] {
  return [{ as: 'teammate', role: 'owner', displayName: 'Dev teammate' }]
}
