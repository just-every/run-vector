import {expect} from 'vitest';
import {setupSlackIntake,slackIntakeFixture} from './slack-events-scenario';
import {request,bindings,invite,actor} from './base-auth-fixture';
import type {setupIntegrations} from './integration-fixture';

export async function slackUnfurlScenario(f:Awaited<ReturnType<typeof setupIntegrations>>,secret:string,member:string,memberId:string,calls:{method:string;body:any}[]){
 const {send,read,snapshot}=await setupSlackIntake(f,secret,memberId);
 const team=f.initial.teams[0].id;
 const issue=await f.create({title:'synthetic-vector-private-spec',description:'synthetic-vector-private-description',priority:'high',assigneeOperatorId:memberId});
 await read(await f.call(`/settings/teams/${team}/members/${memberId}`,'PUT',{role:'member'}));
 await read(await f.call(`/settings/teams/${team}/privacy`,'PUT',{isPrivate:true}));
 const native=await read(await request('/api/issues/'+issue.identifier,'GET',undefined,member));
 let sequence=0;
 const payload=(url:string,user=slackIntakeFixture.user)=>({type:'event_callback',team_id:slackIntakeFixture.team,event_id:'synthetic-vector-unfurl-'+(++sequence),event:{type:'link_shared',channel:slackIntakeFixture.channel,user,message_ts:'synthetic-vector-1',unfurl_id:'synthetic-vector-unfurl-'+sequence,source:'conversations_history',links:[{domain:new URL(bindings.APP_ORIGIN).hostname,url}]}});
 const effects=()=>calls.filter(c=>c.method==='chat.unfurl');
 const url=bindings.APP_ORIGIN+'/app/issues/'+issue.identifier,event=payload(url);
 const before=await snapshot(),count=effects().length;
 await read(await send({...event,team_id:slackIntakeFixture.otherTeam}),403);expect(await snapshot()).toEqual(before);expect(effects()).toHaveLength(count);
 for(const options of [{unsigned:true},{secret:'synthetic-vector-wrong-secret'},{timestamp:String(Math.floor(Date.now()/1000)-301)}]){await read(await send(event,options),401);expect(await snapshot()).toEqual(before);expect(effects()).toHaveLength(count);}
 await read(await send(event));expect(effects()).toHaveLength(count+1);
 expect(effects().at(-1)!.body).toMatchObject({unfurl_id:event.event.unfurl_id,source:event.event.source});
 const text=effects().at(-1)!.body.unfurls[url].blocks[0].text;
 expect(text.type).toBe('plain_text');
 for(const value of [native.identifier,native.title,native.status.name,native.assignee.name,native.priority])expect(text.text).toContain(value);
 expect(JSON.stringify(effects().at(-1)!.body)).not.toContain('synthetic-vector-private-description');
 const delivered=await snapshot();await read(await send(event),409);expect(await snapshot()).toEqual(delivered);expect(effects()).toHaveLength(count+1);
 const bare=async(event:ReturnType<typeof payload>)=>{
  const state=await snapshot(),prior=effects().length;await read(await send(event));const after=await snapshot();
  expect(after.vector_slack_event_receipts).toHaveLength((state.vector_slack_event_receipts as string[]).length+1);
  delete state.vector_slack_event_receipts;delete after.vector_slack_event_receipts;
  expect(after).toEqual(state);expect(effects()).toHaveLength(prior);
 };
 const document=await read(await f.call('/documents','POST',{parentKind:'team',parentId:team,title:'synthetic-vector-private-document',body:'synthetic-vector-private-document-body'}),201);
 const documentUrl=bindings.APP_ORIGIN+'/app/documents/'+document.id,documentNative=await read(await request('/api/documents/'+document.id,'GET',undefined,member));
 const documentEvent=payload(documentUrl),documentCount=effects().length;await read(await send(documentEvent));expect(effects()).toHaveLength(documentCount+1);
 expect(effects().at(-1)!.body).toMatchObject({unfurl_id:documentEvent.event.unfurl_id,source:documentEvent.event.source});
 const documentText=effects().at(-1)!.body.unfurls[documentUrl].blocks[0].text;expect(documentText).toEqual({type:'plain_text',text:documentNative.id+'\n'+documentNative.title});expect(JSON.stringify(effects().at(-1)!.body)).not.toContain(documentNative.body);
 await bare(payload(documentUrl,slackIntakeFixture.unlinked));
 await bare(payload(url,slackIntakeFixture.unlinked));
 const outsider=await invite('synthetic-vector-unfurl-outsider@vector.test',f.cookie),outsiderId=await actor(outsider);
 // Re-map the same Slack user: the next event must use current target authority.
 await read(await f.call('/settings/integrations/slack/app/members/'+memberId,'DELETE'));
 await read(await f.call('/settings/integrations/slack/app/members','POST',{operatorId:outsiderId,slackTeamId:slackIntakeFixture.team,slackUserId:slackIntakeFixture.user}));
 expect((await request('/api/issues/'+issue.identifier,'GET',undefined,outsider)).status).toBe(404);
 await bare(payload(url));await bare(payload(documentUrl));
 await read(await f.call('/settings/operators/'+outsiderId+'/role','PATCH',{role:'viewer'}));
 await bare(payload(url));await bare(payload(documentUrl));
 await read(await f.call(`/settings/teams/${team}/privacy`,'PUT',{isPrivate:false}));
 const viewerCount=effects().length;await read(await send(payload(url)));expect(effects()).toHaveLength(viewerCount+1);
 await read(await f.call('/settings/operators/'+outsiderId+'/role','PATCH',{role:'member'}));
 await read(await f.call(`/settings/teams/${team}/privacy`,'PUT',{isPrivate:false}));
 const state=await f.mutate('/settings/projects','POST',{name:'synthetic-vector-unfurl-project',leadOperatorId:f.owner,priority:'urgent'}),project=state.projects.find(p=>p.name==='synthetic-vector-unfurl-project')!;
 await f.create({projectId:project.id});
 const projectUrl=bindings.APP_ORIGIN+'/app/projects/'+project.id;
 const projectNative=await read(await request('/api/projects/'+project.id,'GET',undefined,outsider));
 const projectCount=effects().length;await read(await send(payload(projectUrl)));expect(effects()).toHaveLength(projectCount+1);
 const projectText=effects().at(-1)!.body.unfurls[projectUrl].blocks[0].text.text;
 for(const value of [projectNative.name,projectNative.lifecycle,projectNative.lead.name,projectNative.priority])expect(projectText).toContain(value);
 await read(await f.call(`/settings/teams/${team}/privacy`,'PUT',{isPrivate:true}));
 await bare(payload(projectUrl));
 await read(await f.call(`/settings/teams/${team}/privacy`,'PUT',{isPrivate:false}));
 await read(await f.call('/settings/projects/'+project.id,'PATCH',{archived:true}));await bare(payload(projectUrl));
 await read(await f.call('/issues/'+issue.identifier,'DELETE',{expectedVersion:issue.version,confirmed:true}));await bare(payload(url));
 await bare(payload(bindings.APP_ORIGIN+'/app/issues/synthetic-vector-unknown'));
 const foreign=new URL(url);foreign.port=String(Number(foreign.port)+1);await bare(payload(foreign.href));
 await bare(payload(bindings.APP_ORIGIN+'/app/documents/synthetic-vector-unbuilt'));
}
