import {slackAppScenario} from './slack-app-scenario';
import {privateChannelRouting} from './private-channel-scenario';
import {channelNotifications} from './channel-notifications-scenario';
import {slackDirectMessages,slackActionsFollowCurrentAccess} from './slack-dm-scenario';
import {env} from 'cloudflare:workers';
import {it,expect} from 'vitest';
import {setupIntegrations} from './integration-fixture';
import {bindings} from './base-auth-fixture';
import {dispatchWebhooks} from '../../src/core/features/integrations/outbound';
import {verifyWebhook} from '../../vendor/base/integrations';
type Destination={id:string;secret:string};
type Listed={destinations:{id:string;signingProblem:string|null;requiresReentry:number;waitingEvents:number}[]};
it('[SLACK-003 SLACK-006 SLACK-007 SLACK-008 SLACK-009 SLACK-004 SLACK-010 SLACK-011 SLACK-012 NOTIFY-007 SEC-001 WEBHOOK-003] a destination that cannot sign is shown as needing attention and holds its events; the healthy destination still receives every event, signed; member choices route private Slack mentions and daily comment email once with signed actions',async()=>{
 const f=await setupIntegrations(),workspace=(await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id'))!;
 const register=async(name:string)=>{const r=await f.call('/settings/integrations/destinations','POST',{name,url:'https://'+name+'.example.com/events'});expect(r.status).toBe(201);return r.json() as Promise<Destination>;};
 const healthy=await register('healthy'),broken=await register('broken'),keys=new Map([[healthy.id,healthy.secret]]);
 const received:string[]=[];
 // Paid/network edge only: an egress binding that verifies each signature and records who received what.
 const egress={...bindings,INTEGRATION_EGRESS_POLICY:'public-dns-pinned-tls-v1',INTEGRATION_EGRESS:{async send(wire:{url:string;body:string;headers:Record<string,string>}){
  const id=wire.headers['webhook-destination'],secret=keys.get(id);if(!secret)throw Error('sent a destination that has no usable secret');
  await verifyWebhook({body:new TextEncoder().encode(wire.body),headers:wire.headers,key:new Uint8Array(secret.match(/../g)!.map(p=>parseInt(p,16))),tenant:workspace,destinationId:id,now:Date.now()});
  received.push(id+':'+wire.headers['webhook-id']);return {status:204,headers:{},body:''};
 }}};
 const list=async()=>(await (await f.call('/settings/integrations')).json()) as Listed;
 const state=async(id:string)=>(await list()).destinations.find(d=>d.id===id)!;
 const eventsFor=async(id:string)=>(await env.DB.prepare('SELECT id,enqueued_at FROM vector_webhook_events WHERE destination_id=? ORDER BY created_at,id').bind(id).all<{id:string;enqueued_at:string|null}>()).results;
 const fire=async(n:number)=>{for(let i=0;i<n;i++)await f.create({title:'Event '+i});};

 // 1. The broken destination's secret is deleted. Events fire; the healthy one is delivered.
 await env.DB.prepare('DELETE FROM vector_integration_secret_keys WHERE identity=?').bind('destination:'+broken.id).run();
 await fire(3);
 expect(await dispatchWebhooks(egress)).toMatchObject({enqueued:3,held:3});
 expect(received.filter(r=>r.startsWith(healthy.id)).length).toBe(3);expect(received.filter(r=>r.startsWith(broken.id))).toEqual([]);
 expect(await state(healthy.id)).toMatchObject({signingProblem:null,requiresReentry:0,waitingEvents:0});
 expect(await state(broken.id)).toMatchObject({signingProblem:'secret_missing',requiresReentry:1,waitingEvents:3});
 expect((await eventsFor(broken.id)).map(e=>e.enqueued_at)).toEqual([null,null,null]);
 expect((await env.DB.prepare("SELECT count(*) n FROM integration_deliveries WHERE json_extract(envelope,'$.destinationId')=?").bind(broken.id).first())?.n).toBe(0);

 // 2. More events than one dispatch window never let the broken destination starve the healthy one.
 await fire(12);
 await dispatchWebhooks(egress);await dispatchWebhooks(egress);
 expect(received.filter(r=>r.startsWith(healthy.id)).length).toBe(15);

 // 3. The owner re-enters the secret: nothing was lost, the held events now go out signed with the new secret.
 const again=await f.call('/settings/integrations/destinations/'+broken.id+'/reenter','POST',{});expect(again.status).toBe(201);keys.set(broken.id,((await again.json()) as Destination).secret);
 await dispatchWebhooks(egress);await dispatchWebhooks(egress);
 expect(received.filter(r=>r.startsWith(broken.id)).length).toBe(15);expect(await state(broken.id)).toMatchObject({signingProblem:null,waitingEvents:0});

 // 4. A secret that no longer decrypts is the same visible state, and is also re-enterable.
 await env.DB.prepare("UPDATE vector_integration_secret_keys SET encrypted=? WHERE identity=?").bind('00'.repeat(12)+':'+'ab'.repeat(32),'destination:'+broken.id).run();
 await fire(1);const before=received.length;await dispatchWebhooks(egress);
 expect(received.length).toBe(before+1);expect(received.at(-1)!.startsWith(healthy.id)).toBe(true);
 expect(await state(broken.id)).toMatchObject({signingProblem:'secret_unreadable',waitingEvents:1});
 expect((await f.call('/settings/integrations/destinations/'+healthy.id+'/reenter','POST',{})).status).toBe(409);
 const fixed=await f.call('/settings/integrations/destinations/'+broken.id+'/reenter','POST',{});expect(fixed.status).toBe(201);keys.set(broken.id,((await fixed.json()) as Destination).secret);
 await dispatchWebhooks(egress);expect(received.filter(r=>r.startsWith(broken.id)).length).toBe(16);

 // 5. A restore drops every secret. Both destinations show it; once the owner re-enters one, only that one delivers new events.
 await env.DB.prepare("INSERT INTO rer_portability_jobs(id,kind,actor,phase,completed,metadata) VALUES('restore-fixture','import','owner','applying',0,?)").bind(JSON.stringify({manifest:{objects:[]}})).run();
 await env.DB.prepare("UPDATE rer_portability_jobs SET phase='complete' WHERE id='restore-fixture'").run();
 expect((await list()).destinations.map(d=>d.signingProblem)).toEqual(['secret_missing','secret_missing']);
 expect((await f.call('/data/restore/review-effects','POST',{})).status).toBe(200);
 const fresh=await f.call('/settings/integrations/destinations/'+healthy.id+'/reenter','POST',{});keys.set(healthy.id,((await fresh.json()) as Destination).secret);keys.delete(broken.id);
 const mark=received.length;await fire(2);await dispatchWebhooks(egress);
 expect(received.slice(mark).map(r=>r.split(':')[0])).toEqual([healthy.id,healthy.id]);
 expect(await state(healthy.id)).toMatchObject({signingProblem:null});expect(await state(broken.id)).toMatchObject({signingProblem:'secret_missing',waitingEvents:2});
 await f.call('/settings/integrations/destinations/'+healthy.id,'DELETE');await f.call('/settings/integrations/destinations/'+broken.id,'DELETE');
 await channelNotifications(f,egress);
 await privateChannelRouting(f,egress);
 await slackDirectMessages(f,egress);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
},240000);
it('a Slack action changes only issues its member can still edit after a role or team change',async()=>{
 await slackActionsFollowCurrentAccess(await setupIntegrations());
},120000);

it('[SLACK-001 SEC-001 ROLE-001] Owners create manifests and install Slack through actor-bound one-use OAuth with sealed credentials',async()=>{await slackAppScenario('installation');});
it('[SLACK-001 ROLE-001] Owners and Admins explicitly map Slack members with audited changes',async()=>{await slackAppScenario('mapping');});
it('[SLACK-001 SEC-001 ROLE-001] Signed Slack Events create one issue as the linked member and refuse invalid intake',async()=>{await slackAppScenario('events');});
it('[SLACK-001 SEC-001] Provider uninstall and local removal retire Slack credentials and revoke access',async()=>{await slackAppScenario('uninstall');});
it('[SLACK-001 SEC-001] Slack archives exclude credentials and restore requires re-entry',async()=>{await slackAppScenario('archive');});

it('[SLACK-005 OPS-001 ROLE-002] Slack link previews unfurl issues and projects only for linked members who can read them',async()=>{await slackAppScenario('unfurl');});
