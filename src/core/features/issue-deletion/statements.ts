import type { D1Sql } from "../../../../vendor/base/import-kit/src/d1/index";
import { detachFileSql } from "../file-removal/detached";
export function deletionStatements(
  issue: { id: string; identifier: string },
  actor: string,
  workspace: string,
  version: number,
  operation: { at: string; operationId: string },
): D1Sql[] {
  const { at, operationId: id } = operation;
  return [
    {
      sql: `SELECT CASE WHEN EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=? AND i.version=? AND t.workspace_id=? AND o.id=? AND o.removed_at IS NULL) AND NOT EXISTS(SELECT 1 FROM issue_duplicates WHERE canonical_issue_id=?) THEN 1 ELSE json('issue deletion admission denied') END`,
      params: [issue.id, version, workspace, actor, issue.id],
    },
    {
      sql: `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
   SELECT ?||':'||issue_id,issue_id,?,'issue.parent_changed',json_object('parentIdentifier',?),json_object('parentIdentifier',NULL),?,? FROM issue_parents WHERE parent_issue_id=?`,
      params: [id, actor, issue.identifier, at, at, issue.id],
    },
    {
      sql: "UPDATE issues SET version=version+1,updated_at=? WHERE id IN(SELECT issue_id FROM issue_parents WHERE parent_issue_id=?)",
      params: [at, issue.id],
    },
    ...detachFileSql(issue, actor, at),
    {
      sql: `INSERT OR IGNORE INTO vector_webhook_erasures(namespace,id,identifier,erased_at)
   SELECT workspace_id,id,?,? FROM vector_webhook_events WHERE workspace_id=? AND json_extract(body,'$.identifier')=?
   UNION SELECT namespace,id,?,? FROM integration_deliveries WHERE namespace=? AND json_extract(CASE WHEN json_valid(json_extract(envelope,'$.body')) THEN json_extract(envelope,'$.body') ELSE '{}' END,'$.identifier')=?
   UNION SELECT namespace,id,?,? FROM integration_replays WHERE namespace=? AND json_extract(CASE WHEN json_valid(json_extract(envelope,'$.body')) THEN json_extract(envelope,'$.body') ELSE '{}' END,'$.identifier')=?`,
      params: [
        issue.identifier,
        at,
        workspace,
        issue.identifier,
        issue.identifier,
        at,
        workspace,
        issue.identifier,
        issue.identifier,
        at,
        workspace,
        issue.identifier,
      ],
    },
    {
      sql: `UPDATE vector_webhook_events SET body='{}' WHERE workspace_id=? AND id IN(SELECT id FROM vector_webhook_erasures WHERE namespace=? AND identifier=?)`,
      params: [workspace, workspace, issue.identifier],
    },
    {
      sql: `UPDATE integration_deliveries SET envelope=json_set(envelope,'$.body','{}') WHERE namespace=? AND id IN(SELECT id FROM vector_webhook_erasures WHERE namespace=? AND identifier=?)`,
      params: [workspace, workspace, issue.identifier],
    },
    {
      sql: `UPDATE integration_replays SET envelope=json_set(envelope,'$.body','{}') WHERE namespace=? AND id IN(SELECT id FROM vector_webhook_erasures WHERE namespace=? AND identifier=?)`,
      params: [workspace, workspace, issue.identifier],
    },
    {
      // Native attempt outcomes are fixed protocol codes; operator-entered
      // reconciliation codes may contain private text despite their safe alphabet.
      sql: `UPDATE integration_resolutions SET outcome=json_set(outcome,'$.code','issue_deleted') WHERE namespace=? AND delivery_id IN(SELECT id FROM vector_webhook_erasures WHERE namespace=? AND identifier=?)`,
      params: [workspace, workspace, issue.identifier],
    },
    {
      sql: "INSERT INTO issue_deletions(issue_id,identifier,workspace_id,requested_at,team_id) SELECT ?,?,?,?,team_id FROM issues WHERE id=?",
      params: [issue.id, issue.identifier, workspace, at,issue.id],
    },
    {
      sql: `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at) VALUES(?,?,'issue.deleted',?,?,?,?)`,
      params: [id, actor, issue.identifier, issue.id, at, at],
    },
    { sql: "DELETE FROM issues WHERE id=?", params: [issue.id] },
  ];
}
