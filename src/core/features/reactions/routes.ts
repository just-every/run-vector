import type { Hono } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { requireIssueProjection } from '../issues/projection-access';
import { discussionAccess } from '../discussion/access';
import { mutationDatabase } from '../auth/mutation-database';
import { reactionInput } from './schema';

/** Reactions are personal, idempotent sets. They deliberately create no notification. */
export function addReactionRoutes(app: Hono<AppEnvironment>) {
  app.get('/issues/:identifier/reactions', discussionAccess(async c => {
    c.set('concealWorkspaceChange', true);
    const issue = await requireIssueProjection(c, c.req.param().identifier);
    const rows = (await c.env.DB.prepare(`SELECT r.target_id AS targetId,r.emoji,r.actor_operator_id AS actorId,o.name AS actor,
      r.actor_operator_id=? AS own FROM issue_reactions r JOIN operators o ON o.id=r.actor_operator_id
      WHERE r.issue_id=? AND (r.target_id='' OR EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=r.target_id AND c.issue_id=r.issue_id AND c.deleted_at IS NULL))
      ORDER BY r.created_at,r.actor_operator_id`).bind(c.get('operatorId'),issue.id).all()).results;
    await requireIssueProjection(c, issue.identifier);
    return c.json({ reactions: rows.map(r => ({ ...r, own: Boolean(r.own) })) });
  }));
  for (const method of ['PUT', 'DELETE'] as const) app.on(method, '/issues/:identifier/reactions', discussionAccess(async c => {
    const parsed = reactionInput.safeParse(await readRequestJson(c.req.raw));
    if (!parsed.success) return c.json({error:'invalid_request'},400);
    const actor = c.get('operatorId'), db = mutationDatabase(c.env.DB, actor);
    const issue = await requireIssueProjection(c, c.req.param().identifier);
    const {targetId,emoji} = parsed.data;
    const valid = `EXISTS(SELECT 1 FROM issues i WHERE i.id=?) AND (?='' OR EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=? AND c.issue_id=? AND c.deleted_at IS NULL))`;
    const values = [issue.id,targetId,targetId,issue.id];
    if (!await db.prepare('SELECT 1 WHERE '+valid).bind(...values).first()) return c.json({error:'not_found'},404);
    await db.batch([
      db.prepare(`SELECT CASE WHEN ${valid} THEN 1 ELSE json('reaction target unavailable') END`).bind(...values),
      method==='PUT'
        ? db.prepare(`INSERT OR IGNORE INTO issue_reactions(issue_id,target_id,emoji,actor_operator_id,created_at) VALUES(?,?,?,?,?)`).bind(issue.id,targetId,emoji,actor,new Date().toISOString())
        : db.prepare('DELETE FROM issue_reactions WHERE issue_id=? AND target_id=? AND emoji=? AND actor_operator_id=?').bind(issue.id,targetId,emoji,actor),
    ]);
    return c.json({updated:true});
  }));
}
