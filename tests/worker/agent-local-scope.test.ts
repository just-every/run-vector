import {expect,it} from 'vitest';
import {agentRequest} from './agent-resource-journey';
import {origin} from './base-auth-fixture';
import {roleWorkspace,resetLimits,snapshot} from './role-fixture';

async function json(response:Response,status=200):Promise<any>{
  expect(response.status,await response.clone().text()).toBe(status);
  return response.json();
}

it('Settings-issued Owner and Member read grants refuse native MCP edits without effects while independent write grants succeed under autonomous and review policies',{timeout:120_000},async()=>{
  const w=await roleWorkspace(),owner=w.people.owner;
  expect(owner.cookie).not.toBe(w.member.cookie);
  const issue=await json(await owner.call('/issues','POST',{
    teamId:w.team.id,title:'synthetic-vector-3701',description:'synthetic-vector-3702',
  }),201);
  const path='/issues/'+issue.identifier;
  await json(await owner.call(path+'/comments','POST',{body:'synthetic-vector-3703'}),201);
  await json(await w.member.call(path+'/comments','POST',{body:'synthetic-vector-3704'}),201);
  const tables=['issues','issue_activity','issue_description_revisions','issue_comments',
    'issue_followers','notification_events','notification_candidates','notifications','notification_deliveries',
    'audit_records','agent_door_calls','agent_door_approvals','agent_door_reviews'];
  let id=0;
  const rpc=async(token:string,name:string,args:object)=>{
    await resetLimits();
    const response=await agentRequest('/mcp',{method:'POST',headers:{Origin:origin,
      Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream',
      'MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
      body:JSON.stringify({jsonrpc:'2.0',id:++id,method:'tools/call',params:{name,arguments:args}})});
    return {response,body:await response.json() as any};
  };
  const audit=async()=>json(await agentRequest('/agents/api/audit',{headers:{Cookie:owner.cookie}}));
  for(const disposition of ['autonomous','review']){
    await json(await agentRequest('/agents/api/policy',{method:'PUT',headers:{Origin:origin,Cookie:owner.cookie,'Content-Type':'application/json'},
      body:JSON.stringify({document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',reviewers:['person:'+owner.id],
        rules:[{id:'standard',class:'standard',do:disposition},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}}})}));
    for(const [kind,person] of [['owner',owner],['member',w.member]] as const){
      expect((await json(await person.call('/session'))).role).toBe(kind);
      const mint=async(scopes:string[])=>{
        const issued=await json(await person.call('/settings/integrations/tokens','POST',{
          name:'synthetic-vector-3705-'+kind+'-'+disposition+'-'+scopes[0],scopes,
        }),201);
        const listed=(await json(await person.call('/settings/integrations/tokens'))).tokens.find((t:any)=>t.id===issued.credential.id);
        expect(JSON.parse(listed.scopes)).toEqual(scopes);
        return issued;
      };
      const read=await mint(['issues:read']),write=await mint(['issues:write']);
      expect(read.token).not.toBe(write.token);
      const native=await json(await person.call(path));
      const loaded=await rpc(read.token,'vector.issue.activity_history',{identifier:issue.identifier});
      expect(loaded.response.status).toBe(200);
      expect(loaded.body.error).toBeUndefined();
      expect(loaded.body.result.isError).toBe(false);
      expect(loaded.body.result.structuredContent).toMatchObject({id:issue.id,identifier:issue.identifier,title:native.title,version:native.version,activity:native.activity});
      const before=await snapshot(tables);
      expect(before.issue_comments.length).toBeGreaterThanOrEqual(2);
      expect(before.issue_followers.length).toBeGreaterThan(0);
      expect(before.notifications.length).toBeGreaterThan(0);
      const change={expectedVersion:native.version,title:'synthetic-vector-3706-'+kind+'-'+disposition};
      const args={identifier:issue.identifier,change,expected_revision:native.version,idempotency_key:crypto.randomUUID()};
      const forged={scopes:['issues:read','issues:write'],scope:'issues:write',grant:{scopes:['issues:write']}};
      for(const claims of [{},forged]){
        const refused=await rpc(read.token,'vector.issue.concurrent_edits',{...args,...claims});
        expect(refused.response.status).toBe(403);
        expect(refused.response.headers.get('www-authenticate')).toBe(`Bearer error="insufficient_scope", scope="issues:write", resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`);
        expect(refused.body).toEqual({jsonrpc:'2.0',id,error:{code:-32000,message:'Insufficient scope',data:{code:'insufficient_scope'}}});
        expect(await snapshot(tables)).toEqual(before);
        const rows=(await audit()).rows.filter((r:any)=>r.agent.id==='vector-token:'+read.credential.id&&r.idempotency_key===args.idempotency_key);
        expect(rows).toHaveLength(Object.keys(claims).length?2:1);
        expect(rows.at(-1)).toMatchObject({door:'mcp',tool:'vector.issue.concurrent_edits',sponsor:{id:person.id},
          client_id:'vector-token:'+read.credential.id,scopes:['issues:read'],outcome:'refused',code:'insufficient_scope',
          ignored_arguments:Object.keys(claims).sort()});
      }
      // The exact same valid request succeeds with a separately issued grant.
      const allowed=await rpc(write.token,'vector.issue.concurrent_edits',{...args,...forged});
      expect(allowed.response.status).toBe(200);
      expect(allowed.response.headers.get('www-authenticate')).toBeNull();
      expect(allowed.body.error).toBeUndefined();
      expect(allowed.body.result.isError).toBe(false);
      expect(allowed.body.result.structuredContent).toEqual({id:issue.id,identifier:issue.identifier,version:native.version+1});
      expect(allowed.body.result._meta['com.runeditrun/decision'].disposition).toBe(disposition);
      expect(await json(await person.call(path))).toMatchObject({title:change.title,version:native.version+1});
      const reread=await rpc(read.token,'vector.issue.activity_history',{identifier:issue.identifier});
      expect(reread.response.status).toBe(200);
      expect(reread.body.result.isError).toBe(false);
      expect(reread.body.result.structuredContent).toMatchObject({id:issue.id,title:change.title,version:native.version+1});
      const retained=(await json(await person.call('/settings/integrations/tokens'))).tokens.find((t:any)=>t.id===read.credential.id);
      expect(JSON.parse(retained.scopes)).toEqual(['issues:read']);
      const row=(await audit()).rows.find((r:any)=>r.agent.id==='vector-token:'+write.credential.id&&r.idempotency_key===args.idempotency_key);
      expect(row).toMatchObject({sponsor:{id:person.id},scopes:['issues:write'],outcome:'done',code:null,decision:disposition,resource:{kind:'issue',id:issue.id}});
      if(disposition==='review')expect(row.review.id).toEqual(expect.any(String));
    }
  }
});
