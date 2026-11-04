import {expect,it} from 'vitest';
import {agentRequest} from './agent-resource-journey';
import {origin} from './base-auth-fixture';
import {roleWorkspace,resetLimits,snapshot,type Person} from './role-fixture';

async function json(response:Response,status=200):Promise<any>{
  expect(response.status,await response.clone().text()).toBe(status);
  return response.json();
}
const watched=['issues','issue_comments','issue_activity','issue_followers','notifications','notification_events','notification_deliveries','audit_records'];

it('native and MCP issue edits and comments share current role, invited-team and private-team authority under autonomous and standard review, including a retained sponsor grant after Viewer downgrade',{timeout:120_000},async()=>{
  const w=await roleWorkspace(),owner=w.people.owner;
  const viewer=await w.fresh('member');
  await json(await owner.call(`/settings/operators/${viewer.id}/role`,'PATCH',{role:'viewer',teamIds:[]}));
  const people={...w.people,viewer};
  const privateTeam=(await json(await owner.call('/settings/teams','POST',{
    name:'synthetic-vector-3601',identifierPrefix:'AGROLE',isPrivate:true,
  }))).teams.find((t:any)=>t.name==='synthetic-vector-3601');
  for(const [kind,person] of Object.entries(people)){
    if(kind==='owner'||kind==='viewer'||kind==='guest')continue;
    await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${person.id}`,'PUT',{role:kind==='lead'?'owner':'member'}));
  }
  await json(await owner.call(`/settings/operators/${w.guest.id}/role`,'PATCH',{role:'guest',teamIds:[w.team.id,privateTeam.id]}));
  await json(await owner.call(`/settings/operators/${viewer.id}/role`,'PATCH',{role:'viewer',teamIds:[privateTeam.id]}));
  const outside=(await json(await owner.call('/settings/teams','POST',{
    name:'synthetic-vector-3602',identifierPrefix:'AGOUT',
  }))).teams.find((t:any)=>t.name==='synthetic-vector-3602');
  const make=async(teamId:string)=>json(await owner.call('/issues','POST',{teamId,title:'synthetic-vector-3603'}),201);
  const publicIssue=await make(w.team.id),privateIssue=await make(privateTeam.id),outsideIssue=await make(outside.id);
  await json(await w.member.call(`/issues/${publicIssue.identifier}/comments`,'POST',{body:'synthetic-vector-3604'}),201);
  let id=0;
  const rpc=async(person:Person,name:string,args:object)=>{
    await resetLimits();
    const response=await agentRequest('/mcp',{method:'POST',headers:{Origin:origin,
      Authorization:'Bearer '+person.token,'Content-Type':'application/json',Accept:'application/json, text/event-stream',
      'MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
      body:JSON.stringify({jsonrpc:'2.0',id:++id,method:'tools/call',params:{name,arguments:{...args,idempotency_key:crypto.randomUUID()}}})});
    expect(response.status,await response.clone().text()).toBe(200);
    const body=await response.json() as any;
    expect(body.error).toBeUndefined();
    return body.result;
  };
  const current=async(issue:any)=>json(await owner.call('/issues/'+issue.identifier));
  const compare=async(person:Person,issue:any,code:string|null)=>{
    for(const verb of ['edit','comment']){
      await resetLimits();
      const before=await snapshot(watched),detail=await current(issue);
      const title='synthetic-vector-3605-'+id,body='synthetic-vector-3606-'+id;
      const path='/issues/'+issue.identifier;
      const native=await person.call(path+(verb==='edit'?'':'/comments'),verb==='edit'?'PATCH':'POST',
        verb==='edit'?{expectedVersion:detail.version,title}:{body});
      const nativeBody=await native.json() as any;
      expect(native.status,verb+' '+person.id).toBe(code?code==='not_found'?404:403:verb==='edit'?200:201);
      if(code){
        expect(nativeBody.error).toBe(code);
        expect(await snapshot(watched)).toEqual(before);
      }else{
        const state=await current(issue);
        if(verb==='edit')expect(state.title).toBe(title);
        else expect((await json(await owner.call(path+'/discussion'))).comments).toContainEqual(expect.objectContaining({id:nativeBody.id,body}));
      }
      const beforeAgent=await snapshot(watched),version=(await current(issue)).version;
      const result=await rpc(person,verb==='edit'?'vector.issue.concurrent_edits':'vector.issue.comment',
        verb==='edit'?{identifier:issue.identifier,change:{expectedVersion:version,title:title+'-agent'}}:{identifier:issue.identifier,body:body+'-agent'});
      expect(result.isError).toBe(Boolean(code));
      if(code){
        expect(result._meta['com.runeditrun/error'].code).toBe(nativeBody.error);
        expect(result.structuredContent).toBeUndefined();
        expect(await snapshot(watched)).toEqual(beforeAgent);
      }else{
        expect(result._meta['com.runeditrun/decision'].disposition).toBe(disposition);
        const state=await current(issue);
        if(verb==='edit')expect(state).toMatchObject({title:title+'-agent',version:version+1});
        else expect((await json(await owner.call(path+'/discussion'))).comments).toContainEqual(expect.objectContaining({id:result.structuredContent.commentId,body:body+'-agent'}));
        expect(state.activity.at(-1).kind).toBe(verb==='edit'?'issue.updated':'comment.created');
      }
    }
  };
  let disposition='autonomous';
  for(disposition of ['autonomous','review']){
    await json(await agentRequest('/agents/api/policy',{method:'PUT',headers:{Origin:origin,Cookie:owner.cookie,'Content-Type':'application/json'},
      body:JSON.stringify({document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',reviewers:['person:'+owner.id],
        rules:[{id:'standard',class:'standard',do:disposition},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}}})}));
    for(const [kind,person] of Object.entries(people)){
      expect((await json(await person.call('/session'))).role).toBe(kind==='lead'?'member':kind);
      await compare(person,publicIssue,kind==='viewer'?'forbidden':null);
      await compare(person,privateIssue,kind==='viewer'?'forbidden':null);
    }
    // A current invited Guest cannot reach an uninvited public team's work.
    await compare(w.guest,outsideIssue,'not_found');
    const sponsor=await w.fresh('member');
    await compare(sponsor,publicIssue,null);
    await json(await owner.call(`/settings/operators/${sponsor.id}/role`,'PATCH',{role:'viewer',teamIds:[]}));
    await compare(sponsor,publicIssue,'forbidden');
    const native=await json(await sponsor.call('/issues/'+publicIssue.identifier));
    const read=await rpc(sponsor,'vector.issue.activity_history',{identifier:publicIssue.identifier});
    expect(read.isError).toBe(false);
    expect(read.structuredContent).toMatchObject({id:native.id,title:native.title,version:native.version,activity:native.activity});
    // Removal of private membership takes effect on the next native and MCP call.
    for(const [kind,person] of Object.entries(people)){
      if(kind==='owner')continue;
      const hiddenTitle=(await current(privateIssue)).title;
      await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${person.id}`,'DELETE'));
      await compare(person,privateIssue,kind==='viewer'?'forbidden':'not_found');
      const deniedRead=await rpc(person,'vector.issue.activity_history',{identifier:privateIssue.identifier});
      expect(deniedRead.isError).toBe(true);
      expect(deniedRead._meta['com.runeditrun/error'].code).toBe('not_found');
      expect(JSON.stringify(deniedRead)).not.toContain(hiddenTitle);
      expect(JSON.stringify(deniedRead)).not.toContain(privateIssue.identifier);
      if(kind==='guest')await json(await owner.call(`/settings/operators/${person.id}/role`,'PATCH',{role:'guest',teamIds:[w.team.id,privateTeam.id]}));
      else if(kind==='viewer')await json(await owner.call(`/settings/operators/${person.id}/role`,'PATCH',{role:'viewer',teamIds:[privateTeam.id]}));
      else await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${person.id}`,'PUT',{role:kind==='lead'?'owner':'member'}));
    }
    expect((await json(await owner.call('/issues/'+privateIssue.identifier))).id).toBe(privateIssue.id);
  }
});
