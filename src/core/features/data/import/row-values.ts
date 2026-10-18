import type { Json,SourceRecord } from '../../../../../vendor/base/import-kit/src/d1/index';
import { canonicalJson } from '../../../../../vendor/base/import-kit/src/d1/index';
import { stableImportId } from './ids';
import { apiRowEffects } from './api-rows';
import { jiraOmissions,jiraValue } from './jira';
import { jiraRowEffects,jiraCompletedAt } from './jira-effects';
import { apiPayloadKey } from './api-file';
export { stableImportId };
import { createIssueInputSchema } from '../../issues/input';
import { importValidationErrors } from './validation';
import { importFieldLabel } from './field-labels';
import { emptyIssueValue,type NativeIssueValue } from './native-snapshot';
import { importField,resolveReference,stringField,listField,type ImportReferences } from './references';
import { linearPriority,isLinear } from './linear';
import type { ImportActor } from './authority';
import type { ImportDiagnostic,ImportField,ImportInput } from './types';

const instant=(value:string,label:string)=>{
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value)))throw Error(`${label} must be an ISO timestamp with a timezone.`);
  return value;
};
export type MappedRow = {record:SourceRecord;value?:NativeIssueValue;parent:string;dependencies:string[];duplicateOf:string;blocks:string[];related:string[];errors:ImportDiagnostic[];omissions:ImportDiagnostic[]};
export function rowOmissions(record:SourceRecord,input:ImportInput):ImportDiagnostic[] {
  if(input.format==='jira-csv')return jiraOmissions(record,input);
  if(!record.payload || typeof record.payload!=='object' || Array.isArray(record.payload))return [];
  const payload=record.payload as Record<string,Json>,row=record.location.row!,result:ImportDiagnostic[]=[];
  const archived=importField(input,payload,'archivedAt');
  if(archived)result.push({row,field:'archivedAt',code:'unsupported_archive_state',message:'Vector has no issue archive state. The original Archived value is retained; importing this row does not archive it.'});
  const used=new Set(Object.values(input.mapping));
  for(const [field,value] of Object.entries(payload))if(field!==apiPayloadKey && !used.has(field) && value!=='' && value!==null)
    result.push({row,field,code:'unmapped_column',message:'This column is not mapped to a Vector field; its value stays in the original file.'});
  return result;
}
export function mapImportRow(record:SourceRecord,input:ImportInput,refs:ImportReferences,actor:ImportActor,effectiveAt:string,sequence:number,inRun:Set<string>=new Set()): MappedRow {
  const errors:ImportDiagnostic[]=[],omissions=rowOmissions(record,input),row=record.location.row!;
  const result:MappedRow={record,parent:'',dependencies:[],duplicateOf:'',blocks:[],related:[],errors,omissions};
  if(!record.payload || typeof record.payload!=='object' || Array.isArray(record.payload))return result;
  const payload=record.payload as Record<string,Json>;
  const take=<T>(field:ImportField,read:()=>T):T|undefined=>{
    try{return read();}catch(error){errors.push({row,field,code:'invalid_field',message:error instanceof Error?error.message:'Invalid field.'});return undefined;}
  };
  const text=(field:ImportField,max?:number)=>stringField(importField(input,payload,field),importFieldLabel(field),max);
  const team=take('team',()=>resolveReference(refs.teams,text('team'), 'team',input));
  const status=team?take('status',()=>resolveReference(refs.statuses.filter(status=>status.team_id===team.id),text('status'),'status',input,String(team.name),input.format==='jira-csv'&&!payload.status)):undefined;
  // A person who is not an active operator (someone who left, say) does not
  // block the run: the issue lands unassigned and the report names them.
  const assignee=take('assignee',()=>{
    const name=text('assignee');if(!name)return null;
    try{return resolveReference(refs.operators,name,'assignee',input);}
    catch(error){if(error instanceof Error && error.message.startsWith('Reference was not found')){omissions.push({row,field:'assignee',code:'unresolved_assignee',message:'No active operator matches this assignee. The issue is imported unassigned; the name stays in the original.'});return null;}throw error;}
  });
  const project=take('project',()=>text('project')?resolveReference(refs.projects,text('project'),'project',input):null);
  const cycle=team?take('cycle',()=>{
    const name=text('cycle');if(!name)return null;
    try{return resolveReference(refs.cycles.filter(cycle=>cycle.team_id===team.id),name,'cycle',input,String(team.name));}
    catch(error){if(input.format==='jira-csv'&&error instanceof Error&&error.message.startsWith('Reference was not found')){omissions.push({row,field:'cycle',code:'unresolved_sprint',message:'No explicit sprint mapping. The issue is imported without a cycle; the sprint stays in the original.'});return null;}throw error;}
  }):undefined;
  const labelIds=take('labels',()=>listField(importField(input,payload,'labels'),'labels').map(name=>resolveReference(refs.labels,name,'labels',input).id));
  const title=take('title',()=>text('title',500).trim());
  const description=take('description',()=>text('description',100000));
  const priority=take('priority',()=>{
    const raw=text('priority')||'none';
    if(input.format==='jira-csv'&&text('priority')){const table=input.jira?.priorities,mapped=table&&Object.hasOwn(table,raw)?table[raw]:undefined;if(!mapped)throw Error('Confirm an explicit Jira priority mapping; priority names never resolve automatically.');return mapped;}
    const value=isLinear(input.format)?linearPriority(raw):raw.toLowerCase();
    if(!['none','low','medium','high','urgent'].includes(value))throw Error('Priority must be none, low, medium, high or urgent.');
    return value;
  });
  const estimate=take('estimate',()=>{
    const raw=importField(input,payload,'estimate');if(raw===undefined || raw===null || raw==='')return null;
    const value=typeof raw==='number'?raw:typeof raw==='string' && /^\d+$/.test(raw)?Number(raw):NaN;
    if(!Number.isSafeInteger(value) || value<1 || value>100)throw Error('Estimate must be an integer from 1 to 100, or empty.');
    return value;
  });
  const dueDate=take('dueDate',()=>{const value=text('dueDate');if(!value)return null;
    if(!/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value)throw Error('Due date must be a valid YYYY-MM-DD date.');return value;});
  const expectedOutcome=take('expectedOutcome',()=>text('expectedOutcome')||null),customerImpact=take('customerImpact',()=>text('customerImpact')||null);
  const createdAt=take('createdAt',()=>instant(text('createdAt')||effectiveAt,'Created'));
  const updatedAt=take('updatedAt',()=>instant(text('updatedAt')||createdAt||effectiveAt,'Updated'));
  if(createdAt && updatedAt && Date.parse(updatedAt)<Date.parse(createdAt))errors.push({row,field:'updatedAt',code:'timestamp_order',message:'Updated cannot precede Created.'});
  result.parent=take('parent',()=>text('parent',128))||'';
  result.dependencies=take('dependencies',()=>listField(importField(input,payload,'dependencies'),'dependencies'))||[];
  result.duplicateOf=take('duplicateOf',()=>text('duplicateOf',128))||'';
  take('archivedAt',()=>text('archivedAt'));
  const api=input.format==='jira-csv'?jiraRowEffects(record,input,actor,effectiveAt,errors):apiRowEffects(payload,record.sourceId,row,input,actor,effectiveAt,inRun,errors,omissions);
  const completedAt=input.format==='jira-csv'?jiraCompletedAt(payload,input,String(status?.category),createdAt,updatedAt,effectiveAt,row,errors,omissions):status?.category==='completed'?updatedAt:null;
  if(api){result.parent||=api.parent;result.duplicateOf||=api.duplicateOf;result.blocks=api.blocks;result.related=api.related;}
  if(status?.category==='intake')errors.push({row,field:'status',code:'intake_requires_evidence',message:'File imports cannot create signal Intake without its evidence. Choose a status for work that is ready to start, in progress or finished.'});
  if(status?.category==='duplicate' && !result.duplicateOf)errors.push({row,field:'duplicateOf',code:'duplicate_reference_required',message:'A Duplicate status needs an explicit duplicate-of reference.'});
  // Finished work's past cycle stays in the original; Vector commits only open work to a cycle.
  const terminal=['completed','canceled','duplicate'].includes(String(status?.category));
  if(cycle && terminal)omissions.push({row,field:'cycle',code:'terminal_cycle_omitted',message:'Finished issues are not committed to a cycle. The cycle stays in the original.'});
  const validation=createIssueInputSchema.safeParse({title,description,teamId:team?.id,statusId:status?.id,assigneeOperatorId:assignee?.id??null,projectId:project?.id??null,cycleId:terminal?null:cycle?.id??null,priority,labelIds,estimate,dueDate,expectedOutcome,customerImpact,customFields:{}});
  if(!validation.success)errors.push(...importValidationErrors(validation.error.issues,row,errors));
  if(errors.length || !validation.success || !team || !status || !createdAt || !updatedAt)return result;
  const data=validation.data,id=stableImportId(actor.workspace,input.source,record.sourceId,'issue');
  const value=emptyIssueValue({id,identifier:`${team.identifier_prefix}-${sequence}`,origin_prefix:team.identifier_prefix,sequence_number:sequence,team_id:team.id,title:data.title,description:data.description,status_id:status.id,priority:data.priority,assignee_operator_id:data.assigneeOperatorId,project_id:data.projectId,cycle_id:data.cycleId,due_date:data.dueDate,estimate:data.estimate,expected_outcome:data.expectedOutcome,customer_impact:data.customerImpact,custom_fields_json:'{}',deferred_until:null,version:1,completed_at:completedAt??null,canceled_at:status.category==='canceled'?updatedAt:null,created_at:createdAt,updated_at:updatedAt});
  value.labels=data.labelIds.sort().map(label_id=>({issue_id:id,label_id,created_at:createdAt}));
  value.activity=[{id:stableImportId(actor.workspace,input.source,record.sourceId,'activity'),issue_id:id,actor_operator_id:actor.id,actor_name:null,kind:'issue.imported',previous_value_json:null,next_value_json:canonicalJson({source:input.source,sourceId:record.sourceId,...(input.format==='jira-csv'?{format:input.format,sourceKey:jiraValue(record,'issue key').trim()}:{}),statusCategory:status.category,omissions:omissions.map(item=>item.field)}),created_at:effectiveAt,updated_at:effectiveAt}];
  const activity=value.activity[0];
  value.descriptionRevisions=[{id:activity.id,issue_id:id,description:data.description,actor_operator_id:activity.actor_operator_id,actor_name:activity.actor_name,created_at:activity.created_at,version:value.issue.version}];
  // Snapshot order: native relations are read back ordered by id.
  value.comments=(api?.comments??[]).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  value.links=(api?.links??[]).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  result.value=value;return result;
}
