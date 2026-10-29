import type { z } from 'zod';
import { mutationDatabase } from '../auth/mutation-database';
import type { reactionInput } from './schema';

export async function readIssueReactions(db: D1Database, issueId: string, actor: string) {
  const rows = (await db.prepare(`SELECT r.target_id AS targetId,r.emoji,r.actor_operator_id AS actorId,o.name AS actor,
    r.actor_operator_id=? AS own FROM issue_reactions r JOIN operators o ON o.id=r.actor_operator_id
    WHERE r.issue_id=? AND (r.target_id='' OR EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=r.target_id AND c.issue_id=r.issue_id AND c.deleted_at IS NULL))
    ORDER BY r.created_at,r.actor_operator_id`).bind(actor, issueId).all()).results;
  return { reactions: rows.map(row => ({ ...row, own: Boolean(row.own) })) };
}

/** The native route and agent door use the same idempotent personal set. */
export async function changeIssueReaction(source: D1Database, issueId: string, actor: string,
  input: z.output<typeof reactionInput>, method: 'PUT' | 'DELETE') {
  const db = mutationDatabase(source, actor), { targetId, emoji } = input;
  const valid = `EXISTS(SELECT 1 FROM issues i WHERE i.id=?) AND (?='' OR EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=? AND c.issue_id=? AND c.deleted_at IS NULL))`;
  const values = [issueId, targetId, targetId, issueId];
  if (!await db.prepare('SELECT 1 WHERE ' + valid).bind(...values).first()) return false;
  await db.batch([
    db.prepare(`SELECT CASE WHEN ${valid} THEN 1 ELSE json('reaction target unavailable') END`).bind(...values),
    method === 'PUT'
      ? db.prepare(`INSERT OR IGNORE INTO issue_reactions(issue_id,target_id,emoji,actor_operator_id,created_at) VALUES(?,?,?,?,?)`).bind(issueId, targetId, emoji, actor, new Date().toISOString())
      : db.prepare('DELETE FROM issue_reactions WHERE issue_id=? AND target_id=? AND emoji=? AND actor_operator_id=?').bind(issueId, targetId, emoji, actor),
  ]);
  return true;
}
