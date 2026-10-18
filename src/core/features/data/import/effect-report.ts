import { stableImportId } from './ids';
import type { MappingResult } from '../../../../../vendor/base/import-kit/src/d1/index';
import type { NativeIssueValue } from './native-snapshot';
export type EffectCounts={labels:number;parents:number;dependencies:number;related:number;duplicates:number;comments:number;links:number;files:number};
export type EffectPlan={counts:EffectCounts;duplicateLinkIds:string[];labels:{name:string;planned:number}[]};
export type EffectReport={counts:{[K in keyof EffectCounts]:{planned:number;written:number}};labels:{name:string;planned:number;written:number}[]};
const relations={related:['issue_relations','first_issue_id'],labels:['issue_labels','issue_id'],parents:['issue_parents','issue_id'],dependencies:['issue_dependencies','blocked_issue_id'],comments:['issue_comments','issue_id'],links:['issue_links','issue_id'],files:['issue_files','issue_id']} as const;
export function effectPlan(effects:Map<string,MappingResult>,labels:{id:string;[key:string]:unknown}[],workspace:string,source:string):EffectPlan {
 const counts:EffectCounts={labels:0,parents:0,dependencies:0,related:0,duplicates:0,comments:0,links:0,files:0},duplicateLinkIds:string[]=[],labelCounts=new Map<string,number>();
 for(const [sourceId,result] of effects)for(const effect of result.effects) {
  const value=effect.value as unknown as NativeIssueValue;
  for(const field of Object.keys(relations) as (keyof typeof relations)[])counts[field]+=(value[field==='parents'?'parent':field]?.length??0);
  for(const link of value.links)if(link.id===stableImportId(workspace,source,sourceId,'duplicate-link'))duplicateLinkIds.push(String(link.id));
  for(const label of value.labels){const name=String(labels.find(item=>item.id===label.label_id)?.name??label.label_id);labelCounts.set(name,(labelCounts.get(name)??0)+1);}
 }
 counts.duplicates=duplicateLinkIds.length;
 return {counts,duplicateLinkIds,labels:[...labelCounts].map(([name,planned])=>({name,planned})).sort((a,b)=>a.name.localeCompare(b.name))};
}
/** Counts the current SQL rows of live provenance, including partial apply and undo. */
export async function effectReport(db:D1Database,jobId:string,plan:EffectPlan):Promise<EffectReport> {
 const owned="SELECT target_id FROM ik_provenance WHERE job_id=? AND target_kind='issue' AND reversed=0";
 const counts={} as EffectReport['counts'];
 for(const [field,[table,key]] of Object.entries(relations) as [keyof typeof relations,readonly [string,string]][])counts[field]={planned:plan.counts[field]??0,written:(await db.prepare(`SELECT count(*) n FROM ${table} WHERE ${key} IN (${owned})`).bind(jobId).first<number>('n'))!};
 counts.duplicates={planned:plan.counts.duplicates,written:(await db.prepare(`SELECT count(*) n FROM issue_links WHERE issue_id IN (${owned}) AND id IN (SELECT value FROM json_each(?))`).bind(jobId,JSON.stringify(plan.duplicateLinkIds)).first<number>('n'))!};
 const rows=(await db.prepare(`SELECT l.name,count(*) n FROM issue_labels il JOIN labels l ON l.id=il.label_id WHERE il.issue_id IN (${owned}) GROUP BY l.name`).bind(jobId).all<{name:string;n:number}>()).results;
 const names=[...new Set([...plan.labels.map(item=>item.name),...rows.map(item=>item.name)])].sort();
 return {counts,labels:names.map(name=>({name,planned:plan.labels.find(item=>item.name===name)?.planned??0,written:rows.find(item=>item.name===name)?.n??0}))};
}
