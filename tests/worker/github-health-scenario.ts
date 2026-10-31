import {env} from 'cloudflare:workers';
import {Hono} from 'hono';
import {createApiApp} from '../../src/core/app/api';
import {expect} from 'vitest';
import {setupIntegrations} from './integration-fixture';
import {actor,bindings,invite,request,origin} from './base-auth-fixture';

export async function exerciseGithubHealthAccess(f:Awaited<ReturnType<typeof setupIntegrations>>,repositoryId:string){
 const response=await f.call('/settings/integrations');expect(response.status).toBe(200);
 const config=await response.json() as {github:Record<string,unknown>[]};
 const repository=config.github.find(row=>row.id===repositoryId)!;
 expect(repository.lastReceivedEventAt).toEqual(expect.any(String));
 const privateContent=await env.DB.prepare('SELECT title FROM vector_github_pull_requests WHERE repository_id=? LIMIT 1').bind(repositoryId).first<string>('title');
 expect(privateContent).toEqual(expect.any(String));
 expect(JSON.stringify(config.github)).not.toContain(privateContent);
 for(const field of ['payload','payload_hash','diagnostic','secret','encrypted'])expect(repository).not.toHaveProperty(field);

 const memberCookie=await invite('synthetic-vector-5201'+bindings.FIRST_OWNER_EMAIL!.slice(bindings.FIRST_OWNER_EMAIL!.indexOf('@')),f.cookie);
 const member=await actor(memberCookie);
 expect((await request('/api/settings/integrations','GET',undefined,memberCookie)).status).toBe(403);
 const issued=await request('/api/settings/integrations/tokens','POST',{name:'Personal integration',scopes:['issues:read']},memberCookie);expect(issued.status).toBe(201);
 const personal=await request('/api/settings/integrations/tokens','GET',undefined,memberCookie);expect(personal.status).toBe(200);
 const personalConfig=await personal.json() as {tokens:{name:string}[]};expect(personalConfig.tokens.some(row=>row.name==='Personal integration')).toBe(true);
 expect(personalConfig).not.toHaveProperty('github');expect(JSON.stringify(personalConfig)).not.toContain(repositoryId);
 expect((await request('/api/settings/integrations/github','POST',{name:'Refused connection',repository:'octocat/linguist'},memberCookie)).status).toBe(403);

 const workspace=(await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(member).first<string>('workspace_id'))!,foreign='01K00000000000000000005202';
 await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) SELECT ?,'Other receipt workspace',timezone,created_at,updated_at FROM workspace_settings WHERE id=?").bind(foreign,workspace).run();
 await env.DB.prepare("UPDATE operators SET workspace_id=?,role='admin' WHERE id=?").bind(foreign,member).run();
 try{
  const mounted=new Hono().route('/api',createApiApp()),read=(cookie:string)=>mounted.request(origin+'/api/settings/integrations',{headers:{Cookie:cookie,host:new URL(origin).host,Origin:origin}},bindings);
  const foreignRead=await read(memberCookie);expect(foreignRead.status,await foreignRead.clone().text()).toBe(200);
  const foreignConfig=await foreignRead.json() as {github:unknown[]};expect(foreignConfig.github).toEqual([]);expect(JSON.stringify(foreignConfig)).not.toContain(repositoryId);
  const ownerRead=await read(f.cookie);expect(ownerRead.status).toBe(200);expect((await ownerRead.json() as {github:unknown[]}).github).toEqual(config.github);
 }finally{
  await env.DB.prepare("UPDATE operators SET workspace_id=?,role='member' WHERE id=?").bind(workspace,member).run();
  await env.DB.prepare('DELETE FROM workspace_settings WHERE id=?').bind(foreign).run();
 }
 console.log('PROBE INTEG-002 authority: Settings API hides receipt times from Members and another workspace while personal tokens remain usable');
}
