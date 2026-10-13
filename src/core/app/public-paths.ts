const exactPublicPaths = new Set(['/', '/signin', '/health', '/favicon.svg', '/rer-theme.css', '/docs', '/auth/request', '/auth/magic-link', '/auth/confirm', '/auth/session', '/auth/signout', '/auth/owner-claim'])
const publicPrefixes = ['/assets/', '/fonts/', '/brand/', '/docs/']

export function isPublicPath(pathname: string): boolean {
  return exactPublicPaths.has(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix))
}
