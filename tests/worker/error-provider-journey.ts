import {env} from 'cloudflare:workers';
import {expect,vi} from 'vitest';
import {bindings,request,invite} from './base-auth-fixture';
import type {setupIntegrations} from './integration-fixture';
export async function exerciseErrorProviders(f:Awaited<ReturnType<typeof setupIntegrations>>){
 const team=f.initial.teams[0],token='synthetic-vector-8101',secret='synthetic-vector-8102';
 const read=async<T=any>(response:Response,status=200):Promise<T>=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>;};
 let registered:any;
 const network=vi.spyOn(globalThis,'fetch'),calls:{url:string;body:any;headers:Headers}[]=[];
 network.mockImplementation(async(input,init)=>{
  const url=String(input),body=JSON.parse(String(init?.body??'{}')),headers=new Headers(init?.headers);expect(init?.redirect).toBe('manual');calls.push({url,body,headers});
  if(/^https:\/\/sentry\.io\/api\/0\/issues\/[0-9]+\/events\/latest\/$/.test(url)){expect(init?.method).toBe('GET');expect(headers.get('Authorization')).toBe('Bearer '+token);return Response.json({release:{version:'synthetic-vector-8103'}});}
  if(url==='https://sentry.io/api/0/issues/8101/'){expect(init?.method).toBe('PUT');expect(headers.get('Authorization')).toBe('Bearer '+token);expect(body).toEqual({status:'resolved'});return Response.json({status:'resolved'});}
  if(url.startsWith('https://api.datadoghq.com/api/v1/integration/webhooks/configuration/webhooks')){expect(headers.get('DD-API-KEY')).toBe(token);expect(headers.get('DD-APPLICATION-KEY')).toBe(secret);registered=body;return Response.json({});}
  throw Error('Unexpected error-provider request');
 });
 try{
 const connection=await read(await f.call('/settings/integrations/errors','POST',{provider:'sentry',teamId:team.id,regressionRule:'reopen',token,secret}),201);
 const payload=(action='created',substatus='ongoing')=>({action,data:{issue:{id:'8101',title:'Checkout error',permalink:'https://sentry.io/organizations/synthetic-vector/issues/8101/',count:'17',userCount:4,lastSeen:'2026-10-28T00:00:00Z',substatus,metadata:{value:'Checkout stack trace'}}}});
 const send=async(value:unknown,delivery:string,tamper=false)=>{
  const body=JSON.stringify(value),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))),byte=>byte.toString(16).padStart(2,'0')).join('');
  return f.app.request(connection.receiver,{method:'POST',headers:{'Content-Type':'application/json','Sentry-Hook-Signature':signature,'Sentry-Hook-Resource':'issue','Request-ID':delivery},body:tamper?body+' ':body},bindings);
 };
 const beforeForged=(await env.DB.prepare('SELECT * FROM issues ORDER BY id').all()).results;
 expect((await send(payload(),'synthetic-vector-8104',true)).status).toBe(401);expect((await env.DB.prepare('SELECT * FROM issues ORDER BY id').all()).results).toEqual(beforeForged);
 const created=await read(await send(payload(),'synthetic-vector-8104'));
 const path='/issues/'+created.identifier,detail=()=>f.call(path).then(r=>read(r));
 let issue=await detail();expect(issue.title).toBe('Checkout error');expect(issue.description).toBe('Checkout stack trace');expect(issue.evidence[0]).toMatchObject({link:payload().data.issue.permalink,measurements:{frequency:17,affectedUsers:4,release:'synthetic-vector-8103'}});
 expect((await f.call('/settings/integrations/errors/'+connection.id+'/resolve','POST',{identifier:created.identifier,recordId:'8101'})).status).toBe(409);
 const active=team.statuses.find(row=>row.category==='unstarted')!;
 issue=await read(await f.call(path+'/accept','POST',{expectedVersion:issue.version,statusId:active.id,assigneeOperatorId:f.owner,priority:'medium'}));
 const done=team.statuses.find(row=>row.category==='completed')!;
 issue=await read(await f.call(path,'PATCH',{expectedVersion:issue.version,statusId:done.id}));
 await read(await f.call('/settings/integrations/errors/'+connection.id+'/resolve','POST',{identifier:created.identifier,recordId:'8101'}));
 expect((await request('/api/settings/integrations/errors/'+connection.id+'/resolve','POST',{identifier:created.identifier,recordId:'8101'})).status).toBe(401);
 const member=await invite(['synthetic-vector-8119','example.test'].join('@'),f.cookie);
 for(const [path,method,body] of [['/settings/integrations/errors','GET',undefined],['/settings/integrations/errors','POST',{provider:'sentry',teamId:team.id,regressionRule:'reopen',token,secret}],['/settings/integrations/errors/'+connection.id+'/resolve','POST',{identifier:created.identifier,recordId:'8101'}],['/settings/integrations/errors/'+connection.id,'DELETE',undefined]] as const){const before=await detail();expect((await request('/api'+path,method,body,member)).status).toBe(403);expect(await detail()).toEqual(before);}
 await env.DB.prepare("CREATE TRIGGER error_receipt_failure BEFORE INSERT ON vector_source_receipts BEGIN SELECT RAISE(ABORT,'error receipt failure'); END").run();
 try{expect((await send(payload('unresolved','regressed'),'synthetic-vector-8105')).status).toBe(503);expect(await detail()).toEqual(issue);}finally{await env.DB.prepare('DROP TRIGGER error_receipt_failure').run();}
 await read(await send(payload('unresolved','regressed'),'synthetic-vector-8105'));
 const reopened=await detail();expect(reopened.status.category).toBe('started');expect(reopened.completedAt).toBeNull();expect(reopened.activity.filter((row:any)=>row.nextValue?.automation==='error_regression')).toHaveLength(1);
 f.restart();expect(await read(await send(payload('unresolved','regressed'),'synthetic-vector-8105'))).toMatchObject({reused:true});expect(await detail()).toEqual(reopened);
 expect(await read(await send(payload('unresolved','regressed'),'synthetic-vector-8120'))).toMatchObject({reused:true});expect(await detail()).toEqual(reopened);
 expect((await send({...payload('unresolved','regressed'),action:'created'},'synthetic-vector-8105')).status).toBe(409);
 await read(await f.call('/settings/integrations/errors','POST',{provider:'sentry',teamId:team.id,regressionRule:'comment',token,secret}),201);
 const commentPayload=payload('unresolved','regressed');commentPayload.data.issue.lastSeen='2026-10-28T00:01:00Z';
 await read(await send(commentPayload,'synthetic-vector-8106'));await read(await send(commentPayload,'synthetic-vector-8106'));await read(await send(commentPayload,'synthetic-vector-8123'));
 const discussion=await read(await f.call(path+'/discussion'));expect(discussion.comments.filter((row:any)=>row.body==='Regression reported by Sentry.')).toHaveLength(1);
 const config=await read(await f.call('/settings/integrations/errors'));expect(JSON.stringify(config)).not.toContain(secret);expect(JSON.stringify(config)).not.toContain(token);
 // Link an existing native issue before its first provider event.
 const linked=await f.create({title:'Existing incident'});
 await read(await f.call('/settings/integrations/errors/'+connection.id+'/link','POST',{identifier:linked.identifier,recordId:'8107'}));
 expect(await read(await send({action:'created',data:{issue:{...payload().data.issue,id:'8107'}}},'synthetic-vector-8107'))).toMatchObject({identifier:linked.identifier});
 issue=await detail();await read(await f.call(path,'DELETE',{expectedVersion:issue.version,confirmed:true}));
 expect((await send(payload(),'synthetic-vector-8108')).status).toBe(410);expect((await send(payload(),'synthetic-vector-8104')).status).toBe(410);
 await read(await f.call('/settings/integrations/errors/'+connection.id,'DELETE'));expect((await send(payload(),'synthetic-vector-8109')).status).toBe(401);
 const dd=await read(await f.call('/settings/integrations/errors','POST',{provider:'datadog',teamId:team.id,regressionRule:'comment',token,secret}),201);
 expect(registered.url).toBe(dd.receiver);const mapped=JSON.parse(registered.payload.replaceAll('$ALERT_ID','8110').replaceAll('$ID','synthetic-vector-8110').replaceAll('$ALERT_TRANSITION','Triggered').replaceAll('$TITLE','Latency alert').replaceAll('$TEXT_ONLY_MSG','Request latency increased').replaceAll('$LINK','https://app.datadoghq.com/monitors/8110').replaceAll('$DATE','1793145600'));
 const ddSecret=JSON.parse(registered.custom_headers)['X-Vector-Secret'];expect(ddSecret).toHaveLength(64);
 const event={id:'8110',eventId:'synthetic-vector-8110',transition:'Triggered',title:'Latency alert',message:'Request latency increased',link:'https://app.datadoghq.com/monitors/8110',date:'1793145600',frequency:9,affectedUsers:2,release:'synthetic-vector-8111'};
 const ddSend=(value:unknown,credential=ddSecret)=>f.app.request(dd.receiver,{method:'POST',headers:{'Content-Type':'application/json','X-Vector-Secret':credential},body:JSON.stringify(value)},bindings);
 expect((await ddSend(event,'synthetic-vector-8112')).status).toBe(401);
 expect((await ddSend(mapped)).status).toBe(200);
 const ddIssue=await read(await ddSend({...event,eventId:'synthetic-vector-8114'}));expect((await read(await f.call('/issues/'+ddIssue.identifier))).evidence.find((row:any)=>row.sourceRevisionId==='synthetic-vector-8114').measurements).toMatchObject({frequency:9,affectedUsers:2,release:'synthetic-vector-8111'});
 const regression={...event,eventId:'synthetic-vector-8113',transition:'Re-Triggered'};
 await read(await ddSend(regression));await read(await ddSend(regression));expect((await read(await f.call('/issues/'+ddIssue.identifier+'/discussion'))).comments).toHaveLength(1);
 const caseIssue=await read(await ddSend({...event,id:'synthetic-vector-8115',eventId:'synthetic-vector-8116',transition:'case_created',title:'Customer error case'}));expect((await read(await f.call('/issues/'+caseIssue.identifier))).title).toBe('Customer error case');
 const beforeRotation=ddSecret;
 await read(await f.call('/settings/integrations/errors','POST',{provider:'datadog',teamId:team.id,regressionRule:'ignore',token,secret}),201);
 const rotatedSecret=JSON.parse(registered.custom_headers)['X-Vector-Secret'];
 expect((await ddSend({...event,eventId:'synthetic-vector-8117'},beforeRotation)).status).toBe(401);
 await read(await ddSend({...event,eventId:'synthetic-vector-8117'},rotatedSecret));
 expect((await read(await f.call('/issues/'+ddIssue.identifier+'/discussion'))).comments).toHaveLength(1);

 expect(calls.filter(row=>row.url==='https://sentry.io/api/0/issues/8101/')).toHaveLength(1);
 }finally{network.mockRestore();}
}
