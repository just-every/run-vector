import { env } from 'cloudflare:workers';
import { expect,it } from 'vitest';
import { setupLinearWorkspace } from './linear-workspace-fixture';
import { createServerApp } from '../../src/core/app/server';
import { bindings,origin } from './base-auth-fixture';
import { sendDueReminders } from '../../src/core/features/due-reminders/service';
import type { ImportPreview } from '../../src/core/features/data/import/types';

const count=async(sql:string,...params:unknown[])=>(await env.DB.prepare(sql).bind(...params).first<number>('n'))??0;
// The tests in this file share one 2,000-issue run, so CI imports it once.
let shared:{f:Awaited<ReturnType<typeof setupLinearWorkspace>>;runId:string}|undefined;
const tableCounts=async()=>Object.fromEntries(await Promise.all((await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' ORDER BY name").all<{name:string}>()).results.map(async({name})=>[name,await count(`SELECT count(*) AS n FROM "${name}"`)])));
it('[DATA-006 DATA-004] a 2,000-issue Linear file previews once, publishes in staged batches, survives a failed batch and lands each issue exactly once',async()=>{
 const f=await setupLinearWorkspace();
 expect((await f.call('/settings/integrations/destinations','POST',{name:'Import effect proof',url:'https://receiver.example.com/events'})).status).toBe(201);
 const before={effects:await f.effects(),mail:await count('SELECT count(*) AS n FROM rer_mail_development_outbox'),issues:await count('SELECT count(*) AS n FROM issues')};
 const value=f.input(),review=await f.preview(value);
 expect(review.errors).toEqual([]);expect(review.ready).toBe(true);expect(review.count).toBe(2000);
 const batches=review.measured.batches;expect(batches).toBeGreaterThan(1);
 let run=await f.createRun(value,review);
 expect(run.state).toBe('queued');expect(run.progress).toMatchObject({batchesApplied:0,batchesTotal:batches,unfinished:true});
 for(let k=1;k<=3;k++){run=await f.resume(run);expect(run.progress.batchesApplied).toBe(k);expect(run.progress.batchesTotal).toBe(batches);}
 // One batch fails inside D1: nothing of it is published and the run says so.
 await env.DB.prepare("CREATE TRIGGER staged_batch_fault BEFORE INSERT ON issues BEGIN SELECT RAISE(ABORT,'forced batch failure'); END").run();
 expect((await f.call('/data/import/runs/'+run.id+'/resume','POST',{})).status).toBe(503);
 await env.DB.prepare('DROP TRIGGER staged_batch_fault').run();
 const partial=await (await f.call('/data/import/runs/'+run.id)).json() as typeof run;
 expect(partial).toMatchObject({state:'applying',checkpoint:3*run.progress.batchSize,progress:{batchesApplied:3,batchesTotal:batches,unfinished:true,lastError:expect.any(String)}});
 expect(await count('SELECT count(*) AS n FROM issues')-before.issues).toBe(partial.checkpoint);
 // Published issues are visible and marked as part of the unfinished run.
 const published=(await env.DB.prepare('SELECT i.identifier FROM issues i JOIN vector_import_revisions v ON v.issue_id=i.id LIMIT 1').first<{identifier:string}>())!;
 expect((await (await f.call('/issues/'+published.identifier)).json() as {importedFrom:unknown}).importedFrom).toMatchObject({source:'linear-workspace',unfinished:true,runId:run.id});
 // A different file under the same run identity conflicts while the run is unfinished.
 const changedCsv=f.generated.csv.replace(f.generated.rows[0].Title,'Changed after export');
 const changed=f.input(changedCsv),changedReview=await f.preview(changed);
 expect(changedReview.errors.some(row=>row.code==='source_content_conflict')).toBe(true);
 // Submitted against the reviewed fingerprint, the changed bytes conflict and write nothing.
 const issuesBefore=await count('SELECT count(*) AS n FROM issues');
 expect((await f.apply(changed,review)).status).toBe(409);
 expect(await count('SELECT count(*) AS n FROM issues')).toBe(issuesBefore);
 run=partial;while(run.progress.unfinished)run=await f.resume(run);
 expect(run).toMatchObject({state:'completed',checkpoint:2000,total:2000,progress:{batchesApplied:batches,batchesTotal:batches,unfinished:false,lastError:null}});
 // Exactly once: one live issue per source record.
 expect(await count('SELECT count(*) AS n FROM issues')-before.issues).toBe(2000);
 expect(await count("SELECT count(DISTINCT json_extract(record_json,'$.sourceId')) AS n FROM ik_provenance WHERE job_id=? AND reversed=0",run.id)).toBe(2000);
 expect(await count('SELECT count(*) AS n FROM vector_import_revisions')).toBe(2000);
 // No notification, mail or webhook for any imported issue.
 expect(await f.effects()).toEqual(before.effects);
 expect(await count('SELECT count(*) AS n FROM rer_mail_development_outbox')).toBe(before.mail);
 // The same review returns the first run with no new rows; after completion a changed file still conflicts.
 const repeated=await f.createRun(value,review);expect(repeated).toMatchObject({id:run.id,state:'completed',checkpoint:2000});
 expect(await count('SELECT count(*) AS n FROM issues')-before.issues).toBe(2000);
 const conflicted=await f.preview(changed) as ImportPreview;
 expect(conflicted.ready).toBe(false);expect(conflicted.errors.some(row=>row.code==='source_content_conflict')).toBe(true);
 expect((await f.apply(changed,review)).status).toBe(409);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
 shared={f,runId:run.id};
},1_800_000);

it('[DATA-007] the reconciliation report equals the database query for query, names omitted columns and unresolved people, and old source IDs still find their issues',async()=>{
 const {f,runId}=shared!,rows=f.generated.rows;
 const report=await (await f.call('/data/import/runs/'+runId+'/report')).json() as {totals:Record<string,number>;dimensions:Record<string,{source:string;read:number;written:number;vector:{name:string;count:number}[]}[]>;omitted:{field?:string;code:string;count:number}[];references:{row:number;sourceId:string;field?:string;value:string;code:string}[];notInFile:string[];mapping:{sourceId:string;identifier:string|null}[]};
 const written=await count("SELECT count(*) AS n FROM ik_provenance p JOIN issues i ON i.id=p.target_id WHERE p.job_id=? AND p.reversed=0",runId);
 expect(report.totals).toMatchObject({rowsRead:rows.length,issuesWritten:written,rowsNotWritten:0});
 // Read side against the file; written side against Vector's tables, one query per breakdown.
 const columns={team:'Team',status:'Status',project:'Project',cycle:'Cycle Name',assignee:'Assignee'} as const;
 const joins={team:"teams v ON v.id=i.team_id",status:"workflow_statuses v ON v.id=i.status_id",project:"projects v ON v.id=i.project_id",cycle:"cycles v ON v.id=i.cycle_id",assignee:"operators v ON v.id=i.assignee_operator_id"} as const;
 for(const field of Object.keys(columns) as (keyof typeof columns)[]) {
  const read=new Map<string,number>();for(const row of rows)read.set(row[columns[field]],(read.get(row[columns[field]])??0)+1);
  expect(Object.fromEntries(report.dimensions[field].map(group=>[group.source,group.read]))).toEqual(Object.fromEntries(read));
  const byVector=new Map<string,number>();
  for(const group of report.dimensions[field])for(const value of group.vector)byVector.set(value.name,(byVector.get(value.name)??0)+value.count);
  const database=(await env.DB.prepare(`SELECT COALESCE(v.name,'(none)') AS name,count(*) AS n FROM ik_provenance p JOIN issues i ON i.id=p.target_id LEFT JOIN ${joins[field]} WHERE p.job_id=? AND p.reversed=0 GROUP BY 1`).bind(runId).all<{name:string;n:number}>()).results;
  expect(Object.fromEntries(byVector),field).toEqual(Object.fromEntries(database.map(row=>[row.name,row.n])));
 }
 // A column Vector does not import, and a person who is not an operator, appear with their counts.
 expect(report.omitted.find(group=>group.field==='SLA Status')?.count).toBe(rows.filter(row=>row['SLA Status']).length);
 const strangers=rows.filter(row=>row.Assignee==='Former Teammate');expect(strangers.length).toBeGreaterThan(0);
 const unresolved=report.references.filter(item=>item.code==='unresolved_assignee');
 expect(unresolved.length).toBe(strangers.length);expect(new Set(unresolved.map(item=>item.value))).toEqual(new Set(['Former Teammate']));
 expect(unresolved.map(item=>item.sourceId).sort()).toEqual(strangers.map(row=>row.ID).sort());
 expect(report.notInFile.join(' ')).toContain('comments');
 // The CSV is the mapping file: every source ID with its Vector identifier.
 const csv=await f.call('/data/import/runs/'+runId+'/report.csv');expect(csv.status).toBe(200);
 const lines=(await csv.text()).trim().split('\r\n');expect(lines.length).toBe(rows.length+1);
 const mapped=(await env.DB.prepare("SELECT json_extract(p.record_json,'$.sourceId') AS source,i.identifier FROM ik_provenance p JOIN issues i ON i.id=p.target_id WHERE p.job_id=? AND p.reversed=0").bind(runId).all<{source:string;identifier:string}>()).results;
 expect(Object.fromEntries(report.mapping.map(row=>[row.sourceId,row.identifier]))).toEqual(Object.fromEntries(mapped.map(row=>[row.source,row.identifier])));
 // A person who types an old Linear ID still finds the work, by search and by the lookup route.
 const sample=mapped.find(row=>row.source==='ENG-17')!;
 const found=await (await f.call('/search?q=ENG-17')).json() as {issues:{identifier:string}[]};
 expect(found.issues.map(issue=>issue.identifier)).toContain(sample.identifier);
 const looked=await f.call('/issues/ENG-17');expect(looked.status).toBe(200);
 expect(await looked.json()).toMatchObject({identifier:sample.identifier,importedFrom:{sourceId:'ENG-17',unfinished:false}});
},600_000);

it('[DATA-004 DATA-006] whole-run rollback names each imported issue with later work and refuses with nothing changed; an untouched run is removed completely',async()=>{
 const {f,runId}=shared!;
 const imported=(await env.DB.prepare('SELECT i.identifier,i.version FROM ik_provenance p JOIN issues i ON i.id=p.target_id WHERE p.job_id=? AND p.reversed=0 ORDER BY i.identifier LIMIT 3').bind(runId).all<{identifier:string;version:number}>()).results;
 const [edited,commented,linked]=imported,native=await f.create({title:'Native work after the move'});
 expect((await f.call('/issues/'+edited.identifier,'PATCH',{expectedVersion:edited.version,title:'Edited after import'})).status).toBe(200);
 expect((await f.call('/issues/'+commented.identifier+'/comments','POST',{body:'Commented after import'})).status).toBe(201);
 expect((await f.call('/issues/'+linked.identifier+'/dependencies','POST',{expectedVersion:linked.version,relatedIdentifier:native.identifier,relatedVersion:native.version,direction:'blocks'})).status).toBe(200);
 const expected=[{identifier:edited.identifier,reasons:['edited']},{identifier:commented.identifier,reasons:['commented']},{identifier:linked.identifier,reasons:['linked']}].sort((a,b)=>a.identifier.localeCompare(b.identifier));
 const preview=await (await f.call('/data/import/runs/'+runId+'/rollback')).json() as {issues:number;conflicts:{identifier:string;reasons:string[]}[]};
 expect(preview.issues).toBe(2000);expect(preview.conflicts.map(({identifier,reasons})=>({identifier,reasons}))).toEqual(expected);
 const before=await tableCounts();
 const refused=await f.call('/data/import/runs/'+runId+'/rollback','POST',{confirmed:true});
 expect(refused.status).toBe(409);expect(((await refused.json()) as {conflicts:{identifier:string}[]}).conflicts.map(row=>row.identifier)).toEqual(expected.map(row=>row.identifier));
 expect(await tableCounts()).toEqual(before);
 expect(await count("SELECT count(*) AS n FROM ik_jobs WHERE id=? AND state='completed'",runId)).toBe(1);
 // A second, untouched run is removed whole, in staged reversal batches.
 const second=f.input(f.workspace(500,7).csv,'linear-second'),review=await f.preview(second);
 expect(review.errors).toEqual([]);
 let run=await f.createRun(second,review);while(run.progress.unfinished)run=await f.resume(run);
 // Old due dates do not flood the Inbox or block the undo: the Cron sweep finds
 // their one overdue reminder already consumed at import.
 expect(await count("SELECT count(*) AS n FROM due_reminder_suppressions s JOIN ik_provenance p ON p.target_id=s.issue_id WHERE p.job_id=?",run.id)).toBeGreaterThan(0);
 await sendDueReminders({DB:env.DB},new Date());
 expect(await count('SELECT count(*) AS n FROM notifications n JOIN ik_provenance p ON p.target_id=n.issue_id WHERE p.job_id=?',run.id)).toBe(0);
 const reserved=(await env.DB.prepare('SELECT identifier_prefix,last_sequence FROM issue_prefix_sequences ORDER BY identifier_prefix').all()).results;
 const removable=await (await f.call('/data/import/runs/'+run.id+'/rollback')).json() as {issues:number;rows:Record<string,number>;conflicts:unknown[]};
 expect(removable.issues).toBe(500);expect(removable.conflicts).toEqual([]);
 const inCycles=await count('SELECT count(*) AS n FROM ik_provenance p JOIN issues i ON i.id=p.target_id WHERE p.job_id=? AND p.reversed=0 AND i.cycle_id IS NOT NULL',run.id);
 expect(inCycles).toBeGreaterThan(0);
 const beforeRollback=await tableCounts();
 let reversed=await f.call('/data/import/runs/'+run.id+'/rollback','POST',{confirmed:true});expect(reversed.status).toBe(200);
 run=await reversed.json() as typeof run;while(run.progress.unfinished)run=await f.resume(run);
 expect(run.state).toBe('rolled_back');
 const afterRollback=await tableCounts();
 // Exactly the rows the preview named are gone; native tables outside them are unchanged.
 const kit=(name:string)=>name.startsWith('ik_')||['access_rate_limits','oa_limits','vector_import_runs'].includes(name);
 const changes=Object.fromEntries(Object.keys(beforeRollback).filter(name=>!kit(name)&&beforeRollback[name]!==afterRollback[name]).map(name=>[name,beforeRollback[name]-afterRollback[name]]));
 const named=Object.fromEntries(Object.entries(removable.rows).filter(([,n])=>n>0));
 // Derived records: the search index drops the issues, and the append-only cycle
 // history records each removed issue leaving its cycle, as any deletion does.
 const derived=Object.keys(changes).filter(name=>name.startsWith('search_issues')||name==='cycle_membership_events');
 expect(Object.fromEntries(Object.entries(changes).filter(([name])=>!derived.includes(name)))).toEqual(named);
 expect(changes.cycle_membership_events).toBe(-inCycles);
 console.log('rollback-row-counts',JSON.stringify(Object.keys(changes).map(table=>({table,before:beforeRollback[table],after:afterRollback[table]}))));
 expect((await env.DB.prepare('SELECT identifier_prefix,last_sequence FROM issue_prefix_sequences ORDER BY identifier_prefix').all()).results).toEqual(reserved);
 // The original file stays retained, byte for byte, as Base's design keeps audit custody.
 const originals=await (await f.call('/data/import/runs/'+run.id+'/originals')).json() as {original:{base64:string}}[];
 expect(originals[0].original.base64).toBe(second.base64);
 // Who may preview or roll back a run.
 const app=createServerApp(),raw=(path:string,method:string,headers:Record<string,string>)=>app.request(origin+path,{method,headers:{host:new URL(origin).host,'content-type':'application/json',...headers},body:method==='POST'?JSON.stringify({confirmed:true}):undefined},bindings);
 const token=await f.call('/settings/integrations/tokens','POST',{name:'Import probe',scopes:['issues:read','issues:write']});expect(token.status).toBe(201);
 const bearer=(await token.json() as {token:string}).token;
 const statuses:Record<string,number>={
  'signed out GET':(await raw('/api/data/import/runs/'+runId+'/rollback','GET',{origin})).status,
  'signed out POST':(await raw('/api/data/import/runs/'+runId+'/rollback','POST',{origin})).status,
  'cross-origin POST':(await raw('/api/data/import/runs/'+runId+'/rollback','POST',{origin:'https://elsewhere.example',cookie:f.cookie})).status,
  'API token GET':(await raw('/api/data/import/runs/'+runId+'/rollback','GET',{origin,authorization:'Bearer '+bearer})).status,
  'API token POST':(await raw('/api/data/import/runs/'+runId+'/rollback','POST',{origin,authorization:'Bearer '+bearer})).status,
  'unknown run id':(await f.call('/data/import/runs/00000000-0000-4000-8000-000000000000/rollback')).status,
  "another operator's run":(await raw('/api/data/import/runs/'+runId+'/rollback','GET',{origin,cookie:f.mayaCookie})).status,
 };
 expect((await f.call('/settings/operators/'+f.maya,'DELETE')).status).toBe(200);
 statuses['removed operator']=(await raw('/api/data/import/runs/'+runId+'/rollback','GET',{origin,cookie:f.mayaCookie})).status;
 console.log('rollback-route-statuses',JSON.stringify(statuses));
 expect(statuses).toEqual({'signed out GET':401,'signed out POST':401,'cross-origin POST':403,'API token GET':401,'API token POST':401,'unknown run id':409,"another operator's run":409,'removed operator':401});
 expect(await count("SELECT count(*) AS n FROM ik_jobs WHERE id=? AND state='completed'",runId)).toBe(1);
},1_800_000);
