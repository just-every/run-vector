import {env} from 'cloudflare:workers';
import {expect,it} from 'vitest';
import {agentRequest,agentToolClient} from './agent-resource-journey';
import {origin,request} from './base-auth-fixture';
import {roleWorkspace,snapshot} from './role-fixture';

it('removing a scoped agent retains native edit and comment audits, attribution and review history while refusing further calls', {timeout:120_000}, async()=>{
  const w=await roleWorkspace();
  const owner=w.people.owner;
  const person=(cookie:string,path:string,method='GET',body?:unknown,extra:Record<string,string>={})=>agentRequest(path,{
    method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...extra},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
  const json=async(response:Response,status=200)=>{
    expect(response.status,await response.clone().text()).toBe(status);
    return await response.json() as any;
  };
  const viewer=await w.fresh('member',false);
  expect((await w.call(`/settings/operators/${viewer.id}/role`,'PATCH',{role:'viewer',teamIds:[]})).status).toBe(200);
  const expired=await w.fresh('member');
  expect((await request('/auth/signout','POST',{},expired.cookie)).status).toBe(204);
  const sponsorName=(await json(await w.member.call('/options'))).operators.find((p:any)=>p.id===w.member.id).name;
  const mint=async(name:string)=>{
    const issued=await json(await w.member.call('/settings/integrations/tokens','POST',{
      name,scopes:['issues:write','comments:write'],
    }),201);
    const tokens=await json(await w.member.call('/settings/integrations/tokens'));
    const credential=tokens.tokens.find((t:any)=>t.name===name);
    expect(credential).toBeDefined();
    return {id:'vector-token:'+credential.id,name,call:agentToolClient(issued.token),token:issued.token};
  };
  const allRows=async()=>json(await person(owner.cookie,'/agents/api/audit'));
  for(const [index,decision] of ['autonomous','review'].entries()){
    await json(await person(owner.cookie,'/agents/api/policy','PUT',{document:{
      schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
      rules:[{id:'standard',class:'standard',do:decision}],reviewers:['role:owner'],spend:{none:true},
    }}));
    const issue=await w.create({title:'synthetic-vector-'+(3500+index),teamId:w.team.id});
    const agent=await mint('synthetic-vector-'+(3510+index));
    const other=await mint('synthetic-vector-'+(3520+index));
    const alreadyActive=await other.call('vector.issue.comment',{identifier:issue.identifier,body:'synthetic-vector-3525',idempotency_key:crypto.randomUUID()});
    expect(alreadyActive.status).toBe(200);expect(alreadyActive.body.result.isError).toBe(false);
    const editKey=crypto.randomUUID(),commentKey=crypto.randomUUID();
    for(const [tool,args] of [
      ['vector.issue.concurrent_edits',{identifier:issue.identifier,change:{expectedVersion:1,title:'synthetic-vector-'+(3530+index)},idempotency_key:editKey}],
      ['vector.issue.comment',{identifier:issue.identifier,body:'synthetic-vector-'+(3540+index),idempotency_key:commentKey}],
    ] as const){
      const result=await agent.call(tool,args);
      expect(result.status).toBe(200);expect(result.body.result?.isError).toBe(false);
    }
    const rows=(await allRows()).rows.filter((r:any)=>r.agent.id===agent.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((r:any)=>r.tool)).toEqual(['vector.issue.concurrent_edits','vector.issue.comment']);
    expect(new Set(rows.map((r:any)=>r.id)).size).toBe(2);
    for(const row of rows){
      expect(row.agent).toEqual({id:agent.id,name:agent.name,specialist:'software delivery coordinator'});
      expect(row.client_id).toBe(agent.id);expect(row.sponsor).toEqual({id:w.member.id,name:sponsorName});
      expect(row.label).toContain(agent.name);expect(row.label).toContain(sponsorName);
      expect(row.classes).toEqual([{class:'standard',facts:{measure:1}}]);
      expect(row.rules).toEqual([{class:'standard',rule:'standard',do:decision}]);
      expect(row.decision).toBe(decision);expect(row.outcome).toBe('done');
      expect(row.resource).toEqual({kind:'issue',id:issue.id});
      expect(row.idempotency_key).toBe(row.tool==='vector.issue.comment'?commentKey:editKey);
      expect(row.revision).toBeGreaterThan(0);
      if(decision==='review')expect(row.review.id).toEqual(expect.any(String));
      else expect(row.review).toBeNull();
    }
    const native=await json(await w.call('/issues/'+issue.identifier));
    const discussion=await json(await w.call('/issues/'+issue.identifier+'/discussion'));
    expect(native.title).toBe('synthetic-vector-'+(3530+index));
    expect(discussion.comments[1]).toMatchObject({body:'synthetic-vector-'+(3540+index)});
    for(const row of rows)expect(native.activity).toEqual(expect.arrayContaining([
      expect.objectContaining({actor:row.label}),
    ]));
    const activity=(await env.DB.prepare('SELECT agent_id,agent_operation_id,actor_operator_id,actor_name FROM issue_activity WHERE issue_id=? AND agent_id=? ORDER BY created_at,id').bind(issue.id,agent.id).all()).results;
    expect(activity).toHaveLength(2);
    for(const row of rows)expect(activity).toEqual(expect.arrayContaining([expect.objectContaining({agent_id:agent.id,agent_operation_id:row.operation_id,actor_operator_id:w.member.id,actor_name:row.label})]));
    const history=await snapshot(['agent_door_audit','agent_door_reviews','issues','issue_comments','issue_activity','audit_records']);
    const revoke='/agents/api/agents/'+encodeURIComponent(agent.id)+'/revoke';
    const unchanged=await snapshot(['agent_door_agents']);
    for(const cookie of [w.admin.cookie,w.member.cookie,w.guest.cookie,viewer.cookie]){
      await json(await person(cookie,revoke,'POST',{}),403);
      await json(await person(cookie,'/agents/api/audit'),403);
    }
    await json(await person('',revoke,'POST',{}),401);
    await json(await person(expired.cookie,revoke,'POST',{}),401);
    await json(await person(owner.cookie,revoke,'POST',{}, {Origin:'https://foreign.invalid'}),403);
    await json(await person(owner.cookie,revoke,'POST',{}, {Authorization:'Bearer '+agent.token}),403);
    await json(await person(owner.cookie,revoke),405);
    expect(await snapshot(['agent_door_agents'])).toEqual(unchanged);
    expect(await snapshot(Object.keys(history))).toEqual(history);
    await json(await person(owner.cookie,revoke,'POST',{}));
    const agents=(await json(await person(owner.cookie,'/agents/api/agents'))).agents;
    expect(agents.find((a:any)=>a.id===agent.id)).toMatchObject({name:agent.name,revoked:true,sponsor:{id:w.member.id,name:sponsorName}});
    expect(agents.find((a:any)=>a.id===other.id)).toMatchObject({name:other.name,revoked:false});
    expect(await snapshot(Object.keys(history))).toEqual(history);
    expect((await allRows()).rows.filter((r:any)=>r.agent.id===agent.id)).toEqual(rows);
    // The helper constructs a fresh server and door for every request. Read persisted
    // history again rather than retaining an in-memory agent or audit object.
    const page=await person(owner.cookie,'/agents');
    expect(page.status).toBe(200);
    const html=await page.text();expect(html).toContain(agent.name);expect(html).toContain(sponsorName);
    for(const args of [
      {identifier:issue.identifier,body:'synthetic-vector-3550',idempotency_key:crypto.randomUUID()},
      {identifier:issue.identifier,body:'synthetic-vector-'+(3540+index),idempotency_key:commentKey},
    ]){
      const refused=await agent.call('vector.issue.comment',args);
      expect(refused.status).toBe(401);expect(refused.body.error.data.code).toBe('unauthenticated');
    }
    const refusedEdit=await agent.call('vector.issue.concurrent_edits',{identifier:issue.identifier,
      change:{expectedVersion:1,title:'synthetic-vector-'+(3530+index)},idempotency_key:editKey});
    expect(refusedEdit.status).toBe(401);
    expect(await snapshot(['issues','issue_comments','issue_activity','audit_records'])).toEqual(Object.fromEntries(
      Object.entries(history).filter(([name])=>['issues','issue_comments','issue_activity','audit_records'].includes(name)),
    ));
    const after=(await allRows()).rows;
    for(const row of rows)expect(after.find((r:any)=>r.id===row.id)).toEqual(row);
    const kept=await other.call('vector.issue.comment',{identifier:issue.identifier,body:'synthetic-vector-3560',idempotency_key:crypto.randomUUID()});
    expect(kept.status).toBe(200);expect(kept.body.result.isError).toBe(false);
    const readback=await json(await w.call('/issues/'+issue.identifier+'/discussion'));
    expect(readback.comments.map((c:any)=>c.body)).toEqual(['synthetic-vector-3525','synthetic-vector-'+(3540+index),'synthetic-vector-3560']);
    const reviews=await json(await person(owner.cookie,'/agents/api/reviews'));
    for(const row of rows.filter((r:any)=>r.review))expect(reviews.reviews).toEqual(expect.arrayContaining([
      expect.objectContaining({id:row.review.id,prepared_by:{agent:agent.name,for:sponsorName},state:'open'}),
    ]));
  }
});
