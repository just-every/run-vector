import { expect, vi } from 'vitest';
import { createServerApp } from '../../src/core/app/server';
import { bindings } from './base-auth-fixture';
// @ts-expect-error Shared native test fixture.
import { emailEventSigner } from '../email-event-signing.mjs';

export async function proveEmailBounces(f:any,intake:any,commentId:string,providerId:string,deliveryId:string,ack:any) {
  const signer=await emailEventSigner(),wrong=await emailEventSigner();
  const {recordedReply}=await import('./email-intake-fixture');
  const delayed=await recordedReply(f.cookie,ack.result.identifier,'We will follow up on the delayed delivery.');
  expect(delayed.response.status).toBe(201);const delayedComment=await delayed.response.json() as any;
  const teamId=f.initial.teams[0].id,path=`/api/integrations/email/${teamId}/events`;
  const event={event:'bounce',sg_message_id:providerId+'.synthetic-vector-731',rer_delivery_id:deliveryId,email:'synthetic-vector-712@example.test',sg_event_id:'synthetic-vector-732'};
  const app=createServerApp();
  const send=(target:string,wire:any)=>app.request(bindings.APP_ORIGIN+target,{method:'POST',...wire},bindings);
  const read=()=>f.data(f.cookie,`/issues/${intake.identifier}/email-intake`);
  const before=await read();
  expect((await send(path,await signer.signed([event]))).status).toBe(401);
  expect((await f.any(f.cookie,`/settings/teams/${teamId}/email-intake`,'PUT',{...intake.settings,acknowledgement:true,eventVerificationKey:signer.key})).status).toBe(200);
  let outbound=0;vi.stubGlobal('fetch',async()=>{outbound++;throw Error('Callback must never send');});
  try {
    expect((await send(path,{body:JSON.stringify([event]),headers:{'content-type':'application/json'}})).status).toBe(401);
    expect((await send(path,await wrong.signed([event]))).status).toBe(401);
    expect((await send(path,await signer.signed([event],String(Math.floor(Date.now()/1000)-301)))).status).toBe(401);
    expect(await read()).toEqual(before);
    const created=await f.any(f.cookie,'/settings/teams','POST',{name:'Other delivery',identifierPrefix:'OTHER'});expect(created.status).toBe(200);
    const admin=await created.json();
    const other=admin.teams.find((team:any)=>team.id!==teamId);
    expect(other).toBeTruthy();
    expect((await f.any(f.cookie,`/settings/teams/${other.id}/email-intake`,'PUT',{...intake.settings,address:'synthetic-vector-733@example.test',eventVerificationKey:signer.key})).status).toBe(200);
    for(const [target,events] of [[`/api/integrations/email/${other.id}/events`,[event]],[path,[{...event,sg_message_id:'synthetic-vector-734'}]],[path,[{...event,email:'synthetic-vector-735@example.test'}]]]) {
      const response=await send(target as string,await signer.signed(events));expect(response.status).toBe(200);expect(await response.json()).toEqual({received:true});
      expect(await read()).toEqual(before);
    }
    const notificationBefore=await f.data(f.bobCookie,'/notifications');
    expect((await send(path,await signer.signed([event]))).status).toBe(200);
    const bounced=await read();expect(bounced.deliveries.find((d:any)=>d.commentId===commentId).status).toBe('bounced');
    expect((await send(path,await signer.signed([event,{...event,event:'delivered'}]))).status).toBe(200);
    expect(await read()).toEqual(bounced);
    const ackEvent={...event,event:'dropped',rer_delivery_id:ack.calls[0].body.custom_args.rer_delivery_id,sg_message_id:ack.calls[0].providerId+'.synthetic-vector-736'};
    expect((await send(path,await signer.signed([ackEvent]))).status).toBe(200);
    const ackState=await f.data(f.cookie,`/issues/${ack.result.identifier}/email-intake`);
    expect(ackState.deliveries.find((d:any)=>d.kind==='acknowledgement').status).toBe('bounced');
    const delayedEvent={event:'bounce',email:'synthetic-vector-712@example.test','smtp-id':delayed.calls[0].body.headers['Message-ID'],sg_event_id:'synthetic-vector-737'};
    expect((await send(path,await signer.signed([delayedEvent]))).status).toBe(200);
    const delayedState=await f.data(f.cookie,`/issues/${ack.result.identifier}/email-intake`);
    expect(delayedState.deliveries.find((d:any)=>d.commentId===delayedComment.commentId).status).toBe('bounced');
    expect((await send(path,await signer.signed([{event:'bounce',email:'synthetic-vector-712@example.test'}]))).status).toBe(200);
    expect(await f.data(f.cookie,`/issues/${ack.result.identifier}/email-intake`)).toEqual(delayedState);
    expect(await f.data(f.bobCookie,'/notifications')).toEqual(notificationBefore);
    expect(outbound).toBe(0);
  } finally {vi.unstubAllGlobals();}
}
