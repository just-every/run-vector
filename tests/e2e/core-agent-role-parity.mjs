import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {inviteReader} from './role-reader-support.mjs';
import {withOperatorClient,publicRequest} from './operator-request.mjs';
import {navigate,settleReads,trackRequests} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** Independent native sessions retain only grants minted while their roles permit it. */
export async function agentRoleParityJourney({page,context,base,state,sql,evidence,record}) {
  const marker='synthetic-vector-'+Date.now(),inspect=roleScreens(evidence),callers=[];
  const raw=async(current,path,method='GET',data)=>withOperatorClient(current,async client=>{
    const response=await client.fetch(base+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    return {status:response.status(),body:await response.json()};
  });
  const owner=async(path,method='GET',data,status=200)=>{
    const response=await raw(context,path,method,data);
    assert.equal(response.status,status,method+' '+path);return response.body;
  };
  const session=await owner('/api/session');
  const tables=['issues','issue_comments','issue_activity','issue_followers','notifications','notification_events','notification_deliveries'];
  const stored=()=>Object.fromEntries(tables.map(table=>[table,sql(`SELECT * FROM ${table} ORDER BY rowid`)]));
  const receipts=[],errors=[],external=[],expectedDenials=new Set();
  let id=0;
  const mint=async(current)=>{
    const response=await raw(current,'/api/settings/integrations/tokens','POST',{
      name:marker,scopes:['issues:read','issues:write','comments:write'],
    });
    assert.equal(response.status,201);return response.body.token;
  };
  const rpc=async(person,name,args)=>{
    const response=await publicRequest(base+'/mcp',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+person.token,
      'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
      data:{jsonrpc:'2.0',id:++id,method:'tools/call',params:{name,arguments:{...args,idempotency_key:crypto.randomUUID()}}}});
    assert.equal(response.status,200);const body=await response.json();assert.equal(body.error,undefined);return body.result;
  };
  const current=issue=>owner('/api/issues/'+issue.identifier);
  const refuse=async(person,issue,code)=>{
    const before=stored(),detail=await current(issue),path='/api/issues/'+issue.identifier;
    for(const verb of ['edit','comment']){
      const native=await raw(person.context,path+(verb==='edit'?'':'/comments'),verb==='edit'?'PATCH':'POST',
        verb==='edit'?{expectedVersion:detail.version,title:marker+'-refused'}:{body:marker+'-refused'});
      assert.equal(native.status,code==='not_found'?404:403);assert.equal(native.body.error,code);
      const result=await rpc(person,verb==='edit'?'vector.issue.concurrent_edits':'vector.issue.comment',
        verb==='edit'?{identifier:issue.identifier,change:{expectedVersion:detail.version,title:marker+'-refused'}}:{identifier:issue.identifier,body:marker+'-refused'});
      assert.equal(result.isError,true);assert.equal(result._meta['com.runeditrun/error'].code,native.body.error);
      assert.equal(result.structuredContent,undefined);assert.deepEqual(stored(),before);
    }
  };
  const show=async(person,issue,writable,capture)=>{
    await person.page.setViewportSize({width:1440,height:1000});
    await navigate(person.page,base+'/app/issues/'+issue.identifier);
    await person.page.getByRole('heading',{name:(await current(issue)).title,exact:true}).waitFor();await settleReads(person.page);
    assert.equal((await person.page.reload()).status(),200);await settleReads(person.page);
    const edit=person.page.getByRole('button',{name:'Edit issue',exact:true});
    const composer=person.page.getByRole('textbox',{name:'Add a comment',exact:true});
    assert.equal(await edit.count(),writable?1:0);assert.equal(await composer.count(),writable?1:0);
    if(writable){await edit.focus();assert.ok(await edit.evaluate(e=>e===document.activeElement));}
    if(capture){
      const timeOrigin=await person.page.evaluate(()=>performance.timeOrigin);
      await inspect(person.page,person.page.locator('main:visible').first(),capture);
      assert.equal(await person.page.evaluate(()=>performance.timeOrigin),timeOrigin);
      await person.page.setViewportSize({width:1440,height:1000});
    }
  };
  try {
    callers.push({kind:'owner',id:session.operatorId,page,context,token:await mint(context)});
    for(const kind of ['admin','lead','member','guest','viewer']){
      const person=await inviteReader({owner:page,browser:context.browser(),runtime:{base,state,sql},name:marker+'-'+kind,
        email:[marker+'-'+kind,'vector.test'].join(String.fromCharCode(64)),role:kind==='admin'?'admin':'member'});
      callers.push({...person,kind,token:await mint(person.context)});
      trackRequests(person.page);
      person.page.on('pageerror',error=>errors.push(error.message));
      person.page.on('console',message=>{
        if(message.type()!=='error')return;
        const status=/^Failed to load resource: the server responded with a status of (\d{3})(?: \([^)]*\))?$/.exec(message.text())?.[1];
        if(!expectedDenials.has(message.location().url+':'+status))errors.push(message.text()+' at '+message.location().url);
      });
      person.page.on('requestfailed',request=>errors.push(request.failure()?.errorText));
      await person.context.route('**/*',async route=>{
        if(new URL(route.request().url()).origin===base)await route.continue();
        else {external.push(new URL(route.request().url()).origin);await route.abort();}
      });
    }
    const auth=await Promise.all(callers.map(p=>raw(p.context,'/auth/session')));
    assert.equal(new Set(auth.map(r=>r.body.id)).size,6,'All role fixtures have independently authenticated sessions');
    const prefix='AGP'+String(Date.now()).slice(-6).replaceAll(/\d/g,d=>String.fromCharCode(65+Number(d)));
    const team=(await owner('/api/settings/teams','POST',{name:marker+'-team',identifierPrefix:prefix})).teams.find(t=>t.name===marker+'-team');
    const privateTeam=(await owner('/api/settings/teams','POST',{name:marker+'-private',identifierPrefix:prefix+'P',isPrivate:true})).teams.find(t=>t.name===marker+'-private');
    for(const p of callers){
      if(p.kind==='owner')continue;
      for(const t of [team,privateTeam])await owner(`/api/settings/teams/${t.id}/members/${p.id}`,'PUT',{role:p.kind==='lead'?'owner':'member'});
      if(['guest','viewer'].includes(p.kind))await owner(`/api/settings/operators/${p.id}/role`,'PATCH',{role:p.kind,teamIds:[team.id,privateTeam.id]});
    }
    const issue=await owner('/api/issues','POST',{teamId:team.id,title:marker+'-issue'},201);
    const secret=await owner('/api/issues','POST',{teamId:privateTeam.id,title:marker+'-private-issue'},201);
    for(const disposition of ['autonomous','review']){
      await owner('/agents/api/policy','PUT',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',reviewers:['person:'+session.operatorId],
        rules:[{id:'standard',class:'standard',do:disposition},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}}});
      for(const p of callers){
        assert.equal((await raw(p.context,'/api/session')).body.role,p.kind==='lead'?'member':p.kind);
        if(p.kind==='guest'){
          const path='/api/issues/'+issue.identifier+'/releases';
          const denied=await raw(p.context,path);
          assert.equal(denied.status,403);assert.equal(denied.body.error,'forbidden');
          expectedDenials.add(base+path+':403');
        }
        await show(p,issue,p.kind!=='viewer',disposition==='autonomous'?'agent-role-'+p.kind:null);
        if(p.kind==='viewer'){await refuse(p,issue,'forbidden');continue;}
        const title=marker+'-'+p.kind+'-'+disposition;
        await p.page.getByRole('button',{name:'Edit issue',exact:true}).click();
        await p.page.getByLabel('Title',{exact:true}).fill(title);
        const saved=p.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/issues/'+issue.identifier&&r.request().method()==='PATCH');
        await p.page.getByRole('button',{name:'Save changes',exact:true}).click();assert.equal((await saved).status(),200);
        await p.page.getByRole('heading',{name:title,exact:true}).waitFor();assert.equal((await current(issue)).title,title);
        const comment=title+'-comment';
        await p.page.getByLabel('Add a comment',{exact:true}).fill(comment);
        const posted=p.page.waitForResponse(r=>new URL(r.url()).pathname===`/api/issues/${issue.identifier}/comments`&&r.request().method()==='POST');
        await p.page.getByRole('button',{name:'Add comment',exact:true}).click();assert.equal((await posted).status(),201);
        await p.page.locator('.comment-entry').filter({hasText:comment}).waitFor();
        const edited=await rpc(p,'vector.issue.concurrent_edits',{identifier:issue.identifier,change:{expectedVersion:(await current(issue)).version,title:title+'-agent'}});
        const added=await rpc(p,'vector.issue.comment',{identifier:issue.identifier,body:comment+'-agent'});
        for(const result of [edited,added]){
          assert.equal(result.isError,false);assert.equal(result._meta['com.runeditrun/decision'].disposition,disposition);
        }
        assert.equal((await current(issue)).title,title+'-agent');
        const discussion=await owner(`/api/issues/${issue.identifier}/discussion`);
        assert.ok(discussion.comments.some(c=>c.id===added.structuredContent.commentId&&c.body===comment+'-agent'));
        await show(p,issue,true);
        await p.page.locator('.comment-entry').filter({hasText:comment+'-agent'}).waitFor();
        receipts.push({role:p.kind,disposition,nativeEdit:true,nativeComment:true,mcpEdit:true,mcpComment:true});
      }
      const sponsor=callers.find(p=>p.kind==='member');
      await owner(`/api/settings/operators/${sponsor.id}/role`,'PATCH',{role:'viewer',teamIds:[privateTeam.id]});
      await refuse(sponsor,issue,'forbidden');
      const read=await rpc(sponsor,'vector.issue.activity_history',{identifier:issue.identifier});
      assert.equal(read.isError,false);assert.equal(read.structuredContent.title,(await current(issue)).title);
      await show(sponsor,issue,false,disposition==='autonomous'?'agent-role-downgraded':null);
      receipts.push({role:'downgraded-sponsor',disposition,retainedGrantRefused:true,readsContinue:true});
      await owner(`/api/settings/operators/${sponsor.id}/role`,'PATCH',{role:'member'});
      const guest=callers.find(p=>p.kind==='guest');
      await refuse(guest,await owner('/api/issues','POST',{teamId:(await owner('/api/options')).teams.find(t=>t.id!==team.id&&t.id!==privateTeam.id).id,title:marker+'-uninvited'},201),'not_found');
      await show(sponsor,secret,true);
      await navigate(sponsor.page,base+'/');
      await owner(`/api/settings/teams/${privateTeam.id}/members/${sponsor.id}`,'DELETE');
      await refuse(sponsor,secret,'not_found');
      const hidden=await rpc(sponsor,'vector.issue.activity_history',{identifier:secret.identifier});
      assert.equal(hidden.isError,true);assert.equal(hidden._meta['com.runeditrun/error'].code,'not_found');
      assert.ok(!JSON.stringify(hidden).includes(secret.title));
      // Navigate with the same session after access withdrawal; no private screen remains.
      expectedDenials.add(base+'/api/issues/'+secret.identifier+':404');
      await navigate(sponsor.page,base+'/app/issues/'+secret.identifier);await sponsor.page.locator('.resource-state').waitFor();
      assert.equal(await sponsor.page.getByRole('button',{name:'Edit issue',exact:true}).count(),0);
      assert.equal(await sponsor.page.getByLabel('Add a comment',{exact:true}).count(),0);
      assert.ok(!(await sponsor.page.locator('main').first().innerText()).includes(secret.title));
      if(disposition==='autonomous')await inspect(sponsor.page,sponsor.page.locator('main:visible').first(),'agent-role-withdrawn');
      await navigate(sponsor.page,base+'/');
      await owner(`/api/settings/teams/${privateTeam.id}/members/${sponsor.id}`,'PUT',{role:'member'});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    for(const p of callers)if(p.errors)assert.deepEqual(p.errors,[]);
    await writeFile(evidence+'/agent-role-parity.json',JSON.stringify({passed:true,receipts,widths:[1440,390],privateWithdrawal:true,independentSessions:6},null,2));
    record('BASE-AGENT-005','Six native roles share MCP edit and comment authority under autonomous and standard review; retained grants follow Viewer downgrade and current private-team withdrawal while authorized reads continue.');
  } finally {for(const p of callers)if(p.context!==context)await p.context.close();}
}
