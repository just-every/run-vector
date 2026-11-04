import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {inviteReader} from './role-reader-support.mjs';
import {withOperatorClient,publicRequest} from './operator-request.mjs';
import {navigate,settleReads,trackRequests} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** Native project page and tool under independently authenticated native grants. */
export async function agentProjectReadJourney({page,context,base,state,sql,evidence,record}) {
  const marker='synthetic-vector-'+Date.now();
  const owner=async(path,method='GET',data,status=200)=>withOperatorClient(context,async client=>{
    const response=await client.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    assert.equal(response.status(),status,method+' '+path+' '+await response.text());return response.json();
  });
  const member=await inviteReader({owner:page,browser:context.browser(),runtime:{base,state,sql},
    name:marker+'-member',email:[marker,'vector.test'].join(String.fromCharCode(64)),role:'member'});
  trackRequests(member.page);
  const inspect=roleScreens(evidence),receipts=[];
  let id=0;
  const policy=async disposition=>withOperatorClient(context,async client=>{
    const response=await client.put(base+'/agents/api/policy',{headers:{Origin:base},data:{document:{
      schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'standard',class:'standard',do:disposition}],
      ...(disposition==='review'?{reviewers:['sponsor']} : {}),spend:{none:true}}}});
    assert.equal(response.status(),200,await response.text());
  });
  const mint=async api=>{
    const {token}=await api('/settings/integrations/tokens','POST',{name:marker,scopes:['projects:read']},201);
    return async projectId=>{
      const response=await publicRequest(base+'/mcp',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+token,
        'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':'tools/call'},
        data:{jsonrpc:'2.0',id:++id,method:'tools/call',params:{name:'vector.project.read',arguments:{projectId,at}}}});
      return {status:response.status,body:await response.json()};
    };
  };
  const at=new Date().toISOString();
  try {
    const session=await owner('/session'),other=await member.api('/session');
    assert.equal(session.role,'owner');assert.equal(other.role,'member');assert.notEqual(session.operatorId,other.operatorId);
    const prefix='PRA'+String(Date.now()).slice(-6).replaceAll(/\d/g,d=>String.fromCharCode(65+Number(d)));
    const team=(await owner('/settings/teams','POST',{name:marker+'-team',identifierPrefix:prefix})).teams.find(t=>t.identifierPrefix===prefix);
    const privateTeam=(await owner('/settings/teams','POST',{name:marker+'-private',identifierPrefix:prefix+'P',isPrivate:true})).teams.find(t=>t.identifierPrefix===prefix+'P');
    const project=(await owner('/settings/projects','POST',{name:marker+'-project',description:marker+'-description',leadOperatorId:session.operatorId,targetDate:'2099-01-01'})).projects.find(p=>p.name===marker+'-project');
    await owner('/settings/projects/'+project.id,'PATCH',{lifecycle:'active'});
    const cycle=(await owner('/settings/cycles','POST',{name:marker+'-cycle',teamId:team.id,startsLocal:'2000-09-01T00:00',endsLocal:'2000-09-08T00:00',capacity:8})).cycles.find(c=>c.name===marker+'-cycle');
    await owner(`/settings/projects/${project.id}/milestones`,'POST',{name:marker+'-milestone',description:marker+'-milestone-description'});
    const first=await owner('/issues','POST',{title:marker+'-completed',teamId:team.id,projectId:project.id,cycleId:cycle.id},201);
    await owner('/issues/'+first.identifier,'PATCH',{expectedVersion:first.version,statusId:team.statuses.find(s=>s.category==='completed').id});
    const second=await owner('/issues','POST',{title:marker+'-open',teamId:team.id,projectId:project.id},201);
    const secret=await owner('/issues','POST',{title:marker+'-secret',teamId:privateTeam.id,projectId:project.id},201);
    const tick=await context.request.get(base+'/cdn-cgi/local/scheduled?cron='+encodeURIComponent('* * * * *')+'&time='+Date.now());
    assert.equal(tick.status(),200);await tick.body();
    const readers=[await mint(owner),await mint(member.api)];
    for(const disposition of ['autonomous','review']){
      await policy(disposition);
      for(const [index,caller] of [{page,api:owner},{page:member.page,api:member.api}].entries()){
        const native=await caller.api(`/projects/${project.id}?at=${encodeURIComponent(at)}`);
        const read=await readers[index](project.id);
        assert.equal(read.status,200);assert.equal(read.body.result.isError,false);
        assert.deepEqual(read.body.result.structuredContent,native);
        assert.equal(read.body.result._meta['com.runeditrun/decision'].disposition,disposition);
        assert.deepEqual(native.progress,{completed:1,total:index===0?3:2,percentage:index===0?33:50});
        assert.equal(native.health,'on-track');assert.equal(native.milestones[0].name,marker+'-milestone');
        assert.ok(native.cycleHistory.some(c=>c.name===marker+'-cycle'&&c.snapshot.completed.includes(first.identifier)));
        assert.ok(native.activity.some(a=>a.kind==='project.updated'));
        assert.deepEqual(native.issues.map(i=>i.identifier).sort(),[first.identifier,second.identifier,...(index===0?[secret.identifier]:[])].sort());
        if(disposition==='autonomous'){
          await caller.page.setViewportSize({width:1440,height:1000});
          await navigate(caller.page,base+'/app/projects/'+project.id);
          await caller.page.getByRole('heading',{name:project.name,exact:true}).waitFor();
          await settleReads(caller.page);
          const main=caller.page.locator('main.project-detail');
          const text=await main.innerText();
          for(const value of [project.description,marker+'-milestone',marker+'-cycle','Project activity',first.identifier,second.identifier])assert.ok(text.includes(value),value);
          assert.equal(await caller.page.locator('.project-health--on-track').count(),1);
          assert.ok((await caller.page.locator('.project-facts').innerText()).includes(index===0?'1/3 complete · 33%':'1/2 complete · 50%'));
          if(index===1)assert.ok(!text.includes(secret.identifier)&&!text.includes(secret.title));
          await inspect(caller.page,main,'agent-project-read-'+index);
        }
        receipts.push({disposition,role:index===0?'owner':'member',project:project.id,progress:native.progress});
      }
    }
    await navigate(member.page,base+'/app');await navigate(page,base+'/app');
    assert.deepEqual(member.errors,[]);
    await writeFile(evidence+'/agent-project-read.json',JSON.stringify({passed:true,receipts},null,2));
    record('BASE-AGENT-002','Owner and Member project pages and native reads match the project tool, including current private contributions, health, progress, milestones, closed cycles and activity under autonomous and review policies.');
  } finally {await member.context.close();}
}
