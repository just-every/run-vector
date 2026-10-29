import type { Hono } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { requireIssueProjection } from '../issues/projection-access';
import { discussionAccess } from '../discussion/access';
import { reactionInput } from './schema';
import { readIssueReactions, changeIssueReaction } from './service';

/** Reactions are personal, idempotent sets. They deliberately create no notification. */
export function addReactionRoutes(app: Hono<AppEnvironment>) {
  app.get('/issues/:identifier/reactions', discussionAccess(async c => {
    c.set('concealWorkspaceChange', true);
    const issue = await requireIssueProjection(c, c.req.param().identifier);
    const result = await readIssueReactions(c.env.DB, issue.id, c.get('operatorId'));
    await requireIssueProjection(c, issue.identifier);
    return c.json(result);
  }));
  for (const method of ['PUT', 'DELETE'] as const) app.on(method, '/issues/:identifier/reactions', discussionAccess(async c => {
    const parsed = reactionInput.safeParse(await readRequestJson(c.req.raw));
    if (!parsed.success) return c.json({error:'invalid_request'},400);
    const actor = c.get('operatorId');
    const issue = await requireIssueProjection(c, c.req.param().identifier);
    if (!await changeIssueReaction(c.env.DB, issue.id, actor, parsed.data, method)) return c.json({error:'not_found'},404);
    return c.json({updated:true});
  }));
}
