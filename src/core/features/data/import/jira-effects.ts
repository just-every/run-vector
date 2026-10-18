import type { Json,SourceRecord } from '../../../../../vendor/base/import-kit/src/d1/index';
import { createLinkSchema } from '../../links/schema';
import type { ApiRowEffects } from './api-rows';
import type { ImportActor } from './authority';
import { stableImportId } from './ids';
import { jiraColumns,jiraMetadata,jiraRelations } from './jira';
import type { ImportDiagnostic,ImportInput } from './types';

/** Dates were normalized by the whole-file detector, never by Date.parse here.
 * All effects join the shared native snapshot and whole-run rollback. */
export function jiraRowEffects(record:SourceRecord,input:ImportInput,actor:ImportActor,effectiveAt:string,errors:ImportDiagnostic[]):ApiRowEffects {
 const result:ApiRowEffects={comments:[],links:[],blocks:[],related:[],parent:'',duplicateOf:''};
 const id=stableImportId(actor.workspace,input.source,record.sourceId,'issue');
 const problem=(column:number,code:string,message:string)=>{const original=jiraColumns(record).find(item=>item.column===column)!;errors.push({row:record.location.row!,field:`${original.header} [column ${column}]`,code,message,value:original.value});};
 for(const metadata of jiraMetadata(record)) {
  if(metadata.kind==='comment') {
   if(!metadata.body?.trim()||metadata.body.length>100000||!metadata.time) {problem(metadata.column,'jira_invalid_comment','Comment requires a body of at most 100,000 characters and a valid source timestamp.');continue;}
   result.comments.push({id:jiraCommentId(actor.workspace,input.source,record.sourceId,metadata.column),issue_id:id,actor_operator_id:actor.id,body:metadata.body,edited_at:null,deleted_at:null,created_at:metadata.time,updated_at:metadata.time,imported_author_name:metadata.author,parent_comment_id:null,resolved_at:null,resolved_by_operator_id:null});
  } else if(input.jira?.attachmentLinks) {
   const parsed=createLinkSchema.safeParse({name:metadata.filename,url:metadata.url});
   if(!parsed.success){problem(metadata.column,'unsafe_link','Attachment opt-in requires a valid named HTTPS link without credentials. No attachment is fetched.');continue;}
   result.links.push({id:stableImportId(actor.workspace,input.source,record.sourceId,'attachment:'+metadata.column),issue_id:id,comment_id:null,actor_operator_id:actor.id,name:parsed.data.name,url:parsed.data.url,deleted_at:null,created_at:effectiveAt,updated_at:effectiveAt});
  }
 }
 const parents=new Set<string>(),duplicates=new Set<string>();
 for(const names of [['parent','parent id'],['outward issue link (duplicate)']]) {
  const occurrences=jiraRelations(record).filter(item=>names.includes(item.header.trim().toLowerCase()));
  const targets=new Set(occurrences.map(item=>item.target||'outside:'+item.value.trim().toUpperCase()));
  if(targets.size>1)for(const occurrence of occurrences)problem(occurrence.column,'jira_conflicting_reference',`Conflicting ${names[0]} targets must be resolved before import.`);
 }
 for(const relation of jiraRelations(record)) {
  if(relation.ambiguous){problem(relation.column,'jira_ambiguous_reference','This value names different source issues as an ID and as a key.');continue;}
  if(!relation.target)continue;
  const name=relation.header.trim().toLowerCase();
  if(relation.target===record.sourceId){problem(relation.column,'invalid_issue_reference','An issue cannot reference itself.');continue;}
  if(name==='outward issue link (relates)')result.related.push(relation.target);
  else if(name==='parent'||name==='parent id')parents.add(relation.target);
  else if(name==='outward issue link (duplicate)')duplicates.add(relation.target);
  else if(name==='outward issue link (blocks)'&&!result.blocks.includes(relation.target))result.blocks.push(relation.target);
 }
 for(const [targets,field] of [[parents,'parent'],[duplicates,'duplicateOf']] as const) {
  if(targets.size===1)result[field]='source:'+targets.values().next().value;
 }
 return result;
}
export function jiraCompletedAt(payload:Record<string,Json>,input:ImportInput,category:string,created:string|undefined,updated:string|undefined,effectiveAt:string,row:number,errors:ImportDiagnostic[],omissions:ImportDiagnostic[]) {
 const resolved=String(payload.$jiraResolved??'');
 if(category!=='completed') {
  if(resolved)omissions.push({row,field:'resolved',code:'jira_resolution_without_completion',message:'Resolved is retained only because the selected Vector status is not Completed.'});
  return null;
 }
 if(resolved) {
  if(created&&resolved<created)errors.push({row,field:'resolved',code:'timestamp_order',message:'Resolved cannot precede Created.'});
  return resolved;
 }
 const policy=input.jira?.completedAtFallback;
 if(!policy){errors.push({row,field:'resolved',code:'jira_completion_policy_required',message:'Completed issue has no Resolved timestamp. Confirm an explicit completion-time fallback policy.'});return null;}
 return policy==='updated'?updated??effectiveAt:policy==='created'?created??effectiveAt:effectiveAt;
}

/** Preserve physical column order when source timestamps tie, without changing
 * those timestamps or authors. A shared identity prefix scopes the
 * ordinal suffix to this issue/source/workspace; retries produce the same ID. */
function jiraCommentId(workspace:string,source:string,id:string,column:number) {
 const alphabet='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
 let ordinal='',value=column;for(let i=0;i<4;i++){ordinal=alphabet[value%32]+ordinal;value=Math.floor(value/32);}
 return stableImportId(workspace,source,id,'jira-comments').slice(0,22)+ordinal;
}
