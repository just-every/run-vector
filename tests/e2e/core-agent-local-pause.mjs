import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {inviteReader} from './role-reader-support.mjs';
import {withOperatorClient,publicRequest} from './operator-request.mjs';
import {navigate,settleReads} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** Existing person controls fence native scoped clients without interrupting human work. */
export async function agentLocalPauseJourney({page,context,base,state,sql,evidence,record,restart}) {
  const marker='synthetic-vector-'+Date.now(),inspect=roleScreens(evidence);
  const owner=async(path,method='GET',data,status=200)=>withOperatorClient(context,async client=>{
    const response=await client.fetch(base+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    assert.equal(response.status(),status,method+' '+path+' '+await response.text());return response.json();
  });
  const member=await inviteReader({owner:page,browser:context.browser(),runtime:{base,state,sql},
    name:marker+'-sponsor',email:[marker,'vector.test'].join(String.fromCharCode(64)),role:'member'});
  const domain=['issues','issue_comments','issue_activity','issue_followers','notifications','audit_records',
    'agent_door_calls','agent_door_approvals','agent_door_reviews','agent_door_usage'];
  const snapshot=(tables=domain)=>Object.fromEntries(tables.map(table=>[table,sql(`SELECT * FROM ${table} ORDER BY rowid`)]));
  const errors=[],receipts=[];
  page.on('pageerror',error=>errors.push(error.message));
  let id=0;
  const policy=async(disposition,ownerId)=>owner('/agents/api/policy','PUT',{document:{
    schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',reviewers:['person:'+ownerId],
    rules:[{id:'standard',class:'standard',do:disposition},{id:'rest',class:'*',do:'blocked'}],spend:{none:true},
  }});
  const press=async(label)=>{
    const button=page.getByRole('button',{name:label,exact:true});
    await button.focus();assert.ok(await button.evaluate(e=>e===document.activeElement));
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/agents/api/pause'&&r.request().method()==='POST');
    await button.press('Enter');assert.equal((await response).status(),200);
    await page.getByRole('button',{name:label==='Pause agents'?'Resume agents':'Pause agents',exact:true}).waitFor();
    await page.waitForLoadState('networkidle');
  };
  try {
    const ownerSession=await owner('/api/session'),memberSession=await member.api('/session');
    assert.notEqual(ownerSession.operatorId,memberSession.operatorId);
    const team=(await owner('/api/settings/administration')).teams[0];
    for(const disposition of ['autonomous','review']){
      await policy(disposition,ownerSession.operatorId);
      const issue=await owner('/api/issues','POST',{teamId:team.id,title:marker+'-'+disposition},201);
      const clients=[];
      for(const api of [async(...args)=>owner('/api'+args[0],...args.slice(1)),member.api]){
        const grant=await api('/settings/integrations/tokens','POST',{name:marker+'-'+disposition,scopes:['evidence:read','comments:write']},201);
        const rpc=async(method,params)=>{
          const response=await publicRequest(base+'/mcp',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+grant.token,
            'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':method},
            data:{jsonrpc:'2.0',id:++id,method,params}});
          return {status:response.status,body:await response.json()};
        };
        clients.push({grant,read:()=>rpc('resources/read',{uri:'vector://issue/'+issue.id}),
          write:(key=crypto.randomUUID())=>rpc('tools/call',{name:'vector.issue.comment',arguments:{identifier:issue.identifier,body:marker+'-comment',idempotency_key:key}})});
      }
      assert.notEqual(clients[0].grant.credential.id,clients[1].grant.credential.id);
      for(const client of clients){
        const read=await client.read();assert.equal(read.status,200);
        assert.equal(JSON.parse(read.body.result.contents[0].text).title,issue.title);
        client.key=crypto.randomUUID();assert.ok((await client.write(client.key)).body.result.structuredContent.commentId);
      }
      await navigate(member.page,base+'/agents');
      assert.equal(await member.page.getByRole('button',{name:/^(Pause|Resume) agents$/}).count(),0);
      await navigate(page,base+'/agents');await page.setViewportSize({width:1440,height:1000});
      if(disposition==='autonomous')await inspect(page,page.locator('main'),'agents-on');
      await page.setViewportSize({width:1440,height:1000});
      await press('Pause agents');const pausedAt=performance.now();
      const refuse=async()=>{
        const unchanged=snapshot();
        for(const client of clients){
          const read=await client.read();assert.equal(read.status,200);
          assert.equal(read.body.error.data.code,'agents_paused');assert.equal(read.body.result,undefined);
          for(const key of [crypto.randomUUID(),client.key]){
            const write=await client.write(key);assert.equal(write.status,200);assert.equal(write.body.result.isError,true);
            assert.equal(write.body.result._meta['com.runeditrun/error'].code,'agents_paused');
            assert.equal(write.body.result.structuredContent,undefined);
          }
        }
        assert.deepEqual(snapshot(),unchanged,'Refused new calls and replay leave domain storage unchanged');
      };
      await refuse();const refusalMs=performance.now()-pausedAt;assert.ok(refusalMs<60_000);
      if(disposition==='autonomous')await inspect(page,page.locator('main'),'agents-paused');
      const before=snapshot([...domain,'agent_door_state']);
      for(const client of clients)for(const paused of [false,true]){
        const response=await publicRequest(base+'/agents/api/pause',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+client.grant.token},data:{paused}});
        assert.equal(response.status,403);assert.equal((await response.json()).code,'person_session_required');
      }
      const denied=await withOperatorClient(member.context,async client=>client.post(base+'/agents/api/pause',{headers:{Origin:base},data:{paused:false}}).then(async response=>({status:response.status(),body:await response.json()})));
      assert.equal(denied.status,403);assert.equal(denied.body.code,'forbidden');
      assert.deepEqual(snapshot([...domain,'agent_door_state']),before,'Unauthorized resume changes nothing');
      // No browser polls while the owned Worker stops; the same D1 and sessions survive restart.
      await settleReads(page);await settleReads(member.page);await restart();
      assert.equal((await owner('/agents/api/state')).paused.local,true);
      await page.reload();await page.getByRole('button',{name:'Resume agents',exact:true}).waitFor();
      await refuse();
      for(const api of [async(...args)=>owner('/api'+args[0],...args.slice(1)),member.api]){
        const human=await api('/issues','POST',{teamId:team.id,title:marker+'-human'},201);
        await api('/issues/'+human.identifier,'PATCH',{expectedVersion:1,title:marker+'-human-edited'});
        await api('/issues/'+human.identifier+'/comments','POST',{body:marker+'-human-comment'},201);
        assert.equal((await api('/issues/'+human.identifier)).title,marker+'-human-edited');
      }
      await policy('blocked',ownerSession.operatorId);
      await press('Resume agents');
      const blocked=snapshot();
      for(const client of clients){
        assert.equal((await client.read()).body.error.data.code,'policy_blocked');
        assert.equal((await client.write()).body.result._meta['com.runeditrun/error'].code,'policy_blocked');
      }
      assert.deepEqual(snapshot(),blocked,'Resume enforces the current policy');
      await policy(disposition,ownerSession.operatorId);
      for(const client of clients){
        assert.ok((await client.read()).body.result.contents.length);
        assert.ok((await client.write()).body.result.structuredContent.commentId);
      }
      receipts.push({disposition,sponsors:2,refusalMs,restartPersistent:true,humanActions:true,personOnlyResume:true,currentPolicy:true});
    }
    assert.deepEqual(member.errors,[]);assert.deepEqual(errors,[]);
    await writeFile(evidence+'/agent-local-pause.json',JSON.stringify({passed:true,receipts},null,2));
    record('BASE-AGENT-011','Owner keyboard Pause and Resume fence two native sponsors under autonomous and standard review policy; human issue work continues, pause survives Worker restart, refused calls change no domain data and only the Owner person session resumes under current policy.');
  } finally {await member.context.close();}
}
