import { z } from 'zod';
import type { Hono } from 'hono';
import type { AppEnvironment } from '../../../app/bindings';
import { requireOperator } from '../../auth/service';
import { IssueAccessError, requireIssueAccess } from '../../issues/access';
import { namedVideoSource } from '../../links/repository';
import { issueIdentifier, linkId } from '../../links/schema';
import { integrationOwner } from '../authority';
import { memberGrant } from './connection';
import { figmaLink } from './urls';
import { figmaRequest, decodeFigma, boundedFetch } from './client';

const title = z.string().trim().min(1).max(500).refine(value => !/[\u0000-\u001f\u007f]/.test(value));
const metadata = z.object({ name: title, lastModified: z.string().datetime({ offset: true }), nodes: z.record(z.string(), z.object({ document: z.object({ id: z.string(), name: title, type: z.string() }) }).nullable()) });
/** Figma image URLs are used server-side and never carry a member bearer. */
function imageUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['s3-alpha.figma.com', 's3-alpha-sig.figma.com'].includes(url.hostname) || url.port || url.username || url.password || url.hash || !/^\/img\/[A-Za-z0-9/_-]+$/.test(url.pathname)) throw Error('Foreign Figma image');
  return url.href;
}
export function addFigmaPreviewRoutes(app: Hono<AppEnvironment>) {
  for (const image of [false, true]) app.get('/issues/:identifier/links/:linkId/' + (image ? 'figma-image' : 'figma-preview'), async c => {
    if (!z.object({ identifier: issueIdentifier, linkId }).strict().safeParse(c.req.param()).success || Object.keys(c.req.query()).length) return c.json({ error: 'invalid_request' }, 400);
    if (c.req.header('X-Vector-Load-Player') !== 'true' || (c.req.header('Origin') && c.req.header('Origin') !== c.env.APP_ORIGIN)) return c.json({ error: 'explicit_load_required' }, 403);
    const current = async () => {
      const actor = await requireOperator(c.env, c.req.raw);
      if (!actor || actor.id !== c.get('operatorId')) return null;
      try {
        const issue = await requireIssueAccess(c.env.DB, c.req.param('identifier')!, actor.id);
        const link = await namedVideoSource(c.env.DB, issue.id, c.req.param('linkId')!);
        if (!link) return null;
        const owner = await integrationOwner(c.env, c.req.raw);
        return { link, grant: await memberGrant(c.env, owner) };
      } catch (error) { if (error instanceof IssueAccessError) return null; throw error; }
    };
    const source = await current();
    if (!source) return c.json({ error: 'not_found' }, 404);
    const file = figmaLink(source.link.url);
    if (!file) return c.json({ error: 'unsupported_figma_link' }, 422);
    if (!source.grant) return image ? c.json({ error: 'figma_connection_required' }, 409) : c.json({ preview: null, connected: false });
    const retained = async () => {
      const next = await current();
      return next && next.link.url === source.link.url && next.grant?.encrypted === source.grant?.encrypted;
    };
    try {
      const suffix = file.key + '?ids=' + encodeURIComponent(file.node), token = source.grant.token;
      if (!image) {
        const meta = metadata.parse(decodeFigma(await figmaRequest('/v1/files/' + file.key + '/nodes?ids=' + encodeURIComponent(file.node) + '&depth=1', token)));
        const frame = meta.nodes[file.node]?.document;
        if (!frame || frame.id !== file.node || !['FRAME','COMPONENT','COMPONENT_SET','INSTANCE','CANVAS'].includes(frame.type)) throw Error('Figma frame not found');
        if (!await retained()) return c.json({ error: 'not_found' }, 404);
        return c.json({ connected: true, preview: { provider: 'Figma', title: frame.name, fileName: meta.name, lastModified: meta.lastModified, imageUrl: '/api/issues/' + c.req.param('identifier') + '/links/' + c.req.param('linkId') + '/figma-image' } });
      }
      const response = z.object({ err: z.null().optional(), images: z.record(z.string(), z.string().nullable()) }).parse(decodeFigma(await figmaRequest('/v1/images/' + suffix + '&format=png&scale=1', token)));
      const remote = response.images[file.node];
      if (!remote || !await retained()) return c.json({ error: 'not_found' }, 404);
      const bytes = await boundedFetch(imageUrl(remote), 4 * 1024 * 1024, 'image/png', { headers: { Accept: 'image/png' } });
      if ([137,80,78,71,13,10,26,10].some((byte, index) => bytes[index] !== byte)) throw Error('Invalid Figma image');
      if (!await retained()) return c.json({ error: 'not_found' }, 404);
      c.header('Content-Type', 'image/png'); c.header('X-Content-Type-Options', 'nosniff'); c.header('Content-Security-Policy', "default-src 'none'");
      return c.body(bytes);
    } catch {
      if (!await retained()) return c.json({ error: 'not_found' }, 404);
      return c.json({ error: 'figma_provider_unavailable', message: 'Figma could not load this preview. Reconnect your account or open the original link.' }, 502);
    }
  });
}
