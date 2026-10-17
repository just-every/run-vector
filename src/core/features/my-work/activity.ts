import { browseActor } from "../issues/browse-access";
import { publicActivityValue } from "../issue-undo/public-activity";

type Row = { id: string; kind: string; at: string; identifier: string; title: string; previous: string | null; next: string | null; comment: string | null };
const parse = (value: string | null) => (value === null ? null : JSON.parse(value));

/** WORK-004 Activity: the member's own most recent changes and comments,
 * newest first, on issues of the workspace they are admitted to (OPS-001). */
export async function myActivity(db: D1Database, actor: string, limit = 50) {
  const access = await browseActor(db, actor);
  const rows = await db
    .prepare(
      `SELECT a.id,a.kind,a.created_at AS at,i.identifier,i.title,a.previous_value_json AS previous,a.next_value_json AS next,
 CASE WHEN a.kind LIKE 'comment.%' THEN (SELECT c.body FROM issue_comments c WHERE c.id=json_extract(a.next_value_json,'$.id') AND c.issue_id=a.issue_id AND c.deleted_at IS NULL) END AS comment
 FROM issue_activity a JOIN issues i ON i.id=a.issue_id JOIN teams t ON t.id=i.team_id
 WHERE a.actor_operator_id=? AND t.workspace_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT ?`,
    )
    .bind(actor, access.workspace_id, limit)
    .all<Row>();
  // Recheck admission after the read so a removed member receives nothing.
  await browseActor(db, actor, access.workspace_id);
  return {
    entries: rows.results.map((row) => ({
      id: row.id,
      kind: row.kind,
      at: row.at,
      issue: { identifier: row.identifier, title: row.title },
      previousValue: publicActivityValue(parse(row.previous)),
      nextValue: publicActivityValue(parse(row.next)),
      comment: row.comment,
    })),
  };
}
