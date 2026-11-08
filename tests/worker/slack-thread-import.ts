import {Buffer} from 'node:buffer';
import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import type {setupIntegrations} from './integration-fixture';
import type {setupSlackIntake} from './slack-events-scenario';
/** A mapped native discussion is later human work, so import rollback must
 * retain it rather than erase an issue whose source file once created it. */
export async function slackThreadImport(f:Awaited<ReturnType<typeof setupIntegrations>>,intake:Awaited<ReturnType<typeof setupSlackIntake>>){
 const {read,send,payload}=intake,team=f.initial.teams[0],status=team.statuses.find(s=>s.category==='unstarted')!;
 const input={format:'json',source:'synthetic-vector-thread-import',name:'issues.json',base64:Buffer.from(JSON.stringify([{id:'synthetic-vector-thread-source',title:'Imported Slack thread subject',team:team.name,status:status.name}])).toString('base64'),mapping:{sourceId:'id',title:'title',team:'team',status:'status'}};
 const review=await read(await f.call('/data/import/preview','POST',input));expect(review.errors).toEqual([]);expect(review.ready).toBe(true);
 let job=await read(await f.call('/data/import/apply','POST',{input:{...input,effectiveAt:review.effectiveAt},reviewedFingerprint:review.fingerprint,operationKey:'synthetic-vector-thread-import',acknowledgeOmissions:true}));
 for(let n=0;job.state!=='completed';n++){
  expect(n).toBeLessThan(10);job=await read(await f.call('/data/import/runs/'+job.id+'/resume','POST',{}));
 }
 const issue=(await env.DB.prepare("SELECT id,identifier FROM issues WHERE title='Imported Slack thread subject'").first<{id:string;identifier:string}>())!;
 const linked=await read(await send({...payload,event_id:'synthetic-vector-import-thread',event:{...payload.event,ts:'1730000006.000001',text:'<@'+payload.event.user+'> add '+issue.identifier+' Retain the native thread'}}));
 const before=(await read(await f.call('/issues/'+issue.identifier+'/discussion'))).comments;
 expect(before).toEqual([expect.objectContaining({id:linked.rootCommentId})]);
 await read(await f.call('/data/import/runs/'+job.id+'/rollback','POST',{confirmed:true}),409);
 expect((await read(await f.call('/issues/'+issue.identifier+'/discussion'))).comments).toEqual(before);
 expect(await env.DB.prepare('SELECT count(*) n FROM vector_slack_threads WHERE issue_id=?').bind(issue.id).first<number>('n')).toBe(1);
}
