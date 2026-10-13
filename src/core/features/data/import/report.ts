import type { Json,SourceRecord } from '../../../../../vendor/base/import-kit/src/d1/index';
import { importField } from './references';
import type { ImportDiagnostic,ImportInput } from './types';

/** Fields the report breaks down; each source value is compared with what it became. */
export const reportFields = ['team','status','project','cycle','assignee'] as const;
type ReportField = typeof reportFields[number];
/** Omissions that name a reference Vector did not resolve, row by row. */
const referenceCodes = new Set(['unresolved_assignee','terminal_cycle_omitted']);
export type ReportInput = {
  format: ImportInput['format']; fileName: string; headers: string[];
  /** [row, sourceId, team, status, project, cycle, assignee] as read from the file. */
  rows: [number,string,...string[]][];
  /** Grouped by field and reason, each with every row: a bounded stored size. */
  omissions: { field?:string; code:string; message:string; rows:number[] }[];
  notInFile: string[];
};
const notInFile: Record<ImportInput['format'],string[]> = {
  'jira-csv': ['attachment file bytes','complete workflow transition history, permissions and complete plugin state are not established by this CSV'],
  'linear-csv': ['comments','attachment files and links','issue history','team and project memberships','relations other than the parent issue (blocks, related, duplicate)'],
  'linear-api-json': ['attachment file bytes (the API file lists attachment links only)','issue history','team and project memberships'],
  csv: ['comments, attachments, history and memberships: a mapped file carries only its columns'],
  json: ['comments, attachments, history and memberships: a mapped file carries only its keys'],
};
/** Recorded with the run at apply, from the exact reviewed file. */
export function reportInput(input:ImportInput,headers:string[],records:SourceRecord[],omissions:ImportDiagnostic[]):ReportInput {
  const text=(value:Json|undefined)=>value===undefined || value===null ? '' : String(value);
  const groups=new Map<string,ReportInput['omissions'][number]>();
  for(const item of omissions){const key=(item.field??'')+'\u0000'+item.code,group=groups.get(key)??{field:item.field,code:item.code,message:item.message,rows:[]};group.rows.push(item.row);groups.set(key,group);}
  return {format:input.format,fileName:input.name,headers,omissions:[...groups.values()],notInFile:notInFile[input.format],
    rows:records.map(record=>{
      const payload=record.payload && typeof record.payload==='object' && !Array.isArray(record.payload)?record.payload as Record<string,Json>:{};
      return [record.location.row!,record.sourceId,...reportFields.map(field=>text(importField(input,payload,field)))] as [number,string,...string[]];
    })};
}
type Written = { source_id:string; identifier:string; team:string; status:string; project:string|null; cycle:string|null; assignee:string|null };
export type ImportReport = {
  run: { id:string; source:string; fileName:string; format:string; state:string };
  totals: { rowsRead:number; issuesWritten:number; rowsNotWritten:number; omittedValues:number; unresolvedReferences:number };
  dimensions: Record<ReportField,{ source:string; read:number; written:number; vector:{ name:string; count:number }[] }[]>;
  omitted: { field?:string; code:string; message:string; count:number; rows:number[] }[];
  references: { row:number; sourceId:string; field?:string; value:string; code:string; message:string }[];
  notInFile: string[];
  mapping: { row:number; sourceId:string; identifier:string|null }[];
};
/** Compares what the file held with the issues the run wrote, as they are now. */
export async function buildReport(db:D1Database,job:{id:string;namespace:string;state:string},input:ReportInput):Promise<ImportReport> {
  const written=(await db.prepare(`SELECT json_extract(p.record_json,'$.sourceId') AS source_id,i.identifier,t.name AS team,s.name AS status,pr.name AS project,c.name AS cycle,o.name AS assignee
    FROM ik_provenance p JOIN issues i ON i.id=p.target_id JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
    LEFT JOIN projects pr ON pr.id=i.project_id LEFT JOIN cycles c ON c.id=i.cycle_id LEFT JOIN operators o ON o.id=i.assignee_operator_id
    WHERE p.job_id=? AND p.target_kind='issue' AND p.reversed=0`).bind(job.id).all<Written>()).results;
  const bySource=new Map(written.map(row=>[row.source_id,row]));
  const dimensions=Object.fromEntries(reportFields.map((field,index)=>{
    const groups=new Map<string,{source:string;read:number;written:number;vector:Map<string,number>}>();
    for(const row of input.rows) {
      const value=row[2+index] as string,group=groups.get(value)??{source:value,read:0,written:0,vector:new Map<string,number>()};
      group.read++;const issue=bySource.get(row[1]);
      if(issue){group.written++;const name=issue[field]??'(none)';group.vector.set(name,(group.vector.get(name)??0)+1);}
      groups.set(value,group);
    }
    return [field,[...groups.values()].sort((a,b)=>b.read-a.read||a.source.localeCompare(b.source)).map(group=>({...group,vector:[...group.vector].map(([name,count])=>({name,count})).sort((a,b)=>a.name.localeCompare(b.name))}))];
  })) as ImportReport['dimensions'];
  const sourceOf=new Map(input.rows.map(row=>[row[0],row]));
  const references=input.omissions.filter(group=>referenceCodes.has(group.code)).flatMap(group=>group.rows.map(number=>{
    const row=sourceOf.get(number),index=reportFields.indexOf(group.field as ReportField);
    return {row:number,sourceId:row?.[1]??'',field:group.field,value:index>=0?String(row?.[2+index]??''):'',code:group.code,message:group.message};
  }));
  return {
    run:{id:job.id,source:job.namespace.replace(/^vector-import:/,''),fileName:input.fileName,format:input.format,state:job.state},
    totals:{rowsRead:input.rows.length,issuesWritten:written.length,rowsNotWritten:input.rows.filter(row=>!bySource.has(row[1])).length,omittedValues:input.omissions.reduce((sum,group)=>sum+group.rows.length,0),unresolvedReferences:references.length},
    dimensions,omitted:input.omissions.map(group=>({...group,count:group.rows.length})).sort((a,b)=>b.count-a.count),references,notInFile:input.notInFile,
    mapping:input.rows.map(row=>({row:row[0],sourceId:row[1],identifier:bySource.get(row[1])?.identifier??null})),
  };
}
const cell=(value:string|number|null)=>{const text=value===null?'':String(value);return /[",\r\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;};
/** One row per source record: the mapping file, with what each row became. */
export function reportCsv(report:ImportReport,input:ReportInput) {
  const omitted=new Map<number,string[]>();
  for(const group of input.omissions)for(const row of group.rows)omitted.set(row,[...(omitted.get(row)??[]),group.field??group.code]);
  const identifiers=new Map(report.mapping.map(row=>[row.sourceId,row.identifier]));
  const lines=[['source_row','source_id','vector_identifier','written',...reportFields.map(field=>'source_'+field),'not_imported_fields'].join(',')];
  for(const row of input.rows)lines.push([row[0],row[1],identifiers.get(row[1])??null,identifiers.get(row[1])?'yes':'no',...row.slice(2) as string[],(omitted.get(row[0])??[]).join('; ')].map(cell).join(','));
  return lines.join('\r\n')+'\r\n';
}
