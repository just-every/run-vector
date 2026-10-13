import { z } from 'zod';
import { fetchJson } from '../../../app/api-client';
import { parseCsv } from '../import/csv';
import { importLimits,type ImportDiagnostic,type ImportInput } from '../import/types';
const diagnostic=z.object({row:z.number(),field:z.string().optional(),code:z.string(),message:z.string()});
export const previewSchema=z.object({ready:z.boolean(),fingerprint:z.string().optional(),effectiveAt:z.string(),headers:z.array(z.string()),errors:z.array(diagnostic),omissions:z.array(diagnostic),count:z.number(),measured:z.record(z.string(),z.number())});
export type Review=z.infer<typeof previewSchema>;
const progressSchema=z.object({batchSize:z.number(),batchesApplied:z.number(),batchesTotal:z.number(),unfinished:z.boolean(),issuesRemaining:z.number(),lastError:z.string().nullable(),lastErrorAt:z.string().nullable()});
export const runSchema=z.object({id:z.string(),state:z.string(),checkpoint:z.number(),total:z.number(),progress:progressSchema});
export type Run=z.infer<typeof runSchema>;
export const runsSchema=z.object({runs:z.array(z.object({id:z.string(),namespace:z.string(),state:z.string(),checkpoint:z.number(),total:z.number(),error:z.string().nullable(),batchSize:z.number().nullable(),batchesApplied:z.number(),lastError:z.string().nullable()}))});
export type Runs=z.infer<typeof runsSchema>['runs'];
export const post=<S extends z.ZodType>(path:string,schema:S,body:unknown)=>fetchJson(path,schema,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
/** Publishes the remaining batches one request at a time, reporting each. */
export async function continueRun(run:Run,onProgress:(run:Run)=>void):Promise<Run> {
 let current=run;onProgress(current);
 while(current.progress.unfinished){current=await post('/api/data/import/runs/'+current.id+'/resume',runSchema,{});onProgress(current);}
 return current;
}
export const runProgressText=(run:{state:string;checkpoint:number;total:number;progress:Run['progress']})=>['rolling_back','rolled_back'].includes(run.state)?`Rolling back: ${run.progress.issuesRemaining} imported issues remain`:`Applied ${run.progress.batchesApplied} of ${run.progress.batchesTotal} batches (${run.checkpoint} of ${run.total} source records)`;
const conflictSchema=z.object({identifier:z.string(),sourceId:z.string(),reasons:z.array(z.string())});
export const rollbackPreviewSchema=z.object({runId:z.string(),state:z.string(),issues:z.number(),rows:z.record(z.string(),z.number()),conflicts:z.array(conflictSchema)});
export type RollbackPreview=z.infer<typeof rollbackPreviewSchema>;
/** One line per field and reason, with its count and the first rows. */
export function groupDiagnostics(items:ImportDiagnostic[]) {
 const groups=new Map<string,{field?:string;code:string;message:string;rows:number[]}>();
 for(const item of items){const key=(item.field??'')+'\u0000'+item.code;const group=groups.get(key)??{field:item.field,code:item.code,message:item.message,rows:[]};group.rows.push(item.row);groups.set(key,group);}
 return [...groups.values()].sort((a,b)=>b.rows.length-a.rows.length);
}
/** An API file is any JSON object; a mapped JSON import must be an array. */
export async function readImportFile(file:File,format:ImportInput['format'],rows=true) {
 if(file.size>importLimits.bytes)throw Error(`Split the file before uploading: one run reads at most ${Math.round(importLimits.bytes/1048576)} MiB.`);
 const bytes=new Uint8Array(await file.arrayBuffer()),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 let headers:string[];
 if(format==='json'){
  const value:unknown=JSON.parse(text.replace(/^﻿/,''));
  if(rows&&!Array.isArray(value))throw Error('JSON must contain an array of objects.');
  headers=!Array.isArray(value)?[]:[...new Set(value.flatMap(row=>row && typeof row==='object' && !Array.isArray(row)?Object.keys(row):[]))];
 }else headers=parseCsv(text).headers;
 let binary='';for(let start=0;start<bytes.length;start+=32768)binary+=String.fromCharCode(...bytes.subarray(start,start+32768));
 return {name:file.name,base64:btoa(binary),headers};
}
const dimension=z.array(z.object({source:z.string(),read:z.number(),written:z.number(),vector:z.array(z.object({name:z.string(),count:z.number()}))}));
export const reportSchema=z.object({
 run:z.object({id:z.string(),source:z.string(),fileName:z.string(),format:z.string(),state:z.string()}),
 totals:z.object({rowsRead:z.number(),issuesWritten:z.number(),rowsNotWritten:z.number(),omittedValues:z.number(),unresolvedReferences:z.number()}),
 dimensions:z.object({team:dimension,status:dimension,project:dimension,cycle:dimension,assignee:dimension}),
 omitted:z.array(z.object({field:z.string().optional(),code:z.string(),message:z.string(),count:z.number(),rows:z.array(z.number())})),
 references:z.array(z.object({row:z.number(),sourceId:z.string(),field:z.string().optional(),value:z.string(),code:z.string(),message:z.string()})),
 notInFile:z.array(z.string()),
 mapping:z.array(z.object({row:z.number(),sourceId:z.string(),identifier:z.string().nullable()})),
});
export type ImportReportData=z.infer<typeof reportSchema>;
