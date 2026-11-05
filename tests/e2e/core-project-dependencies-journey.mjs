import assert from 'node:assert/strict';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';

/** The graph and native Inbox slice. Rendered graph editing remains a separate
 * interface task; this proof does not substitute HTTP calls for those controls.
 */
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
  await capture('PROJ-015','project-dependency-project-1440',memberPage);
  await memberPage.setViewportSize({width:390,height:1000});
  await capture('PROJ-015','project-dependency-project-390',memberPage);
  await memberPage.setViewportSize({width:1440,height:1000});
  await api(edgePath,'DELETE');
  assert.equal((await api('/projects/'+b.id)).directDependencies.blockedBy.length,0);
}
