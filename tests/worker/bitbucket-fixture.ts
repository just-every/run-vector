import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {setupIntegrations} from './integration-fixture';
import {bindings} from './base-auth-fixture';
import type {WorkerBindings} from '../../src/core/app/bindings';
export const bitbucketIdentity={repository:'synthetic-vector-187/repository',repositoryUuid:'{11111111-1111-4111-8111-111111111187}'};
export const bitbucketTables=['vector_bitbucket_repositories','vector_bitbucket_pull_requests','vector_bitbucket_issue_links','vector_bitbucket_deliveries','issues','issue_activity','issue_followers','notifications','notification_events','notification_candidates','audit_records'];
export function bitbucketBody(identifier:string,state='OPEN',time='2026-10-01T01:00:00.000Z',number=17){
 const repository={uuid:bitbucketIdentity.repositoryUuid,full_name:bitbucketIdentity.repository};
 return {actor:{uuid:'{22222222-2222-4222-8222-222222222187}'},repository,pullrequest:{id:number,title:'Fixes '+identifier,description:'synthetic-vector-187',state,updated_on:time,links:{html:{href:'https://bitbucket.org/'+bitbucketIdentity.repository+'/pull-requests/'+number}},destination:{repository},source:{branch:{name:'synthetic-vector-187'},commit:{hash:'a'.repeat(40)}}}};
}
export async function bitbucketWire(secret:string,body:unknown,delivery=crypto.randomUUID(),event?:string){
 const text=JSON.stringify(body),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))),byte=>byte.toString(16).padStart(2,'0')).join('');
 return {method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature':'sha256='+signature,'X-Event-Key':event??((body as ReturnType<typeof bitbucketBody>).pullrequest.state==='MERGED'?'pullrequest:fulfilled':'pullrequest:created'),'X-Request-UUID':'{'+delivery+'}'},body:text};
}
export async function bitbucketFixture(){
 const f=await setupIntegrations(),saved=await f.call('/settings/integrations/bitbucket','POST',{name:'synthetic-vector-187',...bitbucketIdentity});
 expect(saved.status,await saved.clone().text()).toBe(201);const config=await saved.json() as {id:string;secret:string;receiver:string};
 const send=async(body:unknown,delivery=crypto.randomUUID(),overrides:Partial<WorkerBindings>={},tamper=false,event?:string)=>{
  const wire=await bitbucketWire(config.secret,body,delivery,event);
  if(tamper)wire.body+=' ';
  return f.app.request(config.receiver,wire,{...bindings,...overrides});
 };
 return {...f,config,send};
}
/** Digests compare all domain effects without exposing native credentials on failure. */
export async function bitbucketSnapshot(db=env.DB,tables=bitbucketTables){
 const rows=await Promise.all(tables.map(async table=>[table,(await db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()).results]));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows)))),byte=>byte.toString(16).padStart(2,'0')).join('');
}
