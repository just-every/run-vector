import assert from 'node:assert/strict';
import {dispatchWebhooks,outboundService} from '../../../src/core/features/integrations/outbound.ts';

/** The emitted Worker's native mutations feed the real signed TLS receiver.
 * Privacy is rechecked for queued work as well as newly produced events. */
export async function outboundPrivacyJourney({call,cookie,db,env,workspace,transport,setMode}){
 const mutate=async(path,method,body,status=200)=>{
  const response=await call('/api'+path,method,body,cookie);assert.equal(response.status,status,await response.clone().text());return response.json();
 };
 const name='synthetic-vector-32020';
 const team=(await mutate('/settings/teams','POST',{name,identifierPrefix:'SYNHOOK'})).teams.find(team=>team.name===name);
 const privacy=isPrivate=>mutate('/settings/teams/'+team.id+'/privacy','PUT',{isPrivate});
 const create=title=>mutate('/issues','POST',{teamId:team.id,title},201);
 const events=identifier=>db.prepare("SELECT id FROM vector_webhook_events WHERE json_extract(body,'$.identifier')=?").bind(identifier).all();
 const held=await create('synthetic-vector-32021');assert.ok((await events(held.identifier)).results.length>0);
 const before=transport.connects.length;
 await privacy(true);await dispatchWebhooks(env);assert.equal(transport.connects.length,before,'a formerly public queued event never leaves after privacy changes');
 const privateIssue=await create('synthetic-vector-32022');assert.equal((await events(privateIssue.identifier)).results.length,0,'private mutations produce no generic event');
 await privacy(false);
 await mutate('/issues/'+privateIssue.identifier,'PATCH',{expectedVersion:privateIssue.version,title:'synthetic-vector-32023'});
 setMode('accepted');await dispatchWebhooks(env);assert.equal(transport.connects.length,before+1,'new public work reaches the receiver');
 const accepted=await db.prepare("SELECT d.state FROM integration_deliveries d JOIN vector_webhook_events e ON e.id=d.id WHERE json_extract(e.body,'$.identifier')=?").bind(privateIssue.identifier).first();assert.equal(accepted.state,'accepted');
 setMode('retry');const retry=await create('synthetic-vector-32024');await dispatchWebhooks(env);
 const pending=await db.prepare("SELECT d.id,d.next_at,d.state FROM integration_deliveries d JOIN vector_webhook_events e ON e.id=d.id WHERE json_extract(e.body,'$.identifier')=?").bind(retry.identifier).first();assert.equal(pending.state,'queued');
 const attempts=transport.connects.length;
 await privacy(true);const stopped=await outboundService(env,workspace,()=>pending.next_at+1).dispatch(pending.id);
 assert.equal(stopped.state,'rejected');assert.equal(transport.connects.length,attempts,'a retry cannot send work that became private');
 setMode('accepted');
}
