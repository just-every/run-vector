import type { SourceRecord } from '../../../../../vendor/base/import-kit/src/d1/index';
import { jiraColumns,jiraHeader,type JiraColumn } from './jira';
import { ownEntry } from './lookup';
import type { ImportReferences } from './references';
import type { ImportDiagnostic } from './types';

const nativeFields:Record<string,string>={'issue id':'sourceId',summary:'title',description:'description',status:'status',priority:'priority',assignee:'assignee',created:'createdAt',updated:'updatedAt','due date':'dueDate',labels:'labels',sprint:'cycle','story point estimate':'estimate','original estimate':'estimate','issue type':'labels',resolved:'resolved',parent:'parent','parent id':'parent','outward issue link (blocks)':'blocks','outward issue link (duplicate)':'duplicateOf'};
const position=(column:JiraColumn)=>`${column.header} [column ${column.column}]`;

/** Native diagnostics belong to the selected source inputs, not every column
 * sharing the native field. Exact source diagnostics still apply to retained data. */
export function jiraDiagnosticColumns(record:SourceRecord,item:ImportDiagnostic,omissions:ImportDiagnostic[],refs:ImportReferences,isError:boolean):JiraColumn[] {
 if(!item.field)return item.code==='reference_cycle'?jiraColumns(record).filter(column=>['parent','parent id','outward issue link (blocks)','outward issue link (duplicate)'].includes(jiraHeader(column.header))&&!omissions.some(omission=>omission.field===position(column))):[];
 return jiraColumns(record).filter(column=>{
  if(item.column!==undefined)return item.column===column.column;
  if(item.field===position(column))return true;
  const name=jiraHeader(column.header);
  if(item.code.startsWith('jira_'))return item.field===name||item.field===column.header;
  if(ownEntry(nativeFields,name)!==item.field)return false;
  // Rollover sprints, superseded seconds and ordinary issue types have no native input.
  if(omissions.some(omission=>omission.field===position(column)))return false;
  if(isError&&item.field==='labels') {
   const label=name==='issue type'?'epic':column.value.trim();
   return !refs.labels.some(row=>row.name===label);
  }
  return true;
 });
}
