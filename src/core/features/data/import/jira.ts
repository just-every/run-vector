import type { Json,SourceRecord } from '../../../../../vendor/base/import-kit/src/d1/index';
import { ImportError,type ImportDiagnostic,type ImportInput,type ImportMapping } from './types';
import { readJiraDates,type JiraDateCell } from './jira-dates';

export const jiraPayloadKey='$jiraColumns';
const scalar:Record<string,string>={'issue id':'sourceId',summary:'title',description:'description',status:'status',priority:'priority',assignee:'assignee',created:'createdAt',updated:'updatedAt','due date':'dueDate','story point estimate':'estimate'};
const scalarField=(header:string)=>Object.hasOwn(scalar,header)?scalar[header]:undefined;
const mapping:ImportMapping=Object.fromEntries(Object.values(scalar).map(field=>[field,field]));
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
  for(const name of new Set(headers))if((scalarField(name)||name==='issue key')&&headers.filter(header=>header===name).length>1)errors.push({row:1,field:name,code:'jira_repeated_scalar',message:'This scalar column occurs more than once. Retain only the intended scalar column; multivalue columns retain every position.'});
  for(const row of csv.rows)for(let column=0;column<headers.length;column++) {
    const field=headers[column],value=row.values[column]?.trim();if(!value)continue;
    if(['created','updated','due date','resolved'].includes(field))dates.push({row:row.row,column,field,value});
    if(field==='comment'||field==='attachment') {
      const count=field==='comment'?2:3,segments=value.split(';');
      if(segments.length<=count||!segments.slice(0,count).every(segment=>segment.trim())||!segments.slice(count).join(';').trim())errors.push({row:row.row,field:csv.headers[column],code:'jira_invalid_metadata',message:`Expected ${field==='comment'?'date;author;body':'date;author;filename;URL'}; this occurrence cannot be read.`});
      dates.push({row:row.row,column,field,value:segments[0].trim()});
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
  for(const rows of ids.values())if(rows.length>1)for(const row of rows)errors.push({row,field:'issue id',code:'jira_duplicate_source_id',message:'This Jira issue ID appears more than once in the file. Keep one row per issue ID, even when the contents are identical.'});
  for(const identity of keys.values())if(identity.ids.size>1)for(const row of identity.rows)errors.push({row,field:'issue key',code:'jira_ambiguous_issue_key',message:'This Jira issue key belongs to multiple issue IDs in this file. Resolve the conflicting identities before applying.'});
  return {errors,payloads,review:detected.review};
}
export function jiraOmissions(record:SourceRecord):ImportDiagnostic[] {
  const payload=record.payload as Record<string,Json>,columns=payload[jiraPayloadKey] as {header:string;column:number;value:string}[];
  return columns.filter(column=>column.value&&!scalarField(jiraHeader(column.header))).map(column=>({row:record.location.row!,field:`${column.header} [column ${column.column}]`,code:'jira_not_imported',message:jiraHeader(column.header)==='original estimate'?'Original estimate is seconds, not points. It is retained without conversion.':`This source occurrence is retained in the exact original and is not applied in this milestone. Comments, attachment metadata, old issue keys, labels, sprints, relationships and custom/plugin values await the full loss review and effects implementation.`}));
}
