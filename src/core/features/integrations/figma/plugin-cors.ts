import type { Hono, Context } from 'hono';
import type { AppEnvironment } from '../../../app/bindings';
const path = '/integrations/figma/issues';
/** Figma's sandbox uses an opaque origin. This door accepts an explicit bearer,
 * never a cookie credential, and grants no credentialed browser CORS access. */
export function figmaPluginOrigin(origin: string, installation: string) {
  return [installation, 'https://www.figma.com', 'null'].includes(origin);
}
export function figmaPluginCors(c: Context<AppEnvironment>) {
  const origin = c.req.header('Origin');
  if (origin && figmaPluginOrigin(origin, c.env.APP_ORIGIN)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Vary', 'Origin');
  }
}
export function addFigmaPluginPreflight(app: Hono<AppEnvironment>) {
  app.options(path, c => {
    const origin = c.req.header('Origin') ?? '', headers = (c.req.header('Access-Control-Request-Headers') ?? '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
    if (!figmaPluginOrigin(origin, c.env.APP_ORIGIN) || c.req.header('Access-Control-Request-Method') !== 'POST' || headers.some(name => !['authorization','content-type'].includes(name))) return c.json({ error: 'origin_refused' }, 403);
    figmaPluginCors(c);
    c.header('Access-Control-Allow-Methods', 'POST');
    c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    c.header('Cache-Control', 'no-store');
    return c.body(null, 204);
  });
}
