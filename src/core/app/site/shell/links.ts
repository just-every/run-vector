/** Where the public pages point. The docs are the site's own, built from the repository's Markdown (docs/site.json). */
const source = 'https://github.com/just-every/run-vector'

export const links = {
  home: '/',
  docs: '/docs',
  source,
  installer: '/docs/install',
  licence: `${source}/blob/main/LICENSE`,
  signIn: '/signin',
} as const
