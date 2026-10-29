import { expect } from 'vitest';
import { collaborationFixture } from './collaboration-fixture';

type Issue={id:string;identifier:string;version:number;description:string;activity:{kind:string;nextValue:Record<string,unknown>}[]};
async function json<T>(response:Response,status=200):Promise<T>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>;}
export async function referenceScenario(){
 const f=await collaborationFixture(),target=await f.create({title:'Release blocker needs a verified fix'}),targetPath=`/issues/${target.identifier}`;
 const source=await f.create({title:'Investigate release blocker',description:`See ${target.identifier}; unknown SYNTHETIC_VECTOR-999999. Code \`${target.identifier}\` stays literal.`}),path=`/issues/${source.identifier}`;
 const read=()=>f.call(targetPath).then(r=>json<Issue>(r));
 const backlinks=(issue:Issue)=>issue.activity.filter(row=>row.kind==='issue.mentioned');
 const first=await read();expect(first.version).toBe(target.version);expect(backlinks(first)).toHaveLength(1);
 expect(backlinks(first)[0].nextValue).toMatchObject({sourceIssueId:source.id,identifier:source.identifier,removed:false});
 const refs=await json<{references:{identifier:string;title:string;status:{name:string}}[]}>(await f.call(path+'/references'));
 expect(refs.references.map(row=>row.identifier)).toEqual([target.identifier]);expect(refs.references[0].title).toBe(target.title);expect(refs.references[0].status.name.length).toBeGreaterThan(0);
 const comment=await json<{id:string}>(await f.call(path+'/comments','POST',{body:`Also see ${target.identifier}.`}),201);
 const edited=await json<Issue>(await f.call(path,'PATCH',{expectedVersion:source.version,description:`Still see ${target.identifier}.`}));
 expect(backlinks(await read())).toHaveLength(1);expect((await read()).version).toBe(target.version);
 const removed=await json<Issue>(await f.call(path,'PATCH',{expectedVersion:edited.version,description:'Reference removed from description.'}));
 expect(backlinks(await read())[0].nextValue.removed).toBe(false);
 await json(await f.call(path+'/comments/'+comment.id,'PATCH',{body:'Comment reference removed.'}));
 const gone=await read();expect(backlinks(gone)).toHaveLength(1);expect(backlinks(gone)[0].nextValue.removed).toBe(true);
 expect(await json(await f.call(path+'/references'))).toEqual({references:[]});
 await json(await f.call(path,'PATCH',{expectedVersion:removed.version,description:`Again ${target.identifier}.`}));
 expect(backlinks(await read())).toHaveLength(1);expect(backlinks(await read())[0].nextValue.removed).toBe(false);
 const before=await read();await json(await f.call(targetPath,'PATCH',{expectedVersion:target.version,title:'Release blocker fixed after a concurrent reference'}));
 expect((await read()).version).toBe(before.version+1);
 const code=await f.create({description:`\`${target.identifier}\` and [an external label](https://example.test/${target.identifier}) and &#86;EC-1 and SYNTHETIC_VECTOR-999999.`});
 expect(await json(await f.call(`/issues/${code.identifier}/references`))).toEqual({references:[]});
 const document=await json<any>(await f.call('/documents','POST',{parentKind:'issue',parentId:source.id,title:'synthetic-vector-35109',body:'See '+target.identifier}),201);
 expect(backlinks(await read()).filter(row=>row.nextValue.sourceDocumentId===document.id)).toHaveLength(1);
 const sourceNow=await json<Issue>(await f.call(path));await json(await f.call(path,'DELETE',{expectedVersion:sourceNow.version,confirmed:true}));
 expect(await (await import('cloudflare:workers')).env.DB.prepare('SELECT count(*) n FROM document_issue_references WHERE document_id=?').bind(document.id).first<number>('n')).toBe(0);
 expect(backlinks(await read())).toHaveLength(0);expect((await read()).version).toBe(target.version+1);

}

