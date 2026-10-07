const exactPublicPaths = new Set(['/', '/signin', '/health', '/favicon.svg', '/auth/request', '/auth/consume', '/auth/signout'])
const publicPrefixes = ['/assets/']

export function isPublicPath(pathname: string): boolean {
  return exactPublicPaths.has(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix))
}
