import { readD1ImportJob,type D1ImportContext } from '../../../../../vendor/base/import-kit/src/d1/index';
import { stored } from '../../../../../vendor/base/import-kit/src/d1/jobs';
import { loadImportReferences } from './references';
import type { NativeIssueValue } from './native-snapshot';
import { ImportError } from './types';

/** Diagnose only after a failed atomic batch, with a fresh authorization fence.
 * Never return driver SQL or private records from a different workspace. These
 * reads explain the refusal; the original native SQL guards remain decisive. */
export async function explainResumeFailure(id:string,context:D1ImportContext,error:unknown):Promise<unknown> {
 await readD1ImportJob(id,context);
 const {job,plan}=await stored(id,context);
 if(!['queued','applying','failed'].includes(job.state))return error;
 const db=context.storage.database,refs=await loadImportReferences(db as D1Database,job.destination);
 const remaining=plan.entries.slice(job.checkpoint,job.checkpoint+(context.batchSize??1000));
 for(const entry of remaining)for(const effect of entry.effects){
  if(entry.erased||effect.targetKind!=='issue')continue;
  const value=effect.value as unknown as NativeIssueValue,issue=value.issue;
  const changed=(field:string,description:string)=>new ImportError(409,'import_option_changed',`${description} after review (source issue ${entry.source.sourceId}). The failed batch published nothing. Review this run's rollback, confirm it if there is no later native work, then preview the file again with current options.`,{runId:id,sourceId:entry.source.sourceId,field});
  const team=refs.teams.find(row=>row.id===issue.team_id),status=refs.statuses.find(row=>row.id===issue.status_id);
  if(!team||team.archived_at||team.identifier_prefix!==issue.origin_prefix)return changed('team','The selected team or its identifier prefix changed');
  const activity=JSON.parse(String(value.activity[0].next_value_json)) as {statusCategory:string;format?:string};
  if(!status||status.team_id!==issue.team_id||status.category!==activity.statusCategory)return changed('status','The selected status changed');
  for(const label of value.labels)if(!refs.labels.some(row=>row.id===label.label_id)){
   const payload=entry.source.payload as Record<string,unknown>;
   const names=activity.format==='jira-csv'&&Array.isArray(payload.labels)?' ('+payload.labels.map(String).join(', ').slice(0,300)+')':'';
   return changed('labels','A selected label'+names+' was deleted');
  }
  if(issue.project_id&&!refs.projects.some(row=>row.id===issue.project_id&&!row.archived_at))return changed('project','The selected project is no longer available');
  if(issue.cycle_id&&!refs.cycles.some(row=>row.id===issue.cycle_id&&row.team_id===issue.team_id&&!row.closed_at))return changed('cycle','The selected cycle is no longer available');
  if(issue.assignee_operator_id&&!refs.operators.some(row=>row.id===issue.assignee_operator_id&&!row.removed_at&&(activity.format!=='jira-csv'||row.identity_active)))return changed('assignee','The selected assignee is no longer available');
  if(!await db.prepare('SELECT job_id FROM vector_import_allocations WHERE job_id=? AND identifier_prefix=?').bind(id,issue.origin_prefix).first()){
   const floor=await db.prepare('SELECT last_sequence FROM issue_prefix_sequences WHERE workspace_id=? AND identifier_prefix=?').bind(job.destination,issue.origin_prefix).first<{last_sequence:number}>();
   if(floor&&floor.last_sequence>=Number(issue.sequence_number)&&!await db.prepare('SELECT id FROM issues WHERE id=?').bind(effect.targetId).first())
    return new ImportError(409,'import_number_conflict','This older run did not reserve its remaining issue numbers, and another issue advanced the sequence. Review and confirm rollback if there is no later native work, then preview the file again. Existing issues and allocated numbers are preserved.',{runId:id});
  }
 }
 return error;
}
