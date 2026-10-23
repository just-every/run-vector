import {expect} from 'vitest';
import type {roleWorkspace} from './role-fixture';
import {snapshot} from './role-fixture';
import {createServerApp} from '../../src/core/app/server';
import {bindings,origin} from './base-auth-fixture';
export async function exerciseReleases(w:Awaited<ReturnType<typeof roleWorkspace>>){
 const owner=w.people.owner,app=createServerApp();
 const json=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};
 const mint=async(person:typeof owner,scopes:string[])=> (await json(await person.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-1740',scopes}),201)).token as string;
 const api=(token:string,path:string,method='GET',body?:unknown,site=origin)=>app.request(origin+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+token,Origin:site,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},bindings);
 const token=await mint(owner,['releases:read','releases:write']),read=await mint(owner,['releases:read']);
 const release=await json(await api(token,'/releases','POST',{name:'2.4',targetDate:'2027-01-24',description:'synthetic-vector-1741 delivery'}),201);
 const projectState=await json(await owner.call('/settings/projects','POST',{name:'synthetic-vector-1742 release project',leadOperatorId:w.owner}));
 const project=projectState.projects.find((p:any)=>p.name==='synthetic-vector-1742 release project');
 const team=w.initial.teams[0],done=team.statuses.find(s=>s.category==='completed')!;
 const issues=[];
 for(let i=0;i<5;i++)issues.push(await w.create({title:'synthetic-vector-174'+(3+i),projectId:project.id,...(i<2?{statusId:done.id}:{})}));
 const blocker=await w.create({title:'synthetic-vector-1748 blocker'});
 expect((await owner.call('/issues/'+issues[2].identifier+'/dependencies','POST',{expectedVersion:issues[2].version,relatedIdentifier:blocker.identifier,relatedVersion:blocker.version,direction:'blocked-by'})).status).toBe(200);
 const configured=await json(await owner.call('/settings/integrations/github','POST',{name:'synthetic-vector-1749',repository:'synthetic-vector-1749/release'}),201);
 const body=JSON.stringify({action:'opened',number:24,repository:{full_name:'synthetic-vector-1749/release'},pull_request:{number:24,title:'Refs '+issues[2].identifier,body:null,html_url:'https://github.com/synthetic-vector-1749/release/pull/24',state:'open',merged:false,updated_at:'2026-10-23T13:00:00.000Z'}});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(configured.secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 expect((await app.request(configured.receiver,{method:'POST',headers:{'X-GitHub-Event':'pull_request','X-GitHub-Delivery':crypto.randomUUID(),'X-Hub-Signature-256':'sha256='+signature,'Content-Type':'application/json'},body},bindings)).status).toBe(200);
 const scoped=await json(await api(token,'/releases/'+release.id+'/scope','PUT',{expectedVersion:release.version,issueIdentifiers:issues.slice(0,2).map(i=>i.identifier),projectIds:[project.id]}));
 expect(scoped.total).toBe(5);expect(scoped.completed).toBe(2);expect(scoped.blockers).toEqual([{identifier:blocker.identifier,title:'synthetic-vector-1748 blocker',blockedIdentifier:issues[2].identifier}]);
 expect(scoped.pullRequests).toEqual([{repository:'synthetic-vector-1749/release',number:24,title:'Refs '+issues[2].identifier,url:'https://github.com/synthetic-vector-1749/release/pull/24',state:'open'}]);
 expect((await api(read,'/releases/'+release.id,'PATCH',{expectedVersion:scoped.version,status:'released'})).status).toBe(401);
 expect((await api(token,'/releases/'+release.id,'PATCH',{expectedVersion:scoped.version,status:'released'},'https://foreign.example.test')).status).toBe(403);
 const published=await json(await api(token,'/releases/'+release.id,'PATCH',{expectedVersion:scoped.version,status:'released'}));
 expect(published.targetDate).toBe('2027-01-24');expect(published.description).toBe('synthetic-vector-1741 delivery');
 expect((await api(token,'/releases/'+release.id,'PATCH',{expectedVersion:scoped.version,status:'planned'})).status).toBe(409);
 for(const issue of issues){
  const detail=await json(await owner.call('/issues/'+issue.identifier));
  expect(detail.activity.filter((a:any)=>a.kind==='release.published'&&a.nextValue.releaseId===release.id)).toHaveLength(1);
  expect((await json(await owner.call('/issues/'+issue.identifier+'/releases'))).releases).toContainEqual(expect.objectContaining({id:release.id,status:'released'}));
 }
 const unchanged=await json(await api(token,'/releases/'+release.id,'PATCH',{expectedVersion:published.version,status:'released'}));
 for(const issue of issues){const detail=await json(await owner.call('/issues/'+issue.identifier));expect(detail.activity.filter((a:any)=>a.kind==='release.published')).toHaveLength(1);}
 expect((await api(token,'/releases/'+release.id+'/scope','PUT',{expectedVersion:unchanged.version,issueIdentifiers:[],projectIds:[]})).status).toBe(409);
 const before=await snapshot(['releases','release_issues','release_projects','issue_activity','audit_records']);
 for(const [path,method,payload] of [['/releases','POST',{name:'Guest release'}],['/releases/'+release.id,'GET',undefined],['/releases/'+release.id,'PATCH',{expectedVersion:unchanged.version,status:'planned'}],['/releases/'+release.id+'/scope','PUT',{expectedVersion:unchanged.version,issueIdentifiers:[],projectIds:[]}]] as const)expect((await w.guest.call(path,method,payload)).status).toBe(403);
 expect(await snapshot(['releases','release_issues','release_projects','issue_activity','audit_records'])).toEqual(before);
 const page=await json(await api(read,'/releases?limit=1'));expect(page.releases).toHaveLength(1);expect(page.total).toBeGreaterThan(0);
 const memberToken=await mint(w.people.member,['releases:read','releases:write']);
 expect((await api(memberToken,'/releases','POST',{name:'synthetic-vector-1750 member release',teamId:w.team.id})).status).toBe(201);
 const guest=await w.fresh('member'),guestToken=await mint(guest,['releases:read','releases:write']);
 expect((await owner.call('/settings/operators/'+guest.id+'/role','PATCH',{role:'guest',teamIds:[w.team.id]})).status).toBe(200);
 for(const [path,method,payload] of [['/releases','POST',{name:'Guest release'}],['/releases/'+release.id,'GET',undefined],['/releases/'+release.id,'PATCH',{expectedVersion:unchanged.version,status:'planned'}],['/releases/'+release.id+'/scope','PUT',{expectedVersion:unchanged.version,issueIdentifiers:[],projectIds:[]}]] as const)expect((await api(guestToken,path,method,payload)).status).toBe(403);
}
