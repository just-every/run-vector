import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';

/** Native graph, rendered Member editing and current-lead Inbox projection. */
export async function projectDependenciesJourney({page,memberPage,memberContext,base,api,capture,memberId,team}) {
  await page.setViewportSize({width:1440,height:1000});
  await memberPage.setViewportSize({width:1440,height:1000});
  const actor=await api('/session'),suffix=Date.now();
  const create=async(n,leadOperatorId)=>{
    const name=`synthetic-vector-${n}-${suffix}`;
    const state=await api('/settings/projects','POST',{name,leadOperatorId});
    const project=state.projects.find(row=>row.name===name);
    await api('/issues','POST',{teamId:team.id,projectId:project.id,title:`synthetic-vector-${n+10}-${suffix}`});
    return project;
  };
  const a=await create(1531,actor.operatorId),b=await create(1532,memberId);
  const edgePath=`/projects/${b.id}/dependencies/${a.id}`;
  const first=await api(edgePath,'PUT');
  const edge=first.directDependencies.blockedBy[0];
  assert.deepEqual(edge.project,{id:a.id,name:a.name});
  assert.deepEqual((await api('/projects/'+a.id)).directDependencies.blocking,[{id:edge.id,project:{id:b.id,name:b.name}}]);
  const added=first.activity.filter(entry=>entry.kind==='project.dependency_added');
  assert.equal(added.length,1);
  assert.equal((await api(edgePath,'PUT')).activity.length,first.activity.length);
  const minted=await api('/settings/integrations/tokens','POST',{name:'synthetic-vector-1533',scopes:['projects:read','projects:write']});
  const scoped=async(path,method)=>{
    const response=await page.request.fetch(base+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+minted.token,Origin:base}});
    return {status:response.status(),body:await response.json()};
  };
  assert.equal((await scoped(`/projects/${a.id}/dependencies/${b.id}`,'PUT')).status,400);
  assert.equal((await scoped(`/projects/${a.id}/dependencies/${a.id}`,'PUT')).status,400);
  assert.equal((await scoped(edgePath,'DELETE')).status,200);
  const apiAdded=await scoped(edgePath,'PUT');
  assert.equal(apiAdded.status,200);
  assert.equal(apiAdded.body.directDependencies.blockedBy.length,1);
  assert.equal(apiAdded.body.activity.filter(entry=>entry.kind==='project.dependency_added').length,2);
  const memberInbox=await memberContext.request.get(base+'/api/notifications?limit=50');
  assert.equal(memberInbox.status(),200);
  const notices=(await memberInbox.json()).items.filter(item=>item.projectId===b.id);
  assert.equal(notices.length,3,'each actual change notifies the current non-acting lead once');
  assert(notices.every(item=>item.identifier==='Project'&&item.title===b.name&&item.causes.includes('blocking')));
  assert.equal((await api('/notifications?limit=50')).items.filter(item=>item.projectId===b.id).length,0,'the acting lead is excluded');
  await beforePrivateNavigation(memberPage,base+'/app/inbox');
  await memberPage.goto(base+'/app/inbox');
  const row=memberPage.locator('.inbox-row').filter({hasText:b.name}).first();
  await row.waitFor();
  await settleReads(memberPage);
  await capture('PROJ-015','project-dependency-inbox-1440',memberPage);
  await memberPage.setViewportSize({width:390,height:1000});
  await capture('PROJ-015','project-dependency-inbox-390',memberPage);
  await memberPage.setViewportSize({width:1440,height:1000});
  await row.click();
  await memberPage.waitForURL(base+'/app/projects/'+b.id);
  await memberPage.getByRole('heading',{name:b.name,exact:true}).waitFor();
  assert.equal((await memberContext.request.get(base+'/api/projects/'+b.id)).status(),200);
  await memberPage.reload();
  await memberPage.getByRole('heading',{name:'Project activity',exact:true}).waitFor();
  await settleReads(memberPage);
  await api(edgePath,'DELETE');
  assert.equal((await api('/projects/'+b.id)).directDependencies.blockedBy.length,0);
  await projectDependencyControls({memberPage,memberContext,base,api,capture,a,b,memberId});
}

