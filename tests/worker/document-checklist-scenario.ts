import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {readArchive} from '@runeditrun/rer/modules/portability';
import {roleWorkspace,resetLimits} from './role-fixture';
import {heldBody} from './removal-fixture';
import {createServerApp} from '../../src/core/app/server';
import {bindings,origin,request} from './base-auth-fixture';

const read=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};

/** Real document revisions, concurrent ticks, current roles, privacy and portability. */
export async function documentChecklistScenario(){
 const w=await roleWorkspace(),owner=w.people.owner,body='- [ ] Review draft\n- [ ] Publish notes';
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name NOT IN ('integration_token_usage','access_rate_limits') ORDER BY name").all<{name:string}>()).results;
 const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async({name})=>[name,(await env.DB.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all()).results.map(row=>JSON.stringify(row)).sort()])));
 const project=(await read(await owner.call('/settings/projects','POST',{name:'synthetic-vector-2510',leadOperatorId:owner.id}))).projects.find((p:any)=>p.name==='synthetic-vector-2510');
 const issue=await read(await owner.call('/issues','POST',{title:'synthetic-vector-2511',teamId:w.team.id,projectId:project.id,description:body}),201);
 const doc=await read(await owner.call('/documents','POST',{parentKind:'issue',parentId:issue.id,title:'synthetic-vector-2512',body}),201);
 const path='/documents/'+doc.id,task={expectedVersion:1,index:0,text:'Review draft',checked:true};
 const results=await Promise.all([w.member.call(path+'/checklist','POST',task),w.guest.call(path+'/checklist','POST',{...task,index:1,text:'Publish notes'})]);
 for(const response of results)await read(response);
 const changed=await read(await owner.call(path));
 expect(changed).toMatchObject({version:3,body:'- [x] Review draft\n- [x] Publish notes'});
 let history=(await read(await owner.call(path+'/revisions'))).revisions;
 expect(history).toHaveLength(3);
 expect(history.filter((r:any)=>r.checklist).map((r:any)=>r.checklist.text).sort()).toEqual(['Publish notes','Review draft']);
 const authors=(await env.DB.prepare('SELECT author_operator_id actor,version,checklist_json task FROM document_revisions WHERE document_id=? AND checklist_json IS NOT NULL ORDER BY version').bind(doc.id).all<{actor:string;version:number;task:string}>()).results;
 expect(authors.map(row=>row.actor).sort()).toEqual([w.member.id,w.guest.id].sort());
 const audit=(await env.DB.prepare("SELECT id,actor_operator_id actor FROM audit_records WHERE subject_id=? AND action='document.checklist'").bind(doc.id).all()).results;
 expect(audit).toHaveLength(2);
 expect(audit.map(row=>row.actor).sort()).toEqual([w.member.id,w.guest.id].sort());
 const unchanged=await snapshot();await read(await owner.call(path+'/checklist','POST',task));expect(await snapshot()).toEqual(unchanged);
 const unchecked=await read(await owner.call(path+'/checklist','POST',{...task,expectedVersion:3,checked:false}));
 expect(unchecked.body).toBe('- [ ] Review draft\n- [x] Publish notes');
 const edited=await read(await owner.call(path,'PATCH',{expectedVersion:unchecked.version,body:unchecked.body.replace('Review draft','Review replacement')}));
 const beforeConflict=await snapshot(),conflict=await read(await owner.call(path+'/checklist','POST',task),409);
 expect(conflict.document).toMatchObject({id:doc.id,version:edited.version,body:edited.body});expect(await snapshot()).toEqual(beforeConflict);
 for(const expectedVersion of [99]){await read(await owner.call(path+'/checklist','POST',{...task,expectedVersion}),409);expect(await snapshot()).toEqual(beforeConflict);}
 expect((await read(await owner.call('/issues/'+issue.identifier))).status.id).toBe(issue.status.id);
 expect((await read(await owner.call('/issues/'+issue.identifier))).version).toBe(issue.version);

 // All current role cells use the ordinary native and scoped issue doors.
 let memberComment='';
 for(const person of Object.values(w.people)){
  await resetLimits();
  for(const call of [person.call,person.api]){
   const before=await read(await owner.call('/issues/'+issue.identifier));
   const tick=await read(await call('/issues/'+issue.identifier+'/checklist','POST',{expectedVersion:before.version,index:0,text:'Review draft',checked:!before.description.includes('[x] Review draft')}));
   expect(tick.status.id).toBe(issue.status.id);expect(tick.version).toBe(before.version+1);
  }
  const comment=await read(await person.call('/issues/'+issue.identifier+'/comments','POST',{body}),201);
  if(person.id===w.member.id)memberComment=comment.id;
  await read(await person.api(`/issues/${issue.identifier}/comments/${comment.id}/checklist`,'POST',{expectedBody:body,expectedVersion:0,index:0,text:'Review draft',checked:true}));
  for(const other of Object.values(w.people).filter(p=>p.id!==person.id)){
   const before=await snapshot();
   expect((await other.call(`/issues/${issue.identifier}/comments/${comment.id}/checklist`,'POST',{expectedBody:body,index:1,text:'Publish notes',checked:true})).status).toBe(403);
   expect(await snapshot()).toEqual(before);
  }
 }
 const viewer=await w.fresh('member');await read(await owner.call('/settings/operators/'+viewer.id+'/role','PATCH',{role:'viewer'}));
 for(const call of [viewer.call,viewer.api]){
  const before=await snapshot();expect((await call('/issues/'+issue.identifier+'/checklist','POST',{expectedVersion:issue.version,index:0,text:'Review draft',checked:true})).status).toBe(403);expect(await snapshot()).toEqual(before);
 }
 for(const person of [...Object.values(w.people),viewer]){
  const current=await read(await owner.call(path)),before=await snapshot();
  const response=await person.call(path+'/checklist','POST',{expectedVersion:current.version,index:0,text:'Review replacement',checked:true});
  if(person===viewer){expect(response.status).toBe(403);expect(await snapshot()).toEqual(before);}
  else{expect((await read(response)).body).toBe('- [x] Review replacement\n- [x] Publish notes');await read(await owner.call(path+'/checklist','POST',{expectedVersion:current.version+1,index:0,text:'Review replacement',checked:false}));}
 }

 // A live session or token carries no authority across private membership withdrawal.
 await read(await owner.call('/settings/teams/'+w.team.id+'/privacy','PUT',{isPrivate:true}));
 await read(await owner.call(`/settings/teams/${w.team.id}/members/${w.member.id}`,'DELETE'));
 for(const call of [w.member.call,w.member.api]){
  const before=await snapshot();const response=await call('/issues/'+issue.identifier+'/checklist','POST',{expectedVersion:issue.version,index:0,text:'Review draft',checked:false});expect(response.status).toBe(404);expect(await snapshot()).toEqual(before);
  const refused=await call(`/issues/${issue.identifier}/comments/${memberComment}/checklist`,'POST',{expectedBody:body,expectedVersion:0,index:1,text:'Publish notes',checked:true});expect(refused.status).toBe(404);expect(await refused.text()).not.toContain('Publish notes');expect(await snapshot()).toEqual(before);
 }
 const hidden=await snapshot();expect((await w.member.call(path+'/checklist','POST',{...task,text:'Review replacement'})).status).toBe(404);expect(await snapshot()).toEqual(hidden);
 const adminHidden=await snapshot();expect((await w.admin.call(path+'/checklist','POST',{...task,text:'Review replacement'})).status).toBe(404);expect(await snapshot()).toEqual(adminHidden);
 const liveMember=await w.fresh('member'),heldRole=heldBody(),current=await read(await owner.call(path));
 const demoted=createServerApp().request(origin+'/api'+path+'/checklist',{method:'POST',headers:{Host:new URL(origin).host,Cookie:liveMember.cookie,Origin:origin,'content-type':'application/json'},body:heldRole.body},bindings);
 await heldRole.reading;
 await read(await owner.call('/settings/operators/'+liveMember.id+'/role','PATCH',{role:'viewer',teamIds:[w.team.id]}));
 const afterDemotion=await snapshot();heldRole.release(JSON.stringify({...task,expectedVersion:current.version,text:'Review replacement'}));
 expect(await read(await demoted,409)).toMatchObject({error:'authority_changed'});expect(await snapshot()).toEqual(afterDemotion);
 expect((await liveMember.call(path+'/checklist','POST',{...task,expectedVersion:current.version,text:'Review replacement'})).status).toBe(403);expect(await snapshot()).toEqual(afterDemotion);
 const held=heldBody(),app=createServerApp();
 const pending=app.request(origin+'/api'+path+'/checklist',{method:'POST',headers:{Host:new URL(origin).host,Cookie:w.guest.cookie,Origin:origin,'content-type':'application/json'},body:held.body},bindings);
 await held.reading;
 expect((await request('/auth/signout','POST',{},w.guest.cookie)).status).toBe(204);
 const afterSignout=await snapshot();held.release(JSON.stringify({...task,text:'Review replacement'}));
 const denied=await pending;expect(denied.status).toBe(401);expect(await denied.text()).not.toContain('Review replacement');expect(await snapshot()).toEqual(afterSignout);

 const exported=await read(await owner.call('/portability/exports','POST',{}),201);
 let state={phase:'building'};while(state.phase==='building')state=await read(await owner.call('/portability/exports/'+exported.id+'/advance','POST',{maxParts:16}));
 const download=await owner.call('/portability/exports/'+exported.id+'/download');expect(download.status).toBe(200);
 const items:any[]=[];for await(const record of readArchive(download.body!))if(record.kind==='part')items.push(...record.items);
 const revisions=items.filter(item=>item.kind==='row'&&item.table==='document_revisions'&&item.row.document_id===doc.id).map(item=>item.row);
 expect(revisions.map(r=>r.checklist_json).filter(Boolean)).toContain(JSON.stringify({index:0,text:'Review draft',checked:false}));
 expect(revisions).toHaveLength((await read(await owner.call(path))).version);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}
