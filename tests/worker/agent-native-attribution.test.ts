import {env} from 'cloudflare:workers';
import {expect,it} from 'vitest';
import {agentRequest} from './agent-resource-journey';
import {origin,request} from './base-auth-fixture';
import {roleWorkspace,snapshot} from './role-fixture';
import {archiveRows,httpExport} from './http-archive-fixture';

async function json(response:Response,status=200):Promise<any> {
  expect(response.status,await response.clone().text()).toBe(status);
  return response.json();
}

it('native issue creation, edits and comments retain agent attribution in current reads and Owner HTTP archives under autonomous and review policy',async()=>{
  const w=await roleWorkspace(),owner=w.people.owner,member=w.member;
  const team=(await json(await owner.call('/settings/teams','POST',{
    name:'synthetic-vector-3501',identifierPrefix:'ATTR',isPrivate:true,
  }))).teams.find((t:any)=>t.name==='synthetic-vector-3501');
  await json(await owner.call(`/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'}));
  const options=await json(await member.call('/options'));
  const person=options.operators.find((p:any)=>p.id===member.id).name;
  const tables=['issues','issue_comments','issue_activity','issue_followers','notifications','audit_records'];
  const receipts:Array<{issue:any;commentId:string;label:string;grant:string;agent:string;rpc:(name:string,args:object)=>Promise<any>}>=[];
  let id=0;
  for(const disposition of ['autonomous','review']){
    await json(await agentRequest('/agents/api/policy',{method:'PUT',
      headers:{Origin:origin,Cookie:owner.cookie,'Content-Type':'application/json'},
      body:JSON.stringify({document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
        reviewers:['person:'+owner.id],rules:[{id:'standard',class:'standard',do:disposition},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}}}),
    }));
    const name='synthetic-vector-3502-'+disposition;
    const grant=await json(await member.call('/settings/integrations/tokens','POST',{
      name,scopes:['issues:write','comments:write'],
    }),201);
    const rpc=async(tool:string,args:object)=>{
      const response=await agentRequest('/mcp',{method:'POST',headers:{Origin:origin,
        Authorization:'Bearer '+grant.token,'Content-Type':'application/json',Accept:'application/json, text/event-stream',
        'MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
        body:JSON.stringify({jsonrpc:'2.0',id:++id,method:'tools/call',params:{name:tool,arguments:args}})});
      return {status:response.status,body:await response.json() as any};
    };
    const run=async(tool:string,args:object)=>{
      const result=await rpc(tool,{...args,idempotency_key:crypto.randomUUID()});
      expect(result.status).toBe(200);
      expect(result.body.error).toBeUndefined();expect(result.body.result.isError).not.toBe(true);
      return result.body.result.structuredContent;
    };
    const issue=await run('vector.issue.creation',{teamId:team.id,title:'synthetic-vector-3503-'+disposition});
    await run('vector.issue.concurrent_edits',{identifier:issue.identifier,change:{expectedVersion:1,title:'synthetic-vector-3504-'+disposition}});
    const key=crypto.randomUUID(),args={identifier:issue.identifier,body:'synthetic-vector-3505-'+disposition,idempotency_key:key};
    const comment=await rpc('vector.issue.comment',args);
    expect(comment.body.result?.isError).not.toBe(true);expect(comment.body.error).toBeUndefined();
    const commentId=comment.body.result.structuredContent.commentId;
    const before=await snapshot(tables),replayed=await rpc('vector.issue.comment',args);
    expect(replayed.body.result.structuredContent.commentId).toBe(commentId);
    expect(await snapshot(tables)).toEqual(before);
    const label=name+' for '+person;
    // Fresh mounted native reads are independent of the MCP response.
    for(let reload=0;reload<2;reload++){
      const native=await json(await member.call('/issues/'+issue.identifier));
      expect(native.title).toBe('synthetic-vector-3504-'+disposition);
      expect(native.activity.map((a:any)=>({kind:a.kind,actor:a.actor}))).toEqual([
        {kind:'issue.created',actor:label},{kind:'issue.updated',actor:label},{kind:'comment.created',actor:label},
      ]);
      const discussion=await json(await member.call('/issues/'+issue.identifier+'/discussion'));
      expect(discussion.comments).toEqual([expect.objectContaining({id:commentId,actor:label,body:args.body})]);
    }
    const audit=(await env.DB.prepare("SELECT row FROM agent_door_audit WHERE json_extract(row,'$.sponsor.id')=? AND json_extract(row,'$.decision')=? ORDER BY sequence").bind(member.id,disposition).all<{row:string}>()).results.map(r=>JSON.parse(r.row));
    expect(audit.filter((r:any)=>r.outcome==='done').map((r:any)=>r.tool)).toEqual(expect.arrayContaining(['vector.issue.creation','vector.issue.concurrent_edits','vector.issue.comment']));
    const agent=await env.DB.prepare('SELECT agent_id FROM issue_activity WHERE issue_id=? AND kind=?').bind(issue.id,'issue.created').first<string>('agent_id');
    expect(agent).toBeTruthy();
    // A later human edit must not turn the saved agent author into the sponsor.
    await json(await member.call('/issues/'+issue.identifier+'/comments/'+commentId,'PATCH',{body:'synthetic-vector-3514-'+disposition}));
    const editedDiscussion=await json(await member.call('/issues/'+issue.identifier+'/discussion'));
    expect(editedDiscussion.comments[0]).toMatchObject({id:commentId,actor:label,body:'synthetic-vector-3514-'+disposition});
    expect((await json(await member.call('/issues/'+issue.identifier))).activity.map((a:any)=>a.actor)).toEqual([label,label,label,person]);
    receipts.push({issue,commentId,label,grant:grant.credential.id,agent:agent!,rpc});
  }
  const human=await json(await member.call('/issues','POST',{teamId:team.id,title:'synthetic-vector-3506'}),201);
  await json(await member.call('/issues/'+human.identifier,'PATCH',{expectedVersion:1,title:'synthetic-vector-3507'}));
  const humanComment=await json(await member.call('/issues/'+human.identifier+'/comments','POST',{body:'synthetic-vector-3508'}),201);
  expect((await json(await member.call('/issues/'+human.identifier))).activity.map((a:any)=>a.actor)).toEqual([person,person,person]);
  expect((await json(await member.call('/issues/'+human.identifier+'/discussion'))).comments[0]).toMatchObject({id:humanComment.id,actor:person});
  const records=await httpExport((path,method,body)=>request('/api'+path,method,body,owner.cookie));
  const history=archiveRows(records,'issue_activity');
  for(const {issue,commentId,label,agent} of receipts){
    const events=history.filter(row=>row.issue_id===issue.id);
    expect(events.map(row=>row.kind)).toEqual(expect.arrayContaining(['issue.created','issue.updated','comment.created']));
    expect(events).toHaveLength(4);
    for(const event of events.filter(row=>row.kind!=='comment.edited'))expect(event).toMatchObject({actor_operator_id:member.id,actor_name:label,agent_id:agent,agent_operation_id:expect.any(String)});
    expect(events.find(row=>row.kind==='comment.edited')).toMatchObject({actor_operator_id:member.id,actor_name:null,agent_id:null,agent_operation_id:null});
    expect(archiveRows(records,'issue_comments')).toContainEqual(expect.objectContaining({id:commentId,issue_id:issue.id,body:expect.any(String)}));
  }
  const humanEvents=history.filter(row=>row.issue_id===human.id);
  expect(humanEvents).toHaveLength(3);
  for(const event of humanEvents)expect(event).toMatchObject({actor_operator_id:member.id,actor_name:null,agent_id:null,agent_operation_id:null});
  // Credentials and the separate agent audit remain excluded from portability.
  for(const table of ['integration_tokens','agent_door_agents','agent_door_audit'])expect(archiveRows(records,table)).toEqual([]);
  const unchanged=await snapshot(tables);
  expect((await request('/api/portability/exports','POST',{},w.admin.cookie)).status).toBe(404);
  expect(await snapshot(tables)).toEqual(unchanged);
  await json(await owner.call(`/settings/teams/${team.id}/members/${member.id}`,'DELETE'));
  const withdrawn=await snapshot(tables);
  for(const receipt of receipts){
    for(const [tool,args] of [
      ['vector.issue.creation',{teamId:team.id,title:'synthetic-vector-3509'}],
      ['vector.issue.concurrent_edits',{identifier:receipt.issue.identifier,change:{expectedVersion:2,title:'synthetic-vector-3510'}}],
      ['vector.issue.comment',{identifier:receipt.issue.identifier,body:'synthetic-vector-3511'}],
    ] as const){
      const refused=await receipt.rpc(tool,{...args,idempotency_key:crypto.randomUUID()});
      expect(refused.body.result?.isError===true||!!refused.body.error).toBe(true);
      expect(JSON.stringify(refused.body)).not.toContain(receipt.label);
    }
    expect((await member.call('/issues/'+receipt.issue.identifier)).status).toBe(404);
  }
  expect(await snapshot(tables)).toEqual(withdrawn);
  await json(await owner.call(`/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'}));
  await json(await member.call('/settings/integrations/tokens/'+receipts[0].grant,'DELETE'));
  const revokedBaseline=await snapshot(tables);
  const revoked=await receipts[0].rpc('vector.issue.comment',{identifier:receipts[0].issue.identifier,body:'synthetic-vector-3512',idempotency_key:crypto.randomUUID()});
  expect(revoked.status).toBe(401);
  expect(await snapshot(tables)).toEqual(revokedBaseline);
  expect((await json(await member.call('/issues/'+receipts[0].issue.identifier))).activity.map((a:any)=>a.actor)).toEqual([receipts[0].label,receipts[0].label,receipts[0].label,person]);
});
