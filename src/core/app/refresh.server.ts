import type { Hono, Context } from 'hono';
import type { AppEnvironment } from './bindings';
import { isSecondaryRead } from './secondary-refresh';

/** Reuse the normal resource doors and their visibility/role admission. The
 * enclosing HTTP read retains the native-session fence through every body. */
export async function refreshResponse(context: Context<AppEnvironment>, reader: Hono<AppEnvironment>) {
  const paths = [...new Set(context.req.queries('read') ?? [])];
  if (!paths.length || paths.length > 24 || paths.some(path =>
    !path.startsWith('/api/') || path.includes('#') || path.length > 1000 || !isSecondaryRead(path)))
    return context.json({ error: 'invalid_request' }, 400);
  const resources = await Promise.all(paths.map(async path => {
    const response = await reader.fetch(new Request(new URL(path, context.env.APP_ORIGIN), {
      headers: context.req.raw.headers,
    }), context.env);
    return { path, status: response.status, body: await response.json() };
  }));
  return context.json({ resources });
}
