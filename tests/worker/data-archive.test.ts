import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeAll, expect, inject, it } from 'vitest';
import { createWebhookProtocol } from '../../vendor/base/integrations';
import { erasedSourceIdentity } from '../../src/core/features/integrations/source-identity';
import { readArchive } from '@runeditrun/rer/modules/portability';
import { createVectorArchive } from '../../src/core/features/data/archive-service.mjs';
import { actor, bindings, invite, request } from './base-auth-fixture';
import { closureFixture } from './cycle-closure-fixture';
import { createServerApp } from '../../src/core/app/server';
import { scheduled } from '../../src/core/app/scheduled';
import { drainNotificationMail } from '../../src/core/features/notifications/mail';
import { cycleDetailSchema } from '../../src/core/features/administration/schema';
const target=(env as unknown as {ARCHIVE_TARGET_DB:D1Database,ARCHIVE_TARGET_FILES:R2Bucket});
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await applyD1Migrations(target.ARCHIVE_TARGET_DB,inject('migrations'));});
async function records(service:Awaited<ReturnType<typeof createVectorArchive>>) {
 const id=await service.exports.create();
 while((await service.exports.advance(id,{maxParts:16})).phase==='building'){}
 const result=[];for await(const record of readArchive(await service.exports.download(id)))result.push(record);
 await service.exports.abort(id);return result;
}
it('[DATA-001 DATA-005 BASE-DATA-001] native archive restores identities, files, search and history with fresh owner-only access and held effects',async()=>{
 expect((await request('/health')).status).toBe(200);
 const f=await closureFixture(),{cookie,owner}=f,peerCookie=await invite('peer@archive.test',cookie),peer=await actor(peerCookie);
 const project=(await f.mutate('/settings/projects','POST',{name:'Archive history',leadOperatorId:owner})).projects[0];
 const issue=await f.create({title:'Restorable evidence',description:'Archive description',statusId:f.team.statuses.find(s=>s.category==='unstarted')!.id,cycleId:f.closing.id,projectId:project.id,estimate:5});
 // Only the fixture clock changes: creation and both closures use the public product doors.
 const addedAt='2026-09-02T00:00:00.000Z',closedAt='2026-09-08T00:01:00.000Z',failedAt='2026-09-15T00:01:00.000Z';
 await env.DB.prepare('UPDATE cycle_membership_events SET occurred_at=? WHERE identifier=?').bind(addedAt,issue.identifier).run();
 await scheduled({scheduledTime:Date.parse(closedAt)},bindings);
 const closed=await f.detail();
 expect(closed.snapshot).toMatchObject({closedAt,timezone:'UTC',capacity:15,estimateTotal:5,committed:[{identifier:issue.identifier,projectId:project.id,estimate:5,category:'unstarted'}],changes:[{identifier:issue.identifier,direction:'added',at:addedAt}],progress:{unit:'points',total:5,completed:0}});
 expect(closed.failure).toBeNull();
 expect((await (await f.call('/issues/'+issue.identifier)).json() as {cycle:{id:string}}).cycle.id).toBe(f.destination!.id);
 await scheduled({scheduledTime:Date.parse(failedAt)},bindings);
 const failedResponse=await f.call('/cycles/'+f.destination!.id);
 expect(failedResponse.status).toBe(200);
 const failed=cycleDetailSchema.parse(await failedResponse.json());
 expect(failed.snapshot).toMatchObject({closedAt:failedAt,committed:closed.snapshot!.committed,changes:[{identifier:issue.identifier,direction:'added',at:closedAt}]});
 expect(failed.failure).toEqual({identifiers:[issue.identifier],createdAt:failedAt});
 expect((await f.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:3,estimate:8,projectId:null})).status).toBe(200);
 const historyResponse=await f.call('/projects/'+project.id);
 expect(historyResponse.status).toBe(200);
 const history=(await historyResponse.json() as {cycleHistory:unknown[]}).cycleHistory;
 expect(history).toEqual([{cycleId:f.destination!.id,name:f.destination!.name,snapshot:failed.snapshot},{cycleId:f.closing.id,name:f.closing.name,snapshot:closed.snapshot}]);
 expect((await f.detail()).snapshot).toEqual(closed.snapshot);
 const memberships=(db:D1Database)=>db.prepare('SELECT id,cycle_id,identifier,direction,occurred_at FROM cycle_membership_events ORDER BY cycle_id,occurred_at,id').all();
 const sourceMemberships=(await memberships(env.DB)).results;
 expect(sourceMemberships).toHaveLength(4);
 const at='2026-10-01T00:00:00.000Z';
 await env.DB.batch([
  env.DB.prepare('INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('01K00000000000000000000001',issue!.id,peer,'Restored searchable comment',at,at),
  env.DB.prepare('INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('01K00000000000000000000002',issue!.id,owner,'one.txt','text/plain',3,'archive-one',at,at),
  env.DB.prepare('INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('01K00000000000000000000003',issue!.id,peer,'two.bin','application/octet-stream',4,'archive-two',at,at),
 ]);
 await env.FILES.put('archive-one','one',{httpMetadata:{contentType:'text/plain'},customMetadata:{fixture:'first'}});
 await env.FILES.put('archive-two',new Uint8Array([0,1,2,255]),{httpMetadata:{contentType:'application/octet-stream'}});
 for(const [index,state] of ['pending','accepted','uncertain'].entries()) {
  const id='archive-history-'+index;
  await env.DB.prepare(`INSERT INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at,read_at) VALUES(?,?,?,?,?,?,?, ?,?)`).bind(id,id,issue!.id,peer,owner,'Owner','["mention"]',at,index?at:null).run();
  await env.DB.prepare(`INSERT INTO notification_deliveries(id,notification_id,recipient_id,actor_id,actor_name,identifier,title,app_link,status,attempts,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,id,peer,owner,'Owner',issue!.identifier,'Archive history',bindings.APP_ORIGIN+'/app/issues/'+issue!.identifier,state,index?1:0,at,at).run();
 }
 const canonical=await f.create({title:'Archive canonical'}),duplicate=await f.create({title:'Archive duplicate'});
 expect((await f.call('/issues/'+duplicate.identifier+'/duplicate','POST',{expectedVersion:duplicate.version,canonicalIdentifier:canonical.identifier})).status).toBe(200);
 const erased=await f.create({title:'Deleted before archive'});
 await env.DB.prepare("INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,writer_settled,created_at,updated_at) VALUES('archive-unsettled',?,?,'Pending original','text/plain',3,'archive-unsettled','pending',0,?,?)").bind(erased.id,owner,at,at).run();
 const deletion=await f.call('/issues/'+erased.identifier,'DELETE',{expectedVersion:erased.version,confirmed:true});expect(deletion.status,await deletion.clone().text()).toBe(202);const deletionReceipt=await deletion.json();
 const configured=await f.call('/settings/integrations/sources','POST',{name:'Archive source',sourceId:'archive-source',teamId:f.team.id});
 expect(configured.status).toBe(201);
 let sourceConfig=await configured.json() as {id:string;workspaceId:string;sourceId:string;secret:string;receiver:string};
 const sourceInput={teamId:f.team.id,title:'Private archived source',sourceRecordId:'archive-customer@example.test',sourceRevisionId:'private-revision@example.test',observedAt:at};
 const sourcePeer={...sourceInput,title:'Independent raw source',sourceRecordId:await erasedSourceIdentity(sourceInput.sourceRecordId),sourceRevisionId:await erasedSourceIdentity(sourceInput.sourceRevisionId)};
 async function signal(input:typeof sourceInput,environment:typeof bindings=bindings){
  const protocol=createWebhookProtocol({resolveDestination:async()=>sourceConfig.receiver,signingKey:async()=>new Uint8Array(sourceConfig.secret.match(/../g)!.map(pair=>parseInt(pair,16)))});
  const wire=await protocol.prepare({id:crypto.randomUUID(),tenant:sourceConfig.workspaceId,destinationId:sourceConfig.sourceId,event:'signal.revision',protocol:'webhook',body:JSON.stringify(input)},Date.now());
  return createServerApp().request(sourceConfig.receiver,{method:'POST',headers:wire.headers,body:wire.body},environment);
 }
 const signalResponse=await signal(sourceInput);expect(signalResponse.status).toBe(200);
 const signalIssue=await signalResponse.json() as {identifier:string};
 expect((await signal(sourcePeer)).status).toBe(200);
 expect((await f.call('/issues/'+signalIssue.identifier,'DELETE',{expectedVersion:1,confirmed:true})).status).toBe(200);
 const sourceRows=async(db:D1Database)=>({records:(await db.prepare('SELECT * FROM vector_source_records WHERE source_id=? ORDER BY erased,record_id').bind(sourceConfig.id).all()).results,receipts:(await db.prepare('SELECT * FROM vector_source_receipts WHERE source_id=? ORDER BY erased,record_id,revision_id').bind(sourceConfig.id).all()).results});
 const sourceBefore=await sourceRows(env.DB);
 const source=await createVectorArchive({db:env.DB,files:env.FILES});
 const destination=await createVectorArchive({db:target.ARCHIVE_TARGET_DB,files:target.ARCHIVE_TARGET_FILES});
 const archive=await records(source),manifest=archive[0] as any,closing=archive.at(-1) as any;
 expect(manifest.tables.some((t:any)=>t.name==='oa_operators')).toBe(true);
 expect(manifest.tables.some((t:any)=>t.name==='vector_auth_operators')).toBe(true);
 for(const name of ['oa_sessions','oa_tokens','operator_sessions','rer_mail_development_outbox'])expect(manifest.tables.some((t:any)=>t.name===name)).toBe(false);
 await expect(destination.imports.create({...manifest,requiredConfiguration:manifest.requiredConfiguration.map((name:string)=>name==='MAIL_MODE'?'UNRELATED_CONFIGURATION':name)})).rejects.toThrow('configuration_inventory');
 const id=await destination.imports.create(manifest);
 for(const record of archive.filter((r:any)=>r.kind==='part') as any[])await destination.imports.uploadPart(id,record.index,record);
 await destination.imports.finalize(id,{contentHash:closing.contentHash,archiveHash:closing.archiveHash});
 expect((await target.ARCHIVE_TARGET_DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
 expect((await target.ARCHIVE_TARGET_DB.prepare("SELECT count(*) AS n FROM search_issues WHERE search_issues MATCH 'searchable'").first())?.n).toBe(1);
 expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM oa_sessions').first())?.n).toBe(0);
 expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT effects_held AS held FROM vector_restore_status').first())?.held).toBe(1);
 const next=await records(destination);expect((next.at(-1) as any).contentHash).toBe(closing.contentHash);
 const first=(await target.ARCHIVE_TARGET_FILES.get('archive-one'))!;expect(await first.text()).toBe('one');expect(first.httpMetadata.contentType).toBe('text/plain');expect(first.customMetadata).toEqual({fixture:'first'});
 expect(new Uint8Array(await (await target.ARCHIVE_TARGET_FILES.get('archive-two'))!.arrayBuffer())).toEqual(new Uint8Array([0,1,2,255]));
 const app=createServerApp(),restored={...bindings,DB:target.ARCHIVE_TARGET_DB,FILES:target.ARCHIVE_TARGET_FILES};
 const call=(path:string,method='GET',body?:unknown,session='')=>app.request(restored.APP_ORIGIN+path,{method,headers:{Origin:restored.APP_ORIGIN,host:new URL(restored.APP_ORIGIN).host,'Content-Type':'application/json',cookie:session},body:body===undefined?undefined:JSON.stringify(body)},restored);
 expect((await call('/api/cycles/'+f.closing.id,'GET',undefined,cookie)).status).toBe(401);
 expect((await call('/auth/request','POST',{email:'peer@archive.test'})).status).toBe(409);
 expect((await call('/auth/request','POST',{email:bindings.FIRST_OWNER_EMAIL!})).status).toBe(202);
 const mail=(await target.ARCHIVE_TARGET_DB.prepare("SELECT json_extract(message,'$.text') AS text FROM rer_mail_development_outbox ORDER BY sequence DESC LIMIT 1").first<{text:string}>())!;
 const token=new URL(mail.text.match(/https?:\/\/[^\s]+/)![0]).searchParams.get('token');
 const signed=await call('/auth/confirm','POST',{token});expect(signed.status).toBe(303);
 const restoredCookie=signed.headers.get('set-cookie')!.split(';')[0];
 expect(await sourceRows(target.ARCHIVE_TARGET_DB)).toEqual(sourceBefore);
 expect(await target.ARCHIVE_TARGET_DB.prepare('SELECT count(*) n FROM vector_integration_secret_keys').first('n')).toBe(0);
 const rotated=await call('/api/settings/integrations/sources/'+sourceConfig.id+'/rotate','POST',{overlapHours:0},restoredCookie);
 expect(rotated.status).toBe(200);sourceConfig={...sourceConfig,...await rotated.json() as {secret:string}};
 expect((await signal(sourceInput,restored)).status).toBe(401);
 expect(await (await call('/api/issues/'+erased.identifier+'/deletion','GET',undefined,restoredCookie)).json()).toEqual(deletionReceipt);
 expect((await call('/api/issues/'+erased.identifier,'GET',undefined,restoredCookie)).status).toBe(404);
 expect((await (await call('/api/issues/'+canonical.identifier,'GET',undefined,restoredCookie)).json() as any).duplicates.map((row:any)=>row.identifier)).toEqual([duplicate.identifier]);
 expect(await target.ARCHIVE_TARGET_DB.prepare("SELECT writer_settled FROM detached_file_removals WHERE id='archive-unsettled'").first<number>('writer_settled')).toBe(0);

 const restoredCycle=async(cycleId:string)=>{
  const response=await call('/api/cycles/'+cycleId,'GET',undefined,restoredCookie);
  expect(response.status).toBe(200);return cycleDetailSchema.parse(await response.json());
 };
 expect(await restoredCycle(f.closing.id)).toEqual(closed);
 expect(await restoredCycle(f.destination!.id)).toEqual(failed);
 const restoredHistory=await call('/api/projects/'+project.id,'GET',undefined,restoredCookie);
 expect(restoredHistory.status).toBe(200);
 expect((await restoredHistory.json() as {cycleHistory:unknown[]}).cycleHistory).toEqual(history);
 expect((await memberships(target.ARCHIVE_TARGET_DB)).results).toEqual(sourceMemberships);
 for(const [sql,cycleId] of [
  ['UPDATE cycles SET closed_at=NULL WHERE id=?',f.closing.id],
  ["UPDATE cycle_snapshots SET body_json='{}' WHERE cycle_id=?",f.closing.id],
  ['DELETE FROM cycle_snapshots WHERE cycle_id=?',f.closing.id],
  ["UPDATE cycle_closure_failures SET identifiers_json='[]' WHERE cycle_id=?",f.destination!.id],
  ['DELETE FROM cycle_closure_failures WHERE cycle_id=?',f.destination!.id],
 ])await expect(target.ARCHIVE_TARGET_DB.prepare(sql).bind(cycleId).run()).rejects.toThrow();
 expect((await call('/api/issues/'+issue.identifier,'PATCH',{expectedVersion:4,cycleId:f.closing.id},restoredCookie)).status).toBe(400);
 expect(await restoredCycle(f.closing.id)).toEqual(closed);
 expect(await restoredCycle(f.destination!.id)).toEqual(failed);
 expect(await drainNotificationMail(restored,{scheduled:true})).toEqual({processed:0});
 await target.ARCHIVE_TARGET_DB.prepare('UPDATE vector_restore_status SET effects_held=0 WHERE id=1').run();
 expect((await signal(sourceInput,restored)).status).toBe(410);
 expect((await signal({...sourceInput,title:'Conflicting restored revision'},restored)).status).toBe(409);
 expect((await signal({...sourceInput,sourceRevisionId:'new-after-restore'},restored)).status).toBe(410);
 expect((await signal(sourcePeer,restored)).status).toBe(200);
 expect(await sourceRows(target.ARCHIVE_TARGET_DB)).toEqual(sourceBefore);
 expect(await drainNotificationMail(restored,{scheduled:true})).toEqual({processed:0});
 expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT status FROM notification_deliveries ORDER BY id').all()).results.map(row=>row.status)).toEqual(['pending','accepted','uncertain']);
 await expect(destination.imports.create(manifest).then(async second=>{
  for(const record of archive.filter((r:any)=>r.kind==='part') as any[])await destination.imports.uploadPart(second,record.index,record);
  await destination.imports.finalize(second,{contentHash:closing.contentHash,archiveHash:closing.archiveHash});
 })).rejects.toThrow();
 console.info('cycle-archive-roundtrip-receipt',JSON.stringify({closedCycles:history.length,committedSnapshots:[closed,failed].filter(cycle=>cycle.snapshot!.committed.length>0).length,closureFailures:[closed,failed].filter(cycle=>cycle.failure!==null).length,membershipEvents:sourceMemberships.length,archiveContentHashMatches:(next.at(-1) as any).contentHash===closing.contentHash}));
},180_000);
