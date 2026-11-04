import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {inviteReader} from './role-reader-support.mjs';
import {withOperatorClient,publicRequest} from './operator-request.mjs';
import {navigate,settleReads,trackRequests} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';
import {openPerson} from './settings-pane-support.mjs';

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
  const tables=['issues','issue_comments','issue_activity','issue_followers','notifications','notification_events','notification_deliveries','audit_records'];
  const stored=()=>Object.fromEntries(tables.map(table=>[table,sql(`SELECT * FROM ${table} ORDER BY rowid`)]));
  const receipts=[],errors=[],external=[],expectedDenials=new Set();
  let id=0;
  const completed=new Map();
  const mint=async(current)=>{
    const response=await raw(current,'/api/settings/integrations/tokens','POST',{
      name:marker,scopes:['issues:read','issues:write','comments:write'],
    });
    assert.equal(response.status,201);return response.body.token;
  };
  const rpc=async(person,name,args)=>{
    const response=await publicRequest(base+'/mcp',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+person.token,
      'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
      data:{jsonrpc:'2.0',id:++id,method:'tools/call',params:{name,arguments:{idempotency_key:crypto.randomUUID(),...args}}}});
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
  const replayRefused=async(person,issue,code)=>{
    const calls=completed.get(person.id+issue.id);
    assert.equal(calls?.length,2,'Both completed writes must be replayed');
    const before=stored();
    for(const {name,args} of calls){
      const result=await rpc(person,name,args);
      assert.equal(result.isError,true);assert.equal(result._meta['com.runeditrun/error'].code,code);
      assert.equal(result.structuredContent,undefined);
      assert.ok(!JSON.stringify(result).includes(args.change?.title??args.body));
      assert.deepEqual(stored(),before);
    }
  };
  const show=async(person,issue,writable,capture)=>{
    if(person.kind==='guest'){
      const path='/api/issues/'+issue.identifier+'/releases';
      const denied=await raw(person.context,path);
      assert.equal(denied.status,403);assert.equal(denied.body.error,'forbidden');
      expectedDenials.add(base+path+':403');
    }
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
        for(const subject of [issue,secret]){
          const label=subject===secret?'private':'public';
          await show(p,subject,p.kind!=='viewer',disposition==='autonomous'?'agent-role-'+label+'-'+p.kind:null);
          if(p.kind==='viewer'){await refuse(p,subject,'forbidden');continue;}
          const title=marker+'-'+p.kind+'-'+disposition+'-'+label;
          await p.page.getByRole('button',{name:'Edit issue',exact:true}).click();
          await p.page.getByLabel('Title',{exact:true}).fill(title);
          const saved=p.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/issues/'+subject.identifier&&r.request().method()==='PATCH');
          await p.page.getByRole('button',{name:'Save changes',exact:true}).click();assert.equal((await saved).status(),200);
          await p.page.getByRole('heading',{name:title,exact:true}).waitFor();assert.equal((await current(subject)).title,title);
          const comment=title+'-comment';
          await p.page.getByLabel('Add a comment',{exact:true}).fill(comment);
          const posted=p.page.waitForResponse(r=>new URL(r.url()).pathname===`/api/issues/${subject.identifier}/comments`&&r.request().method()==='POST');
          await p.page.getByRole('button',{name:'Add comment',exact:true}).click();assert.equal((await posted).status(),201);
          await p.page.locator('.comment-entry').filter({hasText:comment}).waitFor();
          const calls=[
            {name:'vector.issue.concurrent_edits',args:{identifier:subject.identifier,change:{expectedVersion:(await current(subject)).version,title:title+'-agent'},idempotency_key:crypto.randomUUID()}},
            {name:'vector.issue.comment',args:{identifier:subject.identifier,body:comment+'-agent',idempotency_key:crypto.randomUUID()}},
          ];
          const edited=await rpc(p,calls[0].name,calls[0].args),added=await rpc(p,calls[1].name,calls[1].args);
          for(const result of [edited,added]){
            assert.equal(result.isError,false);assert.equal(result._meta['com.runeditrun/decision'].disposition,disposition);
          }
          completed.set(p.id+subject.id,calls);
          assert.equal((await current(subject)).title,title+'-agent');
          const discussion=await owner(`/api/issues/${subject.identifier}/discussion`);
          assert.ok(discussion.comments.some(c=>c.id===added.structuredContent.commentId&&c.body===comment+'-agent'));
          await show(p,subject,true);
          await p.page.locator('.comment-entry').filter({hasText:comment+'-agent'}).waitFor();
          receipts.push({role:p.kind,disposition,team:label,nativeEdit:true,nativeComment:true,mcpEdit:true,mcpComment:true});
          await navigate(p.page,base+'/');
        }
      }
      const sponsor=callers.find(p=>p.kind==='member');
      // Store the downgrade through the rendered Settings role control.
      await openPerson(page,base,sponsor.id);
      const changed=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/settings/operators/${sponsor.id}/role`&&r.request().method()==='PATCH');
      await page.getByLabel('Role',{exact:true}).selectOption('viewer');
      assert.equal((await changed).status(),200);
      await refuse(sponsor,issue,'forbidden');
      await replayRefused(sponsor,issue,'forbidden');
      const read=await rpc(sponsor,'vector.issue.activity_history',{identifier:issue.identifier});
      assert.equal(read.isError,false);assert.equal(read.structuredContent.title,(await current(issue)).title);
      await show(sponsor,issue,false,disposition==='autonomous'?'agent-role-downgraded':null);
      const privateRead=await rpc(sponsor,'vector.issue.activity_history',{identifier:secret.identifier});
      assert.equal(privateRead.isError,false);assert.equal(privateRead.structuredContent.title,(await current(secret)).title);
      await show(sponsor,secret,false);
      receipts.push({role:'downgraded-sponsor',disposition,retainedGrantRefused:true,readsContinue:true});
      await owner(`/api/settings/operators/${sponsor.id}/role`,'PATCH',{role:'member'});
      const guest=callers.find(p=>p.kind==='guest');
      await refuse(guest,await owner('/api/issues','POST',{teamId:(await owner('/api/options')).teams.find(t=>t.id!==team.id&&t.id!==privateTeam.id).id,title:marker+'-uninvited'},201),'not_found');
      for(const person of callers.filter(p=>p.kind!=='owner')){
        await navigate(person.page,base+'/');
        await owner(`/api/settings/teams/${privateTeam.id}/members/${person.id}`,'DELETE');
        await refuse(person,secret,person.kind==='viewer'?'forbidden':'not_found');
        if(person.kind!=='viewer')await replayRefused(person,secret,'not_found');
        const hidden=await rpc(person,'vector.issue.activity_history',{identifier:secret.identifier});
        assert.equal(hidden.isError,true);assert.equal(hidden._meta['com.runeditrun/error'].code,'not_found');
        const title=(await current(secret)).title;
        assert.ok(!JSON.stringify(hidden).includes(title));assert.ok(!JSON.stringify(hidden).includes(secret.identifier));
        // The same independent session loses private work and its write controls.
        expectedDenials.add(base+'/api/issues/'+secret.identifier+':404');
        await navigate(person.page,base+'/app/issues/'+secret.identifier);await person.page.locator('.resource-state').waitFor();
        assert.equal(await person.page.getByRole('button',{name:'Edit issue',exact:true}).count(),0);
        assert.equal(await person.page.getByLabel('Add a comment',{exact:true}).count(),0);
        assert.ok(!(await person.page.locator('main').first().innerText()).includes(title));
        if(disposition==='autonomous')await inspect(person.page,person.page.locator('main:visible').first(),'agent-role-withdrawn-'+person.kind);
        await navigate(person.page,base+'/');
        if(['guest','viewer'].includes(person.kind))await owner(`/api/settings/operators/${person.id}/role`,'PATCH',{role:person.kind,teamIds:[team.id,privateTeam.id]});
        else await owner(`/api/settings/teams/${privateTeam.id}/members/${person.id}`,'PUT',{role:person.kind==='lead'?'owner':'member'});
      }
      const outside=await owner('/api/issues','POST',{teamId:(await owner('/api/options')).teams.find(t=>t.id!==team.id&&t.id!==privateTeam.id).id,title:marker+'-reassigned'},201);
      const outsideTeam=(await current(outside)).team.id;
      await owner(`/api/settings/operators/${guest.id}/role`,'PATCH',{role:'guest',teamIds:[outsideTeam]});
      await refuse(guest,issue,'not_found');await replayRefused(guest,issue,'not_found');
      await show(guest,outside,true,disposition==='autonomous'?'agent-role-guest-reassigned':null);
      const title=marker+'-reassigned-'+disposition;
      const nativeEdit=await raw(guest.context,'/api/issues/'+outside.identifier,'PATCH',{expectedVersion:outside.version,title:title+'-native'});
      assert.equal(nativeEdit.status,200);assert.equal((await current(outside)).title,title+'-native');
      const nativeComment=await raw(guest.context,`/api/issues/${outside.identifier}/comments`,'POST',{body:title+'-native-comment'});
      assert.equal(nativeComment.status,201);
      assert.ok((await owner(`/api/issues/${outside.identifier}/discussion`)).comments.some(c=>c.id===nativeComment.body.id&&c.body===title+'-native-comment'));
      const calls=[
        {name:'vector.issue.concurrent_edits',args:{identifier:outside.identifier,change:{expectedVersion:nativeEdit.body.version,title},idempotency_key:crypto.randomUUID()}},
        {name:'vector.issue.comment',args:{identifier:outside.identifier,body:title+'-comment',idempotency_key:crypto.randomUUID()}},
      ];
      const edited=await rpc(guest,calls[0].name,calls[0].args),added=await rpc(guest,calls[1].name,calls[1].args);
      completed.set(guest.id+outside.id,calls);
      assert.equal(edited.isError,false);assert.equal(added.isError,false);
      assert.equal((await current(outside)).title,title);
      assert.ok((await owner(`/api/issues/${outside.identifier}/discussion`)).comments.some(c=>c.id===added.structuredContent.commentId&&c.body===title+'-comment'));
      await show(guest,outside,true);await guest.page.locator('.comment-entry').filter({hasText:title+'-comment'}).waitFor();
      await navigate(guest.page,base+'/');
      await owner(`/api/settings/operators/${guest.id}/role`,'PATCH',{role:'guest',teamIds:[team.id,privateTeam.id]});
      await refuse(guest,outside,'not_found');await replayRefused(guest,outside,'not_found');await show(guest,issue,true);
      await navigate(guest.page,base+'/');
      receipts.push({role:'reassigned-guest',disposition,currentNamedTeams:true,retainedGrant:true});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    for(const p of callers)if(p.errors)assert.deepEqual(p.errors,[]);
    await writeFile(evidence+'/agent-role-parity.json',JSON.stringify({passed:true,receipts,widths:[1440,390],privateWithdrawal:true,replayedWritesRefused:true,namedTeamReassignment:true,independentSessions:6},null,2));
    record('BASE-AGENT-005','Six native roles share native UI and MCP edit and comment authority in public and private teams under autonomous and standard review; retained grants and completed write replays follow Viewer downgrade, named-team reassignment and private-team withdrawal while authorized reads continue.');
  } finally {for(const p of callers)if(p.context!==context)await p.context.close();}
}
