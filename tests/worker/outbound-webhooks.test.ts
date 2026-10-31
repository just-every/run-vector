import {env} from 'cloudflare:workers';
import {it,expect,vi} from 'vitest';
import {setupIntegrations} from './integration-fixture';
import {bindings,request} from './base-auth-fixture';
import {dispatchWebhooks,outboundService} from '../../src/core/features/integrations/outbound';
import {verifyWebhook} from '../../vendor/base/integrations';
import {outboundCommentJourney} from './outbound-comment-journey';
import {outboundSubscriptionUpgrade} from './outbound-subscription-upgrade';
it('[WEBHOOK-001 WEBHOOK-002] native mutations queue stable minimal events; explicit RPC dispatch retains retries, uncertainty and restore holds',async()=>{
 const f=await setupIntegrations(),response=await f.call('/settings/integrations/destinations','POST',{name:'Native destination',url:'https://receiver.example.com/events'});expect(response.status).toBe(201);const destination=await response.json() as {id:string;secret:string;dispatchConfigured:boolean};expect(destination.dispatchConfigured).toBe(false);
 const key=new Uint8Array(destination.secret.match(/../g)!.map(pair=>parseInt(pair,16))),workspace=await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id');
 const beforeIssues=await env.DB.prepare('SELECT count(*) AS n FROM issues').first();
 await env.DB.prepare("CREATE TRIGGER webhook_event_failure BEFORE INSERT ON vector_webhook_events BEGIN SELECT RAISE(ABORT,'fixture native event durability failure'); END").run();
 expect((await f.call('/issues','POST',{teamId:f.initial.teams[0].id,title:'Refused native publication'})).status).toBeGreaterThanOrEqual(500);
 expect(await env.DB.prepare('SELECT count(*) AS n FROM issues').first()).toEqual(beforeIssues);expect((await env.DB.prepare('SELECT count(*) AS n FROM vector_webhook_events').first())?.n).toBe(0);
 await env.DB.prepare('DROP TRIGGER webhook_event_failure').run();
 const created=await f.create();const events=(await env.DB.prepare('SELECT id,event,body FROM vector_webhook_events').all<{id:string;event:string;body:string}>()).results;expect(events.length).toBe(1);expect(events[0].event).toBe('issue.created');expect(events[0].body.includes(created.identifier)).toBe(true);expect(events[0].body.includes(destination.secret)).toBe(false);
 expect(await dispatchWebhooks(bindings)).toEqual({configured:false,enqueued:0,dispatched:0,held:0});expect((await env.DB.prepare('SELECT count(*) n FROM integration_deliveries').first())?.n).toBe(0);
 let sends=0,mode:'accepted'|'retry'|'uncertain'='retry';
 // Paid/network edge only. The loopback proof separately exercises actual
 // NodePinnedTransport; this native D1 proof checks composition and ledgers.
 const current={...bindings,INTEGRATION_EGRESS_POLICY:'public-dns-pinned-tls-v1',INTEGRATION_EGRESS:{async send(wire:{url:string;body:string;headers:Record<string,string>}){sends++;await verifyWebhook({body:new TextEncoder().encode(wire.body),headers:wire.headers,key,tenant:workspace!,destinationId:destination.id});if(mode==='uncertain')throw Error('lost acknowledgement');return {status:mode==='retry'?429:204,headers:mode==='retry'?{'retry-after':'1'}:{},body:''};}}};
 await env.DB.prepare("CREATE TRIGGER webhook_delivery_failure BEFORE INSERT ON integration_deliveries BEGIN SELECT RAISE(ABORT,'fixture delivery durability failure'); END").run();
 await expect(dispatchWebhooks(current)).rejects.toThrow();expect(sends).toBe(0);expect((await env.DB.prepare('SELECT count(*) AS n FROM integration_deliveries').first())?.n).toBe(0);expect((await env.DB.prepare('SELECT enqueued_at FROM vector_webhook_events').first())?.enqueued_at).toBeNull();
 await env.DB.prepare('DROP TRIGGER webhook_delivery_failure').run();
 expect((await dispatchWebhooks(current)).enqueued).toBe(1);const first=await env.DB.prepare('SELECT state,attempts,next_at FROM integration_deliveries WHERE id=?').bind(events[0].id).first<{state:string;attempts:number;next_at:number}>();expect(first?.state).toBe('queued');expect(first?.attempts).toBe(1);
 mode='accepted';const restarted=outboundService(current,workspace!,()=>first!.next_at+1);expect((await restarted.dispatch(events[0].id))?.state).toBe('accepted');expect(sends).toBe(2);expect((await dispatchWebhooks(current)).enqueued).toBe(0);expect(sends).toBe(2);
 mode='uncertain';await f.create({title:'Uncertain native delivery'});await dispatchWebhooks(current);const uncertain=await env.DB.prepare("SELECT id,attempts FROM integration_deliveries WHERE state='uncertain'").first<{id:string;attempts:number}>();expect(uncertain?.attempts).toBe(1);const before=sends;await dispatchWebhooks(current);expect(sends).toBe(before);
 expect((await f.call('/settings/integrations/deliveries/'+encodeURIComponent(uncertain!.id)+'/resolve','POST',{kind:'accepted',evidenceCode:'receiver-confirmed'})).status).toBe(200);
 await f.create({title:'Held native event'});const held=await env.DB.prepare('SELECT id FROM vector_webhook_events WHERE enqueued_at IS NULL').first<{id:string}>();await env.DB.prepare('INSERT INTO vector_webhook_restore_holds(namespace,id) VALUES(?,?)').bind(workspace,held!.id).run();await dispatchWebhooks(current);expect(sends).toBe(before);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
 await outboundCommentJourney(f);
 await outboundSubscriptionUpgrade();
},180000);

