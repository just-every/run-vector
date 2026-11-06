import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {readArchive} from '@runeditrun/rer/modules/portability';
import {inviteReader} from './role-reader-support.mjs';
import {withOperatorClient,publicRequest} from './operator-request.mjs';
import {navigate,settleReads,trackRequests} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** Real Settings grants, mounted MCP writes and independently reloaded native views. */
export async function agentAttributionJourney({page,context,base,state,sql,evidence,record}) {
  const marker='synthetic-vector-'+Date.now(),inspect=roleScreens(evidence);
  const owner=async(path,method='GET',data,status=200)=>withOperatorClient(context,async client=>{
    const response=await client.fetch(base+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    assert.equal(response.status(),status,method+' '+path+' '+await response.text());return response.json();
  });
  const member=await inviteReader({owner:page,browser:context.browser(),runtime:{base,state,sql},
    name:marker+'-sponsor',email:[marker,'vector.test'].join(String.fromCharCode(64)),role:'member'});
  let id=0;
  const errors=[],external=[],expectedDenials=new Set();
  trackRequests(member.page);
  member.page.on('console',message=>{
    if(message.type()==='error'&&!(expectedDenials.has(message.location().url)&&/^Failed to load resource: the server responded with a status of 404(?: \([^)]*\))?$/.test(message.text())))errors.push(message.text());
  });
  member.page.on('requestfailed',request=>errors.push(request.failure()?.errorText));
  await member.context.route('**/*',async route=>{
    if(new URL(route.request().url()).origin===base)await route.continue();
    else {external.push(new URL(route.request().url()).origin);await route.abort();}
  });
  try {
    const session=await owner('/api/session'),options=await member.api('/options');
    const person=options.operators.find(p=>p.id===member.id).name;
    const prefix='ATTR'+String(Date.now()).slice(-6).replaceAll(/\d/g,d=>String.fromCharCode(65+Number(d)));
    const team=(await owner('/api/settings/teams','POST',{name:marker+'-team',identifierPrefix:prefix,isPrivate:true})).teams.find(t=>t.name===marker+'-team');
    await owner(`/api/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'});
    const native=[];
    for(const disposition of ['autonomous','review']){
      await owner('/agents/api/policy','PUT',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
        reviewers:['person:'+session.operatorId],rules:[{id:'standard',class:'standard',do:disposition},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}}});
      const name=marker+'-'+disposition;
      const grant=await member.api('/settings/integrations/tokens','POST',{name,scopes:['issues:write','comments:write']},201);
      const call=async(tool,args)=>{
        const response=await publicRequest(base+'/mcp',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+grant.token,
          'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
          data:{jsonrpc:'2.0',id:++id,method:'tools/call',params:{name:tool,arguments:{...args,idempotency_key:crypto.randomUUID()}}}});
        assert.equal(response.status,200);const body=await response.json();assert.equal(body.error,undefined);assert.notEqual(body.result.isError,true);
        return body.result.structuredContent;
      };
      const issue=await call('vector.issue.creation',{teamId:team.id,title:marker+'-created-'+disposition});
      await call('vector.issue.concurrent_edits',{identifier:issue.identifier,change:{expectedVersion:1,title:marker+'-edited-'+disposition}});
      const comment=await call('vector.issue.comment',{identifier:issue.identifier,body:marker+'-comment-'+disposition});
      // The sponsor can edit their comment, but its creation stays agent-authored.
      await member.api('/issues/'+issue.identifier+'/comments/'+comment.commentId,'PATCH',{body:marker+'-human-edit-'+disposition});
      native.push({issue,commentId:comment.commentId,label:name+' for '+person,disposition});
    }
    const human=await member.api('/issues','POST',{teamId:team.id,title:marker+'-human'},201);
    await member.api('/issues/'+human.identifier,'PATCH',{expectedVersion:1,title:marker+'-human-edit'});
    const humanComment=await member.api('/issues/'+human.identifier+'/comments','POST',{body:marker+'-human-comment'},201);
    native.push({issue:human,commentId:humanComment.id,label:person,disposition:'human'});
    for(const entry of native){
      const path='/issues/'+entry.issue.identifier;
      const detail=await member.api(path),discussion=await member.api(path+'/discussion');
      assert.deepEqual(detail.activity.map(a=>({kind:a.kind,actor:a.actor})),[
        {kind:'issue.created',actor:entry.label},{kind:'issue.updated',actor:entry.label},{kind:'comment.created',actor:entry.label},
        ...(entry.disposition==='human'?[]:[{kind:'comment.edited',actor:person}]),
      ]);
      assert.equal(discussion.comments.find(c=>c.id===entry.commentId).actor,entry.label);
      await member.page.setViewportSize({width:1440,height:1000});
      await navigate(member.page,base+'/app'+path);
      await member.page.getByRole('heading',{name:detail.title,exact:true}).waitFor();
      // Assert persistence after a real document reload, then audit both widths once.
      await settleReads(member.page);assert.equal((await member.page.reload()).status(),200);
      await member.page.getByRole('heading',{name:detail.title,exact:true}).waitFor();await settleReads(member.page);
      const comment=member.page.locator('.comment-entry').filter({hasText:discussion.comments[0].body});
      assert.equal(await comment.locator('strong').first().innerText(),entry.label);
      await comment.getByRole('button',{name:'Edit comment',exact:true}).focus();
      assert.ok(await comment.getByRole('button',{name:'Edit comment',exact:true}).evaluate(e=>e===document.activeElement));
      await member.page.locator('.issue-history > summary').click();
      const activity=member.page.locator('.activity-list > li');assert.equal(await activity.count(),entry.disposition==='human'?3:4);
      for(let position=0;position<3;position++)assert.ok((await activity.nth(position).innerText()).includes(entry.label));
      if(entry.disposition!=='human')assert.ok((await activity.nth(3).innerText()).includes(person));
      const timeOrigin=await member.page.evaluate(()=>performance.timeOrigin);
      await inspect(member.page,member.page.locator('main:visible').first(),'agent-attribution-'+entry.disposition);
      assert.equal(await member.page.evaluate(()=>performance.timeOrigin),timeOrigin,'Hydration and viewport changes retain the document');
    }
    await navigate(member.page,base+'/');
    // Owner-only native HTTP export; inspect the downloaded artifact, not a DB substitute.
    const created=await owner('/api/portability/exports','POST',{},201);let phase='building';
    while(phase==='building')phase=(await owner('/api/portability/exports/'+created.id+'/advance','POST',{maxParts:16})).phase;
    assert.equal(phase,'complete');
    const bytes=await withOperatorClient(context,async client=>{
      const response=await client.get(base+'/api/portability/exports/'+created.id+'/download');
      assert.equal(response.status(),200);return response.body();
    });
    const rows=[];for await(const part of readArchive(new Response(bytes).body))if(part.kind==='part')rows.push(...part.items.filter(item=>item.kind==='row'));
    for(const entry of native){
      const events=rows.filter(item=>item.table==='issue_activity'&&item.row.issue_id===entry.issue.id).map(item=>item.row);
      assert.equal(events.length,entry.disposition==='human'?3:4);
      assert.deepEqual(events.map(row=>row.kind).sort(),['comment.created',...(entry.disposition==='human'?[]:['comment.edited']),'issue.created','issue.updated']);
      for(const event of events){
        assert.equal(event.actor_operator_id,member.id);
        assert.equal(event.actor_name,entry.disposition==='human'||event.kind==='comment.edited'?null:entry.label);
        if(entry.disposition==='human'||event.kind==='comment.edited'){assert.equal(event.agent_id,null);assert.equal(event.agent_operation_id,null);}
        else {assert.ok(event.agent_id);assert.ok(event.agent_operation_id);}
      }
      assert.ok(rows.some(item=>item.table==='issue_comments'&&item.row.id===entry.commentId));
    }
    assert.ok(!rows.some(item=>['agent_door_audit','agent_door_agents','integration_tokens'].includes(item.table)));
    await owner('/api/portability/exports/'+created.id+'/abort','POST',{});
    await owner(`/api/settings/teams/${team.id}/members/${member.id}`,'DELETE');
    expectedDenials.add(base+'/api/issues/'+native[0].issue.identifier);
    await navigate(member.page,base+'/app/issues/'+native[0].issue.identifier);
    await member.page.locator('.resource-state').waitFor();assert.equal(await member.page.locator('.issue-inspector').count(),0);
    const text=await member.page.locator('main').first().innerText();
    for(const entry of native)assert.ok(!text.includes(entry.label));
    await navigate(member.page,base+'/');
    assert.deepEqual(errors,[]);assert.deepEqual(member.errors,[]);assert.deepEqual(external,[]);
    await writeFile(evidence+'/agent-native-attribution.json',JSON.stringify({passed:true,modes:native.map(e=>e.disposition),
      nativeReload:true,humanEditsRetainAgentAuthor:true,ownerDownloadedHistory:true,privateWithdrawal:true,widths:[1440,390]},null,2));
    record('BASE-AGENT-008','Mounted MCP issue creation, editing and comments retain the saved agent for sponsor label in native activity, comments after human editing, reload and Owner downloaded history; human edits and a human control remain human.');
  } finally {await member.context.close();}
}
