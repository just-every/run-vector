import {expect} from 'vitest';
import {createServerApp} from '../../src/core/app/server';
import {setupAdministration} from './administration-fixture';
import {bindings,origin} from './base-auth-fixture';
import {createWebhookProtocol} from '../../vendor/base/integrations';
import type {WorkerBindings} from '../../src/core/app/bindings';
export async function setupIntegrations(){
 const f=await setupAdministration();let app=createServerApp();
 const api=(token:string,path:string,method='GET',body?:unknown,overrides:Partial<WorkerBindings>={})=>app.request(origin+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+token,Origin:origin,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},{...bindings,...overrides});
 const issueToken=async(scopes:string[],name='Native API')=>{const response=await f.call('/settings/integrations/tokens','POST',{name,scopes});expect(response.status).toBe(201);return response.json() as Promise<{token:string;credential:{id:string}}>};
 const source=async(sourceId='monitoring')=>{const response=await f.call('/settings/integrations/sources','POST',{name:'Monitoring source',sourceId,teamId:f.initial.teams[0].id});expect(response.status).toBe(201);return response.json() as Promise<{id:string;workspaceId:string;sourceId:string;secret:string;receiver:string}>;};
 const signed=async(config:{id:string;workspaceId:string;sourceId:string;secret:string;receiver:string},body:unknown,overrides:Partial<WorkerBindings>={},tamper=false)=>{
  const text=JSON.stringify(body),key=new Uint8Array(config.secret.match(/../g)!.map(pair=>parseInt(pair,16)));
  const protocol=createWebhookProtocol({resolveDestination:async()=>config.receiver,signingKey:async()=>key});
  const wire=await protocol.prepare({id:crypto.randomUUID(),tenant:config.workspaceId,destinationId:config.sourceId,event:'signal.revision',protocol:'webhook',body:text},Date.now());
  return app.request(config.receiver,{method:'POST',headers:wire.headers,body:tamper?text+' ':text},{...bindings,...overrides});
 };
 return {...f,get app(){return app;},restart(){app=createServerApp();},api,issueToken,source,signed};
}
