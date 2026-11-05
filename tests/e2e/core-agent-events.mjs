import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withOperatorClient,publicRequest} from './operator-request.mjs';
import {navigate,settleReads} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** Rendered native title mutations and durable cursor replay after a Worker restart. */
export async function agentEventsJourney({page,context,base,evidence,record,restart}) {
  const marker='synthetic-vector-'+Date.now(),inspect=roleScreens(evidence);
  const person=async(path,method='GET',data,status=200)=>withOperatorClient(context,async client=>{
    const response=await client.fetch(base+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    assert.equal(response.status(),status,method+' '+path);return response.json();
  });
  const native=(path,method='GET',data,status=200)=>person('/api'+path,method,data,status);
  const session=await native('/session'),options=await native('/options');
  const sponsor=options.operators.find(p=>p.id===session.operatorId);
  const issue=await native('/issues','POST',{teamId:options.teams[0].id,title:marker+'-original'},201);
  await person('/agents/api/policy','PUT',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
    rules:[{id:'all',class:'*',do:'autonomous'}],spend:{none:true}}});
  await page.setViewportSize({width:1440,height:1000});
  await navigate(page,base+'/app/settings/developers');
  const panel=page.locator('#integrations');
  await panel.getByLabel('Token name',{exact:true}).fill(marker);
  await panel.getByRole('checkbox',{name:'issues:read',exact:true}).uncheck();
  for(const scope of ['events:read','evidence:read','issues:write'])await panel.getByRole('checkbox',{name:scope,exact:true}).check();
  const issued=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations/tokens'&&r.request().method()==='POST');
  await panel.getByRole('button',{name:'Create token',exact:true}).click();
  const issuedResponse=await issued;assert.equal(issuedResponse.status(),201);
  const {token}=await issuedResponse.json();
  await panel.getByRole('button',{name:'I saved it; close',exact:true}).click();
  assert.equal(await panel.getByLabel('New credential',{exact:true}).count(),0);
  let id=0;
  const call=async(name,args)=>{
    const response=await publicRequest(base+'/mcp',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+token,
      'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
      data:{jsonrpc:'2.0',id:++id,method:'tools/call',params:{name,arguments:args}}});
    const body=await response.json();assert.equal(response.status,200);assert.equal(body.error,undefined);assert.notEqual(body.result.isError,true);
    return body.result.structuredContent;
  };
  const initial=await call('vector.events.list',{}),cursor=initial.cursor;
  const path='/issues/'+issue.identifier;
  await navigate(page,base+'/app'+path);
  await page.getByRole('button',{name:'Edit issue',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill(marker+'-human');
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api'+path&&r.request().method()==='PATCH');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();assert.equal((await saved).status(),200);
  await page.getByRole('heading',{name:marker+'-human',exact:true}).waitFor();
  const human=await call('vector.events.list',{...(cursor?{after:cursor}:{}),limit:1});
  assert.equal(human.events.length,1);
  assert.deepEqual(human.events[0].actor,{kind:'person',person:{id:session.operatorId,name:sponsor.name}});
  const first=human.events[0];assert.equal(first.uri,'vector://issue/'+issue.id);assert.equal(first.type,'issue.updated');
  const expected=[first];
  for(const disposition of ['autonomous','review']){
    await person('/agents/api/policy','PUT',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',
      reviewers:['person:'+session.operatorId],rules:[{id:'standard',class:'standard',do:disposition}],spend:{none:true}}});
    const current=await native(path);
    const args={identifier:issue.identifier,change:{expectedVersion:current.version,title:marker+'-'+disposition},idempotency_key:crypto.randomUUID()};
    await call('vector.issue.concurrent_edits',args);
    await call('vector.issue.concurrent_edits',args);
    const changed=await native(path);assert.equal(changed.title,args.change.title);assert.equal(changed.version,current.version+1);
  }
  const traverse=async()=>{
    const events=[];let after=first.id;
    for(let pageNumber=0;pageNumber<20;pageNumber++){
      const result=await call('vector.events.list',{after,limit:1});
      if(!result.events.length)return events;
      assert.equal(result.events.length,1);assert.equal(result.cursor,result.events[0].id);
      events.push(result.events[0]);after=result.cursor;
    }
    assert.fail('The finite event sequence must reach its end');
  };
  const before=await traverse(),nativeEvents=before.filter(e=>e.uri===first.uri);
  assert.equal(nativeEvents.length,2);
  for(const event of nativeEvents){
    assert.equal(event.type,'issue.updated');assert.equal(event.actor.kind,'agent');assert.equal(event.actor.for.id,session.operatorId);
    assert.equal(event.actor.agent.name,marker);assert.equal(event.actor.label,marker+' for '+sponsor.name);
    assert.deepEqual(Object.keys(event).sort(),['actor','at','id','type','uri']);
  }
  expected.push(...nativeEvents);assert.equal(new Set(expected.map(e=>e.id)).size,3);
  await settleReads(page);await page.goto('about:blank');await restart();await navigate(page,base+'/app');
  assert.deepEqual(await traverse(),before,'The same cursor returns identical IDs and ordering after a real Worker restart');
  await navigate(page,base+'/app'+path);
  await page.getByRole('heading',{name:marker+'-review',exact:true}).waitFor();await settleReads(page);
  assert.equal((await page.reload()).status(),200);await page.getByRole('heading',{name:marker+'-review',exact:true}).waitFor();
  await page.locator('.issue-history > summary').click();
  const activity=page.locator('.activity-list > li');assert.equal(await activity.count(),4);
  assert.ok((await activity.nth(1).innerText()).includes(sponsor.name));
  for(const index of [2,3])assert.ok((await activity.nth(index).innerText()).includes(marker+' for '+sponsor.name));
  const timeOrigin=await page.evaluate(()=>performance.timeOrigin);
  await inspect(page,page.locator('main:visible').first(),'agent-title-events');
  assert.equal(await page.evaluate(()=>performance.timeOrigin),timeOrigin);
  await writeFile(evidence+'/agent-events.json',JSON.stringify({passed:true,eventIds:expected.map(e=>e.id),
    nativeTitleEdit:true,policies:['autonomous','review'],pagination:true,workerRestart:true,widths:[1440,390]},null,2));
  record('BASE-AGENT-010','Rendered native title edit and mounted agent edits commit one retained event each; one-item pages replay identical IDs and order from the same cursor after a real Worker restart.');
}
