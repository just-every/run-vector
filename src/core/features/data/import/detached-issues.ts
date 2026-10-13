import { canonicalJson, sha256 } from '../../../../../vendor/base/import-kit/src/d1/index';

export type DetachedIssue = { id: string; identifier: string; runId: string };
/** Person erasure severs effects and changes the index target to the person's
 * digest. Base retains the source hash, owning publication entry and native
 * revision. Reconstruct that revision (Base apply.ts) to recognize only issues
 * this run actually created, without recovering or storing erased identities.
 * Vector maps exactly one issue effect per source record, at effect index zero. */
export async function detachedIssues(db:D1Database,workspace:string,runIds:string[]):Promise<DetachedIssue[]> {
  if(!runIds.length)return [];
  const entries=(await db.prepare(`SELECT DISTINCT x.job_id,x.source_identity FROM ik_d1_plan_index x
    JOIN ik_jobs j ON j.id=x.job_id AND j.destination=?1
    JOIN ik_d1_entries e ON e.job_id=x.job_id AND e.ordinal=x.ordinal AND e.source_identity=x.source_identity AND e.owner_job_id=x.job_id
    JOIN ik_d1_erased_sources s ON s.destination=j.destination AND s.identity=x.source_identity
    JOIN ik_d1_erased_targets t ON t.destination=j.destination AND t.identity=x.target_identity
    WHERE x.job_id IN (SELECT value FROM json_each(?2))`).bind(workspace,JSON.stringify(runIds)).all<{job_id:string;source_identity:string}>()).results;
  if(!entries.length)return [];
  const revisions=entries.map(row=>({runId:row.job_id,revision:sha256(canonicalJson([row.job_id,row.source_identity,0,'applied']))}));
  return (await db.prepare(`SELECT i.id,i.identifier,json_extract(r.value,'$.runId') AS runId
    FROM json_each(?1) r JOIN vector_import_revisions v ON v.revision=json_extract(r.value,'$.revision')
    JOIN issues i ON i.id=v.issue_id JOIN teams t ON t.id=i.team_id AND t.workspace_id=?2
    WHERE NOT EXISTS(SELECT 1 FROM ik_provenance p WHERE p.target_kind='issue' AND p.target_id=i.id AND p.reversed=0)
    ORDER BY i.identifier`).bind(JSON.stringify(revisions),workspace).all<DetachedIssue>()).results;
}
