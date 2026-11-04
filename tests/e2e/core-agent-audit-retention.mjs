import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {withOperatorClient,publicRequest} from './operator-request.mjs';
import {navigate,settleReads} from './collaboration-navigation.mjs';
import {inviteReader} from './role-reader-support.mjs';
const require=createRequire(import.meta.url);

/** Real Settings credentials, mounted MCP writes and the retained Agents page. */
export async function agentAuditRetentionJourney({page,context,base,state,sql,evidence,restart,record}) {
  const marker='synthetic-vector-'+Date.now();
  const personAs=async(current,path,method='GET',data,status=200,extra={})=>withOperatorClient(current,async client=>{
    const response=await client.fetch(base+path,{method,headers:{Origin:base,...extra},...(data===undefined?{}:{data})});
    assert.equal(response.status(),status,method+' '+path);
    return response.status()===204?undefined:response.json();
  });
  const person=(...args)=>personAs(context,...args);
  const native=(path,method='GET',data,status=200)=>person('/api'+path,method,data,status);
  const ownerSession=await native('/session');
  const options=await native('/options');
  const team=options.teams[0];
  assert.equal(ownerSession.role,'owner');assert.ok(team);
  const member=await inviteReader({owner:page,browser:context.browser(),runtime:{base,state,sql},
    name:marker+'-member',email:[marker,'vector.test'].join(String.fromCharCode(64)),role:'member'});
  try {
  await native(`/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'});
  const memberSession=await personAs(member.context,'/api/session');
  assert.equal(memberSession.role,'member');
  assert.notEqual(memberSession.operatorId,ownerSession.operatorId);
  const memberAuth=await personAs(member.context,'/auth/session');
  const ownerAuth=await person('/auth/session');
  assert.notEqual(memberAuth.id,ownerAuth.id,'Sponsor and remover have independent native sessions');
  let rpcId=0;
  const call=async(token,name,args,trace)=>{
    const response=await publicRequest(base+'/mcp',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+token,
      'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
      data:{jsonrpc:'2.0',id:++rpcId,method:'tools/call',params:{name,arguments:args,...(trace?{_meta:{traceparent:trace}}:{})}}});
    return {status:response.status,body:await response.json()};
  };
  const mint=async(issuer,name)=>{
    await navigate(issuer.page,base+'/app/settings/developers');
    const panel=issuer.page.locator('#integrations');
    await panel.getByRole('heading',{name:'API tokens',exact:true}).waitFor();
    await panel.getByLabel('Token name',{exact:true}).fill(name);
    // Select exactly the two write scopes; no implicit broad grant.
    await panel.getByRole('checkbox',{name:'issues:read',exact:true}).uncheck();
    for(const scope of ['issues:write','comments:write'])await panel.getByRole('checkbox',{name:scope,exact:true}).check();
    const pending=issuer.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations/tokens'&&r.request().method()==='POST');
    await panel.getByRole('button',{name:'Create token',exact:true}).click();
    const response=await pending;assert.equal(response.status(),201);
    const {token}=await response.json();assert.ok(token);
    const reveal=panel.getByLabel('New credential',{exact:true});await reveal.waitFor();
    assert.equal(await reveal.inputValue()===token,true,'Settings reveals the issued credential only to its creator');
    assert.equal(await reveal.getAttribute('type'),'password');
    await panel.getByRole('button',{name:'I saved it; close',exact:true}).click();
    assert.equal(await reveal.count(),0);
    const tokens=await personAs(issuer.context,'/api/settings/integrations/tokens');
    const credential=tokens.tokens.find(t=>t.name===name);assert.ok(credential);
    assert.deepEqual(JSON.parse(credential.scopes).sort(),['comments:write','issues:write']);
    return {id:'vector-token:'+credential.id,name,token};
  };
  const audit=async()=>{
    const response=await person('/agents/api/audit');
    assert.equal(response.differs_from_policy,0);
    return response.rows;
  };
  const retained=(rows,history)=>{
    for(const row of history)assert.deepEqual(rows.find(r=>r.id===row.id),row,'Historical audit is unchanged: '+row.tool);
  };
  const receipts=[];
  for(const issuer of [{page,context,role:'owner'}, {...member,role:'member'}]){
  const session=await personAs(issuer.context,'/api/session');
  const sponsor=(await native('/options')).operators.find(p=>p.id===session.operatorId);
  assert.ok(sponsor);
  for(const decision of ['autonomous','review']){
    await page.setViewportSize({width:1440,height:1000});
    await person('/agents/api/policy','PUT',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
      rules:[{id:'standard',class:'standard',do:decision}],reviewers:['role:owner'],spend:{none:true}}});
    const issue=await native('/issues','POST',{teamId:team.id,title:marker+'-'+issuer.role+'-'+decision},201);
    const agent=await mint(issuer,marker+'-'+issuer.role+'-'+decision+'-removed');
    const other=await mint(issuer,marker+'-'+issuer.role+'-'+decision+'-retained');
    const active=await call(other.token,'vector.issue.comment',{identifier:issue.identifier,body:marker+'-other-before',idempotency_key:crypto.randomUUID()});
    assert.equal(active.status,200);assert.equal(active.body.result.isError,false);
    const key=crypto.randomUUID(),commentKey=crypto.randomUUID();
    const trace='00-'+crypto.randomUUID().replaceAll('-','')+'-'+crypto.randomUUID().replaceAll('-','').slice(0,16)+'-01';
    const edited=await call(agent.token,'vector.issue.concurrent_edits',{identifier:issue.identifier,
      change:{expectedVersion:issue.version,title:marker+'-'+issuer.role+'-'+decision+'-edited'},idempotency_key:key},trace);
    assert.equal(edited.status,200);assert.equal(edited.body.result.isError,false);
    const commented=await call(agent.token,'vector.issue.comment',{identifier:issue.identifier,body:marker+'-'+decision+'-comment',idempotency_key:commentKey},trace);
    assert.equal(commented.status,200);assert.equal(commented.body.result.isError,false);
    const history=(await audit()).filter(row=>row.agent.id===agent.id);
    assert.equal(history.length,2);assert.equal(new Set(history.map(row=>row.id)).size,2);
    assert.deepEqual(history.map(row=>row.tool),['vector.issue.concurrent_edits','vector.issue.comment']);
    for(const row of history){
      assert.deepEqual(row.agent,{id:agent.id,name:agent.name,specialist:'software delivery coordinator'});
      assert.deepEqual(row.sponsor,{id:session.operatorId,name:sponsor.name});
      assert.equal(row.client_id,agent.id);assert.equal(row.trace,trace);assert.equal(row.door,'mcp');
      assert.deepEqual([...row.scopes].sort(),['comments:write','issues:write']);assert.equal(row.decision,decision);assert.equal(row.outcome,'done');
      assert.deepEqual(row.classes,[{class:'standard',facts:{measure:1}}]);
      assert.deepEqual(row.rules,[{class:'standard',rule:'standard',do:decision}]);
      assert.deepEqual(row.resource,{kind:'issue',id:issue.id});
      assert.equal(row.idempotency_key,row.tool==='vector.issue.comment'?commentKey:key);
      assert.ok(row.label.includes(agent.name));assert.ok(row.label.includes(sponsor.name));
      if(decision==='review')assert.ok(row.review.id);else assert.equal(row.review,null);
    }
    const nativeBefore=await native('/issues/'+issue.identifier);
    const discussionBefore=await native('/issues/'+issue.identifier+'/discussion');
    assert.equal(nativeBefore.title,marker+'-'+issuer.role+'-'+decision+'-edited');
    assert.equal(discussionBefore.comments[1].body,marker+'-'+decision+'-comment');
    assert.equal(discussionBefore.comments[1].actor,history[1].label);
    for(const row of history)assert.ok(nativeBefore.activity.some(a=>a.actor===row.label));
    const agentsBefore=await person('/agents/api/agents');
    const revoke='/agents/api/agents/'+encodeURIComponent(agent.id)+'/revoke';
    for(const role of ['admin','member','viewer','guest']){
      await native(`/settings/operators/${member.id}/role`,'PATCH',{role,teamIds:[team.id]});
      await personAs(member.context,revoke,'POST',{},403);
      await personAs(member.context,'/agents/api/audit','GET',undefined,403);
      assert.deepEqual(await person('/agents/api/agents'),agentsBefore);
      retained(await audit(),history);
      assert.deepEqual(await native('/issues/'+issue.identifier),nativeBefore);
      assert.deepEqual(await native('/issues/'+issue.identifier+'/discussion'),discussionBefore);
    }
    await native(`/settings/operators/${member.id}/role`,'PATCH',{role:'member'});
    const anonymous=await publicRequest(base+revoke,{method:'POST',headers:{Origin:base},data:{}});
    assert.equal(anonymous.status,401);
    await person(revoke,'POST',{},403,{Origin:'https://foreign.invalid'});
    await person(revoke,'POST',{},403,{Authorization:'Bearer '+agent.token});
    assert.deepEqual(await person('/agents/api/agents'),agentsBefore);
    retained(await audit(),history);
    await person(revoke,'POST',{});
    assert.deepEqual(await native('/issues/'+issue.identifier),nativeBefore);
    assert.deepEqual(await native('/issues/'+issue.identifier+'/discussion'),discussionBefore);
    retained(await audit(),history);
    // Park the SPA before stopping its server; restart the same on-disk installation.
    await navigate(page,base+'/');await settleReads(page);
    await navigate(member.page,base+'/');await settleReads(member.page);
    await restart();
    retained(await audit(),history);
    const agents=(await person('/agents/api/agents')).agents;
    assert.deepEqual(agents.find(a=>a.id===agent.id),{id:agent.id,name:agent.name,specialist:'software delivery coordinator',
      sponsor:{id:session.operatorId,name:sponsor.name},revoked:true});
    assert.equal(agents.find(a=>a.id===other.id).revoked,false,'A previously active second agent stays active');
    for(const [tool,args] of [
      ['vector.issue.concurrent_edits',{identifier:issue.identifier,change:{expectedVersion:issue.version,title:marker+'-'+issuer.role+'-'+decision+'-edited'},idempotency_key:key}],
      ['vector.issue.comment',{identifier:issue.identifier,body:marker+'-'+decision+'-comment',idempotency_key:commentKey}],
      ['vector.issue.comment',{identifier:issue.identifier,body:marker+'-refused',idempotency_key:crypto.randomUUID()}],
    ]){
      const refused=await call(agent.token,tool,args);assert.equal(refused.status,401);assert.equal(refused.body.error.data.code,'unauthenticated');
    }
    assert.deepEqual(await native('/issues/'+issue.identifier),nativeBefore);
    assert.deepEqual(await native('/issues/'+issue.identifier+'/discussion'),discussionBefore);
    retained(await audit(),history);
    const kept=await call(other.token,'vector.issue.comment',{identifier:issue.identifier,body:marker+'-other',idempotency_key:crypto.randomUUID()});
    assert.equal(kept.status,200);assert.equal(kept.body.result.isError,false);
    const discussion=await native('/issues/'+issue.identifier+'/discussion');
    assert.deepEqual(discussion.comments.map(c=>c.body),[marker+'-other-before',marker+'-'+decision+'-comment',marker+'-other']);
    const reviews=(await person('/agents/api/reviews')).reviews;
    for(const row of history.filter(r=>r.review))assert.ok(reviews.some(review=>review.id===row.review.id&&review.prepared_by.agent===agent.name&&review.prepared_by.for===sponsor.name));
    await navigate(page,base+'/agents');
    await page.getByRole('heading',{name:'Agents',exact:true}).waitFor();
    const recent=page.getByRole('region',{name:'Recent activity',exact:true});
    const rows=recent.locator('li').filter({hasText:agent.name});
    assert.equal(await rows.count(),5,'Two completed writes and three refused attempts stay visible');
    const completed=rows.filter({hasText:decision==='review'?'Done, to review':/ · Done · /});
    assert.equal(await completed.count(),2);
    for(const row of history)assert.ok((await recent.innerText()).includes(row.agent.name+' for '+row.sponsor.name));
    if(decision==='review'){
      const feed=page.getByRole('region',{name:'To review',exact:true});
      for(const row of history)assert.equal(await feed.locator(`[data-review-id="${row.review.id}"]`).count(),1);
    }
    // Existing labelled controls work with keyboard focus; this document is server
    // rendered and its action script remains active after a real restart.
    const pause=page.getByRole('button',{name:'Pause agents',exact:true});await pause.focus();
    assert.ok(await pause.evaluate(el=>el===document.activeElement));
    const axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
    await page.evaluate(source=>{const script=document.createElement('script');script.nonce=document.querySelector('script[nonce]').nonce;script.textContent=source;document.head.append(script);},axe);
    const findings=await page.evaluate(async()=> (await window.axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id));
    assert.deepEqual(findings,[]);
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:width===390?844:1000});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(await page.locator('button,a,input,select,textarea').evaluateAll(controls=>controls.filter(el=>{
        const style=getComputedStyle(el);return style.display!=='none'&&el.getBoundingClientRect().height>0&&!el.textContent.trim()&&!el.getAttribute('aria-label')&&!el.labels?.length;
      }).map(el=>el.tagName)),[],'Controls have visible text or an accessible label');
      await page.screenshot({path:evidence+'/agent-audit-'+issuer.role+'-'+decision+'-'+width+'.png',fullPage:true});
    }
    receipts.push({sponsorRole:issuer.role,sponsorId:session.operatorId,decision,agent:agent.id,auditIds:history.map(row=>row.id),retained:true,restart:true,nextCall:401,otherAgentUsable:true});
  }
  }
  await navigate(member.page,base+'/');await settleReads(member.page);
  const endedSession=(await member.context.cookies()).map(cookie=>cookie.name+'='+cookie.value).join('; ');
  await personAs(member.context,'/auth/signout','POST',{},204);
  const finalAgents=await person('/agents/api/agents'),finalHistory=await audit();
  for(const agent of finalAgents.agents.filter(agent=>!agent.revoked)){
    const response=await publicRequest(base+'/agents/api/agents/'+encodeURIComponent(agent.id)+'/revoke',
      {method:'POST',headers:{Origin:base,Cookie:endedSession},data:{}});
    assert.equal(response.status,401,'An ended session cannot remove an active agent');
  }
  assert.deepEqual(await person('/agents/api/agents'),finalAgents);
  assert.deepEqual(await audit(),finalHistory);
  assert.deepEqual(member.errors,[]);
  await page.setViewportSize({width:1440,height:1000});
  await writeFile(evidence+'/agent-audit-retention.json',JSON.stringify({passed:true,receipts},null,2));
  record('BASE-AGENT-009','Settings-issued scoped edit and comment agents retain complete audit snapshots, native attribution and review history after Owner removal and process restart; revoked writes and replay refuse while another agent still writes. Owner and independently signed-in Member sponsors retain their own identities; current role, origin, bearer, anonymous and ended-session refusals cannot remove agents or change history. Agents is accessible at 1440 and 390.');
  } finally {await member.context.close();}
}
