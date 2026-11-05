import assert from 'node:assert/strict';
import {readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {inviteReader} from './role-reader-support.mjs';
import {withOperatorClient,publicRequest} from './operator-request.mjs';
import {navigate,settleReads,trackRequests} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** Settings grants retain their actual scope through the built native MCP door. */
export async function agentLocalScopeJourney({page,context,base,state,sql,evidence,record}) {
  const marker='synthetic-vector-'+Date.now(),inspect=roleScreens(evidence);
  const raw=async(current,path,method='GET',data,status=200)=>withOperatorClient(current,async client=>{
    const response=await client.fetch(base+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    assert.equal(response.status(),status,method+' '+path);return response.json();
  });
  const owner=(path,method='GET',data,status=200)=>raw(context,path,method,data,status);
  const session=await owner('/api/session');
  assert.equal(session.role,'owner');
  const member=await inviteReader({owner:page,browser:context.browser(),runtime:{base,state,sql},
    name:marker+'-member',email:[marker,'vector.test'].join(String.fromCharCode(64)),role:'member'});
  trackRequests(member.page);
  const errors=[],external=[],receipts=[],stores=[];
  member.page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  member.page.on('requestfailed',request=>errors.push(request.failure()?.errorText));
  await member.context.route('**/*',async route=>{
    if(new URL(route.request().url()).origin===base)await route.continue();
    else {external.push(new URL(route.request().url()).origin);await route.abort();}
  });
  const tables=['issues','issue_activity','issue_description_revisions','issue_comments','issue_followers',
    'notification_events','notification_candidates','notifications','notification_deliveries','audit_records',
    'agent_door_calls','agent_door_approvals','agent_door_reviews'];
  let id=0;
  const rpc=async(token,name,args)=>{
    const response=await publicRequest(base+'/mcp',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+token,
      'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
      data:{jsonrpc:'2.0',id:++id,method:'tools/call',params:{name,arguments:args}}});
    return {response,body:await response.json()};
  };
  const mint=async(person,scopes)=>{
    await navigate(person.page,base+'/app/settings/developers');
    const panel=person.page.locator('#integrations'),name=marker+'-'+person.kind+'-'+scopes[0];
    await panel.getByLabel('Token name',{exact:true}).fill(name);
    for(const checkbox of await panel.locator('.integration-scopes input').all())await checkbox.uncheck();
    for(const scope of scopes)await panel.getByRole('checkbox',{name:scope,exact:true}).check();
    const created=person.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations/tokens'&&r.request().method()==='POST');
    await panel.getByRole('button',{name:'Create token',exact:true}).click();
    const response=await created;assert.equal(response.status(),201);
    const grant=await response.json(),field=panel.getByLabel('New credential',{exact:true});
    assert.equal(await field.inputValue()===grant.token,true,'The issued credential is shown only to its sponsor');
    assert.equal(await field.getAttribute('type'),'password');
    await panel.getByRole('button',{name:'I saved it; close',exact:true}).click();
    await field.waitFor({state:'detached'});
    const listed=await raw(person.context,'/api/settings/integrations/tokens');
    assert.deepEqual(JSON.parse(listed.tokens.find(t=>t.id===grant.credential.id).scopes),scopes);
    return grant;
  };
  try {
    const callers=[{kind:'owner',id:session.operatorId,page,context},{...member,kind:'member'}];
    assert.notEqual((await raw(member.context,'/api/session')).operatorId,session.operatorId);
    assert.equal((await raw(member.context,'/api/session')).role,'member');
    const options=await owner('/api/options'),team=options.teams.find(t=>!t.isPrivate);
    assert.ok(team);
    const issue=await owner('/api/issues','POST',{teamId:team.id,title:marker+'-original',description:marker+'-description'},201);
    const path='/api/issues/'+issue.identifier;
    await owner(path+'/comments','POST',{body:marker+'-owner-comment'},201);
    await raw(member.context,path+'/comments','POST',{body:marker+'-member-comment'},201);
    for(const person of callers){
      person.read=await mint(person,['issues:read']);
      person.write=await mint(person,['issues:write']);
      assert.notEqual(person.read.token,person.write.token);
      await settleReads(person.page);
      const panel=person.page.locator('#integrations');
      await panel.getByRole('button',{name:'Create token',exact:true}).focus();
      assert.ok(await panel.getByRole('button',{name:'Create token',exact:true}).evaluate(e=>e===document.activeElement));
      await inspect(person.page,panel,'agent-local-scope-'+person.kind+'-settings');
      await person.page.setViewportSize({width:1440,height:1000});
    }
    // Read the persisted domain atomically without starting extra Worker processes.
    const directory=join(state,'v3','d1');
    for(const name of await readdir(directory,{recursive:true})){
      if(!name.endsWith('.sqlite'))continue;
      const database=new DatabaseSync(join(directory,name),{readOnly:true});
      const names=new Set(database.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(row=>row.name));
      if(tables.every(table=>names.has(table)))stores.push(database);else database.close();
    }
    assert.equal(stores.length,1);
    const database=stores[0];database.exec('PRAGMA busy_timeout=5000');
    const stored=()=>{
      database.exec('BEGIN');
      try{return Object.fromEntries(tables.map(table=>[table,database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(row=>({...row}))]));}
      finally{database.exec('ROLLBACK');}
    };
    for(const disposition of ['autonomous','review']){
      await owner('/agents/api/policy','PUT',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
        reviewers:['person:'+session.operatorId],rules:[{id:'standard',class:'standard',do:disposition},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}}});
      for(const person of callers){
        const native=await raw(person.context,path);
        const loaded=await rpc(person.read.token,'vector.issue.activity_history',{identifier:issue.identifier});
        assert.equal(loaded.response.status,200);assert.equal(loaded.body.error,undefined);assert.equal(loaded.body.result.isError,false);
        const read=loaded.body.result.structuredContent;
        assert.equal(read.id,issue.id);assert.equal(read.title,native.title);assert.equal(read.version,native.version);assert.deepEqual(read.activity,native.activity);
        const before=stored();assert.ok(before.issue_comments.length>=2);assert.ok(before.issue_followers.length);assert.ok(before.notifications.length);
        const args={identifier:issue.identifier,change:{expectedVersion:native.version,title:marker+'-'+person.kind+'-'+disposition},
          expected_revision:native.version,idempotency_key:crypto.randomUUID()};
        const forged={scopes:['issues:read','issues:write'],scope:'issues:write',grant:{scopes:['issues:write']}};
        for(const claims of [{},forged]){
          const refused=await rpc(person.read.token,'vector.issue.concurrent_edits',{...args,...claims});
          assert.equal(refused.response.status,403);
          assert.equal(refused.response.headers.get('www-authenticate'),`Bearer error="insufficient_scope", scope="issues:write", resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`);
          assert.deepEqual(refused.body,{jsonrpc:'2.0',id,error:{code:-32000,message:'Insufficient scope',data:{code:'insufficient_scope'}}});
          assert.deepEqual(stored(),before);
          const rows=(await owner('/agents/api/audit')).rows.filter(r=>r.agent.id==='vector-token:'+person.read.credential.id&&r.idempotency_key===args.idempotency_key);
          assert.equal(rows.length,Object.keys(claims).length?2:1);
          const row=rows.at(-1);assert.equal(row.sponsor.id,person.id);assert.equal(row.outcome,'refused');assert.equal(row.code,'insufficient_scope');
          assert.deepEqual(row.scopes,['issues:read']);assert.deepEqual(row.ignored_arguments,Object.keys(claims).sort());
        }
        const allowed=await rpc(person.write.token,'vector.issue.concurrent_edits',{...args,...forged});
        assert.equal(allowed.response.status,200);assert.equal(allowed.body.error,undefined);assert.equal(allowed.body.result.isError,false);
        assert.equal(allowed.response.headers.get('www-authenticate'),null);
        assert.deepEqual(allowed.body.result.structuredContent,{id:issue.id,identifier:issue.identifier,version:native.version+1});
        assert.equal(allowed.body.result._meta['com.runeditrun/decision'].disposition,disposition);
        const after=await raw(person.context,path);assert.equal(after.title,args.change.title);assert.equal(after.version,native.version+1);
        const reread=await rpc(person.read.token,'vector.issue.activity_history',{identifier:issue.identifier});
        assert.equal(reread.response.status,200);assert.equal(reread.body.result.isError,false);
        assert.equal(reread.body.result.structuredContent.title,args.change.title);assert.equal(reread.body.result.structuredContent.version,after.version);
        const retained=(await raw(person.context,'/api/settings/integrations/tokens')).tokens.find(t=>t.id===person.read.credential.id);
        assert.deepEqual(JSON.parse(retained.scopes),['issues:read']);
        const row=(await owner('/agents/api/audit')).rows.find(r=>r.agent.id==='vector-token:'+person.write.credential.id&&r.idempotency_key===args.idempotency_key);
        assert.equal(row.sponsor.id,person.id);assert.equal(row.outcome,'done');assert.equal(row.decision,disposition);
        assert.deepEqual(row.scopes,['issues:write']);if(disposition==='review')assert.ok(row.review.id);
        receipts.push({sponsor:person.kind,disposition,readAuthorized:true,refused:403,scope:'issues:write',oneChallenge:true,
          unchangedNativeState:true,auditRetained:true,argumentWideningRefused:true,separateWriteSucceeded:true});
      }
    }
    for(const person of callers){
      await person.page.setViewportSize({width:1440,height:1000});
      await navigate(person.page,base+'/app/issues/'+issue.identifier);
      await person.page.getByRole('heading',{name:(await owner(path)).title,exact:true}).waitFor();await settleReads(person.page);
      assert.equal((await person.page.reload()).status(),200);await person.page.getByRole('heading',{name:(await owner(path)).title,exact:true}).waitFor();
      await inspect(person.page,person.page.locator('main:visible').first(),'agent-local-scope-'+person.kind+'-issue');
    }
    assert.deepEqual(member.errors,[]);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    await writeFile(evidence+'/agent-local-scope.json',JSON.stringify({passed:true,receipts,widths:[1440,390]},null,2));
    record('BASE-AGENT-004','Settings-issued Owner and Member read credentials read native issues and refuse valid edits with the exact scope challenge, unchanged native state and retained audit under autonomous and review policies; independent write controls succeed and argument claims cannot widen grants.');
  } finally {for(const database of stores)database.close();await member.context.close();}
}
