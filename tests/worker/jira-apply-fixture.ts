import { env } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';
import { expect } from 'vitest';
import { generateJiraFixture } from '../fixtures/import/jira/generate.mjs';
import { setupImport } from './data-import-fixture';
import type { ImportInput } from '../../src/core/features/data/import/types';
import type { ImportReport } from '../../src/core/features/data/import/report';
export async function setupJiraApply(){
 const f=await setupImport(),fixture=generateJiraFixture();
 for(const name of fixture.expected.nativeSetup.labels)await f.mutate('/settings/labels','POST',{name,color:'#345678'});
 for(const [index,name] of fixture.expected.nativeSetup.cycles.entries())await f.mutate('/settings/cycles','POST',{teamId:f.team.id,name,startsLocal:`2027-0${index+1}-01T09:00`,endsLocal:`2027-0${index+1}-20T09:00`,capacity:100});
 const state=await f.state();
 const input=(source:string,csv=fixture.csv,attachmentLinks=false):ImportInput=>({format:'jira-csv',name:'jira-300.csv',source,base64:Buffer.from(csv).toString('base64'),mapping:{},defaults:{team:f.team.id},references:{status:Object.fromEntries([['To Do','unstarted'],['In Progress','started'],['Done','completed']].map(([name,category])=>[name,f.team.statuses.find(status=>status.category===category)!.id])),assignee:{[fixture.expected.nativeSetup.assigneeTokens[0].token]:f.owner},cycle:Object.fromEntries(state.cycles.map(cycle=>[cycle.name,cycle.id]))},jira:{priorities:fixture.expected.priorities.explicitVectorMapping,originalEstimateSecondsPerUnit:3600,attachmentLinks}});
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' AND name NOT IN ('access_rate_limits','oa_limits') ORDER BY name").all<{name:string}>()).results.map(row=>row.name);
 const counts=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,await env.DB.prepare('SELECT count(*) n FROM "'+table+'"').first<number>('n') as number])));
 const snapshots=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await env.DB.prepare('SELECT * FROM "'+table+'"').all()).results.map(row=>JSON.stringify(row)).sort()])));
 const report=async(id:string)=>{const response=await f.call('/data/import/runs/'+id+'/report');expect(response.status).toBe(200);return response.json() as Promise<ImportReport>;};
 const native=async(id:string)=>(await env.DB.prepare("SELECT i.*,json_extract(p.record_json,'$.sourceId') source_id FROM ik_provenance p JOIN issues i ON i.id=p.target_id WHERE p.job_id=? AND p.reversed=0 ORDER BY source_id").bind(id).all<Record<string,unknown>&{id:string;identifier:string;source_id:string;version:number}>()).results;
 return {...f,fixture,inputJira:input,counts,snapshots,report,native,state};
}
export async function checkJiraReconciliation(f:Awaited<ReturnType<typeof setupJiraApply>>,id:string,attachmentLinks=false,fixture=f.fixture){
 const report=await f.report(id),rows=await f.native(id);
 expect(report.totals).toMatchObject({rowsRead:300,issuesWritten:300,rowsNotWritten:0});
 const count=async(sql:string)=>(await env.DB.prepare(sql).bind(id).first<number>('n'))!;
 const owned="SELECT target_id FROM ik_provenance WHERE job_id=? AND reversed=0";
 const expected={labels:173,parents:5,dependencies:2,duplicates:2,comments:102,links:attachmentLinks?40:2,files:0};
 for(const [field,[table,key]] of Object.entries({labels:['issue_labels','issue_id'],parents:['issue_parents','issue_id'],dependencies:['issue_dependencies','blocked_issue_id'],comments:['issue_comments','issue_id'],links:['issue_links','issue_id'],files:['issue_files','issue_id']})){
  const written=await count(`SELECT count(*) n FROM ${table} WHERE ${key} IN (${owned})`);expect(written,field).toBe(expected[field as keyof typeof expected]);expect(report.effects!.counts[field as keyof typeof expected]).toEqual({planned:written,written});
 }
 expect(report.effects!.counts.duplicates).toEqual({planned:2,written:await count(`SELECT count(*) n FROM issue_links WHERE issue_id IN (${owned}) AND name LIKE 'Duplicate of %'`)});
 expect(await count(`SELECT count(*) n FROM issue_duplicates WHERE issue_id IN (${owned})`)).toBe(0); // Duplicate is the existing Linear canonical link mechanism, with no guessed status.
 const labels=(await env.DB.prepare(`SELECT l.name,count(*) n FROM issue_labels il JOIN labels l ON l.id=il.label_id WHERE il.issue_id IN (${owned}) GROUP BY l.name ORDER BY l.name`).bind(id).all<{name:string;n:number}>()).results;
 expect(report.effects!.labels).toEqual(labels.map(row=>({name:row.name,planned:row.n,written:row.n})));
 for(const [field,join] of Object.entries({team:'teams v ON v.id=i.team_id',status:'workflow_statuses v ON v.id=i.status_id',project:'projects v ON v.id=i.project_id',cycle:'cycles v ON v.id=i.cycle_id',assignee:'operators v ON v.id=i.assignee_operator_id'})){
  const expectedCounts=(await env.DB.prepare(`SELECT COALESCE(v.name,'(none)') name,count(*) n FROM issues i LEFT JOIN ${join} WHERE i.id IN (${owned}) GROUP BY 1`).bind(id).all<{name:string;n:number}>()).results;
  const actual=new Map<string,number>();for(const group of report.dimensions[field as keyof typeof report.dimensions])for(const value of group.vector)actual.set(value.name,(actual.get(value.name)??0)+value.count);
  expect(Object.fromEntries(actual),field).toEqual(Object.fromEntries(expectedCounts.map(row=>[row.name,row.n])));
 }
 const byId=new Map(rows.map(row=>[row.id,row.source_id]));
 const parents=(await env.DB.prepare(`SELECT issue_id,parent_issue_id FROM issue_parents WHERE issue_id IN (${owned}) ORDER BY issue_id`).bind(id).all<{issue_id:string;parent_issue_id:string}>()).results;
 expect(parents.map(row=>({sourceIssueId:byId.get(row.issue_id),parentIssueId:byId.get(row.parent_issue_id)})).sort((a,b)=>a.sourceIssueId!.localeCompare(b.sourceIssueId!))).toEqual(f.fixture.expected.relations.parents);
 const blocks=(await env.DB.prepare(`SELECT blocked_issue_id,blocking_issue_id FROM issue_dependencies WHERE blocked_issue_id IN (${owned})`).bind(id).all<{blocked_issue_id:string;blocking_issue_id:string}>()).results;
 expect(blocks.map(row=>({source:byId.get(row.blocking_issue_id),target:byId.get(row.blocked_issue_id)})).sort((a,b)=>a.source!.localeCompare(b.source!))).toEqual(f.fixture.expected.relations.blocks.map((row:{sourceIssueId:string;targetIssueId:string})=>({source:row.sourceIssueId,target:row.targetIssueId})));
 for(const duplicate of f.fixture.expected.relations.duplicates){const source=rows.find(row=>row.source_id===duplicate.sourceIssueId)!,target=rows.find(row=>row.source_id===duplicate.targetIssueId)!;expect((await env.DB.prepare("SELECT name,url FROM issue_links WHERE issue_id=? AND name LIKE 'Duplicate of %'").bind(source.id).all()).results).toEqual([{name:'Duplicate of '+target.identifier,url:'http://127.0.0.1:15920/app/issues/'+target.identifier}]);}
 // Independent fixture time arithmetic, not the importer's date reader.
 const instant=(index:number)=>new Date(Date.UTC(2025,0,1+index,9)-10*3600000).toISOString();
 for(const [index,row] of rows.entries()){
  expect(row).toMatchObject({created_at:instant(index),updated_at:instant(index+300),completed_at:index%3===2?instant(index+900):null,priority:['urgent','high','medium','low','low'][index%5],assignee_operator_id:index%4===0?f.owner:null,estimate:index%10===0?1+((index/5)%4):1+(index%8)});
  expect(row.cycle_id).toBe(index%3===2?null:index%4===0?f.state.cycles.find(cycle=>cycle.name===fixture.expected.nativeSetup.cycles[1])!.id:index%3===0?f.state.cycles.find(cycle=>cycle.name===fixture.expected.nativeSetup.cycles[0])!.id:null);
  if(index%4===0)expect(row.due_date).toBe(new Date(Date.UTC(2025,0,1+index+600)).toISOString().slice(0,10));
  const source=fixture.rows[index];
  const comments=(await env.DB.prepare('SELECT body,created_at,imported_author_name FROM issue_comments WHERE issue_id=? ORDER BY created_at').bind(row.id).all()).results;
  expect(comments).toEqual([25,30].flatMap((column,ordinal)=>source[column]?[{body:source[column].split(';').slice(2).join(';'),created_at:instant(index+1200+ordinal),imported_author_name:f.fixture.expected.nativeSetup.commentAuthorToken}]:[]));
 }
 console.log('jira-300-reconciliation',JSON.stringify({run:id,totals:report.totals,effects:report.effects,dimensions:report.dimensions}));
 return {report,rows};
}
