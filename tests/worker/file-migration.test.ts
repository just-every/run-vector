import { env } from 'cloudflare:workers';
import { expect,it } from 'vitest';
import { setupImport } from './data-import-fixture';
import { actor,bindings,invite,request } from './base-auth-fixture';
import { createServerApp } from '../../src/core/app/server';
import { httpExport,archiveRows,freshTarget,stageArchive,targetCall,targetSignIn,finalBody } from './http-archive-fixture';
import type { migrationReport } from '../../src/core/features/data/migrations/report';
type Report=Awaited<ReturnType<typeof migrationReport>>;
const custody=['vector_migration_erased_sources','vector_file_migrations','vector_migration_runs','vector_migration_references','issues','ik_jobs','audit_records'];
const snapshot=async()=>Promise.all(custody.map(async table=>({table,rows:(await env.DB.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()).results})));

it('[DATA-017] reviewed file runs retain exact missing endpoints and finish only by current explicit acceptance, once across restart and restore',async()=>{
  const f=await setupImport(),source='synthetic-vector-1701';
  const json=async(path:string,method='GET',body?:unknown)=>{const response=await f.call(path,method,body);expect(response.status,await response.clone().text()).toBe(200);return response.json() as Promise<Report>;};
  const created=await f.call('/data/migrations','POST',{source});expect(created.status,await created.clone().text()).toBe(200);
  const migration=await created.json() as {id:string},path='/data/migrations/'+migration.id;
  const value=(id:string,target:string)=>({...f.input([f.row(id,{dependencies:'source:'+target})],source),migrationId:migration.id});
  const firstInput=value('synthetic-vector-1702','synthetic-vector-1799'),firstReview=await f.preview(firstInput);
  expect(firstReview.pending).toEqual([{row:1,sourceId:'synthetic-vector-1702',targetSourceId:'synthetic-vector-1799',kind:'dependencies'}]);
  const first=await f.finish(await (await f.apply(firstInput,firstReview)).json() as never);
  const old=await json(path);expect(old.runs.map(run=>run.id)).toEqual([first.id]);
  const stale={version:old.migration.version,acceptPending:true,pendingIds:old.pending.map(row=>row.id)};
  const second=await f.publish(value('synthetic-vector-1703','synthetic-vector-1798'));
  const report=await json(path);
  expect(report.pending.map(({sourceId,targetSourceId,kind,runId,row})=>({sourceId,targetSourceId,kind,runId,row})).sort((a,b)=>a.sourceId.localeCompare(b.sourceId))).toEqual([
    {sourceId:'synthetic-vector-1702',targetSourceId:'synthetic-vector-1799',kind:'dependencies',runId:first.id,row:1},
    {sourceId:'synthetic-vector-1703',targetSourceId:'synthetic-vector-1798',kind:'dependencies',runId:second.id,row:1},
  ]);
  expect(report.totals).toEqual({rowsRead:2,issuesWritten:2});expect(report.omissions).toEqual([]);
  const csv=await (await f.call(path+'/report.csv')).text();
  for(const ref of report.pending)expect(csv).toContain([ref.id,ref.runId,ref.row,ref.sourceId,ref.kind,ref.targetSourceId,'pending'].map(value=>'"'+value+'"').join(','));
  const before=await snapshot();
  for(const body of [{},{version:report.migration.version,acceptPending:false,pendingIds:report.pending.map(row=>row.id)},stale,{version:report.migration.version,acceptPending:true,pendingIds:[]}]) {
    expect([400,409]).toContain((await f.call(path+'/finish','POST',body)).status);expect(await snapshot()).toEqual(before);
  }
  // Standalone imports retain missing-reference refusal; no migration is inferred.
  const ordinary=f.input([f.row('synthetic-vector-1710',{dependencies:'source:synthetic-vector-1799'})],'synthetic-vector-standalone');
  const refused=await f.preview(ordinary);expect(refused.ready).toBe(false);expect(refused.errors.some(row=>row.code==='invalid_issue_reference')).toBe(true);
  const mismatch={...value('synthetic-vector-1711','synthetic-vector-1799'),source:'synthetic-vector-other'};
  expect((await f.call('/data/import/preview','POST',mismatch)).status).toBe(409);
  const memberCookie=await invite(['synthetic-vector-member','vector.test'].join('@'),f.cookie),adminCookie=await invite(['synthetic-vector-admin','vector.test'].join('@'),f.cookie,'admin'),admin=await actor(adminCookie);
  const accept={version:report.migration.version,acceptPending:true,pendingIds:report.pending.map(row=>row.id)};
  const held=await snapshot();
  for(const [door,method,body] of [[path,'GET',undefined],[path+'/report.csv','GET',undefined],[path+'/finish','POST',accept],['/data/migrations','POST',{source:'synthetic-vector-member'}]] as const)
    expect((await request('/api'+door,method,body,memberCookie)).status).toBe(403);
  expect(await snapshot()).toEqual(held);
  // The current role is used, including a credential minted before demotion.
  expect((await f.call('/settings/operators/'+admin+'/role','PATCH',{role:'member',teamIds:[]})).status).toBe(200);
  expect((await request('/api'+path+'/finish','POST',accept,adminCookie)).status).toBe(403);
  expect((await f.call('/settings/operators/'+admin+'/role','PATCH',{role:'admin',teamIds:[]})).status).toBe(200);
  const targetCookie=await freshTarget();
  expect((await targetCall('/api'+path,'GET',undefined,targetCookie)).status).toBe(409);
  expect((await targetCall('/api'+path+'/finish','POST',accept,targetCookie)).status).toBe(409);
  // Native changes still prevent repeat and rollback. Finishing never edits issues.
  const mapping=report.reports[0].report.mapping[0],detail=await f.call('/issues/'+mapping.identifier);const issue=await detail.json() as {version:number};
  expect((await f.call('/issues/'+mapping.identifier,'PATCH',{title:'Native work retained',expectedVersion:issue.version})).status).toBe(200);
  const again=await f.preview(firstInput);expect(again.ready).toBe(false);
  expect((await f.call('/data/import/runs/'+first.id+'/rollback','POST',{confirmed:true})).status).toBe(409);
  const [finished,concurrent]=await Promise.all([request('/api'+path+'/finish','POST',accept,adminCookie),request('/api'+path+'/finish','POST',accept,f.cookie)]);expect(finished.status,await finished.clone().text()).toBe(200);expect(concurrent.status,await concurrent.clone().text()).toBe(200);
  const result=await finished.json() as Report;expect(result.migration.state).toBe('finished');expect(result.pending).toEqual([]);expect(result.omissions.map(row=>row.id).sort()).toEqual(accept.pendingIds.sort());
  expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_records WHERE action='migration.finished' AND subject_id=?").bind(migration.id).first<number>('n')).toBe(1);
  const restart=()=>createServerApp().request(bindings.APP_ORIGIN+'/api'+path+'/finish',{method:'POST',headers:{host:new URL(bindings.APP_ORIGIN).host,Origin:bindings.APP_ORIGIN,cookie:adminCookie,'Content-Type':'application/json'},body:JSON.stringify(accept)},bindings);
  const terminal=await snapshot(),replayed=await restart();expect(replayed.status,await replayed.clone().text()).toBe(200);expect(await snapshot()).toEqual(terminal);
  expect((await f.call('/data/import/preview','POST',value('synthetic-vector-1712','synthetic-vector-1799'))).status).toBe(409);
  // Export and restore through mounted native archive routes preserve acceptance.
  const records=await httpExport(f.call);
  expect(archiveRows(records,'vector_migration_references').map(row=>row.state)).toEqual(['omitted','omitted']);
  const job=await stageArchive(records,targetCookie),restored=await targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),targetCookie);expect(restored.status,await restored.clone().text()).toBe(200);
  const historical=await targetSignIn(),restoredReport=await targetCall('/api'+path,'GET',undefined,historical);expect(restoredReport.status).toBe(200);
  expect((await restoredReport.json() as Report).omissions).toEqual(result.omissions);
  expect((await targetCall('/api'+path+'/finish','POST',accept,historical)).status).toBe(200);
  expect((await request('/auth/signout','POST',{},adminCookie)).status).toBe(204);
  const signedOut=await snapshot();expect((await request('/api'+path+'/finish','POST',accept,adminCookie)).status).toBe(401);expect(await snapshot()).toEqual(signedOut);
  // Personal source IDs and pending targets are erased with import custody.
  const erasedSource='synthetic-vector-erase-migration',eraseCreated=await f.call('/data/migrations','POST',{source:erasedSource}),eraseId=(await eraseCreated.json() as {id:string}).id;
  const erasedName='Synthetic Vector Erased Person',erasedInput={...f.input([f.row(erasedName,{dependencies:'source:'+erasedName+' endpoint'})],erasedSource),migrationId:eraseId};
  await f.publish(erasedInput);
  const erasure=await f.call('/data/erasure','POST',{subject:{names:[erasedName]},confirmation:'erase '+erasedName});expect(erasure.status,await erasure.clone().text()).toBe(200);
  const erasedReport=await json('/data/migrations/'+eraseId);expect(JSON.stringify(erasedReport)).not.toContain(erasedName);expect(erasedReport.pending).toEqual([]);
  const erasedReview=await f.preview(erasedInput);expect(erasedReview.ready).toBe(false);expect(erasedReview.errors.some(row=>row.code==='source_erased')).toBe(true);
  const pendingPerson='Synthetic Vector Absent Person',privacyInput={...f.input([f.row('synthetic-vector-1715',{dependencies:'source:'+pendingPerson})],erasedSource),migrationId:eraseId};
  await f.publish(privacyInput);
  const removedEndpoint=await f.call('/data/erasure','POST',{subject:{names:[pendingPerson]},confirmation:'erase '+pendingPerson});expect(removedEndpoint.status,await removedEndpoint.clone().text()).toBe(200);
  expect((await json('/data/migrations/'+eraseId)).pending).toEqual([]);
  const rebound={...f.input([f.row('synthetic-vector-1716',{dependencies:'source:'+pendingPerson})],erasedSource),migrationId:eraseId};
  const noResurrection=await f.preview(rebound);expect(noResurrection.ready).toBe(false);expect(noResurrection.errors.some(row=>row.code==='source_erased')).toBe(true);
  const absentEndpoint=await f.preview({...f.input([f.row(pendingPerson)],erasedSource),migrationId:eraseId});expect(absentEndpoint.ready).toBe(false);expect(absentEndpoint.errors.some(row=>row.code==='source_erased')).toBe(true);
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
},180000);
