import {env} from 'cloudflare:workers';
import {expect,it,vi} from 'vitest';
import {setupIntegrations} from './integration-fixture';
import {bindings,request,invite} from './base-auth-fixture';
import {httpExport,archiveRows,freshTarget,stageArchive,finalBody,targetCall,targetSignIn,destination} from './http-archive-fixture';
const prefix='/settings/integrations/gitlab',token='synthetic-vector-18901';
const project=(id:number)=>({id,path_with_namespace:'synthetic-vector/project-'+id,name:'Project '+id,permissions:{project_access:{access_level:40},group_access:null}});
it('GitLab setup registers chosen projects, fences authority and uncertain writes, and restores without credentials',async()=>{
 const f=await setupIntegrations();
 const read=async(response:Response,status=200):Promise<any>=>{expect(response.status,await response.clone().text()).toBe(status);return response.json();};
 const calls:{origin:string;path:string;method:string;body:any}[]=[],writes:typeof calls=[];let failure='',withdraw=false,withdrawActor='',denyDiscovery=false;
 const spy=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(String(input)),method=init?.method??'GET',body=JSON.parse(String(init?.body??'{}'));
  expect(init?.redirect).toBe('manual');expect(new Headers(init?.headers).get('PRIVATE-TOKEN')).toBe(token);
  expect(['https://gitlab.com','https://gitlab.example.com']).toContain(url.origin);
  const call={origin:url.origin,path:url.pathname,method,body};calls.push(call);
  if(url.pathname==='/api/v4/personal_access_tokens/self')return Response.json({active:true,revoked:false,scopes:denyDiscovery?['api','sudo']:['api']});
  if(url.pathname==='/api/v4/projects'){expect(url.searchParams.get('membership')).toBe('true');expect(url.searchParams.get('min_access_level')).toBe('40');return Response.json([project(18911),project(18912),project(18913)]);}
  const match=/^\/api\/v4\/projects\/(\d+)(?:\/hooks(?:\/(\d+))?)?$/.exec(url.pathname);expect(match).not.toBeNull();const id=Number(match![1]);
  if(method==='GET'){
   if(withdraw){withdraw=false;await env.DB.prepare("UPDATE operators SET role='member' WHERE id=?").bind(withdrawActor).run();}
   return Response.json(project(id));
  }
  writes.push(call);expect(['POST','PUT']).toContain(method);expect(body).toMatchObject({enable_ssl_verification:true,push_events:true,merge_requests_events:true,pipeline_events:true,deployment_events:true});
  expect(body.token).toMatch(/^[a-f0-9]{64}$/);
  if(failure==='timeout'&&id===18912)throw Error('synthetic-vector-18902');
  if(failure==='rejected'&&id===18912)return new Response(null,{status:403});
  return Response.json({id:match![2]?Number(match![2]):id+100,url:body.url});
 });
 const snapshot=async()=>Promise.all(['vector_gitlab_connections','vector_gitlab_projects','vector_gitlab_hooks','vector_integration_secret_keys','audit_records'].map(table=>env.DB.prepare('SELECT * FROM '+table+' ORDER BY 1,2').all().then(result=>result.results)));
 try{
  const com=await read(await f.call(prefix,'POST',{origin:'https://gitlab.com',token}),201);
  let config=await read(await f.call(prefix));expect(config.connections[0].projects.map((p:any)=>p.projectId)).toEqual([18911,18912,18913]);
  const refuse=async(body:unknown)=>{const before=await snapshot(),count=calls.length;await read(await f.call(prefix+'/'+com.id+'/hooks','POST',body),400);expect(await snapshot()).toEqual(before);expect(calls).toHaveLength(count);};
  await refuse({projectIds:[18911,999999]});await refuse({projectIds:[18911,'18912']});await refuse({projectIds:[18911,18911]});
  let before=await snapshot();denyDiscovery=true;await read(await f.call(prefix,'POST',{origin:'https://gitlab.com',token}),400);denyDiscovery=false;expect(await snapshot()).toEqual(before);
  const registration=await read(await f.call(prefix+'/'+com.id+'/hooks','POST',{projectIds:[18911,18912]}));expect(registration.outcomes).toEqual([{projectId:18911,state:'registered'},{projectId:18912,state:'registered'}]);
  expect(writes.map(w=>w.path)).toEqual(['/api/v4/projects/18911/hooks','/api/v4/projects/18912/hooks']);
  expect(writes.map(w=>w.body.url)).toEqual([bindings.APP_ORIGIN+'/api/integrations/gitlab/'+com.id+'/18911',bindings.APP_ORIGIN+'/api/integrations/gitlab/'+com.id+'/18912']);
  expect(writes[0].body.token).not.toBe(writes[1].body.token);
  before=await snapshot();const writeCount=writes.length;f.restart();await read(await f.call(prefix+'/'+com.id+'/hooks','POST',{projectIds:[18911,18912]}));expect(await snapshot()).toEqual(before);expect(writes).toHaveLength(writeCount);
  // Every management door refuses the three non-management role cells, without an outbound call.
  for(const role of ['member','guest','viewer']){
   const cookie=await invite(['synthetic-vector-'+role,'example.test'].join('@'),f.cookie);
   const actor=await (await request('/api/session','GET',undefined,cookie)).json() as {operatorId:string};
   if(role!=='member')expect((await f.call('/settings/operators/'+actor.operatorId+'/role','PATCH',role==='guest'?{role,teamIds:[f.initial.teams[0].id]}:{role})).status).toBe(200);
   const base=await snapshot(),count=calls.length;
   for(const [path,method,body] of [[prefix,'GET',undefined],[prefix,'POST',{origin:'https://gitlab.com',token}],[prefix+'/'+com.id+'/hooks','POST',{projectIds:[18913]}],[prefix+'/'+com.id,'DELETE',undefined]] as const)expect((await request('/api'+path,method,body,cookie)).status).toBe(403);
   expect(await snapshot()).toEqual(base);expect(calls).toHaveLength(count);
  }
  // Current authority is checked after provider reads and before the durable write claim.
  const coOwner=await invite(['synthetic-vector-18909','example.test'].join('@'),f.cookie);const coOwnerId=(await (await request('/api/session','GET',undefined,coOwner)).json() as {operatorId:string}).operatorId;expect((await f.call('/settings/operators/'+coOwnerId+'/role','PATCH',{role:'admin'})).status).toBe(200);withdrawActor=coOwnerId;
  before=await snapshot();withdraw=true;const count=writes.length;const withdrawal=await request('/api'+prefix+'/'+com.id+'/hooks','POST',{projectIds:[18913]},coOwner);expect(withdrawal.status,await withdrawal.clone().text()).toBe(503);await env.DB.prepare("UPDATE operators SET role='admin' WHERE id=?").bind(coOwnerId).run();expect(await snapshot()).toEqual(before);expect(writes).toHaveLength(count);
  // A second origin produces an honest partial result, then refuses blind replay after a lost response.
  const adminCall=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,coOwner);
  const self=await read(await adminCall(prefix,'POST',{origin:'https://gitlab.example.com',token}),201);
  expect((await read(await adminCall(prefix+'/'+self.id+'/hooks','POST',{projectIds:[18911,18912]}))).outcomes).toEqual([{projectId:18911,state:'registered'},{projectId:18912,state:'registered'}]);
  await read(await adminCall(prefix,'POST',{origin:'https://gitlab.example.com',token}),201);
  failure='rejected';expect((await read(await adminCall(prefix+'/'+self.id+'/hooks','POST',{projectIds:[18911,18912]}))).outcomes).toEqual([{projectId:18911,state:'registered'},{projectId:18912,state:'rejected'}]);
  failure='timeout';expect((await read(await adminCall(prefix+'/'+self.id+'/hooks','POST',{projectIds:[18912]}))).outcomes[0].state).toBe('unknown');const unknownCount=writes.length;f.restart();await read(await adminCall(prefix+'/'+self.id+'/hooks','POST',{projectIds:[18912]}));expect(writes).toHaveLength(unknownCount);failure='';
  config=await read(await f.call(prefix));expect(JSON.stringify(config)).not.toContain(token);for(const write of writes)expect(JSON.stringify(config)).not.toContain(write.body.token);
  const receive=(secret:string)=>f.app.request(writes[0].body.url,{method:'POST',headers:{'X-Gitlab-Token':secret,'Content-Type':'application/json'},body:'{}'},bindings);
  expect((await receive(writes[0].body.token)).status).toBe(503);expect((await receive('synthetic-vector-18910')).status).toBe(401);
  const sealed=(await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity LIKE 'gitlab-%'").all<{encrypted:string}>()).results;
  expect(sealed.length).toBeGreaterThan(0);for(const row of sealed)expect(row.encrypted).not.toContain(token);
  const records=await httpExport(f.call),archive=JSON.stringify(records);expect(archiveRows(records,'vector_gitlab_connections')).toHaveLength(2);expect(archiveRows(records,'vector_gitlab_hooks')).toHaveLength(4);
  expect(archive).not.toContain(token);for(const row of sealed)expect(archive).not.toContain(row.encrypted);for(const write of writes)expect(archive).not.toContain(write.body.token);
  const targetCookie=await freshTarget(),job=await stageArchive(records,targetCookie);
  await read(await targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),targetCookie));
  const restored=await targetSignIn(),target=(path:string,method='GET',body?:unknown)=>targetCall('/api'+path,method,body,restored);
  const restoredConfig=await read(await target(prefix));expect(restoredConfig.connections.every((c:any)=>c.requiresReentry===1)).toBe(true);
  const beforeReentry=writes.length;expect((await target(prefix+'/'+com.id+'/hooks','POST',{projectIds:[18911]})).status).toBe(409);expect(writes).toHaveLength(beforeReentry);
  await read(await target(prefix,'POST',{origin:'https://gitlab.com',token}),201);
  await read(await target(prefix+'/'+com.id+'/hooks','POST',{projectIds:[18911,18912]}));
  expect(writes.slice(beforeReentry).map(w=>w.method)).toEqual(['PUT','PUT']);expect(writes[beforeReentry].path).toBe('/api/v4/projects/18911/hooks/19011');expect(writes[beforeReentry].body.token).not.toBe(writes[0].body.token);
  expect(await destination.ARCHIVE_TARGET_DB.prepare("SELECT count(*) n FROM vector_gitlab_hooks WHERE state='registered'").first<number>('n')).toBe(3);
  await read(await f.call(prefix+'/'+com.id,'DELETE'));expect((await receive(writes[0].body.token)).status).toBe(401);const removed=await read(await f.call(prefix));expect(removed.connections.find((c:any)=>c.id===com.id).requiresReentry).toBe(1);const stopped=writes.length;expect((await f.call(prefix+'/'+com.id+'/hooks','POST',{projectIds:[18911]})).status).toBe(409);expect(writes).toHaveLength(stopped);
  expect(await env.DB.prepare("SELECT count(*) n FROM vector_integration_secret_keys WHERE identity=? OR identity LIKE ?").bind('gitlab-token:'+com.id,'gitlab-hook:'+com.id+':%').first<number>('n')).toBe(0);
 }finally{spy.mockRestore();}
},180000);
