import {createWebhookProtocol} from '../../../../../vendor/base/integrations/core/webhook';

export type SourceConnection={webhookUrl?:string;receiver:string;workspaceId:string;sourceId:string;teamId:string};
export type SourceReport={title:string;summary:string;sourceRecordId:string;sourceRevisionId:string;observedAt:string;teamId:string};
export async function sourceRequest(connection:SourceConnection,secret:string,report:SourceReport){
 if(!/^[a-f0-9]{64}$/.test(secret))throw new Error('Paste the 64-character source secret from registration.');
 const protocol=createWebhookProtocol({resolveDestination:async()=>connection.receiver,signingKey:async()=>new Uint8Array(secret.match(/../g)!.map(pair=>parseInt(pair,16)))});
 return protocol.prepare({id:crypto.randomUUID(),tenant:connection.workspaceId,destinationId:connection.sourceId,event:'signal.revision',protocol:'webhook',body:JSON.stringify(report)},Date.now());
}
export function sourceScript(connection:SourceConnection,report:SourceReport){
 return `// Save as vector-source.mjs. Requires Node.js 22 or later.
// Set VECTOR_SOURCE_SECRET in your automation's secret store, then run:
// node vector-source.mjs
import {createHmac, randomUUID} from 'node:crypto';
const secret = process.env.VECTOR_SOURCE_SECRET;
if (!/^[a-f0-9]{64}$/.test(secret ?? '')) throw new Error('Set VECTOR_SOURCE_SECRET to the source secret.');
const receiver = ${JSON.stringify(connection.receiver)};
const tenant = ${JSON.stringify(connection.workspaceId)};
const source = ${JSON.stringify(connection.sourceId)};
// Map these fields to the monitoring alert or support ticket in your automation.
// Keep sourceRecordId for the same alert; change sourceRevisionId when it changes.
// Map observedAt to the alert update time. Keep the body identical when retrying.
const report = ${JSON.stringify(report,null,2)};
const body = JSON.stringify(report);
const id = randomUUID();
const timestamp = String(Math.floor(Date.now() / 1000));
const event = 'signal.revision';
const signed = JSON.stringify(['integrations.webhook.v1', tenant, source, event, id, timestamp, body]);
const signature = createHmac('sha256', Buffer.from(secret, 'hex')).update(signed).digest('hex');
const response = await fetch(receiver, {method:'POST', headers:{
  'content-type':'application/json', 'webhook-id':id, 'webhook-tenant':tenant,
  'webhook-destination':source, 'webhook-event':event, 'webhook-timestamp':timestamp,
  'webhook-signature':'v1=' + signature
}, body});
console.log(response.status, await response.text());
if (!response.ok) process.exitCode = 1;`;
}
