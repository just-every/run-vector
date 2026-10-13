import {runInDurableObject} from 'cloudflare:test';
import {expect,it} from 'vitest';
import {populatedHttpSource} from './http-archive-source';
import {destination,freshTarget,targetCall,targetSignIn,targetSnapshot,httpExport,stageArchive,finalHash,finalBody} from './http-archive-fixture';
import type {WorkerBindings} from '../../src/core/app/bindings';

it('[DATA-001 DATA-005 BASE-DATA-001] revocation during HTTP object publication denies the atomic commit while narrow settlement removes owned bytes',async()=>{
 const f=await populatedHttpSource(),records=await httpExport(f.call),cookie=await freshTarget(),job=await stageArchive(records,cookie);
 const stub=destination.ARCHIVE_TARGET_COORDINATOR.get(destination.ARCHIVE_TARGET_COORDINATOR.idFromName('installation'));
 let expected!:Awaited<ReturnType<typeof targetSnapshot>>,oldEnv!:WorkerBindings;
 await runInDurableObject(stub,async instance=>{
  const object=instance as unknown as {env:WorkerBindings};oldEnv=object.env;
  object.env={...oldEnv,FILES:new Proxy(oldEnv.FILES,{get(target,key){
   if(key==='put')return async(...args:Parameters<R2Bucket['put']>)=>{
    const result=await target.put(...args);
    // This is the separately authorized native signout racing the final commit.
    expect((await targetCall('/auth/signout','POST',{},cookie)).status).toBe(200);
    expected=await targetSnapshot();return result;
   };const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }})};
 });
 const denied=await targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),cookie);expect(denied.status).toBe(500);
 await runInDurableObject(stub,async instance=>{(instance as unknown as {env:WorkerBindings}).env=oldEnv;});
 expect(await targetSnapshot()).toEqual(expected);expect((await destination.ARCHIVE_TARGET_FILES.list()).objects).toEqual([]);
 expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT count(*) AS n FROM rer_portability_owned').first())?.n).toBe(0);
 expect((await targetCall('/api/session','GET',undefined,cookie)).status).toBe(401);
 expect((await targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),cookie)).status).toBe(401);
 const fresh=await targetSignIn();
 expect((await targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),fresh)).status).toBe(409);
 expect((await targetCall('/api/portability/imports/'+job+'/abort','POST',{},fresh)).status).toBe(200);
 expect((await targetCall('/api/session','GET',undefined,fresh)).status).toBe(200);
},180000);
