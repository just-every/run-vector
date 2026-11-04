import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {inviteReader} from './role-reader-support.mjs';
import {withOperatorClient,publicRequest} from './operator-request.mjs';
import {navigate,settleReads,trackRequests} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** Discard a real mounted response, restart its Worker and inspect native history. */
export async function agentWriteRetryJourney({page,context,base,state,sql,evidence,record,restart}) {
  const marker='synthetic-vector-'+Date.now(),inspect=roleScreens(evidence);
  const owner=async(path,method='GET',data,status=200)=>withOperatorClient(context,async client=>{
    const response=await client.fetch(base+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    assert.equal(response.status(),status,method+' '+path+' '+await response.text());return response.json();
  });
  const member=await inviteReader({owner:page,browser:context.browser(),runtime:{base,state,sql},
    name:marker+'-sponsor',email:[marker,'vector.test'].join(String.fromCharCode(64)),role:'member'});
  trackRequests(member.page);
  const consoleErrors=[],failed=[],external=[];
  member.page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  member.page.on('requestfailed',request=>failed.push(request.failure()?.errorText));
  await member.context.route('**/*',async route=>{
    if(new URL(route.request().url()).origin===base)await route.continue();
    else {external.push(new URL(route.request().url()).origin);await route.abort();}
  });
  let id=0;
  const receipts=[];
  try {
    const session=await owner('/api/session'),options=await member.api('/options');
    const person=options.operators.find(p=>p.id===member.id).name;
    const prefix='RETRY'+String(Date.now()).slice(-5).replaceAll(/\d/g,d=>String.fromCharCode(65+Number(d)));
    const team=(await owner('/api/settings/teams','POST',{name:marker+'-team',identifierPrefix:prefix,isPrivate:true})).teams.find(t=>t.name===marker+'-team');
    await owner(`/api/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'});
    for(const disposition of ['autonomous','review']){
      await owner('/agents/api/policy','PUT',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
        reviewers:['person:'+session.operatorId],rules:[{id:'standard',class:'standard',do:disposition},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}}});
      const grant=await member.api('/settings/integrations/tokens','POST',{name:marker+'-'+disposition,scopes:['issues:write']},201);
      const issue=await member.api('/issues','POST',{teamId:team.id,title:marker+'-original-'+disposition},201);
      const path='/issues/'+issue.identifier,args={identifier:issue.identifier,change:{expectedVersion:1,title:marker+'-agent-'+disposition},
        expected_revision:1,idempotency_key:crypto.randomUUID()};
      const request=arguments_=>({method:'POST',headers:{Origin:base,Authorization:'Bearer '+grant.token,
        'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call',Connection:'close'},
        body:JSON.stringify({jsonrpc:'2.0',id:++id,method:'tools/call',params:{name:'vector.issue.concurrent_edits',arguments:arguments_}})});
      const rpc=async arguments_=>{
        const init=request(arguments_),response=await publicRequest(base+'/mcp',{method:init.method,headers:init.headers,data:JSON.parse(init.body)});
        const body=await response.json();assert.equal(body.id,id);return {status:response.status,body};
      };
      // This fetch does reach the built Worker. Cancel the body without reading
      // or cloning it, then prove the committed edit through independent doors.
      const discarded=await fetch(base+'/mcp',request(args));
      assert.equal(discarded.status,200);const lostId=id;await discarded.body.cancel();
      const first=await member.api(path);
      assert.equal(first.title,args.change.title);assert.equal(first.version,2);
      assert.equal(first.activity.filter(a=>a.kind==='issue.updated').length,1);
      const saved=sql(`SELECT decision_id,outcome FROM agent_door_calls WHERE agent='vector-token:${grant.credential.id}' AND key='${args.idempotency_key}'`)[0];
      assert.ok(saved,'The mounted edit itself recorded its outcome');
      const original=JSON.parse(saved.outcome);
      assert.deepEqual(original.result,{id:issue.id,identifier:issue.identifier,version:2});
      assert.equal(original.outcome,'done');assert.equal(original.decision.disposition,disposition);
      const audit=(await owner('/agents/api/audit')).rows.find(row=>row.id===saved.decision_id);
      assert.equal(audit.outcome,'done');assert.equal(audit.idempotency_key,args.idempotency_key);
      assert.equal(audit.sponsor.id,member.id);assert.deepEqual(audit.resource,{kind:'issue',id:issue.id});
      const events=sql(`SELECT agent_operation_id FROM issue_activity WHERE issue_id='${issue.id}' AND kind='issue.updated'`);
      assert.equal(events.length,1);assert.equal(events[0].agent_operation_id,audit.operation_id);
      if(disposition==='review')assert.ok(original.review.id);
      const immediate=await rpc(args);assert.notEqual(id,lostId);assert.equal(immediate.body.result.isError,false);
      assert.deepEqual(immediate.body.result.structuredContent,original.result);
      assert.deepEqual(immediate.body.result._meta['com.runeditrun/review'],original.review);
      assert.deepEqual(await member.api(path),first);
      const conflict=await rpc({...args,change:{...args.change,title:marker+'-conflicting'}});
      assert.deepEqual(conflict.body.result._meta['com.runeditrun/error'],{code:'idempotency_conflict'});
      assert.equal(conflict.body.result.isError,true);assert.deepEqual(await member.api(path),first);
      await member.api(path,'PATCH',{expectedVersion:2,title:marker+'-later-'+disposition});
      const later=await member.api(path);
      assert.equal(later.version,3);assert.equal(later.title,marker+'-later-'+disposition);
      const stale=await rpc({...args,idempotency_key:crypto.randomUUID(),change:{expectedVersion:3,title:marker+'-stale'}});
      assert.deepEqual(stale.body.result._meta['com.runeditrun/error'],{code:'revision_conflict',current_revision:3});
      assert.equal(stale.body.result.isError,true);assert.deepEqual(await member.api(path),later);
      await navigate(page,base+'/');await navigate(member.page,base+'/');
      await restart();
      const replay=await rpc(args);
      assert.equal(replay.status,200);assert.equal(replay.body.result.isError,false);
      assert.deepEqual(replay.body.result.structuredContent,original.result);
      assert.deepEqual(replay.body.result._meta['com.runeditrun/review'],original.review);
      assert.deepEqual(await member.api(path),later,'Restarted replay preserves the later native edit');
      const replays=(await owner('/agents/api/audit')).rows.filter(row=>row.replay_of===audit.id);
      assert.equal(replays.length,2);for(const row of replays)assert.equal(row.operation_id,audit.operation_id);
      const label=grant.credential.name+' for '+person;
      assert.deepEqual(later.activity.map(a=>({kind:a.kind,actor:a.actor})),[
        {kind:'issue.created',actor:person},{kind:'issue.updated',actor:label},{kind:'issue.updated',actor:person},
      ]);
      await member.page.setViewportSize({width:1440,height:1000});
      await navigate(member.page,base+'/app'+path);
      await member.page.getByRole('heading',{name:later.title,exact:true}).waitFor();
      await settleReads(member.page);assert.equal((await member.page.reload()).status(),200);
      await member.page.getByRole('heading',{name:later.title,exact:true}).waitFor();
      await member.page.locator('.issue-history > summary').click();
      const activity=member.page.locator('.activity-list > li');assert.equal(await activity.count(),3);
      assert.ok((await activity.nth(1).innerText()).includes(label));
      assert.ok((await activity.nth(2).innerText()).includes(person));
      const summary=member.page.locator('.issue-history > summary');await summary.focus();
      assert.ok(await summary.evaluate(element=>element===document.activeElement));
      const timeOrigin=await member.page.evaluate(()=>performance.timeOrigin);
      await inspect(member.page,member.page.locator('main:visible').first(),'agent-write-retry-'+disposition);
      assert.equal(await member.page.evaluate(()=>performance.timeOrigin),timeOrigin,'Viewport inspection retains the hydrated document');
      await navigate(member.page,base+'/');
      await owner('/agents/api/pause','POST',{paused:true});
      const paused=await rpc(args);assert.equal(paused.body.result._meta['com.runeditrun/error'].code,'agents_paused');
      assert.equal(paused.body.result.structuredContent,undefined);assert.deepEqual(await member.api(path),later);
      await owner('/agents/api/pause','POST',{paused:false});
      await owner(`/api/settings/teams/${team.id}/members/${member.id}`,'DELETE');
      const hidden=await rpc(args);assert.equal(hidden.body.result._meta['com.runeditrun/error'].code,'not_found');
      assert.equal(hidden.body.result.structuredContent,undefined);
      await owner(`/api/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'});
      assert.deepEqual(await member.api(path),later);
      await member.api('/settings/integrations/tokens/'+grant.credential.id,'DELETE');
      const revoked=await rpc(args);assert.equal(revoked.status,401);assert.equal(revoked.body.result,undefined);
      assert.deepEqual(await member.api(path),later);
      receipts.push({disposition,discardedResponse:true,restarted:true,singleAgentEdit:true,linkedAudit:true,conflictingKeyRefused:true,
        staleRevision:3,laterWorkRetained:true,admissionBeforeReplay:true});
    }
    assert.deepEqual(member.errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
    await writeFile(evidence+'/agent-write-retry.json',JSON.stringify({passed:true,receipts,widths:[1440,390]},null,2));
    record('BASE-AGENT-012','Discarded native edit responses replay after Worker restart under autonomous and review policies, with one linked agent edit; conflicting keys and stale revisions preserve later human work and current Pause, access and revocation admission.');
  } finally {await member.context.close();}
}
