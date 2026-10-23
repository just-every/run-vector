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
}
