import { canonicalJson,sha256 } from '../../../../../vendor/base/import-kit/src/d1/index';
import { nativeRelations } from './native-snapshot';
import { readNativeIssues } from './native-targets';
import { ImportError } from './types';

export type RollbackConflict = { identifier: string; sourceId: string; reasons: ('edited'|'commented'|'linked'|'notified')[] };
export type RollbackPreview = { runId: string; state: string; issues: number; rows: Record<string,number>; conflicts: RollbackConflict[] };
const reason=(kind:string)=>kind.startsWith('comment.')?'commented' as const:/^(link\.|github\.)|dependency|parent|duplicate/.test(kind)?'linked' as const:'edited' as const;

/** What a whole-run rollback would remove, and every imported issue that later
 * native work makes unremovable. Read-only; nothing is written. */
export async function rollbackPreview(db:D1Database,workspace:string,id:string):Promise<RollbackPreview> {
  const job=await db.prepare('SELECT state FROM ik_jobs WHERE id=?').bind(id).first<{state:string}>();
  if(!job)throw new ImportError(409,'import_run_unavailable');
  const provenance=(await db.prepare(`SELECT target_id,record_json FROM ik_provenance WHERE job_id=? AND target_kind='issue' AND reversed=0 ORDER BY ordinal`).bind(id).all<{target_id:string;record_json:string}>()).results;
  const ids=provenance.map(row=>row.target_id),natives=await readNativeIssues(db,workspace,ids),inRun=JSON.stringify(ids);
  const changed=new Set<string>();
  for(const row of provenance) {
    const recorded=JSON.parse(row.record_json) as {valueHash:string;appliedRevision:string},current=natives.get(row.target_id);
    if(!current || current.revision!==recorded.appliedRevision || sha256(canonicalJson(current.value))!==recorded.valueHash)changed.add(row.target_id);
  }
  // Relationships from issues outside the run also keep an imported issue in place.
  const incoming=(await db.prepare(`SELECT parent_issue_id AS id FROM issue_parents WHERE parent_issue_id IN (SELECT value FROM json_each(?1)) AND issue_id NOT IN (SELECT value FROM json_each(?1))
    UNION SELECT blocking_issue_id FROM issue_dependencies WHERE blocking_issue_id IN (SELECT value FROM json_each(?1)) AND blocked_issue_id NOT IN (SELECT value FROM json_each(?1))
    UNION SELECT canonical_issue_id FROM issue_duplicates WHERE canonical_issue_id IN (SELECT value FROM json_each(?1)) AND issue_id NOT IN (SELECT value FROM json_each(?1))`).bind(inRun).all<{id:string}>()).results.map(row=>row.id);
  const flagged=[...new Set([...changed,...incoming])];
  const conflicts:RollbackConflict[]=[];
  if(flagged.length) {
    const rows=(await db.prepare(`SELECT i.id,i.identifier,(SELECT group_concat(kind,' ') FROM issue_activity a WHERE a.issue_id=i.id AND a.kind<>'issue.imported') AS kinds,
      EXISTS(SELECT 1 FROM notifications n WHERE n.issue_id=i.id) AS notified,
      (SELECT json_extract(p.record_json,'$.sourceId') FROM ik_provenance p WHERE p.job_id=? AND p.target_id=i.id) AS source_id
      FROM issues i WHERE i.id IN (SELECT value FROM json_each(?)) ORDER BY i.identifier`).bind(id,JSON.stringify(flagged)).all<{id:string;identifier:string;kinds:string|null;notified:number;source_id:string}>()).results;
    for(const row of rows) {
      const reasons=new Set<RollbackConflict['reasons'][number]>((row.kinds??'').split(' ').filter(Boolean).map(reason));
      if(incoming.includes(row.id))reasons.add('linked');
      if(row.notified)reasons.add('notified');
      if(!reasons.size)reasons.add('edited');
      conflicts.push({identifier:row.identifier,sourceId:row.source_id,reasons:(['edited','commented','linked','notified'] as const).filter(item=>reasons.has(item))});
    }
  }
  const counts:Record<string,number>={issues:ids.length,vector_import_revisions:ids.length,
    due_reminder_suppressions:(await db.prepare('SELECT count(*) AS n FROM due_reminder_suppressions WHERE issue_id IN (SELECT value FROM json_each(?))').bind(inRun).first<number>('n'))??0};
  for(const [table,key] of Object.values(nativeRelations))
    counts[table]=(counts[table]??0)+((await db.prepare(`SELECT count(*) AS n FROM "${table}" WHERE "${key}" IN (SELECT value FROM json_each(?))`).bind(inRun).first<number>('n'))??0);
  return {runId:id,state:job.state,issues:ids.length,rows:counts,conflicts};
}
/** Whole-run rollback starts only when no imported issue has later native work. */
export async function refuseRollbackConflicts(db:D1Database,workspace:string,id:string) {
  const preview=await rollbackPreview(db,workspace,id);
  if(preview.conflicts.length)throw new ImportError(409,'import_rollback_conflict','Later work on imported issues blocks this rollback. Nothing was removed.',{conflicts:preview.conflicts});
}
