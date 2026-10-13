/** The import that created an issue, by its source record ID (for example
 * ENG-123), so a person can see and find where the work came from. */
export type ImportedFrom = { source: string; sourceId: string; sourceKey?: string; runId: string; unfinished: boolean };
export async function importedFrom(db:D1Database,issueId:string):Promise<ImportedFrom|null> {
  const row=await db.prepare(`SELECT p.job_id,json_extract(p.record_json,'$.sourceId') AS source_id,(SELECT json_extract(a.next_value_json,'$.sourceKey') FROM issue_activity a WHERE a.issue_id=p.target_id AND a.kind='issue.imported' LIMIT 1) AS source_key,j.namespace,j.state FROM ik_provenance p
    JOIN ik_jobs j ON j.id=p.job_id WHERE p.target_kind='issue' AND p.target_id=? AND p.reversed=0 AND j.namespace LIKE 'vector-import:%'
    ORDER BY p.rowid DESC LIMIT 1`).bind(issueId).first<{job_id:string;source_id:string;source_key:string|null;namespace:string;state:string}>();
  return row?{source:row.namespace.replace(/^vector-import:/,''),sourceId:row.source_id,...(row.source_key?{sourceKey:row.source_key}:{}),runId:row.job_id,unfinished:['queued','applying','failed'].includes(row.state)}:null;
}
/** A source ID (for example ENG-123) that is not a Vector identifier resolves to
 * the one live imported issue carrying it in the actor's workspace. */
export async function identifierForSource(db:D1Database,operatorId:string,identifier:string):Promise<string> {
  const row=await db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.identifier=?1 AND t.workspace_id=o.workspace_id) THEN NULL ELSE
    (SELECT CASE WHEN count(*)=1 THEN min(i.identifier) END FROM ik_provenance p JOIN issues i ON i.id=p.target_id JOIN teams t ON t.id=i.team_id AND t.workspace_id=o.workspace_id
     WHERE p.destination=o.workspace_id AND p.target_kind='issue' AND p.reversed=0 AND (json_extract(p.record_json,'$.sourceId')=?1 COLLATE NOCASE OR EXISTS(SELECT 1 FROM issue_activity a WHERE a.issue_id=i.id AND a.kind='issue.imported' AND json_extract(a.next_value_json,'$.sourceKey')=?1 COLLATE NOCASE))) END AS identifier
    FROM operators o WHERE o.id=?2`).bind(identifier,operatorId).first<{identifier:string|null}>();
  return row?.identifier ?? identifier;
}
