import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {inviteReader} from './role-reader-support.mjs';
import {withOperatorClient,publicRequest} from './operator-request.mjs';
import {navigate,settleReads,trackRequests} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** Settings credentials and the real mounted MCP, native comment and approval doors. */
export async function agentDestructiveJourney({page,context,base,state,sql,evidence,record}) {
  const marker='synthetic-vector-'+Date.now(),inspect=roleScreens(evidence);
  const owner=async(path,method='GET',data,status=200)=>withOperatorClient(context,async client=>{
    const response=await client.fetch(base+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    assert.equal(response.status(),status,method+' '+path+' '+await response.text());return response.json();
  });
  const member=await inviteReader({owner:page,browser:context.browser(),runtime:{base,state,sql},
    name:marker+'-sponsor',email:[marker,'vector.test'].join(String.fromCharCode(64)),role:'member'});
  const errors=[],external=[];trackRequests(member.page);
  member.page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  member.page.on('requestfailed',request=>errors.push(request.failure()?.errorText));
  await member.context.route('**/*',async route=>{
    if(new URL(route.request().url()).origin===base)await route.continue();
    else {external.push(new URL(route.request().url()).origin);await route.abort();}
  });
  let id=0;
  const receipts=[];
  try {
    const session=await owner('/api/session'),options=await member.api('/options');
    const person=options.operators.find(p=>p.id===member.id).name;
    const prefix='DEST'+String(Date.now()).slice(-6).replaceAll(/\d/g,d=>String.fromCharCode(65+Number(d)));
    const team=(await owner('/api/settings/teams','POST',{name:marker+'-team',identifierPrefix:prefix,isPrivate:true})).teams.find(t=>t.name===marker+'-team');
    await owner(`/api/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'});
    const grant=await member.api('/settings/integrations/tokens','POST',{name:marker+'-deleter',scopes:['comments:delete']},201);
    const insufficient=await member.api('/settings/integrations/tokens','POST',{name:marker+'-writer',scopes:['comments:write']},201);
    const call=async(args,token=grant.token,method='tools/call')=>{
      const response=await publicRequest(base+'/mcp',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+token,
        'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,...(method==='tools/call'?{'Mcp-Name':'vector.comment.delete'}:{})},
        data:{jsonrpc:'2.0',id:++id,method,params:method==='tools/list'?{_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}:{name:'vector.comment.delete',arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{elicitation:{url:{}}}}}}});
      return {status:response.status,body:await response.json()};
    };
    const policy=disposition=>owner('/agents/api/policy','PUT',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
      rules:[{id:'destructive',class:'destructive',do:disposition,...(disposition==='approval'?{approver:['person:'+session.operatorId],wait:'P1D'}:{})},
        {id:'rest',class:'*',do:'autonomous'}],spend:{none:true}}});
    // One read transaction captures every column of every affected native table.
    const tables=['issue_comments','issue_activity','issue_links','issue_mentions','issue_followers','audit_records','notifications','notification_events','notification_deliveries'];
    const parts=tables.map(table=>{
      const columns=sql(`PRAGMA table_info(${table})`).map(column=>column.name);
      const row=columns.map(column=>`'${column}',"${column}"`).join(',');
      return `'${table}',json((SELECT json_group_array(json_object(${row})) FROM (SELECT * FROM ${table} ORDER BY rowid)))`;
    });
    const storage=()=>JSON.parse(sql(`SELECT json_object(${parts.join(',')}) AS state`)[0].state);
    await policy('autonomous');
    const listed=(await call({},grant.token,'tools/list')).body.result.tools.find(t=>t.name==='vector.comment.delete');
    assert.equal(listed.annotations.destructiveHint,true);assert.equal(listed.annotations.readOnlyHint,false);
    assert.deepEqual(listed._meta['com.runeditrun/classes'],['destructive']);assert.equal(listed._meta['com.runeditrun/scope'],'comments:delete');
    for(const disposition of ['autonomous','approval']){
      await policy(disposition);
      const issue=await member.api('/issues','POST',{teamId:team.id,title:marker+'-'+disposition},201),path='/issues/'+issue.identifier;
      const roots=[];
      for(const mode of ['native','tool']){
        const root=await member.api(path+'/comments','POST',{body:marker+'-'+mode+' internal: true confirmExternal: true measure: 0'},201);
        const reply=await member.api(path+'/comments','POST',{body:marker+'-retained-'+mode,parentId:root.id},201);
        const link=await member.api(path+'/links','POST',{name:marker+'-link-'+mode,url:'https://example.test/synthetic-vector-3713',commentId:root.id},201);
        roots.push({mode,id:root.id,reply:reply.id,linkId:link.id});
      }
      const input={identifier:issue.identifier,itemId:roots[1].id,expectedVersion:0,expected_revision:0,idempotency_key:crypto.randomUUID(),internal:true,confirmed:true,confirmExternal:true,classes:['standard'],measure:0};
      const beforeScope=storage(),scope=await call(input,insufficient.token);
      assert.equal(scope.status,403);assert.equal(scope.body.error.data.code,'insufficient_scope');assert.deepEqual(storage(),beforeScope);
      await member.api(path+'/comments/'+roots[0].id,'DELETE');
      const before=storage(),first=await call(input);
      assert.equal(first.status,200);assert.equal(first.body.error,undefined);
      const decision=first.body.result._meta['com.runeditrun/decision'];
      assert.equal(decision.disposition,disposition);assert.deepEqual(decision.classes.map(c=>({class:c.class,facts:c.facts})),[{class:'destructive',facts:{measure:1}}]);
      if(disposition==='approval'){
        assert.equal(first.body.result.resultType,'input_required');assert.deepEqual(storage(),before);
        const pending=first.body.result._meta['com.runeditrun/approval'];
        const approval=(await owner('/agents/api/approvals/'+pending.id)).approval;
        assert.deepEqual(approval.classes,[{class:'destructive',facts:{measure:1}}]);
        assert.deepEqual(approval.summary.nativeTarget,{kind:'comment',id:roots[1].id});
        const retry=await call(input);assert.equal(retry.body.result._meta['com.runeditrun/approval'].id,pending.id);assert.deepEqual(storage(),before);
        await page.setViewportSize({width:1440,height:1000});
        await navigate(page,pending.url);await page.getByRole('heading',{name:'Delete comment',exact:true}).waitFor();
        await page.getByRole('button',{name:'Approve',exact:true}).focus();
        assert.ok(await page.getByRole('button',{name:'Approve',exact:true}).evaluate(e=>e===document.activeElement));
        await page.locator('details > summary').click();
        assert.ok((await page.locator('main').innerText()).includes('1 item'));
        await inspect(page,page.locator('main'),'agent-destructive-pending');
        await page.setViewportSize({width:1440,height:1000});
        const approved=page.waitForResponse(r=>new URL(r.url()).pathname===`/agents/api/approvals/${pending.id}/approve`&&r.request().method()==='POST');
        await page.getByRole('button',{name:'Approve',exact:true}).click();
        const response=await approved;assert.equal(response.status(),200);
        // The native page navigates on success; re-read the durable approval
        // rather than asking Chromium for the previous document's response body.
        assert.equal((await owner('/agents/api/approvals/'+pending.id)).approval.state,'executed');
        const final=await call(input);assert.equal(final.body.result.isError,false);
        assert.deepEqual(final.body.result._meta['com.runeditrun/receipt'].approved_by,[session.operatorId]);
        await navigate(page,base+'/app');
      }else assert.equal(first.body.result.isError,false);
      const after=storage(),replayed=await call(input);assert.equal(replayed.body.result.isError,false);assert.deepEqual(storage(),after);
      assert.deepEqual(replayed.body.result.structuredContent,{updated:true,commentId:roots[1].id,identifier:issue.identifier});
      const discussion=await member.api(path+'/discussion'),native=await member.api(path);
      for(const root of roots){
        const comment=discussion.comments.find(c=>c.id===root.id);
        assert.equal(comment.body,null);assert.ok(comment.deletedAt);assert.equal(comment.actor,person);
        assert.equal(comment.canDelete,0);assert.equal(comment.anchor,null);
        assert.deepEqual(discussion.comments.filter(c=>c.parentId===root.id).map(c=>({id:c.id,body:c.body})),[{id:root.reply,body:marker+'-retained-'+root.mode}]);
      }
      assert.deepEqual((await member.api(path+'/links')).links,[]);
      for(const root of roots){
        const link=sql(`SELECT name,url,deleted_at FROM issue_links WHERE id='${root.linkId}'`)[0];
        assert.equal(link.name,null);assert.equal(link.url,null);assert.ok(link.deleted_at);
      }
      const label=grant.credential.name+' for '+person;
      assert.equal(native.activity.find(a=>a.kind==='link.deleted'&&a.nextValue.id===roots[1].linkId).actor,label);
      assert.equal(native.activity.filter(a=>a.kind==='comment.deleted'&&a.nextValue.id===roots[1].id).length,1);
      assert.equal(native.activity.find(a=>a.kind==='comment.deleted'&&a.nextValue.id===roots[1].id).actor,label);
      const audits=(await owner('/agents/api/audit')).rows.filter(r=>r.tool==='vector.comment.delete'&&r.resource?.id===roots[1].id);
      assert.ok(audits.some(r=>r.outcome==='done'&&r.classes[0].facts.measure===1));
      await member.page.setViewportSize({width:1440,height:1000});
      await navigate(member.page,base+'/app'+path);await member.page.getByRole('heading',{name:issue.title,exact:true}).waitFor();
      await settleReads(member.page);assert.equal((await member.page.reload()).status(),200);
      await member.page.getByRole('heading',{name:issue.title,exact:true}).waitFor();await settleReads(member.page);
      assert.equal(await member.page.getByText('Comment deleted',{exact:true}).count(),2);
      await member.page.getByText(marker+'-retained-tool',{exact:true}).waitFor();
      await member.page.locator('.issue-history > summary').click();
      assert.ok((await member.page.locator('.activity-list').innerText()).includes(label));
      const timeOrigin=await member.page.evaluate(()=>performance.timeOrigin);
      await inspect(member.page,member.page.locator('main:visible').first(),'agent-destructive-'+disposition);
      assert.equal(await member.page.evaluate(()=>performance.timeOrigin),timeOrigin);
      await navigate(member.page,base+'/app');
      receipts.push({disposition,count:1,retainedReplies:true,singleEffect:true,nativeParity:true,truthfulAttribution:true,erasedNamedLinks:true});
    }
    // Policy refusal is an actual mounted call and leaves the native record intact.
    await policy('blocked');
    const liveIssue=await member.api('/issues','POST',{teamId:team.id,title:marker+'-refused'},201),livePath='/issues/'+liveIssue.identifier;
    const live=await member.api(livePath+'/comments','POST',{body:marker+' internal: true confirmExternal: true measure: 0'},201);
    await member.api(livePath+'/links','POST',{name:marker+'-refused-link',url:'https://example.test/synthetic-vector-3713',commentId:live.id},201);
    const refusedArgs={identifier:liveIssue.identifier,itemId:live.id,expectedVersion:0,idempotency_key:crypto.randomUUID(),confirmed:true,measure:0,classes:['standard']};
    const unchanged=storage(),blocked=await call(refusedArgs);
    assert.equal(blocked.body.result._meta['com.runeditrun/error'].code,'policy_blocked');assert.deepEqual(storage(),unchanged);
    assert.equal(blocked.body.result._meta['com.runeditrun/decision'].classes[0].facts.measure,1);
    const audit=(await owner('/agents/api/audit')).rows.find(r=>r.id===blocked.body.result._meta['com.runeditrun/decision'].id);
    assert.deepEqual(audit.classes,[{class:'destructive',facts:{measure:1}}]);assert.equal(audit.outcome,'refused');
    await policy('autonomous');
    await owner(`/api/settings/teams/${team.id}/members/${member.id}`,'DELETE');
    const hiddenBefore=storage(),hidden=await call(refusedArgs);assert.equal(hidden.body.result._meta['com.runeditrun/error'].code,'not_found');assert.deepEqual(storage(),hiddenBefore);
    await owner(`/api/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'});
    await member.api('/settings/integrations/tokens/'+grant.credential.id,'DELETE');
    const revokedBefore=storage(),revoked=await call(refusedArgs);assert.equal(revoked.status,401);assert.equal(revoked.body.result,undefined);assert.deepEqual(storage(),revokedBefore);
    assert.deepEqual(member.errors,[]);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    await writeFile(evidence+'/agent-destructive.json',JSON.stringify({passed:true,receipts,computedPolicyRefusal:true,writeScopeDoesNotDelete:true,privateWithdrawal:true,revokedGrant:true,widths:[1440,390]},null,2));
    record('BASE-AGENT-006','One persisted comment is destructive with count 1 through MCP; native deletion parity, held signed-in approval, retained replies and attributed tombstones, policy refusal and current credential admission are proved. Other classes remain unqualified.');
  } finally {await member.context.close();}
}
