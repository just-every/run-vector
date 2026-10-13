import type { SourceRecord } from '../../../../../vendor/base/import-kit/src/d1/index';
import { jiraColumns,jiraHeader,jiraValue } from './jira';
import { referenceAlias,resolveReference,type ImportReferences } from './references';
import { ownEntry } from './lookup';
import { jiraDiagnosticColumns } from './jira-review-diagnostics';
import type { ImportDiagnostic,ImportInput } from './types';

export type JiraOccurrence={row:number;sourceId:string;sourceKey:string;column:number;value:string;action:'planned'|'not_imported'|'error'|'review_only';reason:string;metadata?:{time:string;author:string;body?:string;filename?:string;url?:string}};
export type JiraConcept={name:string;headers:{name:string;column:number}[];action:string;rowCount:number;rows:number[];valueCount:number;values:{value:string;count:number;rows:number[]}[];occurrences:JiraOccurrence[];dispositions:{action:JiraOccurrence['action'];reason:string;rows:number[];rowCount:number;valueCount:number}[]};
export type JiraConfirmation={source:string;rows:number[];categories:string[];suggestion:string|null;target:string|null};
export type JiraReview={concepts:JiraConcept[];statuses:JiraConfirmation[];priorities:JiraConfirmation[];unresolved:(ImportDiagnostic&{sourceId:string;sourceKey:string;value:string})[];policies:string[]};
const actions:Record<string,string>={
 'issue id':'Stable source identity; scoped to the supplied source name.',
 'issue key':'Retained original only. Visible/searchable old-key effect awaits Part 3.',
 summary:'Native title.',description:'Native description.',status:'Explicit confirmed native status; category only suggests.',
 'status category':'Suggestion only; never resolves a status.',priority:'Explicit confirmed native priority; source names only suggest.',
 assignee:'Explicit active existing operator mapping; blank is unassigned; unmapped tokens are omitted.',
 created:'Native created time.',updated:'Native updated time.', 'due date':'Native calendar due date.',resolved:'Retained original resolution time; native completion follows Updated in this milestone.',
 labels:'Exact existing label name, once per issue; missing labels are errors. No automatic creation.',
 'issue type':'Epic becomes an ordinary issue labelled epic (existing label required); every other type is retained only. Parent effects await Part 3.',
 sprint:'Last NONEMPTY listed occurrence may map to an exact-name existing open cycle in the same team. Earlier occurrences are rolled over in Jira. Terminal issues cannot join cycles.',
 'story point estimate':'Native integer estimate 1–100; takes precedence over original seconds.',
 'original estimate':'Explicit seconds-per-native-unit policy only, with exact integer 1–100 result and no rounding; otherwise retained only.',
 comment:'Every author, time and body retained; native comments await Part 3.',
 attachment:'Every author, time, filename and URL retained. No fetch, bytes or native links; optional named HTTPS links deferred to Part 3.',
 parent:'Retained source relationship; native parent awaits Part 3.', 'parent id':'Retained source relationship; native parent awaits Part 3.',
};
const unique=(rows:number[])=>[...new Set(rows)].sort((a,b)=>a-b);
/** One authoritative review, serialized unchanged by preview, the private CLI file and reports. */
export function buildJiraReview(records:SourceRecord[],input:ImportInput,errors:ImportDiagnostic[],omissions:ImportDiagnostic[],refs:ImportReferences):JiraReview {
 const concepts=new Map<string,JiraConcept>(),byRow=new Map(records.map(record=>[record.location.row!,record]));
 const ids=new Set(records.map(record=>record.sourceId)),keys=new Set(records.map(record=>jiraValue(record,'issue key').trim().toUpperCase()));
 const diagnosticsByRow=(items:ImportDiagnostic[])=>{const grouped=new Map<number,ImportDiagnostic[]>();for(const item of items){const row=grouped.get(item.row)??[];row.push(item);grouped.set(item.row,row);}return grouped;};
 const errorsByRow=diagnosticsByRow(errors),omissionsByRow=diagnosticsByRow(omissions);
 const columnsByDiagnostic=new Map<ImportDiagnostic,number[]>();
 for(const [items,isError] of [[errors,true],[omissions,false]] as const)for(const item of items) {
  const record=byRow.get(item.row);if(!record)continue;
  const columns=jiraDiagnosticColumns(record,item,omissionsByRow.get(item.row)??[],refs,isError);
  columnsByDiagnostic.set(item,columns.map(column=>column.column));
  item.sourceId=record.sourceId;item.sourceKey=jiraValue(record,'issue key');item.value??=columns.find(column=>column.value.trim())?.value??'';
 }
 const unresolved:JiraReview['unresolved']=[];
 for(const item of [...errors,...omissions])if(item.sourceId&&(['unresolved_assignee','unresolved_sprint','terminal_cycle_omitted'].includes(item.code)||(['assignee','cycle'].includes(item.field??'')&&errors.includes(item))))unresolved.push({...item,sourceId:item.sourceId,sourceKey:item.sourceKey??'',value:item.value??''});
 for(const record of records)for(const column of jiraColumns(record)) {
  const name=jiraHeader(column.header),concept=concepts.get(name)??{name,headers:[],action:ownEntry(actions,name)??(name.startsWith('outward issue link')?'Retained source relationship; native link effect awaits Part 3.':'No native field. Retained original only, not imported.'),rowCount:0,rows:[],valueCount:0,values:[],occurrences:[],dispositions:[]};
  if(!concept.headers.some(item=>item.column===column.column))concept.headers.push({name:column.header,column:column.column});
  concepts.set(name,concept);if(!column.value.trim())continue;
  const row=record.location.row!,sourceKey=jiraValue(record,'issue key');
  const exactField=`${column.header} [column ${column.column}]`;
  const problem=(errorsByRow.get(row)??[]).find(item=>columnsByDiagnostic.get(item)?.includes(column.column));
  const omission=(omissionsByRow.get(row)??[]).find(item=>columnsByDiagnostic.get(item)?.includes(column.column));
  const occurrence:JiraOccurrence={row,sourceId:record.sourceId,sourceKey,column:column.column,value:column.value,action:problem?'error':omission?'not_imported':name==='status category'?'review_only':'planned',reason:problem?.message??omission?.message??concept.action};
  if(name==='comment'||name==='attachment') {
   const [time,author='',...parts]=column.value.split(';');
   occurrence.metadata=name==='comment'?{time,author,body:parts.join(';')}:{time,author,filename:parts[0],url:parts.slice(1).join(';')};
  }
  if(['parent','parent id'].includes(name)||name.startsWith('outward issue link')) {
   const target=column.value.trim();
   if(!ids.has(target)&&!keys.has(target.toUpperCase())) {
    const reason='Source reference is outside this file. It cannot bind any native issue with the same name or identifier; retained only.';
    occurrence.reason=reason;
    unresolved.push({row,sourceId:record.sourceId,sourceKey,field:exactField,value:column.value,code:'jira_reference_outside_file',message:reason});
   }
  }
  concept.occurrences.push(occurrence);
 }
 for(const concept of concepts.values()) {
  concept.rows=unique(concept.occurrences.map(item=>item.row));concept.rowCount=concept.rows.length;concept.valueCount=concept.occurrences.length;
  const values=new Map<string,{value:string;count:number;rows:number[]}>();
  for(const item of concept.occurrences){const value=values.get(item.value)??{value:item.value,count:0,rows:[]};value.count++;value.rows.push(item.row);values.set(item.value,value);}
  concept.values=[...values.values()].map(value=>({...value,rows:unique(value.rows)}));
  const dispositions=new Map<string,JiraConcept['dispositions'][number]>();
  for(const item of concept.occurrences){const key=item.action+'\u0000'+item.reason,group=dispositions.get(key)??{action:item.action,reason:item.reason,rows:[],rowCount:0,valueCount:0};group.rows.push(item.row);group.valueCount++;dispositions.set(key,group);}
  concept.dispositions=[...dispositions.values()].map(group=>({...group,rows:unique(group.rows),rowCount:unique(group.rows).length}));
 }
 let teamName:string|undefined;
 try{teamName=String(resolveReference(refs.teams,input.defaults?.team??'','team',input).name);}catch{ /* The team error is already in the authoritative row diagnostics. */ }
 const confirmations=(name:'status'|'priority'):JiraConfirmation[]=>(concepts.get(name)?.values??[]).map(value=>{
  const categories=name==='status'?[...new Set(records.filter(record=>value.rows.includes(record.location.row!)).map(record=>jiraValue(record,'status category')).filter(Boolean))]:[];
  const suggestions=categories.map(category=>ownEntry({'to do':'unstarted','in progress':'started',done:'completed'},category.trim().toLowerCase()));
  const suggestion=name==='priority'?(ownEntry({Highest:'urgent',High:'high',Medium:'medium',Low:'low',Lowest:'low'},value.value)??null):suggestions.length&&suggestions.every(item=>item&&item===suggestions[0])?suggestions[0]!:null;
  const target=name==='priority'?ownEntry(input.jira?.priorities,value.value):referenceAlias(input,'status',value.value,teamName);
  return {source:value.value,rows:value.rows,categories,suggestion,target:target??null};
 });
 return {concepts:[...concepts.values()],statuses:confirmations('status'),priorities:confirmations('priority'),unresolved,policies:[
  'Counts distinguish physical source rows from nonempty occurrences. Every original column name, position and value is retained.',
  'Planned means the field can be written only after the whole run passes errors and review confirmation. Preview writes nothing.',
  'Status categories and priority suggestions are never implicit mappings. Blank assignee stays unassigned; no operators or labels are created.',
  'Repeated Sprint order is this supported profile’s declared policy, not a guarantee of Jira export chronology.',
  input.jira?.originalEstimateSecondsPerUnit?`Confirmed original-estimate policy: ${input.jira.originalEstimateSecondsPerUnit} seconds per native unit; exact integers only, no rounding.`:'No original-estimate conversion policy confirmed. Seconds are retained only.',
  'Parents, blocks, duplicates, comments and visible/searchable old keys are NOT imported in this milestone; Part 3 owns those effects.',
  'Attachment URLs are plain source text. No URL is fetched and no native link is created; named HTTPS-link opt-in is deferred to Part 3.',
 ]};
}
