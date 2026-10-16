// Base's shared policy leaf has no declaration at the pinned revision.
// Reuse its public signature without importing the server entry at runtime.
declare module '*vendor/base/operator-auth/policy.mjs' {
  export const normalizeEmail: typeof import('../../vendor/base/operator-auth/index.mjs').normalizeEmail;
}
