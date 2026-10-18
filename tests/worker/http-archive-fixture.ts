import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {expect,inject} from 'vitest';
import {createServerApp} from '../../src/core/app/server';
import {bindings} from './base-auth-fixture';
import type {WorkerBindings} from '../../src/core/app/bindings';
import inventory from '../../src/core/features/data/archive-inventory.json';
import {readArchive,type Manifest,type Part,type Closing} from '@runeditrun/rer/modules/portability';
export const destination=env as unknown as {ARCHIVE_TARGET_DB:D1Database;ARCHIVE_TARGET_FILES:R2Bucket;ARCHIVE_TARGET_COORDINATOR:NonNullable<WorkerBindings['RESTORE_COORDINATOR']>};
// This independent target has configured-owner bootstrap, regardless of the
// optional setup token Wrangler reads from the developer checkout.
export const targetBindings={...bindings,SETUP_TOKEN:undefined,DB:destination.ARCHIVE_TARGET_DB,FILES:destination.ARCHIVE_TARGET_FILES,RESTORE_COORDINATOR:destination.ARCHIVE_TARGET_COORDINATOR};
const app=createServerApp();
export async function targetCall(path:string,method='GET',body?:unknown,cookie='',overrides:Partial<WorkerBindings>={}) {
 const current={...targetBindings,...overrides};
 const response=await app.request(current.APP_ORIGIN+path,{method,headers:{host:new URL(targetBindings.APP_ORIGIN).host,Origin:targetBindings.APP_ORIGIN,cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},current);
 // Complete the HTTP reply before the next request or DO eviction; unread
 // response streams retain runtime references even when only status is tested.
 const bytes=await response.arrayBuffer();
 return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
}
export async function targetSignIn(email=bindings.FIRST_OWNER_EMAIL!) {
 expect((await targetCall('/auth/request','POST',{email})).status).toBe(202);
 const mail=await destination.ARCHIVE_TARGET_DB.prepare("SELECT json_extract(message,'$.text') AS text FROM rer_mail_development_outbox ORDER BY sequence DESC LIMIT 1").first<{text:string}>();
 const token=new URL(mail!.text.match(/https?:\/\/[^\s]+/)![0]).searchParams.get('token');
 const confirmed=await targetCall('/auth/confirm','POST',{token});expect(confirmed.status).toBe(303);
 return confirmed.headers.get('set-cookie')!.split(';')[0];
}
export async function freshTarget() {
 await applyD1Migrations(destination.ARCHIVE_TARGET_DB,inject('migrations'));
 return targetSignIn();
}
export type ArchiveRecords=(Manifest|Part|Closing)[];
export async function httpExport(call:(path:string,method?:string,body?:unknown)=>Promise<Response>) {
 const create=await call('/portability/exports','POST',{});expect(create.status).toBe(201);
 const {id}=await create.json() as {id:string};let phase='building';
 while(phase==='building') { const advanced=await call('/portability/exports/'+id+'/advance','POST',{maxParts:16});expect(advanced.status).toBe(200);phase=(await advanced.json() as {phase:string}).phase; }
 const download=await call('/portability/exports/'+id+'/download');expect(download.status).toBe(200);
 const records:ArchiveRecords=[];for await(const record of readArchive(download.body!))records.push(record);
 expect((await call('/portability/exports/'+id+'/abort','POST',{})).status).toBe(200);
 return records;
}
export async function stageArchive(records:ArchiveRecords,cookie:string) {
 const staged=await targetCall('/api/portability/imports','POST',{confirmed:true,manifest:records[0]},cookie);
 expect(staged.status,await staged.clone().text()).toBe(201);const {id}=await staged.json() as {id:string};
 for(const part of records.filter((row):row is Part=>row.kind==='part')) {
  const uploaded=await targetCall('/api/portability/imports/'+id+'/parts/'+part.index,'PUT',part,cookie);
  expect(uploaded.status,await uploaded.clone().text()).toBe(200);
 }
 return id;
}
export const finalHash=(records:ArchiveRecords)=>(records.at(-1) as Closing).contentHash;
/** Base finalizes against both the content and the archive digest of the closing record. */
export const finalBody=(records:ArchiveRecords)=>({contentHash:(records.at(-1) as Closing).contentHash,archiveHash:(records.at(-1) as Closing & {archiveHash:string}).archiveHash});
export const targetSnapshot=async()=>{
 // Compare the entire classified native graph, including authentication and
 // excluded destination claims/holds. Only transport counters/custody may vary.
 const transport=new Set(['access_rate_limits','oa_limits','rer_mail_development_outbox','vector_http_restore']);
 const tables=Object.keys(inventory).filter(name=>!name.startsWith('rer_portability_')&&!transport.has(name));
 return Promise.all(tables.map(async name=>{
  const quote=(value:string)=>'"'+value.replaceAll('"','""')+'"';
  const columns=(inventory as Record<string,string[]>)[name];
  const rows=(await destination.ARCHIVE_TARGET_DB.prepare('SELECT * FROM '+quote(name)+' ORDER BY '+columns.map(quote).join(',')).all()).results;
  // Equality of content digests avoids printing synthetic native credentials in
  // assertion diagnostics while retaining every classified table and column.
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows,(_key,value)=>value instanceof ArrayBuffer?Array.from(new Uint8Array(value)):value)));
  return {table:name,count:rows.length,content:Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')};
 }));
};
