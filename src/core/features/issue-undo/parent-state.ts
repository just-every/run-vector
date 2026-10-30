import { issueSnapshotSchema, type UndoAction } from "./schema";
import { identityFields, issueSnapshotSql } from "./snapshot";

export const parentFields = [...identityFields, "cycleId", "completedAt", "canceledAt", "deferredUntil", "deferralOrigin"] as const;
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
export const parentIdsSql = (ids: string[]) => literal(JSON.stringify(ids));
export function parentSnapshotSql(ids: string) {
  return `(WITH undo_members AS (SELECT value id FROM json_each(${ids})) SELECT ${issueSnapshotSql(parentFields)})`;
}
/** The fence includes sibling order and progress inputs, even siblings outside
 * the reader's scope. It stays serialized inside private Undo metadata. */
export function parentGraphSql(ids: string) {
  return `(SELECT json_group_array(json(edge)) FROM (
    SELECT json_object('issueId',r.issue_id,'parentId',r.parent_issue_id,'createdAt',r.created_at,
      'position',r.position,'version',c.version,'statusId',c.status_id) edge
    FROM main.issue_parents r JOIN main.issues c ON c.id=r.issue_id
    WHERE r.parent_issue_id IN(SELECT value FROM json_each(${ids}))
      OR r.issue_id IN(SELECT value FROM json_each(${ids})) ORDER BY r.issue_id))`;
}
export function parentRulesSql(ids: string) {
  return `(SELECT json_group_array(json(rule)) FROM (
    SELECT json_object('teamId',t.id,'archivedAt',t.archived_at,'autoCycle',t.auto_cycle_completed,
      'enabled',r.enabled,'version',r.version,
      'statuses',json((SELECT json_group_array(json_object('id',s.id,'category',s.category,'position',s.position))
        FROM (SELECT * FROM main.workflow_statuses WHERE team_id=t.id ORDER BY id) s)),
      'cycles',json((SELECT json_group_array(json_object('id',c.id,'startsAt',c.starts_at,'endsAt',c.ends_at,'closedAt',c.closed_at))
        FROM (SELECT * FROM main.cycles WHERE team_id=t.id ORDER BY id) c))) rule
    FROM main.teams t LEFT JOIN main.subissue_team_rules r ON r.team_id=t.id
    WHERE t.id IN(SELECT team_id FROM main.issues WHERE id IN(SELECT value FROM json_each(${ids}))) ORDER BY t.id))`;
}
export async function prepareParentState(db: D1Database, childId: string, targetId: string | null) {
  // Keep direct parents before their ancestors for attributed state restoration.
  const rows = (await db.prepare(`WITH RECURSIVE ancestors(id,depth) AS (
    SELECT parent_issue_id,0 FROM main.issue_parents WHERE issue_id=?1
    UNION SELECT ?2,0 WHERE ?2 IS NOT NULL
    UNION ALL SELECT r.parent_issue_id,a.depth+1 FROM main.issue_parents r JOIN ancestors a ON r.issue_id=a.id
  ) SELECT id,min(depth) depth FROM ancestors GROUP BY id ORDER BY depth,id`).bind(childId, targetId).all<{ id: string }>()).results;
  const ids = rows.map(row => row.id), sqlIds = parentIdsSql(ids);
  const state = await db.prepare(`SELECT ${parentSnapshotSql(sqlIds)} snapshot,
    ${parentGraphSql(sqlIds)} graph,${parentRulesSql(sqlIds)} rules`).first<{ snapshot: string; graph: string; rules: string }>();
  const before = issueSnapshotSchema.array().parse(JSON.parse(state!.snapshot));
  return { ids, before, graph: state!.graph, rules: state!.rules };
}
export function parentStateMatches(action: UndoAction, side: "before" | "after", command = "command.body") {
  if (!action.parents) return "0";
  const ids = `json_extract(${command},'$.parents.ids')`;
  return `(${parentSnapshotSql(ids)}=json_extract(${command},'$.parents.${side}')
    AND ${parentGraphSql(ids)}=json_extract(${command},'$.parents.graph')
    AND ${parentRulesSql(ids)}=json_extract(${command},'$.parents.rules'))`;
}
