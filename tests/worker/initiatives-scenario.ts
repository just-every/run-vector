import {expect} from 'vitest';
import type {roleWorkspace} from './role-fixture';
import {snapshot,resetLimits} from './role-fixture';
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
 expect(detail).toMatchObject({ownerOperatorId:w.member.id,targetDate:'2027-04-01',description:'Across two teams'});
 expect((await api(readToken,'/initiatives/'+root.id,'PATCH',{expectedVersion:linked.version,status:'completed'})).status).toBe(401);
 const updated=await json(await api(token,'/initiatives/'+root.id,'PATCH',{expectedVersion:linked.version,status:'completed',description:'Updated direction'}));expect(updated.status).toBe('completed');
 expect((await api(token,'/initiatives/'+root.id,'PATCH',{expectedVersion:linked.version,status:'active'})).status).toBe(409);
 const page=await json(await api(readToken,'/initiatives?limit=1'));expect(page.initiatives).toHaveLength(1);expect(page.nextCursor).toBeTypeOf('string');
 const next=await json(await api(readToken,'/initiatives?limit=1&cursor='+encodeURIComponent(page.nextCursor)));expect(next.initiatives[0].id).not.toBe(page.initiatives[0].id);
 const scoped=await json(await api(readToken,'/initiatives?parent='+root.id));expect(scoped.initiatives.map((n:any)=>n.id)).toEqual([child.id]);
 const guest=await w.fresh('member'),guestToken=await mint(guest);
 expect((await owner.call('/settings/operators/'+guest.id+'/role','PATCH',{role:'guest',teamIds:[w.team.id]})).status).toBe(200);
 const before=await snapshot(['initiatives','initiative_projects','initiative_graph','audit_records']);
 for(const send of [guest.call,(p:string,m?:string,b?:unknown)=>api(guestToken,p,m,b)])for(const [path,method,body] of [
  ['/initiatives','GET',undefined],['/initiatives','POST',{name:'Guest initiative',ownerOperatorId:guest.id}],['/initiatives/'+root.id,'GET',undefined],
  ['/initiatives/'+root.id,'PATCH',{expectedVersion:updated.version,status:'active'}],['/initiatives/'+root.id+'/projects','PUT',{expectedVersion:updated.version,projectIds:[]}]
 ] as const)expect((await send(path,method,body)).status).toBe(403);
 expect(await snapshot(['initiatives','initiative_projects','initiative_graph','audit_records'])).toEqual(before);
 expect((await guest.call('/subscriptions','POST',{subjectType:'initiative',subjectId:root.id})).status).toBe(404);
 await json(await w.member.call('/settings/notifications','PATCH',{mutedKinds:[]}));
 const sub=await json(await w.member.call('/subscriptions','POST',{subjectType:'initiative',subjectId:root.id}),201);
 await json(await w.member.call('/subscriptions','POST',{subjectType:'project',subjectId:projects[1].id}),201);
 const matching=await w.create({teamId:w.initial.teams[0].id,projectId:projects[1].id,title:'synthetic-vector-1789'});
 const notices=async()=> (await json(await w.member.call('/notifications?limit=50'))).items.filter((n:any)=>n.identifier===matching.identifier);
 expect(await notices()).toHaveLength(1);expect(await notices()).toHaveLength(1);
 const started=w.initial.teams[0].statuses.find(s=>s.category==='started')!;
 await json(await owner.call('/issues/'+matching.identifier,'PATCH',{expectedVersion:matching.version,statusId:started.id}));
 expect(await notices()).toHaveLength(2);
 expect((await w.member.call('/subscriptions/'+sub.id,'DELETE')).status).toBe(200);
 expect(childLinked.nodes[0].projects).toHaveLength(3);
}
