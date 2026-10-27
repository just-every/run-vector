import {expect} from 'vitest';
import {env} from 'cloudflare:workers';
import type {roleWorkspace} from './role-fixture';
import {snapshot,resetLimits,type Person} from './role-fixture';
import {createServerApp} from '../../src/core/app/server';
import {bindings,origin} from './base-auth-fixture';
export async function exerciseInitiatives(w:Awaited<ReturnType<typeof roleWorkspace>>){
 await resetLimits();const owner=w.people.owner,app=createServerApp();
 const json=async(r:Response,status=200)=>{expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<any>;};
 const mint=async(person:typeof owner,scopes=['initiatives:read','initiatives:write'])=>(await json(await person.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-1780',scopes}),201)).token as string;
 const api=(token:string,path:string,method='GET',body?:unknown)=>app.request(origin+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},bindings);
 const token=await mint(owner),readToken=await mint(owner,['initiatives:read']);
 const root=await json(await api(token,'/initiatives','POST',{name:'synthetic-vector-1781',ownerOperatorId:w.member.id,description:'Across two teams',targetDate:'2027-04-01'}),201);
 const child=await json(await w.member.call('/initiatives','POST',{name:'synthetic-vector-1782',ownerOperatorId:w.member.id,parentId:root.id,status:'active'}),201);
 const third=await json(await owner.call('/initiatives','POST',{name:'synthetic-vector-1783',ownerOperatorId:w.owner,parentId:child.id}),201);
 expect((await owner.call('/initiatives','POST',{name:'synthetic-vector-1784',ownerOperatorId:w.owner,parentId:third.id})).status).toBe(400);
 expect((await owner.call('/initiatives/'+root.id,'PATCH',{expectedVersion:root.version,parentId:third.id})).status).toBe(400);
 const projects=[];
 for(let i=0;i<3;i++){const name='synthetic-vector-178'+(5+i),state=await json(await owner.call('/settings/projects','POST',{name,leadOperatorId:w.owner}));projects.push(state.projects.find((p:any)=>p.name===name));await w.create({teamId:i===0?w.team.id:w.initial.teams[0].id,projectId:projects[i].id,title:'synthetic-vector-1788-'+i});}
 const linked=await json(await api(token,'/initiatives/'+root.id+'/projects','PUT',{expectedVersion:root.version,projectIds:[projects[0].id]}));
 const childLinked=await json(await w.member.call('/initiatives/'+child.id+'/projects','PUT',{expectedVersion:child.version,projectIds:projects.map(p=>p.id)}));
 const detail=await json(await w.member.call('/initiatives/'+root.id));
 expect(detail.nodes.map((n:any)=>[n.name,n.depth])).toEqual([[root.name,1],[child.name,2],[third.name,3]]);
 expect(detail.nodes[0].projects.map((p:any)=>p.id)).toEqual([projects[0].id]);
 expect(new Set(detail.nodes[1].projects.map((p:any)=>p.id))).toEqual(new Set(projects.map(p=>p.id)));
 expect(new Set(detail.nodes.flatMap((n:any)=>n.projects.flatMap((p:any)=>p.teams)))).toEqual(new Set([w.team.name,w.initial.teams[0].name]));
 expect(detail.status,'persisted Planned initiative readback').toBe('planned');
 expect(detail).toMatchObject({ownerOperatorId:w.member.id,targetDate:'2027-04-01',description:'Across two teams'});
 expect((await api(readToken,'/initiatives/'+root.id,'PATCH',{expectedVersion:linked.version,status:'completed'})).status).toBe(401);
 const updated=await json(await api(token,'/initiatives/'+root.id,'PATCH',{expectedVersion:linked.version,status:'completed',description:'Updated direction'}));expect(updated.status).toBe('completed');
 expect((await api(token,'/initiatives/'+root.id,'PATCH',{expectedVersion:linked.version,status:'active'})).status).toBe(409);
 const page=await json(await api(readToken,'/initiatives?limit=1'));expect(page.initiatives).toHaveLength(1);expect(page.nextCursor).toBeTypeOf('string');
 const next=await json(await api(readToken,'/initiatives?limit=1&cursor='+encodeURIComponent(page.nextCursor)));expect(next.initiatives[0].id).not.toBe(page.initiatives[0].id);
 const scoped=await json(await api(readToken,'/initiatives?parent='+root.id));expect(scoped.initiatives.map((n:any)=>n.id)).toEqual([child.id]);
 const guest=await w.fresh('member'),guestToken=await mint(guest);
 expect((await owner.call('/settings/operators/'+guest.id+'/role','PATCH',{role:'guest',teamIds:[w.team.id]})).status).toBe(200);
 expect((await w.member.call('/settings/integrations/channels','POST',{scope:'initiative',objectId:root.id,provider:'slack',channelId:'CINITIATIVE',channelName:'refused',events:['initiative.updated']})).status).toBe(403);
 await scopedInitiativeDoors(w,json,root,child,projects,guest);
 const before=await snapshot(['initiatives','initiative_projects','initiative_graph','audit_records','vector_webhook_events']);
 for(const send of [guest.call,(p:string,m?:string,b?:unknown)=>api(guestToken,p,m,b)])for(const [path,method,body] of [
  ['/initiatives','GET',undefined],['/initiatives','POST',{name:'Guest initiative',ownerOperatorId:guest.id}],['/initiatives/'+root.id,'GET',undefined],
  ['/initiatives/'+root.id,'PATCH',{expectedVersion:updated.version,status:'active'}],['/initiatives/'+root.id+'/projects','PUT',{expectedVersion:updated.version,projectIds:[]}]
 ] as const)expect((await send(path,method,body)).status).toBe(403);
 expect(await snapshot(['initiatives','initiative_projects','initiative_graph','audit_records','vector_webhook_events'])).toEqual(before);
 expect((await guest.call('/subscriptions','POST',{subjectType:'initiative',subjectId:root.id})).status).toBe(404);
 // A fresh recipient follows only the initiative: project/team/view matches cannot carry this proof.
 const recipient=await w.fresh('member');
 await json(await recipient.call('/settings/notifications','PATCH',{mutedKinds:[]}));
 const sub=await json(await recipient.call('/subscriptions','POST',{subjectType:'initiative',subjectId:root.id}),201);
 const subscriptions=await json(await recipient.call('/subscriptions'));
 expect(subscriptions.subscriptions.map((s:any)=>[s.subjectType,s.subjectId])).toEqual([['initiative',root.id]]);
 const matching=await w.create({teamId:w.initial.teams[0].id,projectId:projects[1].id,title:'synthetic-vector-1789'});
 const notices=async()=> (await json(await recipient.call('/notifications?limit=50'))).items.filter((n:any)=>n.identifier===matching.identifier);
 expect(await notices(),'initiative-only creation notice').toHaveLength(1);
 const started=w.initial.teams[0].statuses.find(s=>s.category==='started')!;
 await json(await owner.call('/issues/'+matching.identifier,'PATCH',{expectedVersion:matching.version,statusId:started.id}));
 expect(await notices(),'initiative-only status-change notice').toHaveLength(2);
 expect(await notices(),'rereading preserves exactly two initiative-only notices').toHaveLength(2);
 expect((await recipient.call('/subscriptions/'+sub.id,'DELETE')).status).toBe(200);
 expect(childLinked.nodes[0].projects).toHaveLength(3);
}

/** ct 27 Oct (INIT-001): the scoped capability at its public doors; Discord destinations need no network to bind. */
async function scopedInitiativeDoors(w:Awaited<ReturnType<typeof roleWorkspace>>,json:(r:Response,status?:number)=>Promise<any>,root:{id:string},child:{id:string},projects:{id:string}[],guest:Person){
 const owner=w.people.owner,approvals='/settings/integrations/channels/initiative-approvals',door='/initiatives/'+root.id+'/channel-binding';
 const custody=()=>snapshot(['vector_initiative_destination_approvals','vector_initiative_scoped_bindings','vector_initiative_channel_bindings','vector_webhook_destinations','vector_integration_secret_keys','vector_webhook_events','audit_records']);
 const sources:string[]=[];
 for(const [i,project] of projects.entries())sources.push((await json(await owner.call('/settings/integrations/channels','POST',{scope:'project',objectId:project.id,provider:'discord',channelName:'synthetic-vector-184'+i,events:['issue.created'],webhookUrl:'https://discord.com/api/webhooks/184'+i+'/synthetic-vector-1845'}),201)).id);
 const approvalInput={provider:'discord',initiativeId:root.id,destinationId:sources[0],audience:'workspace'};
 const first=await snapshot(['vector_initiative_destination_approvals','audit_records']);
 expect(await json(await owner.call(approvals,'POST',approvalInput),201)).toMatchObject({changed:true});
 const approved=await snapshot(['vector_initiative_destination_approvals','audit_records']);
 expect(approved).not.toEqual(first);
 expect(await json(await owner.call(approvals,'POST',approvalInput),201)).toMatchObject({changed:false});
 expect(await snapshot(['vector_initiative_destination_approvals','audit_records'])).toEqual(approved);
 await json(await w.admin.call(approvals,'POST',{provider:'discord',initiativeId:child.id,destinationId:sources[1],audience:'workspace'}),201);
 const approval=(await json(await owner.call('/settings/integrations/channels'))).approvals.find((a:any)=>a.initiativeId===root.id).id;
 const viewer=await w.fresh('member');expect((await owner.call('/settings/operators/'+viewer.id+'/role','PATCH',{role:'viewer',teamIds:[]})).status).toBe(200);
 // (f) A Member stays refused at the administration and approval doors.
 let unchanged=await custody();
 expect((await w.member.call(approvals,'POST',{provider:'discord',initiativeId:root.id,destinationId:sources[2],audience:'workspace'})).status).toBe(403);
 expect((await w.member.call(approvals+'/'+approval,'DELETE')).status).toBe(403);
 expect((await w.member.call('/settings/integrations/channels/'+sources[0],'DELETE')).status).toBe(403);
 expect(await custody()).toEqual(unchanged);
 // (d) Guests and Viewers are refused at every scoped door with no effect.
 for(const person of [guest,viewer])for(const [method,body] of [['GET',undefined],['PUT',{provider:'discord',channelId:'1840',events:['initiative.updated'],expectedVersion:null}],['DELETE',{expectedVersion:sources[0]}]] as const)expect((await person.call(door,method,body)).status,person.id+' '+method).toBe(403);
 expect(await custody()).toEqual(unchanged);
 // (a) An editing Member sees only this initiative's approvals and binds one with chosen events.
 const editor=await w.fresh('member'),second=await w.fresh('member'),state=await json(await editor.call(door));
 expect(state).toEqual({destinations:[{provider:'discord',channelId:'1840',channelName:'synthetic-vector-1840'}],binding:null,version:null,canManage:false});
 let saved=await json(await editor.call(door,'PUT',{provider:'discord',channelId:'1840',events:['initiative.created','initiative.updated'],expectedVersion:null}));
 expect((await json(await editor.call(door))).binding).toMatchObject({id:saved.version,provider:'discord',channelId:'1840',events:['initiative.created','initiative.updated'],live:true});
 // (b) Unapproved identities and (e) stale versions refuse with no row.
 unchanged=await custody();
 for(const [channelId,channelName] of [['1841','synthetic-vector-1841'],['1842','synthetic-vector-1842'],['1843','synthetic-vector-1840']])expect((await editor.call(door,'PUT',{provider:'discord',channelId,channelName,events:['initiative.updated'],expectedVersion:saved.version})).status,'unapproved '+channelId).toBe(403);
 expect((await editor.call(door,'PUT',{provider:'discord',channelId:'1840',events:['initiative.updated'],expectedVersion:null})).status,'stale save').toBe(409);
 expect((await editor.call(door,'DELETE',{expectedVersion:sources[0]})).status,'stale withdrawal').toBe(409);
 expect(await custody()).toEqual(unchanged);
 // (c) A demoted editor is refused at once; another editor withdraws the binding.
 expect((await owner.call('/settings/operators/'+editor.id+'/role','PATCH',{role:'viewer',teamIds:[]})).status).toBe(200);
 unchanged=await custody();
 expect((await editor.call(door,'PUT',{provider:'discord',channelId:'1840',events:['initiative.updated'],expectedVersion:saved.version})).status).toBe(403);
 expect(await custody()).toEqual(unchanged);
 expect((await json(await second.call(door))).binding).toMatchObject({id:saved.version,live:false,notPosting:{code:'binder_cannot_edit'}});
 expect((await json(await owner.call(door))).binding).toMatchObject({live:false,notPosting:{code:'binder_cannot_edit'}});
 expect((await owner.call('/settings/operators/'+editor.id+'/role','PATCH',{role:'member',teamIds:[]})).status).toBe(200);
 await json(await owner.call(approvals+'/'+approval,'DELETE'));
 for(const person of [second,owner])expect((await json(await person.call(door))).binding).toMatchObject({live:false,notPosting:{code:'approval_withdrawn'}});
 expect(await json(await owner.call(approvals,'POST',approvalInput),201)).toMatchObject({changed:true});
 for(const person of [second,owner])expect((await json(await person.call(door))).binding).toMatchObject({live:false,notPosting:{code:'approved_again'}});
 expect(await json(await second.call(door,'DELETE',{expectedVersion:saved.version}))).toEqual({removed:true,version:null});
 expect((await json(await second.call(door))).binding).toBeNull();
 // A source replacement preserves the approval row while removing its posting authority.
 const settings=async()=>json(await owner.call('/settings/integrations/channels'));
 const approvalRows=async()=>(await env.DB.prepare('SELECT * FROM vector_initiative_destination_approvals ORDER BY id').all()).results;
 const approvalAudits=()=>snapshot(['audit_records']);
 const destinationRow=(id:string)=>env.DB.prepare('SELECT enabled,revoked_at FROM vector_webhook_destinations WHERE id=?').bind(id).first();
 const oldApproval=(await approvalRows()).find(row=>row.initiative_id===root.id)!;
 saved=await json(await second.call(door,'PUT',{provider:'discord',channelId:'1840',events:['initiative.updated'],expectedVersion:null}));
 let replacement=(await json(await owner.call('/settings/integrations/channels','POST',{scope:'project',objectId:projects[0].id,provider:'discord',channelName:'synthetic-vector-1840',events:['issue.created'],webhookUrl:'https://discord.com/api/webhooks/1840/synthetic-vector-1845'}),201)).id;
 expect(await destinationRow(sources[0])).toMatchObject({enabled:0,revoked_at:expect.any(String)});
 expect(await destinationRow(replacement)).toMatchObject({enabled:1,revoked_at:null});
 expect(await destinationRow(saved.id)).toMatchObject({enabled:1,revoked_at:null});
 expect((await approvalRows()).find(row=>row.id===oldApproval.id)).toEqual(oldApproval);
 const sourceChanged=async(approvalId:unknown,sourceAvailable:boolean)=>{
  const reason={code:'source_changed',sourceAvailable};
  for(const person of [second,owner])expect(await json(await person.call(door))).toMatchObject({destinations:[],binding:{id:saved.id,live:false,notPosting:reason}});
  const current=await settings();
  expect(current.approvals.find((a:any)=>a.id===approvalId)).toMatchObject({usable:false,notPosting:reason});
  expect(current.bindings.find((b:any)=>b.id===saved.id)).toMatchObject({scoped:true,needsAttention:false,notPosting:reason});
  unchanged=await custody();
  expect((await second.call(door,'PUT',{provider:'discord',channelId:'1840',events:['initiative.updated'],expectedVersion:saved.version})).status).toBe(403);
  expect(await custody()).toEqual(unchanged);
 };
 await sourceChanged(oldApproval.id,true);
 const beforeRows=await approvalRows(),beforeAudits=await approvalAudits();
 expect(await json(await owner.call(approvals,'POST',{...approvalInput,destinationId:replacement}),201)).toMatchObject({changed:true});
 let freshApproval=(await approvalRows()).find(row=>row.initiative_id===root.id)!;
 expect(freshApproval.id).not.toBe(oldApproval.id);expect(freshApproval.source_destination_id).toBe(replacement);
 expect(await approvalRows()).toHaveLength(beforeRows.length);expect((await approvalAudits()).audit_records).toHaveLength(beforeAudits.audit_records.length+1);
 for(const person of [second,owner])expect((await json(await person.call(door))).binding).toMatchObject({live:false,notPosting:{code:'approved_again'}});
 expect((await settings()).approvals.find((a:any)=>a.id===freshApproval.id)).toMatchObject({usable:true,notPosting:{code:'approved_again'}});
 // Before the Member saves, a second source change is explained by the current approval.
 expect(await env.DB.prepare('SELECT approval_id FROM vector_initiative_scoped_bindings WHERE destination_id=?').bind(saved.id).first()).toEqual({approval_id:oldApproval.id});
 expect((await approvalRows()).find(row=>row.id===oldApproval.id)).toBeUndefined();
 await json(await owner.call('/settings/integrations/channels/'+replacement,'DELETE'));
 expect(await destinationRow(replacement)).toMatchObject({enabled:0,revoked_at:expect.any(String)});
 expect((await approvalRows()).find(row=>row.id===freshApproval.id)).toEqual(freshApproval);
 await sourceChanged(freshApproval.id,false);
 replacement=(await json(await owner.call('/settings/integrations/channels','POST',{scope:'project',objectId:projects[0].id,provider:'discord',channelName:'synthetic-vector-1840',events:['issue.created'],webhookUrl:'https://discord.com/api/webhooks/1840/synthetic-vector-1845'}),201)).id;
 await sourceChanged(freshApproval.id,true);
 expect(await json(await owner.call(approvals,'POST',{...approvalInput,destinationId:replacement}),201)).toMatchObject({changed:true});
 const pendingApproval=freshApproval;freshApproval=(await approvalRows()).find(row=>row.initiative_id===root.id)!;
 expect(freshApproval.id).not.toBe(pendingApproval.id);expect(freshApproval.source_destination_id).toBe(replacement);
 saved=await json(await second.call(door,'PUT',{provider:'discord',channelId:'1840',events:['initiative.updated'],expectedVersion:saved.version}));
 expect((await json(await second.call(door))).binding).toMatchObject({id:saved.id,live:true,notPosting:null});
 await json(await owner.call('/settings/integrations/channels/'+replacement,'DELETE'));
 expect(await destinationRow(replacement)).toMatchObject({enabled:0,revoked_at:expect.any(String)});
 expect((await approvalRows()).find(row=>row.id===freshApproval.id)).toEqual(freshApproval);
 await sourceChanged(freshApproval.id,false);
 await json(await second.call(door,'DELETE',{expectedVersion:saved.version}));
}
