import type { ImportDiagnostic } from './types';
import type { MappedRow } from './row-values';

/** A related pair belongs to the endpoint published last. It never enters the
 * directed reference graph, so reciprocal and circular related links are valid. */
export function mapRelated(rows:MappedRow[],order:string[],errors:ImportDiagnostic[],at:string) {
  const bySource=new Map(rows.filter(row=>row.value).map(row=>[row.record.sourceId,row]));
  const rank=new Map(order.map((id,index)=>[id,index])),seen=new Set<string>();
  for(const row of rows)for(const source of row.related) {
    const target=bySource.get(source);
    if(!row.value||!target?.value) {
      errors.push({row:row.record.location.row!,field:'related',code:'related_target_not_in_run',message:'A related issue must be imported in this run; it cannot change a retained issue from another run.'});continue;
    }
    const a=String(row.value.issue.id),b=String(target.value.issue.id);
    if(a===b){errors.push({row:row.record.location.row!,field:'related',code:'invalid_issue_reference',message:'An issue cannot relate to itself.'});continue;}
    const key=[a,b].sort().join(':');if(seen.has(key))continue;seen.add(key);
    const [owner,other]=rank.get(a)!>rank.get(b)!?[row,target]:[target,row];
    (owner.value!.related??=[]).push({first_issue_id:owner.value!.issue.id,second_issue_id:other.value!.issue.id,created_at:at});
  }
  for(const row of rows)row.value?.related?.sort((a,b)=>String(a.second_issue_id).localeCompare(String(b.second_issue_id)));
}
