import {expect,it} from 'vitest';
import {agentRequest} from './agent-resource-journey';
import {origin} from './base-auth-fixture';
import {roleWorkspace,snapshot} from './role-fixture';

async function json(response:Response,status=200):Promise<any> {
  expect(response.status,await response.clone().text()).toBe(status);
  return response.json();
}

it('Owner pause fences two native sponsors, persists across fresh handlers and resumes only through an authorized person under current policy',async()=>{
  const w=await roleWorkspace(),owner=w.people.owner;
  const domain=['issues','issue_comments','issue_activity','issue_followers','notifications','audit_records',
    'agent_door_calls','agent_door_approvals','agent_door_reviews','agent_door_usage'];
  const control=(cookie:string,path:string,method='GET',body?:object,token?:string)=>agentRequest(path,{
    method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  const state=async()=>json(await control(owner.cookie,'/agents/api/state'));
  const policy=async(disposition:string)=>json(await control(owner.cookie,'/agents/api/policy','PUT',{
    document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',reviewers:['person:'+owner.id],
      rules:[{id:'standard',class:'standard',do:disposition},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}},
  }));
  let id=0;
  for(const disposition of ['autonomous','review']){
    await policy(disposition);
    const issue=await json(await owner.call('/issues','POST',{teamId:w.team.id,title:'synthetic-vector-3601-'+disposition}),201);
    const clients=await Promise.all([owner,w.member].map(async sponsor=>{
      const grant=await json(await sponsor.call('/settings/integrations/tokens','POST',{
        name:'synthetic-vector-3602-'+disposition,scopes:['evidence:read','comments:write'],
      }),201);
      const rpc=async(method:string,params:object)=>{
        const response=await agentRequest('/mcp',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+grant.token,
          'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':method},
          body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params})});
        return {status:response.status,body:await response.json() as any};
      };
      const read=()=>rpc('resources/read',{uri:'vector://issue/'+issue.id});
      const write=(key=crypto.randomUUID())=>rpc('tools/call',{name:'vector.issue.comment',arguments:{
        identifier:issue.identifier,body:'synthetic-vector-3603',idempotency_key:key,
      }});
      return {sponsor,grant,read,write};
    }));
    const succeeded=[];
    for(const client of clients){
      const read=await client.read();expect(read.status).toBe(200);
      expect(JSON.parse(read.body.result.contents[0].text)).toMatchObject({id:issue.id,title:issue.title});
      const key=crypto.randomUUID(),write=await client.write(key);
      expect(write.body.result.isError).not.toBe(true);expect(write.body.result.structuredContent.commentId).toBeTruthy();
      succeeded.push({client,key});
    }
    expect(clients[0].grant.credential.id).not.toBe(clients[1].grant.credential.id);
    expect(clients[0].sponsor.id).not.toBe(clients[1].sponsor.id);
    await json(await control(owner.cookie,'/agents/api/pause','POST',{paused:true}));
    const pausedAt=performance.now(),unchanged=await snapshot(domain);
    for(const {client,key} of succeeded){
      const read=await client.read();expect(read.status).toBe(200);
      expect(read.body.error.data.code).toBe('agents_paused');expect(read.body.result).toBeUndefined();
      for(const attempt of [()=>client.write(),()=>client.write(key)]){
        const write=await attempt();expect(write.status).toBe(200);
        expect(write.body.result.isError).toBe(true);expect(write.body.result._meta['com.runeditrun/error'].code).toBe('agents_paused');
        expect(write.body.result.structuredContent).toBeUndefined();
      }
    }
    expect(performance.now()-pausedAt).toBeLessThan(60_000);
    expect(await snapshot(domain)).toEqual(unchanged);
    // agentRequest constructs a fresh native door on every request: persisted state governs it.
    expect((await state()).paused).toEqual({business:false,local:true});
    const authorityBefore=await snapshot([...domain,'agent_door_state']);
    for(const client of clients){
      for(const cookie of ['',owner.cookie])for(const paused of [false,true]){
        const refused=await json(await control(cookie,'/agents/api/pause','POST',{paused},client.grant.token),403);
        expect(refused.code).toBe('person_session_required');
      }
    }
    for(const person of [w.admin,w.member,w.guest])await json(await control(person.cookie,'/agents/api/pause','POST',{paused:false}),403);
    await json(await control('','/agents/api/pause','POST',{paused:false}),401);
    expect(await snapshot([...domain,'agent_door_state'])).toEqual(authorityBefore);
    // Both signed-in people retain their ordinary issue read and mutation doors while paused.
    for(const person of [owner,w.member]){
      const human=await json(await person.call('/issues','POST',{teamId:w.team.id,title:'synthetic-vector-3604'}),201);
      await json(await person.call('/issues/'+human.identifier,'PATCH',{expectedVersion:1,title:'synthetic-vector-3605'}));
      await json(await person.call('/issues/'+human.identifier+'/comments','POST',{body:'synthetic-vector-3606'}),201);
      expect((await json(await person.call('/issues/'+human.identifier))).title).toBe('synthetic-vector-3605');
    }
    // Resuming never restores a superseded policy or a revoked credential.
    await policy('blocked');
    expect((await state()).paused.local).toBe(true);
    await json(await control(owner.cookie,'/agents/api/pause','POST',{paused:false}));
    const blockedBefore=await snapshot(domain);
    for(const client of clients){
      expect((await client.read()).body.error.data.code).toBe('policy_blocked');
      expect((await client.write()).body.result._meta['com.runeditrun/error'].code).toBe('policy_blocked');
    }
    expect(await snapshot(domain)).toEqual(blockedBefore);
    await policy(disposition);
    for(const client of clients){
      expect((await client.read()).body.result.contents).toHaveLength(1);
      expect((await client.write()).body.result.structuredContent.commentId).toBeTruthy();
    }
    await json(await w.member.call('/settings/integrations/tokens/'+clients[1].grant.credential.id,'DELETE'));
    await json(await control(owner.cookie,'/agents/api/pause','POST',{paused:true}));
    await json(await control(owner.cookie,'/agents/api/pause','POST',{paused:false}));
    const revokedBefore=await snapshot(domain);
    expect((await clients[1].read()).status).toBe(401);expect((await clients[1].write()).status).toBe(401);
    expect(await snapshot(domain)).toEqual(revokedBefore);
  }
});
