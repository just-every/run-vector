const exactPublicPaths = new Set(['/', '/setup/state', '/signin', '/health', '/favicon.svg', '/rer-theme.css', '/docs', '/auth/request', '/auth/magic-link', '/auth/confirm', '/auth/session', '/auth/signout', '/auth/owner-claim', '/auth/setup-complete', '/.well-known/rer-dependencies', '/auth/oidc/auth/callback', '/auth/oidc/auth/logout'])
const publicPrefixes = ['/assets/', '/fonts/', '/brand/', '/docs/', '/.well-known/rer-link/', '/auth/dependencies/', '/auth/oidc/']

export function isPublicPath(pathname: string): boolean {
  return exactPublicPaths.has(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix))
}
