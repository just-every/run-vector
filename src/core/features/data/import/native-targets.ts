import type { D1TargetAdapter, TargetRow, D1Sql, Json } from '../../../../../vendor/base/import-kit/src/d1/index';
import { canonicalJson } from '../../../../../vendor/base/import-kit/src/d1/index';
import { nativeRelations,snapshotExpression,legacySnapshotExpression,insertNative,type NativeIssueValue } from './native-snapshot';

const guard = (sql:string,...params:Json[]): D1Sql => ({sql:`SELECT CASE WHEN (${sql}) THEN 1 ELSE json('import native option changed') END`,params});
/** One set read of complete native snapshots, for preview of a re-imported file. */
export async function readNativeIssues(db:D1Database,destination:string,ids:string[]):Promise<Map<string,{value:Json;revision:string}>> {
  const found=new Map<string,{value:Json;revision:string}>();
  for(let start=0;start<ids.length;start+=200) {
    const rows=(await db.prepare(`SELECT i.id,${snapshotExpression} AS value,v.revision FROM issues i JOIN teams t ON t.id=i.team_id JOIN vector_import_revisions v ON v.issue_id=i.id WHERE t.workspace_id=? AND i.id IN (SELECT value FROM json_each(?))`).bind(destination,JSON.stringify(ids.slice(start,start+200))).all<{id:string;value:string;revision:string}>()).results;
    for(const row of rows)found.set(row.id,{value:JSON.parse(row.value),revision:row.revision});
  }
  return found;
}
// A parent or blocker from the same run that a person erasure severed before it
// was published never existed: no issue and no deletion record. Its link is left
// out on write, and out of the expected snapshot in `matches` the same way. A
// deleted or otherwise missing target still refuses.
const neverPublished=(id:string)=>`NOT EXISTS(SELECT 1 FROM issues WHERE id=${id}) AND NOT EXISTS(SELECT 1 FROM issue_deletions WHERE issue_id=${id})`;
const severable={parent:'parent_issue_id',dependencies:'blocking_issue_id'} as const;
const kept=(name:keyof typeof severable)=>`json((SELECT json_group_array(json(e.value)) FROM (SELECT e.value FROM json_each(json(?),'$.${name}') e WHERE NOT (${neverPublished(`json_extract(e.value,'$.${severable[name]}')`)}) ORDER BY e.key) e))`;
// Imports only reference people, so a person named as an erasure target
// (retireD1ImportCustody) is never a native import target: always absent.
const personTarget='person';
export const nativeTargets: D1TargetAdapter = {
  async read(db,destination,kind,id) {
    if (kind === personTarget) return undefined;
    if (kind !== 'issue') throw Error('unsupported_import_target');
    const row=await db.prepare(`SELECT ${snapshotExpression} AS value,v.revision FROM issues i JOIN teams t ON t.id=i.team_id JOIN vector_import_revisions v ON v.issue_id=i.id WHERE i.id=? AND t.workspace_id=?`).bind(id,destination).first<{value:string;revision:string}>();
    return row?{destination,targetKind:kind,targetId:id,value:JSON.parse(row.value),revision:row.revision}:undefined;
  },
  matches(row,destination,kind,id) {
    if (kind === personTarget && !row) return {sql:'1=1',params:[]};
    if (kind !== 'issue') throw Error('unsupported_import_target');
    if (!row) return {sql:'NOT EXISTS(SELECT 1 FROM issues WHERE id=?) AND NOT EXISTS(SELECT 1 FROM vector_import_revisions WHERE issue_id=?)',params:[id,id]};
    const value=canonicalJson(row.value);
    return {sql:`EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN vector_import_revisions v ON v.issue_id=i.id WHERE i.id=? AND t.workspace_id=? AND v.revision=? AND ${legacySnapshotExpression}=json_remove(json_set(json(?),'$.dependencies',${kept('dependencies')},'$.parent',${kept('parent')}),'$.manualOrder')
      AND (SELECT count(*) FROM manual_order_entries e WHERE e.issue_id=i.id)=json_array_length(COALESCE(json_extract(json(?),'$.manualOrder'),json('[]')))
      AND NOT EXISTS(SELECT 1 FROM json_each(json(?),'$.manualOrder') expected WHERE NOT EXISTS(SELECT 1 FROM manual_order_entries e WHERE e.issue_id=i.id AND e.workspace_id=json_extract(expected.value,'$.workspace_id') AND e.scope_key=json_extract(expected.value,'$.scope_key') AND e.issue_id=json_extract(expected.value,'$.issue_id') AND e.position IS json_extract(expected.value,'$.position'))))`,params:[id,destination,row.revision,value,value,value,value,value]};
  },
  write(row:TargetRow) {
    if (row.targetKind !== 'issue') throw Error('unsupported_import_target');
    const value=row.value as unknown as NativeIssueValue,issue=value.issue;
    const imported=JSON.parse(String(value.activity[0].next_value_json)) as {statusCategory:string;format?:string};
    const statements=[
      guard(`EXISTS(SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND identifier_prefix=? COLLATE BINARY AND archived_at IS NULL)
        AND EXISTS(SELECT 1 FROM workflow_statuses WHERE id=? AND team_id=? AND category=?)`,issue.team_id,row.destination,issue.origin_prefix,issue.status_id,issue.team_id,imported.statusCategory),
      guard('COALESCE((SELECT last_sequence FROM issue_prefix_sequences WHERE workspace_id=? AND identifier_prefix=?),0)<?',row.destination,issue.origin_prefix,issue.sequence_number),
    ];
    if (issue.assignee_operator_id) statements.push(guard(`EXISTS(SELECT 1 FROM operators o WHERE id=? AND workspace_id=? AND removed_at IS NULL${imported.format==='jira-csv'?" AND EXISTS(SELECT 1 FROM vector_auth_operators m JOIN oa_operators a ON a.id=m.auth_id WHERE m.operator_id=o.id AND a.status='active')":''})`,issue.assignee_operator_id,row.destination));
    if (issue.project_id) statements.push(guard('EXISTS(SELECT 1 FROM projects WHERE id=? AND workspace_id=? AND archived_at IS NULL)',issue.project_id,row.destination));
    if (issue.cycle_id) statements.push(guard(`EXISTS(SELECT 1 FROM cycles WHERE id=? AND team_id=? AND closed_at IS NULL)
      AND EXISTS(SELECT 1 FROM workflow_statuses WHERE id=? AND category NOT IN ('completed','canceled','duplicate'))`,issue.cycle_id,issue.team_id,issue.status_id));
    for (const label of value.labels) statements.push(guard('EXISTS(SELECT 1 FROM labels WHERE id=? AND workspace_id=?)',label.label_id,row.destination));
    statements.push(insertNative('issues',issue),{sql:'INSERT INTO vector_import_revisions(issue_id,revision) VALUES(?,?)',params:[row.targetId,row.revision]});
    for(const dependency of value.dependencies)statements.push(guard(`(EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=? AND t.workspace_id=?)
      AND NOT EXISTS(SELECT 1 FROM issue_dependencies WHERE blocked_issue_id=? AND blocking_issue_id=?)
      AND NOT EXISTS(WITH RECURSIVE reachable(id) AS (SELECT ? UNION SELECT d.blocked_issue_id FROM issue_dependencies d JOIN reachable r ON d.blocking_issue_id=r.id) SELECT 1 FROM reachable WHERE id=?)) OR (${neverPublished('?')})`,dependency.blocking_issue_id,row.destination,dependency.blocking_issue_id,row.targetId,row.targetId,dependency.blocking_issue_id,dependency.blocking_issue_id,dependency.blocking_issue_id));
    for(const parent of value.parent)statements.push(guard(`EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=? AND t.workspace_id=?) OR (${neverPublished('?')})`,parent.parent_issue_id,row.destination,parent.parent_issue_id,parent.parent_issue_id));
    for (const [name,[table]] of Object.entries(nativeRelations)) {
      const target=severable[name as keyof typeof severable];
      for (const record of value[name as keyof typeof nativeRelations]) statements.push(insertNative(table,record,target?{sql:'EXISTS(SELECT 1 FROM issues WHERE id=?)',params:[record[target]]}:undefined));
    }
    for (const entry of value.manualOrder ?? []) {
      statements.push({sql:'INSERT INTO manual_order_scopes(workspace_id,scope_key,version) VALUES(?,?,0) ON CONFLICT DO NOTHING',params:[entry.workspace_id,entry.scope_key]}, insertNative('manual_order_entries',entry));
    }
    // A due date already past at import is history, not news: its one overdue
    // reminder is consumed for the assignee, as a mute would. Due today or later
    // still reminds. The row cascades away with the issue on rollback.
    const importedOn=String(value.activity[0].created_at).slice(0,10);
    if (issue.assignee_operator_id && issue.due_date && String(issue.due_date)<importedOn && !['completed','canceled','duplicate'].includes(imported.statusCategory))
      statements.push({sql:`INSERT INTO due_reminder_suppressions(issue_id,due_date,kind,operator_id,created_at) VALUES(?,?,'overdue',?,?) ON CONFLICT(issue_id,due_date,kind,operator_id) DO NOTHING`,params:[issue.id,issue.due_date,issue.assignee_operator_id,value.activity[0].created_at]});
    return statements;
  },
  remove(destination,kind,id) {
    if (kind !== 'issue') throw Error('unsupported_import_target');
    // Deleting an import must not cascade away relationships another native
    // operation added to a parent or blocker after the reviewed import.
    return [guard(`EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=? AND t.workspace_id=?)
      AND NOT EXISTS(SELECT 1 FROM issue_parents WHERE parent_issue_id=?)
      AND NOT EXISTS(SELECT 1 FROM issue_dependencies WHERE blocking_issue_id=?)
      AND NOT EXISTS(SELECT 1 FROM issue_duplicates WHERE canonical_issue_id=?)`,id,destination,id,id,id),
      ...Object.values(nativeRelations).map(([table,key])=>({sql:`DELETE FROM "${table}" WHERE "${key}"=?`,params:[id]})),
      {sql:'DELETE FROM manual_order_entries WHERE issue_id=?',params:[id]},
      {sql:'DELETE FROM issues WHERE id=?',params:[id]},
      {sql:'DELETE FROM manual_order_scopes WHERE workspace_id=? AND version=0 AND NOT EXISTS(SELECT 1 FROM manual_order_entries e WHERE e.workspace_id=manual_order_scopes.workspace_id AND e.scope_key=manual_order_scopes.scope_key)',params:[destination]}];
  },
  async list(db,destination) {
    const ids=(await db.prepare('SELECT i.id FROM issues i JOIN teams t ON t.id=i.team_id JOIN vector_import_revisions v ON v.issue_id=i.id WHERE t.workspace_id=? ORDER BY i.id').bind(destination).all<{id:string}>()).results;
    const result:TargetRow[]=[];
    for (const {id} of ids) { const row=await nativeTargets.read(db,destination,'issue',id);if(row)result.push(row); }
    return result;
  },
  matchesCount(count,destination) { return {sql:'(SELECT count(*) FROM issues i JOIN teams t ON t.id=i.team_id JOIN vector_import_revisions v ON v.issue_id=i.id WHERE t.workspace_id=?)=?',params:[destination,count]}; },
};

/** A reservation belongs to this exact job and workspace. Pre-upgrade jobs
 * without reservations retain the strict floor guard; collision is diagnosed
 * with an explicit rollback/review route instead of overwriting native work. */
export function nativeTargetsForRun(jobId:string):D1TargetAdapter {
 return {...nativeTargets,write(row){
  const statements=nativeTargets.write(row),issue=(row.value as unknown as NativeIssueValue).issue;
  statements[1]=guard(`EXISTS(SELECT 1 FROM vector_import_allocations a JOIN ik_jobs j ON j.id=a.job_id
    WHERE a.job_id=? AND a.workspace_id=? AND j.destination=a.workspace_id AND a.identifier_prefix=?
    AND ? BETWEEN a.first_sequence AND a.last_sequence)
    OR (NOT EXISTS(SELECT 1 FROM vector_import_allocations WHERE job_id=? AND identifier_prefix=?)
    AND COALESCE((SELECT last_sequence FROM issue_prefix_sequences WHERE workspace_id=? AND identifier_prefix=?),0)<?)`,jobId,row.destination,issue.origin_prefix,issue.sequence_number,jobId,issue.origin_prefix,row.destination,issue.origin_prefix,issue.sequence_number);
  return statements;
 }};
}
