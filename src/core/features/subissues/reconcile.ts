/** Call only for live commands, in their mutation batch. Historical relation
 * imports deliberately do not dispatch automation events. */
export function reconcileParentChanges(db: D1Database, activityId: string) {
  return db
    .prepare(
      `INSERT INTO subissue_progress_events(id,parent_issue_id,created_at)
    SELECT lower(hex(randomblob(13))),p.id,a.created_at FROM issue_activity a JOIN issues p ON p.identifier=json_extract(a.previous_value_json,'$.parentIdentifier') OR p.identifier=json_extract(a.next_value_json,'$.parentIdentifier') WHERE a.id=?`,
    )
    .bind(activityId);
}
export function reconcileParent(db: D1Database, parentId: string, at: string) {
  return db
    .prepare(
      `INSERT INTO subissue_progress_events(id,parent_issue_id,created_at) VALUES(lower(hex(randomblob(13))),?,?)`,
    )
    .bind(parentId, at);
}
export function versionAdmission(
  db: D1Database,
  issueId: string,
  version: number,
) {
  return db
    .prepare(
      `SELECT CASE WHEN EXISTS(SELECT 1 FROM issues WHERE id=? AND version=?) THEN 1 ELSE json('subissue stale version') END`,
    )
    .bind(issueId, version);
}
