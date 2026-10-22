import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {beforeAll,expect,inject,it} from 'vitest';
import {createVectorArchive} from '../../src/core/features/data/archive-service.mjs';
import {readArchive,makePart} from '@runeditrun/rer/modules/portability';
import {ContentVerifier} from '@runeditrun/rer/modules/portability/format';
import {bindings,request,signIn,actor,invite} from './base-auth-fixture';
import {createServerApp} from '../../src/core/app/server';
const target=env as unknown as {ARCHIVE_TARGET_DB:D1Database,ARCHIVE_TARGET_FILES:R2Bucket};
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await applyD1Migrations(target.ARCHIVE_TARGET_DB,inject('migrations'));});
it('[DATA-001 DATA-005 BASE-DATA-001] bad native references roll back publication and owned bytes; unknown data and missing attachments refuse export',async()=>{
 expect((await request('/health')).status).toBe(200);
 const cookie=await signIn(),owner=await actor(cookie),team=(await env.DB.prepare('SELECT id FROM teams').first<{id:string}>())!;
 const created=await request('/api/issues','POST',{title:'Atomic restoration',teamId:team.id},cookie);expect(created.status).toBe(201);
 const issue=await created.json() as {id:string};
 await env.DB.prepare(`INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind('01K00000000000000000000009',issue.id,owner,'retained.txt','text/plain',3,'retained-file','2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z').run();
 await env.FILES.put('retained-file','one');
 const source=await createVectorArchive({db:env.DB,files:env.FILES}),destination=await createVectorArchive({db:target.ARCHIVE_TARGET_DB,files:target.ARCHIVE_TARGET_FILES});
 const exported=await source.exports.create();while((await source.exports.advance(exported,{maxParts:16})).phase==='building'){}
 const records:any[]=[];for await(const record of readArchive(await source.exports.download(exported)))records.push(record);await source.exports.abort(exported);
 const manifest=records[0],verifier=new ContentVerifier(manifest),id=await destination.imports.create(manifest);
 for(const record of records.filter(row=>row.kind==='part')) {
  for(const item of record.items)if(item.kind==='row'&&item.table==='issue_files')item.row.actor_operator_id='01K00000000000000000000099';
  const part=await makePart(record.index,record.items);for(const item of part.items)verifier.add(item);
  await destination.imports.uploadPart(id,part.index,part);
 }
 await expect(destination.imports.finalize(id,{contentHash:verifier.digest()})).rejects.toThrow();
 expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM operators').first())?.n).toBe(0);
 expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM issues').first())?.n).toBe(0);
 expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM vector_restore_status').first())?.n).toBe(0);
 expect((await target.ARCHIVE_TARGET_FILES.list()).objects).toEqual([]);
 expect(await (await env.FILES.get('retained-file'))!.text()).toBe('one');
 expect((await destination.imports.status(id)).phase).toBe('staging');await destination.imports.abort(id);
 expect((await destination.imports.status(id)).phase).toBe('aborted');
 // A removed historical setup owner must not make an archive inaccessible;
 // the last Owner stays, so the replacement is invited as an Owner.
 await invite('replacement@archive.test',cookie,'owner');
 expect((await request('/api/settings/operators/'+owner,'DELETE',undefined,cookie)).status).toBe(200);
 const next=await source.exports.create();while((await source.exports.advance(next,{maxParts:16})).phase==='building'){}
 const replacement:any[]=[];for await(const record of readArchive(await source.exports.download(next)))replacement.push(record);await source.exports.abort(next);
 const restoredId=await destination.imports.create(replacement[0]);
 for(const part of replacement.filter(row=>row.kind==='part'))await destination.imports.uploadPart(restoredId,part.index,part);
 await destination.imports.finalize(restoredId,{contentHash:replacement.at(-1).contentHash,archiveHash:replacement.at(-1).archiveHash});
 expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM vector_restore_operator_grants').first())?.n).toBe(0);
 const app=createServerApp(),restored={...bindings,DB:target.ARCHIVE_TARGET_DB,FILES:target.ARCHIVE_TARGET_FILES,FIRST_OWNER_EMAIL:'replacement@archive.test'};
 const call=(path:string,method='GET',body?:unknown,session='')=>app.request(restored.APP_ORIGIN+path,{method,headers:{host:new URL(restored.APP_ORIGIN).host,Origin:restored.APP_ORIGIN,'Content-Type':'application/json',cookie:session},body:body===undefined?undefined:JSON.stringify(body)},restored);
 expect((await call('/health')).status).toBe(200);
 expect((await call('/auth/request','POST',{email:'uninvited@archive.test'})).status).toBe(409);
 expect((await call('/auth/request','POST',{email:'replacement@archive.test'})).status).toBe(202);
 const mail=(await target.ARCHIVE_TARGET_DB.prepare("SELECT json_extract(message,'$.text') AS text FROM rer_mail_development_outbox ORDER BY sequence DESC LIMIT 1").first<{text:string}>())!;
 const token=new URL(mail.text.match(/https?:\/\/[^\s]+/)![0]).searchParams.get('token');
 const signed=await call('/auth/confirm','POST',{token});expect(signed.status).toBe(303);
 expect((await call('/api/data/restore','GET',undefined,signed.headers.get('set-cookie')!.split(';')[0])).status).toBe(200);
 await env.DB.prepare('CREATE TABLE newly_unclassified(secret TEXT)').run();
 await expect(createVectorArchive({db:env.DB,files:env.FILES})).rejects.toThrow('unclassified_table');
 await env.DB.prepare('DROP TABLE newly_unclassified').run();
 await env.FILES.delete('retained-file');
 await expect(createVectorArchive({db:env.DB,files:env.FILES})).rejects.toThrow('attachment_reference');
 expect((await env.DB.prepare('SELECT count(*) AS n FROM issues').first())?.n).toBe(1);
});