it('operators enable delivery from Settings and send a signed test without creating an issue',async()=>{
 const f=await setupIntegrations();
 const account='1234567890abcdef1234567890abcdef',token='synthetic-read-only-account-token';
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(input)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  expect(url.origin).toBe('https://api.cloudflare.com');
  if(url.pathname===`/client/v4/accounts/${account}/workers/subdomain`)return Response.json({success:true,errors:[],result:{subdomain:'vector-host'}});
  if(url.pathname==='/client/v4/zones')return Response.json({success:true,errors:[],result:[],result_info:{page:1,per_page:50,count:0,total_count:0,total_pages:0}});
  throw new Error('Unexpected network edge');
 });
 try {
  const configured=await f.call('/settings/integrations/delivery','POST',{accountId:account,apiToken:token});expect(configured.status).toBe(200);
  expect((await (await f.call('/settings/integrations')).json() as {outboundConfigured:boolean}).outboundConfigured).toBe(true);
  expect(JSON.stringify((await env.DB.prepare('SELECT * FROM vector_integration_secret_keys').all()).results)).not.toContain(token);
 } finally {provider.mockRestore();}
 const registered=await f.call('/settings/integrations/destinations','POST',{name:'Operations receiver',url:'https://receiver.example.com/events'});
 const destination=await registered.json() as {id:string;secret:string};
 let sent=0;
 const transport={async send(wire:{url:string;body:string;headers:Record<string,string>}){
  await verifyWebhook({body:new TextEncoder().encode(wire.body),headers:wire.headers,key:new Uint8Array(destination.secret.match(/../g)!.map(pair=>parseInt(pair,16))),tenant:wire.headers['webhook-tenant'],destinationId:destination.id});
  expect(JSON.parse(wire.body).event).toBe('vector.test');sent++;return {status:204,headers:{},body:''};
 }};
 const before=(await env.DB.prepare('SELECT count(*) n FROM issues').first())?.n;
 const result=await request('/api/settings/integrations/destinations/'+destination.id+'/test','POST',{},f.cookie,{INTEGRATION_EGRESS_POLICY:'public-dns-pinned-tls-v1',INTEGRATION_EGRESS:transport});
 expect(result.status).toBe(200);expect(await result.json()).toMatchObject({state:'accepted'});expect(sent).toBe(1);
 expect((await env.DB.prepare('SELECT count(*) n FROM issues').first())?.n).toBe(before);
 expect((await env.DB.prepare('SELECT state FROM integration_deliveries').first())?.state).toBe('accepted');
});
