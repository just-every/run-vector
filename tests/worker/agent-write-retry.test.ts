import {env} from 'cloudflare:workers';
import {expect,it,vi} from 'vitest';
import {agentRequest} from './agent-resource-journey';
import {origin} from './base-auth-fixture';
import {roleWorkspace,snapshot} from './role-fixture';

async function json(response:Response,status=200):Promise<any> {
  expect(response.status,await response.clone().text()).toBe(status);
  return response.json();
}

it('native issue edits replay discarded responses after 24 hours while conflicts and current admission preserve later work under autonomous and review policies',async()=>{
  // Only Date is controlled: actual D1 requests and transport still run normally.
  vi.useFakeTimers({toFake:['Date']});
  const start=Date.UTC(2030,0,15,12);
  vi.setSystemTime(start);
  try {
    const w=await roleWorkspace(),owner=w.people.owner,member=w.member;
    const team=(await json(await owner.call('/settings/teams','POST',{
      name:'synthetic-vector-3601',identifierPrefix:'RETRY',isPrivate:true,
    }))).teams.find((t:any)=>t.name==='synthetic-vector-3601');
    await json(await owner.call(`/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'}));
    const person=(await json(await member.call('/options'))).operators.find((p:any)=>p.id===member.id).name;
    const tables=['issues','issue_activity','issue_description_revisions','issue_comments','issue_followers','notifications','audit_records'];
    let id=0;
    const control=async(path:string,method='GET',body?:object)=>json(await agentRequest('/agents/api/'+path,{
      method,headers:{Origin:origin,Cookie:owner.cookie,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),
    }));
    for(const disposition of ['autonomous','review']){
      vi.setSystemTime(start);
      await control('policy','PUT',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
        reviewers:['person:'+owner.id],rules:[{id:'standard',class:'standard',do:disposition},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}}});
      const grant=await json(await member.call('/settings/integrations/tokens','POST',{
        name:'synthetic-vector-3602-'+disposition,scopes:['issues:write'],
      }),201);
      const issue=await json(await member.call('/issues','POST',{teamId:team.id,title:'synthetic-vector-3603'}),201);
      const path='/issues/'+issue.identifier,key=crypto.randomUUID();
      const args={identifier:issue.identifier,change:{expectedVersion:1,title:'synthetic-vector-3604-'+disposition},expected_revision:1,idempotency_key:key};
      const send=(arguments_:object)=>{
        const requestId=++id;
        return {requestId,response:agentRequest('/mcp',{method:'POST',headers:{Origin:origin,
          Authorization:'Bearer '+grant.token,'Content-Type':'application/json',Accept:'application/json, text/event-stream',
          'MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
          body:JSON.stringify({jsonrpc:'2.0',id:requestId,method:'tools/call',params:{name:'vector.issue.concurrent_edits',arguments:arguments_}})})};
      };
      const rpc=async(arguments_:object)=>{const sent=send(arguments_);return {requestId:sent.requestId,body:await json(await sent.response)};};
      const lost=send(args),discarded=await lost.response;
      expect(discarded.status).toBe(200);
      // Never decode, clone or retain the first response body. The native effect
      // and retained row below must be produced by this mounted call itself.
      await discarded.body!.cancel();
      const native=await json(await member.call(path));
      expect(native).toMatchObject({title:args.change.title,version:2});
      expect(native.activity.filter((a:any)=>a.kind==='issue.updated')).toEqual([
        expect.objectContaining({actor:grant.credential.name+' for '+person}),
      ]);
      const saved=await env.DB.prepare('SELECT decision_id,created_at,outcome FROM agent_door_calls WHERE agent=? AND key=?')
        .bind('vector-token:'+grant.credential.id,key).first<{decision_id:string;created_at:number;outcome:string}>();
      expect(saved).not.toBeNull();
      const original=JSON.parse(saved!.outcome);
      expect(original).toMatchObject({outcome:'done',result:{id:issue.id,identifier:issue.identifier,version:2}});
      const audit=(await control('audit')).rows.find((a:any)=>a.id===saved!.decision_id);
      expect(audit).toMatchObject({outcome:'done',decision:disposition,tool:'vector.issue.concurrent_edits',idempotency_key:key,
        sponsor:{id:member.id},resource:{kind:'issue',id:issue.id}});
      const event=await env.DB.prepare("SELECT agent_operation_id FROM issue_activity WHERE issue_id=? AND kind='issue.updated'").bind(issue.id).first<string>('agent_operation_id');
      expect(event).toBe(audit.operation_id);
      if(disposition==='review')expect(original.review.id).toBeTruthy();
      else expect(original.review).toBeUndefined();
      const baseline=await snapshot(tables);
      const replay=await rpc(args);
      expect(replay.requestId).not.toBe(lost.requestId);
      expect(replay.body.id).toBe(replay.requestId);
      expect(replay.body.result.isError).toBe(false);
      expect(replay.body.result.structuredContent).toEqual(original.result);
      expect(replay.body.result._meta['com.runeditrun/review']).toEqual(original.review);
      expect(await snapshot(tables)).toEqual(baseline);
      expect((await control('audit')).rows).toContainEqual(expect.objectContaining({outcome:'replayed',replay_of:audit.id,operation_id:audit.operation_id}));
      vi.setSystemTime(start+24*60*60*1000+1000);
      expect(Date.now()-saved!.created_at).toBeGreaterThanOrEqual(24*60*60*1000);
      expect((await rpc(args)).body.result.structuredContent).toEqual(original.result);
      expect(await snapshot(tables)).toEqual(baseline);
      const conflict=await rpc({...args,change:{...args.change,title:'synthetic-vector-3605'}});
      expect(conflict.body.result._meta['com.runeditrun/error']).toEqual({code:'idempotency_conflict'});
      expect(conflict.body.result.isError).toBe(true);
      expect(await snapshot(tables)).toEqual(baseline);
      // A later genuine native edit must survive both old-revision replay and
      // a fresh-key stale revision attempt; the response names the live revision.
      await json(await member.call(path,'PATCH',{expectedVersion:2,title:'synthetic-vector-3606'}));
      const later=await snapshot(tables);
      const stale=await rpc({...args,idempotency_key:crypto.randomUUID(),change:{expectedVersion:3,title:'synthetic-vector-3607'}});
      expect(stale.body.result._meta['com.runeditrun/error']).toEqual({code:'revision_conflict',current_revision:3});
      expect(stale.body.result.isError).toBe(true);
      expect((await rpc(args)).body.result.structuredContent).toEqual(original.result);
      expect(await snapshot(tables)).toEqual(later);
      expect(await json(await member.call(path))).toMatchObject({title:'synthetic-vector-3606',version:3});
      // There is no grant-edit HTTP door. Narrow the actual Settings grant's
      // scope only; never fabricate or modify its saved outcome or audit.
      await env.DB.prepare('UPDATE integration_tokens SET scopes=? WHERE id=?').bind(JSON.stringify(['issues:read']),grant.credential.id).run();
      const narrowed=send(args),scopeResponse=await narrowed.response;
      expect(scopeResponse.status).toBe(403);
      expect((await scopeResponse.json() as any).error.data.code).toBe('insufficient_scope');
      expect(await snapshot(tables)).toEqual(later);
      await env.DB.prepare('UPDATE integration_tokens SET scopes=? WHERE id=?').bind(JSON.stringify(['issues:write']),grant.credential.id).run();
      await control('pause','POST',{paused:true});
      expect((await rpc(args)).body.result._meta['com.runeditrun/error'].code).toBe('agents_paused');
      expect(await snapshot(tables)).toEqual(later);
      await control('pause','POST',{paused:false});
      expect((await rpc(args)).body.result.structuredContent).toEqual(original.result);
      await json(await owner.call(`/settings/teams/${team.id}/members/${member.id}`,'DELETE'));
      const withdrawn=await snapshot(tables),hidden=await rpc(args);
      expect(hidden.body.result.isError).toBe(true);
      expect(hidden.body.result.structuredContent).toBeUndefined();
      expect(hidden.body.result._meta['com.runeditrun/error'].code).toBe('not_found');
      expect(await snapshot(tables)).toEqual(withdrawn);
      await json(await owner.call(`/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'}));
      expect((await rpc(args)).body.result.structuredContent).toEqual(original.result);
      await json(await owner.call(path,'DELETE',{expectedVersion:3,confirmed:true}));
      const erased=await snapshot(tables);
      expect((await rpc(args)).body.result._meta['com.runeditrun/error'].code).toBe('not_found');
      expect(await snapshot(tables)).toEqual(erased);
      await json(await member.call('/settings/integrations/tokens/'+grant.credential.id,'DELETE'));
      const revokedBaseline=await snapshot(tables);
      const revoked=await send(args).response;
      expect(revoked.status).toBe(401);
      expect((await revoked.json() as any).result).toBeUndefined();
      expect(await snapshot(tables)).toEqual(revokedBaseline);
    }
  } finally {vi.useRealTimers();}
});
