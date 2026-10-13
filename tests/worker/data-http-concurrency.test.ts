import {runInDurableObject,evictDurableObject} from 'cloudflare:test';
import {expect,it} from 'vitest';
import {populatedHttpSource} from './http-archive-source';
import {destination,targetBindings,freshTarget,targetCall,targetSignIn,httpExport,stageArchive,finalHash,finalBody} from './http-archive-fixture';
import type {WorkerBindings} from '../../src/core/app/bindings';
import {scheduled} from '../../src/core/app/scheduled';

it('[DATA-001 DATA-005 BASE-DATA-001] HTTP finalize serializes abort and recovers lost commit acknowledgement and coordinator restart without deleting committed bytes',async()=>{
 const f=await populatedHttpSource(),records=await httpExport(f.call),cookie=await freshTarget(),job=await stageArchive(records,cookie);
 const stub=destination.ARCHIVE_TARGET_COORDINATOR.get(destination.ARCHIVE_TARGET_COORDINATOR.idFromName('installation'));
 let reached!:()=>void,release!:()=>void;
 const entered=new Promise<void>(resolve=>{reached=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 let oldEnv!:WorkerBindings,ackLost=false;
 let inspected!:()=>void,resumeSchedule!:()=>void;
 const inspectedHold=new Promise<void>(resolve=>{inspected=resolve;}),scheduleGate=new Promise<void>(resolve=>{resumeSchedule=resolve;});
 // Delay a real D1 read acknowledgement at the network edge: the Cron sees its
 // pre-restore false result only after publication. Its candidate SQL must then
 // observe the durable hold, preserving historical removals and deferrals.
 const scheduleDb=new Proxy(targetBindings.DB,{get(target,key){
  if(key==='prepare')return(sql:string)=>{
   const statement=target.prepare(sql);
   if(sql==='SELECT id FROM vector_restore_status WHERE effects_held=1')return new Proxy(statement,{get(s,k){if(k==='first')return async()=>{const result=await s.first();inspected();await scheduleGate;return result;};const value=Reflect.get(s,k,s);return typeof value==='function'?value.bind(s):value;}});
   return statement;
  };const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
 const sweeping=scheduled({scheduledTime:Date.now()},{...targetBindings,DB:scheduleDb});await inspectedHold;
 await runInDurableObject(stub,async instance=>{
  const object=instance as unknown as {env:WorkerBindings};oldEnv=object.env;
  const files=new Proxy(oldEnv.FILES,{get(target,key){if(key==='put')return async(...args:Parameters<R2Bucket['put']>)=>{const result=await target.put(...args);reached();await gate;return result;};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  const db=new Proxy(oldEnv.DB,{get(target,key){if(key==='batch')return async(statements:D1PreparedStatement[])=>{const result=await target.batch(statements);if(!ackLost&&await target.prepare("SELECT 1 FROM rer_portability_jobs WHERE id=? AND phase='complete'").bind(job).first()){ackLost=true;throw Error('Synthetic lost commit acknowledgement');}return result;};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  object.env={...oldEnv,FILES:files,DB:db};
 });
 // Read the reply in the originating runner context before the R2 gate wakes
 // the assertion continuation in the coordinator context. Pass only plain data.
 const finishing=targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),cookie).then(async response=>({status:response.status,body:await response.text()}));
 try {
  await Promise.race([runInDurableObject(stub,async()=>{await entered;return true;}),finishing.then(async result=>{throw Error('Finalize returned before object publication: '+result.status);})]);
  expect((await targetCall('/api/portability/imports/'+job+'/abort','POST',{},cookie)).status).toBe(409);
  expect((await targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),cookie)).status).toBe(409);
  release();const done=await finishing;expect(done.status,done.body).toBe(200);expect(ackLost).toBe(true);
 } finally { release();resumeSchedule();await Promise.allSettled([finishing,sweeping]); }
 await runInDurableObject(stub,async instance=>{(instance as unknown as {env:WorkerBindings}).env=oldEnv;});
 await evictDurableObject(stub);
 expect((await targetCall('/api/session','GET',undefined,cookie)).status).toBe(401);
 const fresh=await targetSignIn();
 const status=await targetCall('/api/data/restore','GET',undefined,fresh);expect(status.status).toBe(200);expect((await status.json() as {status:unknown}).status).toMatchObject({importId:job,phase:'complete',contentHash:finalHash(records)});
 expect(new Uint8Array(await (await destination.ARCHIVE_TARGET_FILES.get('http-archive-file'))!.arrayBuffer())).toEqual(new Uint8Array([0,1,2,255]));
 const again=await httpExport((path,method,body)=>targetCall('/api'+path,method,body,fresh));expect(finalHash(again)).toBe(finalHash(records));
},180000);
