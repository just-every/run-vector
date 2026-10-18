import { canonicalJson,sha256 } from '../../../../../vendor/base/import-kit/src/d1/index';
import { nativeRelations } from './native-snapshot';
import { readNativeIssues } from './native-targets';
import { detachedIssues } from './detached-issues';
import { ImportError } from './types';

export type RollbackConflict = { identifier: string; sourceId: string; reasons: ('edited'|'commented'|'linked'|'notified'|'erasure_detached')[]; detachedIdentifiers?: string[] };
export type RollbackPreview = { runId: string; state: string; issues: number; rows: Record<string,number>; conflicts: RollbackConflict[]; detachedIssues: number; detachedIdentifiers: string[] };
const reason=(kind:string)=>kind.startsWith('comment.')?'commented' as const:/^(link\.|github\.)|dependency|parent|duplicate/.test(kind)?'linked' as const:'edited' as const;

/** What a whole-run rollback would remove, and every imported issue that later
 * native work makes unremovable. Read-only; nothing is written. */
export async function rollbackPreview(db:D1Database,workspace:string,id:string):Promise<RollbackPreview> {
  const job=await db.prepare('SELECT state FROM ik_jobs WHERE id=?').bind(id).first<{state:string}>();
  if(!job)throw new ImportError(409,'import_run_unavailable');
  const provenance=(await db.prepare(`SELECT target_id,record_json FROM ik_provenance WHERE job_id=? AND target_kind='issue' AND reversed=0 ORDER BY ordinal`).bind(id).all<{target_id:string;record_json:string}>()).results;
  const ids=provenance.map(row=>row.target_id),natives=await readNativeIssues(db,workspace,ids),inRun=JSON.stringify(ids);
  const detached=await detachedIssues(db,workspace,[id]),detachedById=new Map(detached.map(row=>[row.id,row.identifier]));
  const changed=new Set<string>();
  for(const row of provenance) {
    const recorded=JSON.parse(row.record_json) as {valueHash:string;appliedRevision:string},current=natives.get(row.target_id);
    if(!current || current.revision!==recorded.appliedRevision || sha256(canonicalJson(current.value))!==recorded.valueHash)changed.add(row.target_id);
  }
  // Relationships from issues outside the run also keep an imported issue in place.
  const incoming=(await db.prepare(`WITH incoming(id,other,relation) AS (
    SELECT parent_issue_id,issue_id,'parent' FROM issue_parents WHERE parent_issue_id IN (SELECT value FROM json_each(?1)) AND issue_id NOT IN (SELECT value FROM json_each(?1))
    UNION SELECT blocking_issue_id,blocked_issue_id,'dependency' FROM issue_dependencies WHERE blocking_issue_id IN (SELECT value FROM json_each(?1)) AND blocked_issue_id NOT IN (SELECT value FROM json_each(?1))
    UNION SELECT canonical_issue_id,issue_id,'duplicate' FROM issue_duplicates WHERE canonical_issue_id IN (SELECT value FROM json_each(?1)) AND issue_id NOT IN (SELECT value FROM json_each(?1)))
    SELECT link.id,link.other,EXISTS(SELECT 1 FROM issue_activity a JOIN issues target ON target.id=link.id WHERE a.issue_id=link.other AND (
      (link.relation='parent' AND a.kind='issue.parent_changed' AND json_extract(a.next_value_json,'$.parentIdentifier')=target.identifier) OR
      (link.relation='dependency' AND a.kind='issue.dependency_added' AND json_extract(a.next_value_json,'$.relatedIdentifier')=target.identifier AND json_extract(a.next_value_json,'$.direction')='blocked-by') OR
      (link.relation='duplicate' AND a.kind='issue.duplicate_changed' AND json_extract(a.next_value_json,'$.canonicalIdentifier')=target.identifier))) AS native_link
    FROM incoming link`).bind(inRun).all<{id:string;other:string;native_link:number}>()).results;
  const flagged=[...new Set([...changed,...incoming.map(row=>row.id)])];
  const conflicts:RollbackConflict[]=[];
  if(flagged.length) {
    const rows=(await db.prepare(`SELECT i.id,i.identifier,(SELECT group_concat(kind,' ') FROM issue_activity a WHERE a.issue_id=i.id AND a.kind<>'issue.imported') AS kinds,
      EXISTS(SELECT 1 FROM notifications n WHERE n.issue_id=i.id) AS notified,
      (SELECT json_extract(p.record_json,'$.sourceId') FROM ik_provenance p WHERE p.job_id=? AND p.target_id=i.id) AS source_id
      FROM issues i WHERE i.id IN (SELECT value FROM json_each(?)) ORDER BY i.identifier`).bind(id,JSON.stringify(flagged)).all<{id:string;identifier:string;kinds:string|null;notified:number;source_id:string}>()).results;
    for(const row of rows) {
      const reasons=new Set<RollbackConflict['reasons'][number]>((row.kinds??'').split(' ').filter(Boolean).map(reason));
      const links=incoming.filter(link=>link.id===row.id);
      const detachedIdentifiers=[...new Set(links.flatMap(link=>detachedById.has(link.other)?[detachedById.get(link.other)!]:[]))];
      if(detachedIdentifiers.length)reasons.add('erasure_detached');
      // Native relationship actions live on the child for parents and duplicates.
      // Match this relationship's target; unrelated edits on a survivor are not links.
      if(links.some(link=>!detachedById.has(link.other)||link.native_link))reasons.add('linked');
      if(row.notified)reasons.add('notified');
      if(!reasons.size)reasons.add('edited');
      conflicts.push({identifier:row.identifier,sourceId:row.source_id,reasons:(['edited','commented','linked','notified','erasure_detached'] as const).filter(item=>reasons.has(item)),...(detachedIdentifiers.length?{detachedIdentifiers}:{})});
    }
  }
  const counts:Record<string,number>={issues:ids.length,vector_import_revisions:ids.length,
    due_reminder_suppressions:(await db.prepare('SELECT count(*) AS n FROM due_reminder_suppressions WHERE issue_id IN (SELECT value FROM json_each(?))').bind(inRun).first<number>('n'))??0};
  for(const [table,key] of Object.values(nativeRelations))
    counts[table]=(counts[table]??0)+((await db.prepare(`SELECT count(*) AS n FROM "${table}" WHERE "${key}" IN (SELECT value FROM json_each(?))`).bind(inRun).first<number>('n'))??0);
  const orderCount=await db.prepare('SELECT count(*) n FROM manual_order_entries WHERE issue_id IN (SELECT value FROM json_each(?))').bind(inRun).first<number>('n');
  if(orderCount)counts.manual_order_entries=orderCount;
  return {runId:id,state:job.state,issues:ids.length,rows:counts,conflicts,detachedIssues:detached.length,detachedIdentifiers:detached.map(row=>row.identifier)};
}
/** Whole-run rollback starts only when no imported issue has later native work. */
export async function refuseRollbackConflicts(db:D1Database,workspace:string,id:string) {
  const preview=await rollbackPreview(db,workspace,id);
  if(!preview.conflicts.length)return;
  const erased=preview.conflicts.some(row=>row.reasons.includes('erasure_detached')),later=preview.conflicts.some(row=>row.reasons.some(reason=>reason!=='erasure_detached'));
  const message=[erased?'Personal-data erasure detached issues whose links block removing this run. Unlink or delete the listed detached issues, then review rollback again. Removing a dependency records native work on both issues; its imported endpoint may also need deletion.':'',later?'Later native work on imported issues blocks this rollback. Resolve that work before rollback.':'','Nothing was removed.'].filter(Boolean).join(' ');
  throw new ImportError(409,'import_rollback_conflict',message,{conflicts:preview.conflicts,detachedIssues:preview.detachedIssues,detachedIdentifiers:preview.detachedIdentifiers});
}
