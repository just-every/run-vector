import {aliasTargetSql} from '../aliases/identity';
import { IssueAccessError } from "../../issues/access";

/** The import that created an issue, by its source record ID (for example
 * ENG-123), so a person can see and find where the work came from. */
export type ImportedFrom = { source: string; sourceId: string; sourceKey?: string; runId: string; unfinished: boolean };
export type ImportedFromRow = {job_id:string;source_id:string;source_key:string|null;namespace:string;state:string};
export function importedFromStatement(db:D1Database,issueId:string) {
  return db.prepare(`SELECT p.job_id,json_extract(p.record_json,'$.sourceId') AS source_id,(SELECT json_extract(a.next_value_json,'$.sourceKey') FROM issue_activity a WHERE a.issue_id=p.target_id AND a.kind='issue.imported' LIMIT 1) AS source_key,j.namespace,j.state FROM ik_provenance p
    JOIN ik_jobs j ON j.id=p.job_id WHERE p.target_kind='issue' AND p.target_id=? AND p.reversed=0 AND j.namespace LIKE 'vector-import:%'
    ORDER BY p.rowid DESC LIMIT 1`).bind(issueId);
}
export function importedFromProjection(row:ImportedFromRow|null|undefined):ImportedFrom|null {
  return row?{source:row.namespace.replace(/^vector-import:/,''),sourceId:row.source_id,...(row.source_key?{sourceKey:row.source_key}:{}),runId:row.job_id,unfinished:['queued','applying','failed'].includes(row.state)}:null;
}
/** Resolve a native identifier or one unique imported source ID and admit its
 * current workspace membership in the same SQL snapshot. */
export async function requireIssueSourceAccess(db:D1Database,operatorId:string,identifier:string) {
  const row=await db.prepare(`SELECT actor.removed_at,i.id,i.identifier,i.version
    FROM operators actor LEFT JOIN issues i ON i.id=COALESCE(${aliasTargetSql('actor.workspace_id','?1')},
      (SELECT CASE WHEN count(DISTINCT imported.id)=1 THEN min(imported.id) END
       FROM ik_provenance p JOIN issues imported ON imported.id=p.target_id
       JOIN teams t ON t.id=imported.team_id AND t.workspace_id=actor.workspace_id
       WHERE p.destination=actor.workspace_id AND p.target_kind='issue' AND p.reversed=0
       AND NOT EXISTS(SELECT 1 FROM issue_aliases a WHERE a.issue_id=imported.id)
       AND json_extract(p.record_json,'$.sourceId')=?1 COLLATE NOCASE))
      AND EXISTS(SELECT 1 FROM teams t WHERE t.id=i.team_id AND t.workspace_id=actor.workspace_id)
    WHERE actor.id=?2`).bind(identifier,operatorId)
    .first<{removed_at:string|null;id:string|null;identifier:string;version:number}>();
  if(!row||row.removed_at!==null)throw new IssueAccessError('unauthenticated','An active native operator is required.',401);
  if(!row.id)throw new IssueAccessError('not_found','Issue is unavailable.',404);
  return {id:row.id,identifier:row.identifier,version:row.version};
}
