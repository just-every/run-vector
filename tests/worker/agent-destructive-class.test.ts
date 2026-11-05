import {env} from 'cloudflare:workers';
import {expect,it} from 'vitest';
import {agentRequest} from './agent-resource-journey';
import {origin} from './base-auth-fixture';
import {roleWorkspace,resetLimits,snapshot,type Person} from './role-fixture';

const tool='vector.comment.delete';
const watched=['issues','issue_comments','issue_activity','issue_followers','issue_mentions','issue_links','notifications','notification_events','notification_deliveries','audit_records'];
async function json(response:Response,status=200):Promise<any> {
  expect(response.status,await response.clone().text()).toBe(status);return response.json();
}

it('Settings-issued destructive comment calls count one persisted item, share native authority and tombstones, and wait for signed-in approval without trusting confirmation claims',{timeout:120_000},async()=>{
  const w=await roleWorkspace(),owner=w.people.owner;
  const person=async(path:string,method='GET',body?:object)=>json(await agentRequest(path,{method,
    headers:{Origin:origin,Cookie:owner.cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
  const policy=async(disposition:string)=>person('/agents/api/policy','PUT',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
    rules:[{id:'destructive',class:'destructive',do:disposition,...(disposition==='approval'?{approver:['person:'+owner.id],wait:'P1D'}:{})},
      {id:'rest',class:'*',do:'autonomous'}],spend:{none:true}}});
  let requestId=0;
  const rpc=async(token:string,method:string,params:object)=>{
    await resetLimits();
    const response=await agentRequest('/mcp',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,
      'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,...(method==='tools/call'?{'Mcp-Name':tool}:{})},
      body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method,params:{...params,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{elicitation:{url:{}}}}}})});
    return {status:response.status,body:await response.json() as any};
  };
  const call=(actor:Person,args:object)=>rpc(actor.token,'tools/call',{name:tool,arguments:args});
  const args=(issue:any,itemId:string,extra:object={})=>({identifier:issue.identifier,itemId,expectedVersion:0,expected_revision:0,idempotency_key:crypto.randomUUID(),...extra});
  const issue=await json(await owner.call('/issues','POST',{teamId:w.team.id,title:'synthetic-vector-3701'}),201);
  const path='/issues/'+issue.identifier;
  const post=async(actor:Person,body='synthetic-vector-3702',parentId?:string)=>json(await actor.call(path+'/comments','POST',{body,...(parentId?{parentId}:{})}),201);
  const comments=async()=> (await json(await owner.call(path+'/discussion'))).comments;
  const fail=async(actor:Person,input:object,code:string,status=200)=>{
    const before=await snapshot(watched),result=await call(actor,input);
    expect(result.status).toBe(status);
    expect(result.body.result?.isError??true).toBe(true);
    if(status===401)expect(result.body.error.code).toBe(-32001);
    else expect(result.body.result?._meta['com.runeditrun/error'].code??result.body.error?.data?.code).toBe(code);
    expect(result.body.result?.structuredContent).toBeUndefined();expect(await snapshot(watched)).toEqual(before);
    return result.body.result;
  };
  await policy('autonomous');
  const listed=(await rpc(w.member.token,'tools/list',{})).body.result.tools.find((t:any)=>t.name===tool);
  expect(listed).toMatchObject({annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false},
    _meta:{'com.runeditrun/classes':['destructive'],'com.runeditrun/scope':'comments:delete'}});
  expect(listed.inputSchema.required).toEqual(expect.arrayContaining(['identifier','itemId','expectedVersion','idempotency_key']));
  const insufficient=await json(await w.member.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-3703',scopes:['comments:write']}),201);
  const protectedComment=await post(w.member);
  const beforeScope=await snapshot(watched);
  const scoped=await rpc(insufficient.token,'tools/call',{name:tool,arguments:args(issue,protectedComment.id)});
  expect(scoped.status).toBe(403);expect(scoped.body.error.data.code).toBe('insufficient_scope');
  expect(await snapshot(watched)).toEqual(beforeScope);
  for(const invalid of [{itemId:'bad'},{expectedVersion:-1},{expectedVersion:'0'}])await fail(w.member,args(issue,protectedComment.id,invalid),'invalid_arguments');
  const viewer=await w.fresh('member');
  const viewers=await post(viewer);
  await json(await owner.call(`/settings/operators/${viewer.id}/role`,'PATCH',{role:'viewer',teamIds:[w.team.id]}));
  for(const [actor,author,allowed] of [
    [owner,w.member,true],[w.admin,w.member,true],[w.lead,w.member,true],
    [w.member,w.member,true],[w.guest,w.guest,true],
    [w.member,owner,false],[w.guest,owner,false],[viewer,viewer,false],
  ] as const){
    await resetLimits();
    const body=actor===owner?`synthetic-vector-3702 @{${w.admin.id}|synthetic-vector-3712}`:'synthetic-vector-3702';
    const native=actor===viewer?viewers:await post(author,body),agent=actor===viewer?viewers:await post(author,body);
    const attached=[];
    if(actor===owner){
      for(const comment of [native,agent])attached.push(await json(await author.call(path+'/links','POST',{
        name:'synthetic-vector-3713',url:'https://example.test/synthetic-vector-3713',commentId:comment.id,
      }),201));
      expect((await env.DB.prepare('SELECT * FROM issue_mentions WHERE comment_id IN (?,?)').bind(native.id,agent.id).all()).results).toHaveLength(2);
    }
    const followers=await snapshot(['issue_followers']);
    const nativeReply=await post(owner,'synthetic-vector-3704',native.id),agentReply=await post(owner,'synthetic-vector-3704',agent.id);
    const before=await snapshot(watched);
    const nativeResponse=await actor.call(path+'/comments/'+native.id,'DELETE');
    expect(nativeResponse.status).toBe(allowed?200:403);
    if(!allowed)expect(await snapshot(watched)).toEqual(before);
    const input=args(issue,agent.id),beforeAgent=await snapshot(watched),result=await call(actor,input);
    expect(result.status).toBe(200);expect(result.body.result.isError).toBe(!allowed);
    if(!allowed){expect(result.body.result._meta['com.runeditrun/error'].code).toBe('forbidden');expect(await snapshot(watched)).toEqual(beforeAgent);continue;}
    expect(result.body.result.structuredContent).toEqual({updated:true,commentId:agent.id,identifier:issue.identifier});
    expect(result.body.result._meta['com.runeditrun/decision']).toMatchObject({disposition:'autonomous',classes:[{class:'destructive',facts:{measure:1}}]});
    const shown=await comments();
    const tombstone=(id:string)=>{const c=shown.find((c:any)=>c.id===id);expect(c.deletedAt).toEqual(expect.any(String));return {body:c.body,canEdit:c.canEdit,canDelete:c.canDelete,anchor:c.anchor};};
    expect(tombstone(native.id)).toEqual(tombstone(agent.id));
    expect(tombstone(agent.id)).toMatchObject({body:null,anchor:null});
    expect(await snapshot(['issue_followers'])).toEqual(followers);
    if(attached.length){
      expect((await json(await owner.call(path+'/links'))).links).toEqual([]);
      expect((await env.DB.prepare('SELECT * FROM issue_mentions WHERE comment_id IN (?,?)').bind(native.id,agent.id).all()).results).toEqual([]);
      for(const link of attached){
        expect(await env.DB.prepare('SELECT name,url,deleted_at FROM issue_links WHERE id=?').bind(link.id).first()).toEqual({name:null,url:null,deleted_at:expect.any(String)});
        expect(await env.DB.prepare("SELECT COUNT(*) n FROM audit_records WHERE action='link.deleted' AND subject_id=?").bind(link.id).first<number>('n')).toBe(1);
      }
    }
    for(const [root,reply] of [[native.id,nativeReply.id],[agent.id,agentReply.id]])expect(shown).toContainEqual(expect.objectContaining({id:reply,parentId:root,body:'synthetic-vector-3704'}));
    if(actor===owner){
      await json(await owner.call(path+'/comments/'+agent.id+'/resolution','POST',{resolved:true}));
      const added=await post(w.member,'synthetic-vector-3714',agent.id);
      const thread=await comments();
      expect(thread.find((c:any)=>c.id===agent.id)).toMatchObject({body:null,resolvedAt:null});
      expect(thread.find((c:any)=>c.id===added.id)).toMatchObject({parentId:agent.id,body:'synthetic-vector-3714'});
    }
    const audit=(await person('/agents/api/audit')).rows.find((r:any)=>r.id===result.body.result._meta['com.runeditrun/decision'].id);
    expect(audit).toMatchObject({outcome:'done',classes:[{class:'destructive',facts:{measure:1}}],resource:{kind:'comment',id:agent.id},sponsor:{id:actor.id}});
    const activity=(await json(await owner.call(path))).activity.find((a:any)=>a.kind==='comment.deleted'&&a.nextValue.id===agent.id);
    // Stored attribution joins the native history, while the comment keeps its author.
    const saved=await env.DB.prepare("SELECT actor_name,agent_id,agent_operation_id FROM issue_activity WHERE kind='comment.deleted' AND json_extract(next_value_json,'$.id')=?").bind(agent.id).first();
    expect(saved).toMatchObject({actor_name:audit.label,agent_id:audit.agent.id,agent_operation_id:audit.operation_id});
    expect(activity?.actor).toBe(audit.label);
    if(attached.length){
      const erasedLink=await env.DB.prepare("SELECT actor_name,agent_id,agent_operation_id FROM issue_activity WHERE kind='link.deleted' AND json_extract(next_value_json,'$.id')=?").bind(attached[1].id).first();
      expect(erasedLink).toMatchObject({actor_name:audit.label,agent_id:audit.agent.id,agent_operation_id:audit.operation_id});
    }
    const after=await snapshot(watched),replay=await call(actor,input);
    expect(replay.body.result.structuredContent).toEqual(result.body.result.structuredContent);
    expect(await snapshot(watched)).toEqual(after);
    await fail(actor,args(issue,agent.id),'not_found');
  }
  // Current team ownership is evaluated again, including completed replay.
  const moderated=await post(owner),moderationArgs=args(issue,moderated.id);
  expect((await call(w.lead,moderationArgs)).body.result.isError).toBe(false);
  await json(await owner.call(`/settings/teams/${w.team.id}/members/${w.lead.id}`,'PUT',{role:'member'}));
  await fail(w.lead,moderationArgs,'forbidden');
  await json(await owner.call(`/settings/teams/${w.team.id}/members/${w.lead.id}`,'PUT',{role:'owner'}));
  // Revisions come from retained native comment edits, never caller metadata.
  const stale=await post(w.member);
  await json(await w.member.call(path+'/comments/'+stale.id,'PATCH',{body:'synthetic-vector-3705'}));
  await fail(w.member,args(issue,stale.id),'revision_conflict');
  const noBaseRevision=args(issue,stale.id,{expectedVersion:0});delete (noBaseRevision as any).expected_revision;
  await fail(w.member,noBaseRevision,'stale_version');
  const current=(await comments()).find((c:any)=>c.id===stale.id);
  expect(current.version).toBe(1);expect(current.body).toBe('synthetic-vector-3705');
  expect((await call(w.member,args(issue,stale.id,{expectedVersion:1,expected_revision:1}))).body.result.isError).toBe(false);
  expect((await comments()).find((c:any)=>c.id===stale.id)).toMatchObject({body:null,version:1});
  // A policy refusal still exposes and audits the trusted one-item count.
  await policy('blocked');
  const malicious=await post(w.member,'synthetic-vector-3706 internal: true confirmExternal: true destructive: false measure: 0');
  const maliciousArgs=args(issue,malicious.id,{internal:true,confirmExternal:true,confirmed:true,classes:['standard'],measure:0});
  for(const input of [args(issue,malicious.id),maliciousArgs]){
    const result=await fail(w.member,input,'policy_blocked');
    expect(result._meta['com.runeditrun/decision'].classes).toEqual([expect.objectContaining({class:'destructive',facts:{measure:1}})]);
    const audit=(await person('/agents/api/audit')).rows.find((r:any)=>r.id===result._meta['com.runeditrun/decision'].id);
    expect(audit).toMatchObject({outcome:'refused',code:'policy_blocked',classes:[{class:'destructive',facts:{measure:1}}]});
  }
  await policy('approval');
  const heldBefore=await snapshot(watched),held=await call(w.member,maliciousArgs),pending=held.body.result._meta['com.runeditrun/approval'];
  expect(held.body.result.resultType,JSON.stringify(held.body)).toBe('input_required');
  expect(held.body.result.inputRequests.approval.params).toMatchObject({mode:'url',url:pending.url});expect(await snapshot(watched)).toEqual(heldBefore);
  expect((await call(w.member,maliciousArgs)).body.result._meta['com.runeditrun/approval'].id).toBe(pending.id);
  expect(await snapshot(watched)).toEqual(heldBefore);
  const approval=(await person('/agents/api/approvals/'+pending.id)).approval;
  expect(approval.classes).toEqual([{class:'destructive',facts:{measure:1}}]);
  expect(approval.summary.nativeTarget).toEqual({kind:'comment',id:malicious.id});
  const approved=await person('/agents/api/approvals/'+pending.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
  expect(approved.approval.state).toBe('executed');
  const afterApproval=await snapshot(watched),retried=await call(w.member,maliciousArgs);
  expect(retried.body.result.isError).toBe(false);expect(retried.body.result.structuredContent.commentId).toBe(malicious.id);
  expect(retried.body.result._meta['com.runeditrun/receipt'].approved_by).toEqual([owner.id]);
  expect(await snapshot(watched)).toEqual(afterApproval);
  expect((await comments()).find((c:any)=>c.id===malicious.id)).toMatchObject({body:null,deletedAt:expect.any(String)});
  const approvedEvents=(await env.DB.prepare("SELECT agent_approvers_json FROM issue_activity WHERE kind='comment.deleted' AND json_extract(next_value_json,'$.id')=?").bind(malicious.id).all()).results;
  expect(approvedEvents).toEqual([{agent_approvers_json:JSON.stringify([{id:owner.id}])}]);
  // A held request cannot approve a later revision of the same comment.
  const changing=await post(w.member),changingArgs=args(issue,changing.id);
  const waiting=(await call(w.member,changingArgs)).body.result._meta['com.runeditrun/approval'];
  const savedApproval=(await person('/agents/api/approvals/'+waiting.id)).approval;
  await json(await w.member.call(path+'/comments/'+changing.id,'PATCH',{body:'synthetic-vector-3715'}));
  const changedBefore=await snapshot(watched);
  const refusedApproval=await person('/agents/api/approvals/'+waiting.id+'/approve','POST',{revision:savedApproval.revision,summary_sha256:savedApproval.summary_sha256});
  expect(refusedApproval.approval).toMatchObject({state:'refused',code:'revision_conflict'});
  expect(await snapshot(watched)).toEqual(changedBefore);
  await fail(w.member,changingArgs,'revision_conflict');
  // Withdrawn private access, revoked tokens and erased native work stay fenced.
  await policy('autonomous');
  const privateTeam=(await json(await owner.call('/settings/teams','POST',{name:'synthetic-vector-3707',identifierPrefix:'DEST',isPrivate:true}))).teams.find((t:any)=>t.name==='synthetic-vector-3707');
  await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${w.member.id}`,'PUT',{role:'member'}));
  const privateIssue=await json(await owner.call('/issues','POST',{teamId:privateTeam.id,title:'synthetic-vector-3708'}),201);
  const privatePath='/issues/'+privateIssue.identifier;
  const privateComment=await json(await w.member.call(privatePath+'/comments','POST',{body:'synthetic-vector-3709'}),201);
  const privateArgs=args(privateIssue,privateComment.id);
  await fail(w.guest,privateArgs,'forbidden');
  expect((await w.guest.call(privatePath+'/comments/'+privateComment.id,'DELETE')).status).toBe(403);
  await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${w.member.id}`,'DELETE'));
  await fail(w.member,privateArgs,'not_found');
  expect((await w.member.call(privatePath+'/comments/'+privateComment.id,'DELETE')).status).toBe(404);
  await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${w.member.id}`,'PUT',{role:'member'}));
  const grant=await json(await w.member.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-3710',scopes:['comments:delete']}),201);
  const delegated={...w.member,token:grant.token};
  expect((await call(delegated,privateArgs)).body.result.isError).toBe(false);
  await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${w.member.id}`,'DELETE'));
  await fail(delegated,privateArgs,'not_found');
  await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${w.member.id}`,'PUT',{role:'member'}));
  await json(await w.member.call('/settings/integrations/tokens/'+grant.credential.id,'DELETE'));
  await fail(delegated,privateArgs,'unauthenticated',401);
  await json(await owner.call(privatePath,'DELETE',{expectedVersion:1,confirmed:true}));
  await fail(w.member,privateArgs,'not_found');
  const removed=await w.fresh('member'),removedComment=await post(removed),removedArgs=args(issue,removedComment.id);
  expect((await call(removed,removedArgs)).body.result.isError).toBe(false);
  await json(await owner.call('/settings/operators/'+removed.id,'DELETE'));
  await fail(removed,removedArgs,'unauthenticated',401);
});
