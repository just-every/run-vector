import type { Json,SourceRecord } from '../../../../../vendor/base/import-kit/src/d1/index';
import { ImportError,type ImportDiagnostic,type ImportInput,type ImportMapping } from './types';
import { readJiraDates,type JiraDateCell } from './jira-dates';

export const jiraPayloadKey='$jiraColumns';
const scalar:Record<string,string>={'issue id':'sourceId',summary:'title',description:'description',status:'status',priority:'priority',assignee:'assignee',created:'createdAt',updated:'updatedAt','due date':'dueDate','story point estimate':'estimate'};
const scalarField=(header:string)=>Object.hasOwn(scalar,header)?scalar[header]:undefined;
const mapping:ImportMapping={...Object.fromEntries(Object.values(scalar).map(field=>[field,field])),labels:'labels',cycle:'cycle'};
export const jiraHeader=(header:string)=>header.trim().toLowerCase();
export function jiraInput(input:ImportInput):ImportInput {
  if(input.format!=='jira-csv') {
    if(input.jira)throw new ImportError(400,'invalid_format','Jira configuration requires jira-csv.');
    return input;
  }
  if(Object.keys(input.mapping).length)throw new ImportError(400,'jira_fixed_columns','Jira uses its documented columns by position; use explicit reference mappings and a default team.');
  if(Object.keys(input.defaults??{}).some(field=>!['team','status'].includes(field)))throw new ImportError(400,'jira_invalid_default','Jira accepts explicit default team and status only. Other source values need reviewed mappings.');
  return {...input,mapping};
}
export function readJiraCsv(csv:{headers:string[];rows:{row:number;values:string[]}[]},input:ImportInput) {
  const errors:ImportDiagnostic[]=[],headers=csv.headers.map(jiraHeader),dates:JiraDateCell[]=[];
  for(const name of ['issue id','issue key','summary'])if(!headers.includes(name))errors.push({row:1,field:name,code:'jira_required_column',message:`Required Jira column is absent: ${name}.`});
  // A repeated scalar cannot be selected without silently losing another value.
  for(const name of new Set(headers))if((scalarField(name)||['issue key','original estimate','issue type','status category','resolved'].includes(name))&&headers.filter(header=>header===name).length>1)errors.push({row:1,field:name,code:'jira_repeated_scalar',message:'This scalar column occurs more than once. Retain only the intended scalar column; multivalue columns retain every position.'});
  for(const row of csv.rows)for(let column=0;column<headers.length;column++) {
    const field=headers[column],rawValue=row.values[column]??'',value=rawValue.trim();if(!value)continue;
    if(['created','updated','due date','resolved'].includes(field))dates.push({row:row.row,column,field:csv.headers[column],value,rawValue});
    if(field==='comment'||field==='attachment') {
      const count=field==='comment'?2:3,segments=value.split(';');
      if(segments.length<=count||!segments.slice(0,count).every(segment=>segment.trim())||!segments.slice(count).join(';').trim())errors.push({row:row.row,column:column+1,field:`${csv.headers[column]} [column ${column+1}]`,value:rawValue,code:'jira_invalid_metadata',message:`Expected ${field==='comment'?'date;author;body':'date;author;filename;URL'}; this occurrence cannot be read.`});
      dates.push({row:row.row,column,field:csv.headers[column],value:segments[0].trim(),rawValue});
    }
  }
  const detected=readJiraDates(dates,input.jira?.sourceOffset,input.jira?.shortYearCentury);errors.push(...detected.errors);
  const payloads=new Map<number,Record<string,Json>>(),ids=new Map<string,number[]>(),keys=new Map<string,{ids:Set<string>;rows:number[]}>();
  for(const row of csv.rows) {
    const payload:Record<string,Json>={...Object.fromEntries(Object.values(scalar).map(field=>[field,''])),[jiraPayloadKey]:csv.headers.map((header,column)=>({header,column:column+1,value:row.values[column]??''}))};
    for(let column=0;column<headers.length;column++) {
      const field=scalarField(headers[column]),raw=row.values[column]??'';
      if(field)payload[field]=detected.values.get(row.row+':'+column)??raw;
    }
    const values=(name:string)=>headers.flatMap((header,index)=>header===name&&row.values[index]?.trim()?[row.values[index].trim()]:[]);
    payload.labels=[...new Set([...values('labels'),...(values('issue type').some(value=>value.toLowerCase()==='epic')?['epic']:[])])];
    payload.cycle=values('sprint').at(-1)??'';
    payload.$jiraMetadata=csv.headers.flatMap((header,index)=>{
      const kind=jiraHeader(header),raw=row.values[index]??'';
      if(!['comment','attachment'].includes(kind)||!raw.trim())return [];
      const [date,author,...parts]=raw.split(';');
      return [{column:index+1,kind,time:detected.values.get(row.row+':'+index)??'',sourceTime:date,author:author?.trim()??'',...(kind==='comment'?{body:parts.join(';')}:{filename:parts[0]?.trim()??'',url:parts.slice(1).join(';').trim()})}];
    });
    payload.$jiraResolved=detected.values.get(row.row+':'+headers.indexOf('resolved'))??'';
    if(!String(payload.estimate).trim()&&values('original estimate').length&&input.jira?.originalEstimateSecondsPerUnit) {
      const seconds=values('original estimate')[0],units=Number(seconds)/input.jira.originalEstimateSecondsPerUnit;
      payload.estimate=/^\d+$/.test(seconds)&&Number.isSafeInteger(Number(seconds))?String(units):'invalid seconds';
    }
    for(const required of ['issue id','issue key','summary'])if(!(row.values[headers.indexOf(required)]??'').trim())errors.push({row:row.row,field:required,code:'jira_required_value',message:`Jira ${required} must have a value.`});
    const id=row.values[headers.indexOf('issue id')]??'',key=(row.values[headers.indexOf('issue key')]??'').trim().toUpperCase();
    // IDs stay opaque; Jira keys compare without case or surrounding whitespace.
    if(id.trim()) {
      const occurrences=ids.get(id)??[];occurrences.push(row.row);ids.set(id,occurrences);
      if(key) {
        const identity=keys.get(key)??{ids:new Set<string>(),rows:[]};
        identity.ids.add(id);identity.rows.push(row.row);keys.set(key,identity);
      }
    }
    payloads.set(row.row,payload);
  }
  // Resolve only against this file. A mutable key is an alias for the stable ID,
  // never permission to select a same-named native issue.
  const aliases=new Map([...keys].filter(([,value])=>value.ids.size===1).map(([key,value])=>[key,[...value.ids][0]]));
  for(const payload of payloads.values()) {
    payload.$jiraRelations=(payload[jiraPayloadKey] as JiraColumn[]).filter(column=>['parent','parent id','outward issue link (blocks)','outward issue link (duplicate)','outward issue link (relates)'].includes(jiraHeader(column.header))&&column.value.trim()).map(column=>{
      const value=column.value.trim(),byId=ids.has(value)?value:undefined,byKey=aliases.get(value.toUpperCase());
      return {...column,target:byId??byKey??'',ambiguous:!!byId&&!!byKey&&byId!==byKey};
    });
  }
  for(const rows of ids.values())if(rows.length>1)for(const row of rows)errors.push({row,field:'issue id',code:'jira_duplicate_source_id',message:'This Jira issue ID appears more than once in the file. Keep one row per issue ID, even when the contents are identical.'});
  for(const identity of keys.values())if(identity.ids.size>1)for(const row of identity.rows)errors.push({row,field:'issue key',code:'jira_ambiguous_issue_key',message:'This Jira issue key belongs to multiple issue IDs in this file. Resolve the conflicting identities before applying.'});
  return {errors,payloads,review:detected.review};
}
export type JiraColumn={header:string;column:number;value:string};
export const jiraColumns=(record:SourceRecord)=>(record.payload as Record<string,Json>)[jiraPayloadKey] as JiraColumn[];
export const jiraValue=(record:SourceRecord,name:string)=>jiraColumns(record).find(column=>jiraHeader(column.header)===name)?.value??'';
export function jiraOmissions(record:SourceRecord,input:ImportInput):ImportDiagnostic[] {
  const columns=jiraColumns(record),sprints=columns.filter(column=>jiraHeader(column.header)==='sprint'&&column.value.trim());
  return columns.flatMap(column=>{
    const name=jiraHeader(column.header);if(!column.value.trim())return [];
    let message='';
    if(name==='sprint'&&column!==sprints.at(-1))message='Rolled over in Jira: earlier nonempty sprint occurrence retained; only the last nonempty occurrence can map to a cycle.';
    else if(name==='issue type'&&column.value.trim().toLowerCase()!=='epic')message='This Jira issue type has no native field. The ordinary issue retains its source type in the original.';
    else if(name==='original estimate') {
      if(jiraValue(record,'story point estimate').trim())message='Story points take precedence. Original estimate seconds are retained without conversion.';
      else if(!input.jira?.originalEstimateSecondsPerUnit)message='Original estimate is seconds. No seconds-per-native-unit conversion policy was confirmed; retained without conversion.';
    }

    else if(name==='attachment')message=input.jira?.attachmentLinks?'Named HTTPS link planned; attachment bytes are absent and never fetched. Source timestamp and author remain metadata.':'Attachment timestamp, author, filename and URL retained. Bytes are absent and never fetched; no named-link opt-in was confirmed.';
    else if(['parent','parent id','outward issue link (blocks)','outward issue link (duplicate)'].includes(name)) {
      const relation=jiraRelations(record).find(item=>item.column===column.column);
      if(!relation?.target)message='Source reference is outside this file. It cannot bind any native issue with the same name or identifier; retained only.';
    }
    else if(name.startsWith('outward issue link'))message='This relationship kind has no native mapping; retained in the original without a link.';
    else if(!scalarField(name)&&!['status category','labels','sprint','issue type','original estimate','issue key','comment','resolved'].includes(name))message='No native field for this source column; every occurrence is retained in the original and not imported.';
    return message?[{row:record.location.row!,field:`${column.header} [column ${column.column}]`,code:name==='sprint'?'jira_sprint_rollover':message.startsWith('Source reference is outside')?'jira_reference_outside_file':name==='attachment'&&input.jira?.attachmentLinks?'jira_attachment_bytes_absent':'jira_not_imported',message,sourceId:record.sourceId,sourceKey:jiraValue(record,'issue key'),value:column.value}]:[];
  });
}

export type JiraRelation=JiraColumn&{target:string;ambiguous:boolean};
export const jiraRelations=(record:SourceRecord)=>(record.payload as Record<string,Json>).$jiraRelations as JiraRelation[];
export type JiraMetadata={column:number;kind:string;time:string;sourceTime:string;author:string;body?:string;filename?:string;url?:string};
export const jiraMetadata=(record:SourceRecord)=>(record.payload as Record<string,Json>).$jiraMetadata as JiraMetadata[];
