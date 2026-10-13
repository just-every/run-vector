import { DeliveryService,D1SqlDatabase,createWebhookProtocol,verifyWebhook } from '../../../../vendor/base/integrations';
import type { TrustedTransport } from '../../../../vendor/base/integrations';
import type { WorkerBindings } from '../../app/bindings';
import { IntegrationError } from './errors';
import { openSecret } from './secrets';
import { NativeWebhookRepository } from './outbound-repository';
import { restoredEffectsHeld } from '../data/restore-authority';
import { destinationSigningProblems } from './destination-signing';
export const egressConfigured=(env:WorkerBindings)=>env.INTEGRATION_EGRESS_POLICY==='public-dns-pinned-tls-v1'&&typeof env.INTEGRATION_EGRESS?.send==='function';
const keyBytes=(value:string)=>new Uint8Array(value.match(/../g)!.map(part=>parseInt(part,16)));
export function outboundService(env:WorkerBindings,workspace:string,now:()=>number=Date.now,skipDestinations:readonly string[]=[]){
 if(!egressConfigured(env))throw new IntegrationError(503,'outbound_unconfigured','Provision an enforcing public DNS, pinned TLS RPC binding before dispatch.');
 const repository=new NativeWebhookRepository(new D1SqlDatabase(env.DB),workspace);repository.skipDestinations=skipDestinations;
 const configuration=async(id:string)=>{
  const row=await env.DB.prepare(`SELECT d.url,k.encrypted FROM vector_webhook_destinations d JOIN vector_integration_secret_keys k ON k.identity='destination:'||d.id AND k.slot='current' WHERE d.id=? AND d.workspace_id=? AND d.enabled=1 AND d.revoked_at IS NULL`).bind(id,workspace).first<{url:string;encrypted:string}>();
  if(!row||await restoredEffectsHeld(env.DB))throw new IntegrationError(503,'outbound_destination_disabled');
  return {...row,key:keyBytes(await openSecret(env,'destination:'+id,row.encrypted))};
 };
 const protocol=createWebhookProtocol({resolveDestination:async id=>(await configuration(id)).url,signingKey:async envelope=>(await configuration(envelope.destinationId)).key});
 const transport:TrustedTransport={async send(wire){
  const destination=wire.headers['webhook-destination'],eventId=wire.headers['webhook-id'],current=await configuration(destination);
  if(wire.url!==current.url||(await env.DB.prepare('SELECT 1 FROM vector_webhook_restore_holds WHERE namespace=? AND id=?').bind(workspace,eventId).first()))throw new IntegrationError(503,'outbound_delivery_held');
  await verifyWebhook({body:wire.body,headers:wire.headers,key:current.key,tenant:workspace,destinationId:destination,now:now()});
  if(await env.DB.prepare('SELECT 1 FROM vector_webhook_erasures WHERE namespace=? AND id=?').bind(workspace,eventId).first())throw new IntegrationError(410,'outbound_issue_deleted');
  return env.INTEGRATION_EGRESS!.send(wire);
 }};
 return new DeliveryService({repository,protocols:[protocol],transport,now});
}
/** A destination that cannot sign keeps its events queued, unsent, and is reported as held; every other destination proceeds. */
export async function dispatchWebhooks(env:WorkerBindings){
 if(!egressConfigured(env)||await restoredEffectsHeld(env.DB))return {configured:egressConfigured(env),enqueued:0,dispatched:0,held:0};
 const workspaces=(await env.DB.prepare('SELECT DISTINCT workspace_id FROM vector_webhook_destinations WHERE enabled=1 AND revoked_at IS NULL LIMIT 100').all<{workspace_id:string}>()).results;
 let enqueued=0,dispatched=0,held=0;
 for(const {workspace_id:workspace} of workspaces){
  const blocked=[...(await destinationSigningProblems(env,workspace)).keys()],service=outboundService(env,workspace,Date.now,blocked);
  const unsendable=blocked.length?` AND e.destination_id NOT IN (${blocked.map(()=>'?').join(',')})`:'';
  held+=blocked.length?(await env.DB.prepare(`SELECT count(*) AS n FROM vector_webhook_events e WHERE e.workspace_id=? AND e.enqueued_at IS NULL AND e.destination_id IN (${blocked.map(()=>'?').join(',')}) AND NOT EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=e.workspace_id AND h.id=e.id)`).bind(workspace,...blocked).first<{n:number}>())!.n:0;
  const events=(await env.DB.prepare(`SELECT e.* FROM vector_webhook_events e JOIN vector_webhook_destinations d ON d.id=e.destination_id WHERE e.workspace_id=? AND e.enqueued_at IS NULL AND d.enabled=1 AND d.revoked_at IS NULL${unsendable} AND NOT EXISTS(SELECT 1 FROM vector_webhook_restore_holds h WHERE h.namespace=e.workspace_id AND h.id=e.id) AND NOT EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=e.workspace_id AND h.id=e.id) ORDER BY e.created_at,e.id LIMIT 20`).bind(workspace,...blocked).all<{id:string;destination_id:string;event:string;body:string}>()).results;
  for(const event of events){
   try {await service.enqueue({id:event.id,tenant:workspace,destinationId:event.destination_id,event:event.event,protocol:'webhook',body:event.body});}
   catch(error){if(await env.DB.prepare('SELECT 1 FROM vector_webhook_erasures WHERE namespace=? AND id=?').bind(workspace,event.id).first())continue;throw error;}
   await env.DB.prepare('UPDATE vector_webhook_events SET enqueued_at=COALESCE(enqueued_at,?) WHERE id=? AND workspace_id=?').bind(new Date().toISOString(),event.id,workspace).run();enqueued++;
  }
  dispatched+=(await service.dispatchDue(20)).length;
 }
 return {configured:true,enqueued,dispatched,held};
}