async function projectDependencyControls({memberPage,memberContext,base,api,capture,a,b,memberId}) {
  const errors=[];
  const onError=error=>errors.push(error.message);
  memberPage.on('pageerror',onError);
  const open=async project=>{
    await beforePrivateNavigation(memberPage,base+'/app/projects/'+project.id);
    await memberPage.goto(base+'/app/projects/'+project.id);
    await memberPage.getByRole('heading',{name:project.name,exact:true}).waitFor();
    await settleReads(memberPage);
  };
  const panel=memberPage.getByRole('region',{name:'Project dependencies',exact:true});
  const endpoint=project=>'/projects/'+project.id;
  const activity=detail=>detail.activity.filter(entry=>entry.kind.startsWith('project.dependency_'));
  const baseline=new Map(await Promise.all([a,b].map(async project=>[project.id,activity(await api(endpoint(project))).length])));
  const notices=async()=> (await api('/notifications?limit=50')).items.filter(item=>item.projectId===b.id);
  const beforeNotices=(await notices()).length;
  const memberNotices=async()=>{
    const response=await memberContext.request.get(base+'/api/notifications?limit=50');
    assert.equal(response.status(),200);
    return (await response.json()).items.filter(item=>item.projectId===b.id).length;
  };
  const beforeMemberNotices=await memberNotices();
  const memberName=(await (await memberContext.request.get(base+'/api/metadata')).json()).operators.find(person=>person.id===memberId).name;
  try {
    await open(b);
    assert.equal(await panel.getByRole('combobox',{name:'Dependency project',exact:true}).locator(`option[value="${b.id}"]`).count(),0,'self is never offered');
    const mutate=async(method,blocked,blocking,act)=>{
      const response=memberPage.waitForResponse(response=>response.url()===`${base}/api/projects/${blocked.id}/dependencies/${blocking.id}`&&response.request().method()===method);
      await act();
      const receipt=await response;
      assert.equal(receipt.status(),200,await receipt.text());
      await panel.getByRole('status').filter({hasText:method==='PUT'?'Dependency added.':'Dependency removed.'}).waitFor();
      return receipt.json();
    };
    const add=async(direction,other,blocked,blocking)=>{
      await panel.getByRole('combobox',{name:'Dependency direction',exact:true}).selectOption(direction);
      await panel.getByRole('combobox',{name:'Dependency project',exact:true}).selectOption(other.id);
      return mutate('PUT',blocked,blocking,async()=>{
        await panel.getByRole('button',{name:'Add dependency',exact:true}).focus();
        await memberPage.keyboard.press('Enter');
      });
    };
    const receipt=await add('blockedBy',a,b,a);
    const edge=receipt.directDependencies.blockedBy[0];
    await panel.getByRole('link',{name:a.name,exact:true}).waitFor();
    assert.deepEqual(edge.project,{id:a.id,name:a.name});
    assert.deepEqual((await api(endpoint(a))).directDependencies.blocking,[{id:edge.id,project:{id:b.id,name:b.name}}]);
    for(const project of [a,b]) {
      const entries=activity(await api(endpoint(project)));
      assert.equal(entries.length,baseline.get(project.id)+1);
      assert.equal(entries[0].actorName,memberName);
    }
    assert.equal((await notices()).length,beforeNotices+1,'the other lead receives the Member change');
    assert.equal(await memberNotices(),beforeMemberNotices,'the Member actor is not notified');
    await beforePrivateNavigation(memberPage,memberPage.url());
    await memberPage.reload();
    await panel.getByRole('link',{name:a.name,exact:true}).waitFor();
    assert.equal((await api(endpoint(b))).directDependencies.blockedBy[0].id,edge.id,'reload preserves the edge identity');
    const axe=await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8');
    await memberPage.evaluate(source=>{
      const script=document.createElement('script');
      const nonce=document.querySelector('script[nonce]')?.nonce;
      if(nonce)script.nonce=nonce;
      script.textContent=source;document.head.append(script);
    },axe);
    const violations=await memberPage.evaluate(async()=> (await window.axe.run('.project-dependencies')).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id));
    assert.deepEqual(violations,[],'dependency controls have no serious accessibility violations');
    for(const width of [1440,390]) {
      await memberPage.setViewportSize({width,height:1000});
      await panel.scrollIntoViewIfNeeded();
      assert(await memberPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'dependency controls fit the viewport');
      await capture('PROJ-015','project-dependency-project-'+width,memberPage);
    }
    await memberPage.setViewportSize({width:1440,height:1000});
    await mutate('DELETE',b,a,()=>panel.getByRole('button',{name:'Remove blocked by '+a.name,exact:true}).click());
    assert.equal(await panel.getByRole('link',{name:a.name,exact:true}).count(),0);
    for(const project of [a,b]) {
      const detail=await api(endpoint(project));
      assert.equal(activity(detail).length,baseline.get(project.id)+2);
      assert.deepEqual(detail.directDependencies,{blockedBy:[],blocking:[]});
    }
    assert.equal((await notices()).length,beforeNotices+2);
    assert.equal(await memberNotices(),beforeMemberNotices);
    // The other direction edits the same graph while staying on its own page.
    await open(a);
    await add('blocking',b,b,a);
    await panel.getByRole('link',{name:b.name,exact:true}).waitFor();
    assert.equal(await panel.getByRole('heading',{name:'Blocking',exact:true}).count(),1);
    await mutate('DELETE',b,a,()=>panel.getByRole('button',{name:'Remove blocking '+b.name,exact:true}).click());
    assert.equal(await panel.getByRole('link',{name:b.name,exact:true}).count(),0);
    await beforePrivateNavigation(memberPage,memberPage.url());
    await memberPage.reload();
    await panel.getByRole('button',{name:'Add dependency',exact:true}).waitFor();
    assert.deepEqual((await api(endpoint(a))).directDependencies,{blockedBy:[],blocking:[]});
    assert.deepEqual((await api(endpoint(b))).directDependencies,{blockedBy:[],blocking:[]});
    assert.deepEqual(errors,[],'Member editing and reload hydrate without errors');
  } catch(error) {
    await capture('PROJ-015','project-dependency-controls-failure',memberPage).catch(()=>{});
    throw error;
  } finally {
    memberPage.off('pageerror',onError);
  }
}
