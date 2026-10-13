import {runInDurableObject,evictDurableObject} from 'cloudflare:test';
import {expect,it} from 'vitest';
import {populatedHttpSource} from './http-archive-source';
import {destination,freshTarget,targetCall,targetSnapshot,httpExport,stageArchive,finalHash,finalBody} from './http-archive-fixture';
import type {WorkerBindings} from '../../src/core/app/bindings';

it('[DATA-001 DATA-005 BASE-DATA-001] object failure rolls back only owned bytes; uncertain failed settlement stays reserved across coordinator restart',async()=>{
 const f=await populatedHttpSource(),records=await httpExport(f.call),cookie=await freshTarget(),original=await targetSnapshot();
 const stub=destination.ARCHIVE_TARGET_COORDINATOR.get(destination.ARCHIVE_TARGET_COORDINATOR.idFromName('installation'));
 let oldEnv!:WorkerBindings;
 const installFailure=async(cleanupFails:boolean)=>runInDurableObject(stub,async instance=>{
  const object=instance as unknown as {env:WorkerBindings};oldEnv=object.env;
  object.env={...oldEnv,FILES:new Proxy(oldEnv.FILES,{get(target,key){
   if(key==='put')return async(...args:Parameters<R2Bucket['put']>)=>{await target.put(...args);throw Error('Synthetic R2 publication failure');};
   if(key==='delete'&&cleanupFails)return async()=>{throw Error('Synthetic R2 settlement unavailable');};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }})};
 });
 const first=await stageArchive(records,cookie);await installFailure(false);
 const failed=await targetCall('/api/portability/imports/'+first+'/finalize','POST',finalBody(records),cookie);expect(failed.status).toBe(500);
 await runInDurableObject(stub,async instance=>{(instance as unknown as {env:WorkerBindings}).env=oldEnv;});
 expect(await targetSnapshot()).toEqual(original);expect((await destination.ARCHIVE_TARGET_FILES.list()).objects).toEqual([]);
 expect((await targetCall('/api/portability/imports/'+first+'/abort','POST',{},cookie)).status).toBe(200);
 expect((await targetCall('/api/session','GET',undefined,cookie)).status).toBe(200);
 const second=await stageArchive(records,cookie);await installFailure(true);
 const uncertain=await targetCall('/api/portability/imports/'+second+'/finalize','POST',finalBody(records),cookie);expect(uncertain.status).toBe(409);
 expect(await uncertain.json()).toEqual({error:'restore_settlement_pending'});
 await runInDurableObject(stub,async instance=>{(instance as unknown as {env:WorkerBindings}).env=oldEnv;});
 await evictDurableObject(stub);
 expect((await targetCall('/api/portability/imports/'+second+'/abort','POST',{},cookie)).status).toBe(409);
 expect((await targetCall('/api/portability/imports/'+second+'/finalize','POST',finalBody(records),cookie)).status).toBe(409);
 const status=await targetCall('/api/portability/imports/'+second,'GET',undefined,cookie);expect(status.status).toBe(200);expect((await status.json() as {phase:string}).phase).toBe('applying');
 expect(await targetSnapshot()).toEqual(original);expect((await targetCall('/api/session','GET',undefined,cookie)).status).toBe(200);
 expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM issues').first())?.n).toBe(0);
 expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM rer_portability_owned WHERE job=?').bind(second).first())?.n).toBe(1);
},180000);
