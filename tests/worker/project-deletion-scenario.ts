import {projectDeletionArchive} from './project-deletion-archive';
import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {createServerApp} from '../../src/core/app/server';
import {bindings,request,signIn} from './base-auth-fixture';
import {roleWorkspace,snapshot,resetLimits} from './role-fixture';
const tables=['projects','issues','project_milestones','documents','document_revisions','project_deletions','project_deletion_memberships','project_activity','issue_activity','audit_records','administration_audit_details'];
const read=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};
/** Real mounted deletion and recovery doors, including unsafe paths with a full
 * snapshot of the retained content, recovery ledger and attributed history. */
export async function projectDeletionScenario(f:Awaited<ReturnType<typeof roleWorkspace>>) {
 const create=async(name:string)=>(await f.mutate('/settings/projects','POST',{name,description:'synthetic-vector-9601',leadOperatorId:f.lead.id})).projects.find(p=>p.name===name)!;
 const project=await create('synthetic-vector-9600'),destination=await create('synthetic-vector-9602');
 const milestoneDetail=await read(await f.call('/settings/projects/'+project.id+'/milestones','POST',{name:'synthetic-vector-9603',description:'synthetic-vector-9604'}));
 const milestone=milestoneDetail.milestones.find((m:any)=>m.name==='synthetic-vector-9603');
 const issues=[];
 for(let i=0;i<4;i++)issues.push(await f.create({projectId:project.id,milestoneId:milestone.id,title:'synthetic-vector-'+(9610+i),description:'synthetic-vector-9614'}));
 const doc=await read(await f.call('/documents','POST',{parentKind:'project',parentId:project.id,title:'synthetic-vector-9615',body:'synthetic-vector-9616'}),201);
 const initial=await read(await f.call('/projects/'+project.id));
 const remove=async()=>{const response=await f.call('/settings/projects/'+project.id,'DELETE');expect(response.status,await response.clone().text()).toBe(200);return JSON.parse(response.headers.get('x-vector-project-undo')!);};
 const refused=async(call:()=>Promise<Response>,status:number)=>{const before=await snapshot(tables);expect((await call()).status).toBe(status);expect(await snapshot(tables)).toEqual(before);};
 const viewer=await f.fresh('member');
 await f.mutate('/settings/operators/'+viewer.id+'/role','PATCH',{role:'viewer'});
 let receipt=await remove();
 // The native deleting session alone can Undo, and a replay changes nothing.
 expect(await read(await f.call('/projects/undo-deletion','POST',{id:receipt.id,version:1}))).toEqual({projectId:project.id});
 let restored=await read(await f.call('/projects/'+project.id));
 expect(restored).toMatchObject({id:project.id,name:project.name,description:project.description,milestones:initial.milestones});
 for(const issue of issues)expect(await read(await f.call('/issues/'+issue.identifier))).toMatchObject({id:issue.id,project:{id:project.id},milestone:{id:milestone.id}});
 expect(await read(await f.call('/documents/'+doc.id))).toMatchObject({id:doc.id,body:doc.body});
 expect(restored.activity.filter((a:any)=>a.kind==='project.restored')).toHaveLength(1);
 await refused(()=>f.call('/projects/undo-deletion','POST',{id:receipt.id,version:1}),409);
 await resetLimits();
 receipt=await remove();
 const foreignCookie=await signIn();
 await refused(()=>request('/api/projects/undo-deletion','POST',{id:receipt.id,version:1},foreignCookie),409);
 for(const surface of ['call','api'] as const){
  expect((await f.people.owner[surface]('/projects/'+project.id)).status).toBe(404);
  expect((await read(await f.people.owner[surface]('/projects?includeArchived=true'))).projects.some((p:any)=>p.id===project.id)).toBe(false);
 }
 expect((await f.call('/documents/'+doc.id)).status).toBe(404);
 expect((await f.call('/documents/'+doc.id,'PATCH',{expectedVersion:doc.version,body:'synthetic-vector-refused'})).status).toBe(404);
 expect((await read(await f.call('/search?q=synthetic-vector-9600&includeArchived=true'))).projects).toEqual([]);
 expect((await read(await f.call('/search?q=synthetic-vector-9615&includeArchived=true'))).documents).toEqual([]);
 expect((await read(await f.call('/settings/administration'))).projects.some((p:any)=>p.id===project.id)).toBe(false);
 for(const issue of issues)expect(await read(await f.call('/issues/'+issue.identifier))).toMatchObject({id:issue.id,title:issue.title,description:issue.description,project:null,milestone:null});
 for(const who of [f.lead,f.member,f.guest,viewer])for(const surface of ['call','api'] as const){
  await refused(()=>who[surface]('/projects/restore','POST',{id:receipt.id,version:1}),403);
  await refused(()=>who[surface]('/projects/recently-deleted'),403);
 }
 await refused(()=>f.admin.call('/projects/undo-deletion','POST',{id:receipt.id,version:1}),409);
 await refused(()=>f.call('/projects/restore','POST',{id:receipt.id,version:2}),409);
 // Reassignment, reassign then clear, explicit null, and a non-membership edit.
 const patch=async(i:number,change:Record<string,unknown>)=>{const current=await read(await f.call('/issues/'+issues[i].identifier));return read(await f.call('/issues/'+current.identifier,'PATCH',{expectedVersion:current.version,...change}));};
 await patch(0,{projectId:destination.id});
 await patch(1,{projectId:destination.id});await patch(1,{projectId:null});
 await patch(2,{projectId:null});
 await patch(3,{title:'synthetic-vector-9620'});
 await refused(()=>f.call('/projects/undo-deletion','POST',{id:receipt.id,version:1}),409);
 const recent=(await read(await f.admin.call('/projects/recently-deleted'))).projects.find((p:any)=>p.projectId===project.id);
 expect(recent).toMatchObject({id:receipt.id,version:1,actorName:expect.any(String),deletedAt:expect.any(String)});
 // Recreate the HTTP app to prove no in-memory deletion state is needed.
 const restarted=createServerApp();
 const response=await restarted.request(bindings.APP_ORIGIN+'/api/projects/restore',{method:'POST',headers:{host:new URL(bindings.APP_ORIGIN).host,origin:bindings.APP_ORIGIN,cookie:f.admin.cookie,'content-type':'application/json'},body:JSON.stringify({id:recent.id,version:recent.version})},bindings);
 await read(response);
 expect((await read(await f.call('/issues/'+issues[0].identifier))).project.id).toBe(destination.id);
 for(const i of [1,2])expect((await read(await f.call('/issues/'+issues[i].identifier))).project).toBeNull();
 expect(await read(await f.call('/issues/'+issues[3].identifier))).toMatchObject({title:'synthetic-vector-9620',project:{id:project.id},milestone:{id:milestone.id}});
 restored=await read(await f.call('/projects/'+project.id));
 expect(restored.activity.filter((a:any)=>a.kind==='project.restored')).toHaveLength(2);
 await refused(()=>f.admin.api('/projects/restore','POST',{id:receipt.id,version:1}),409);
 receipt=await remove();
 await env.DB.prepare("UPDATE project_deletions SET undo_until=datetime('now','-1 second') WHERE id=?").bind(receipt.id).run();
 await refused(()=>f.call('/projects/undo-deletion','POST',{id:receipt.id,version:1}),409);
 // Current authority, revoked sessions and old receipts never carry authority.
 const otherCookie=await signIn();
 await refused(()=>request('/api/projects/undo-deletion','POST',{id:receipt.id,version:1},otherCookie),409);
 await f.mutate('/settings/operators/'+f.admin.id+'/role','PATCH',{role:'member'});
 await refused(()=>f.admin.api('/projects/restore','POST',{id:receipt.id,version:1}),403);
 await f.mutate('/settings/operators/'+f.admin.id+'/role','PATCH',{role:'admin'});
 // The supported scoped restore uses the same native transaction and identity.
 await read(await f.admin.api('/projects/restore','POST',{id:receipt.id,version:1}));
 receipt=await remove();
 const concurrent=await Promise.all([f.call('/projects/restore','POST',{id:receipt.id,version:1}),f.call('/projects/restore','POST',{id:receipt.id,version:1})]);
 expect(concurrent.map(r=>r.status).sort()).toEqual([200,409]);
 expect((await read(await f.call('/projects/'+project.id))).activity.filter((a:any)=>a.kind==='project.restored')).toHaveLength(4);
 // Current private-team visibility is checked from the retained source teams,
 // even after the issues have been detached or reassigned elsewhere.
 const hiddenTeam=(await f.mutate('/settings/teams','POST',{name:'synthetic-vector-9630',identifierPrefix:'SYNREC',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-9630')!;
 const hidden=await create('synthetic-vector-9631');
 await f.create({teamId:hiddenTeam.id,projectId:hidden.id});
 const hiddenResponse=await f.call('/settings/projects/'+hidden.id,'DELETE');expect(hiddenResponse.status).toBe(200);
 const hiddenReceipt=JSON.parse(hiddenResponse.headers.get('x-vector-project-undo')!);
 expect((await read(await f.admin.call('/projects/recently-deleted'))).projects.some((p:any)=>p.projectId===hidden.id)).toBe(false);
 await refused(()=>f.admin.call('/projects/restore','POST',{id:hiddenReceipt.id,version:1}),409);
 await f.mutate('/settings/teams/'+hiddenTeam.id+'/members/'+f.admin.id,'PUT',{role:'member'});
 expect((await read(await f.admin.call('/projects/recently-deleted'))).projects.some((p:any)=>p.projectId===hidden.id)).toBe(true);
 await f.mutate('/settings/teams/'+hiddenTeam.id+'/members/'+f.admin.id,'DELETE');
 await refused(()=>f.admin.api('/projects/restore','POST',{id:hiddenReceipt.id,version:1}),409);
 await read(await f.call('/projects/restore','POST',{id:hiddenReceipt.id,version:1}));
 await projectDeletionArchive(f,project.id,doc,issues[3].id);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}