/** Real document subjects use current parent visibility on both read doors. */
export async function documentReferenceScenario(f:Awaited<ReturnType<typeof import('./administration-fixture').setupAdministration>>){
 const {env}=await import('cloudflare:workers');
 const {invite,actor,request}=await import('./base-auth-fixture');
 const {snapshot}=await import('./role-fixture');
 const sourceTeam=(await f.mutate('/settings/teams','POST',{name:'synthetic-vector-35101',identifierPrefix:'SYNDREF',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-35101')!;
 const hiddenTeam=(await f.mutate('/settings/teams','POST',{name:'synthetic-vector-35102',identifierPrefix:'SYNHREF',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-35102')!;
 const target=await f.create({title:'synthetic-vector-35103'}),hidden=await f.create({teamId:hiddenTeam.id,title:'synthetic-vector-35104'});
 const path='/issues/'+target.identifier,body=`See ${target.identifier} and ${hidden.identifier}; unknown SYNTHETIC_VECTOR-999999. Code \`${target.identifier}\` stays literal.`;
 const doc=await json<any>(await f.call('/documents','POST',{parentKind:'team',parentId:sourceTeam.id,title:'synthetic-vector-35105',body}),201);
 const docPath='/documents/'+doc.id;
 const links=async()=>{const issue=await json<Issue>(await f.call(path));expect(issue.version).toBe(target.version);return issue.activity.filter(a=>a.kind==='issue.mentioned'&&a.nextValue.sourceDocumentId===doc.id);};
 expect(doc.references.map((r:any)=>r.identifier).sort()).toEqual([target.identifier,hidden.identifier].sort());
 const original=(await links())[0];expect(original.nextValue).toEqual({sourceDocumentId:doc.id,title:doc.title,removed:false});
 expect(await links()).toHaveLength(1);
 const watched=['documents','document_revisions','document_issue_references','issue_activity','issues'];
 for(const role of ['member','viewer'] as const){
  const cookie=await invite(['synthetic-vector-35106-'+role,'vector.test'].join('@'),f.cookie,role),id=await actor(cookie);
  const call=(p:string,method='GET',value?:unknown)=>request('/api'+p,method,value,cookie);
  const absent=async()=>{
   expect((await call(docPath)).status).toBe(404);
   expect((await call(docPath+'/revisions')).status).toBe(404);
   const issue=await json<Issue>(await call(path));expect(JSON.stringify(issue)).not.toContain(doc.id);expect(JSON.stringify(issue)).not.toContain(doc.title);
  };
  await absent();
  await f.mutate(`/settings/teams/${sourceTeam.id}/members/${id}`,'PUT',{role:'member'});
  const visible=await json<any>(await call(docPath));
  expect(visible.references).toEqual([expect.objectContaining({identifier:target.identifier,title:'synthetic-vector-35103',status:expect.objectContaining({name:expect.any(String)})})]);
  expect((await json<Issue>(await call(path))).activity.filter(a=>a.nextValue?.sourceDocumentId===doc.id)).toHaveLength(1);
  if(role==='member'){
   const authored=await json<any>(await call('/documents','POST',{parentKind:'team',parentId:sourceTeam.id,title:'synthetic-vector-35107',body}),201);
   expect(authored.references.map((r:any)=>r.identifier)).toEqual([target.identifier]);
   expect((await json<Issue>(await f.call('/issues/'+hidden.identifier))).activity.filter(a=>a.nextValue?.sourceDocumentId===authored.id)).toHaveLength(0);
  }else{
   const before=await snapshot(watched);expect((await call(docPath,'PATCH',{expectedVersion:doc.version,body:'synthetic-vector-refused'})).status).toBe(403);expect(await snapshot(watched)).toEqual(before);
  }
  await f.mutate(`/settings/teams/${sourceTeam.id}/members/${id}`,'DELETE');
  await absent();
  const before=await snapshot(watched);expect((await call(docPath,'PATCH',{expectedVersion:doc.version,body:'synthetic-vector-refused'})).status).toBe(role==='viewer'?403:404);expect(await snapshot(watched)).toEqual(before);
 }
 const edited=await json<any>(await f.call(docPath,'PATCH',{expectedVersion:doc.version,title:'synthetic-vector-35108',body:'Still see '+target.identifier}));
 expect(await links()).toHaveLength(1);expect((await links())[0]).toMatchObject({id:(original as any).id,nextValue:{title:edited.title,removed:false}});
 const before=await snapshot(watched);expect((await f.call(docPath,'PATCH',{expectedVersion:doc.version,body:'synthetic-vector-stale'})).status).toBe(409);expect(await snapshot(watched)).toEqual(before);
 const removed=await json<any>(await f.call(docPath,'PATCH',{expectedVersion:edited.version,body:'Reference removed.'}));
 expect(removed.references).toEqual([]);expect(await links()).toHaveLength(1);expect((await links())[0].nextValue.removed).toBe(true);
 await json(await f.call(docPath,'PATCH',{expectedVersion:removed.version,body:'Again '+target.identifier}));
 expect(await links()).toHaveLength(1);expect((await links())[0].nextValue.removed).toBe(false);
 const retained=await env.DB.prepare('SELECT removed FROM document_issue_references WHERE document_id=? AND target_issue_id=?').bind(doc.id,target.id).all();
 expect(retained.results).toEqual([{removed:0}]);
 return {doc,target};
}
