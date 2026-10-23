import assert from 'node:assert/strict';
import {roleScreens} from './role-ui-support.mjs';
import {navigate,settleReads,trackRequests} from './collaboration-navigation.mjs';
export async function subscriptionsJourney({recipientPage:page,actorPage,base,evidence}){
 trackRequests(page);trackRequests(actorPage);
 const errors=[];for(const p of [page,actorPage]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/hydration|did not match|Minified React error #(418|423|425)/i.test(m.text()))errors.push(m.text());});}
 const call=context=>async(path,method='GET',data,status=200)=>{const r=await context.request.fetch(base+'/api'+path,{method,headers:{Origin:base},data});assert.equal(r.status(),status,await r.text());return r.json();};
 const recipient=call(page.context()),actor=call(actorPage.context()),inspect=roleScreens(evidence);
 const options=await recipient('/options'),team=options.teams[0],owner=options.operator.id;
 await recipient('/settings/notifications','PATCH',{mutedKinds:[]});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  const capture=async(region,name)=>{await inspect(page,region,name+'-'+width);await page.setViewportSize({width,height:1000});};
  const labelName='synthetic-vector-1770-'+width,projectName='synthetic-vector-1771-'+width,viewName='synthetic-vector-1772-'+width;
  const label=(await recipient('/settings/labels','POST',{name:labelName,color:'#3355aa'})).labels.find(l=>l.name===labelName);
  const project=(await recipient('/settings/projects','POST',{name:projectName,leadOperatorId:owner})).projects.find(p=>p.name===projectName);
  const view=await recipient('/views','POST',{name:viewName,isShared:true,query:{team:team.id,label:label.id}},201);
  const toggle=async(name)=>{const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/subscriptions');await page.getByRole('button',{name,exact:true}).click();assert.equal((await response).status(),201);};
  await navigate(page,base+'/app/my-work/subscribed');
  const manager=page.getByRole('region',{name:'Subject subscriptions',exact:true});
  await manager.getByLabel('Subscription subject',{exact:true}).selectOption('team:'+team.id);
  const added=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/subscriptions');
  await manager.getByRole('button',{name:'Subscribe',exact:true}).click();assert.equal((await added).status(),201);
  await manager.getByRole('button',{name:'Unsubscribe '+team.name,exact:true}).waitFor();
  await capture(manager,'subscriptions-manager-team');
  await navigate(page,base+'/app/projects/'+project.id);await page.getByRole('heading',{name:projectName,exact:true}).waitFor();
  await toggle('Subscribe to project');await page.getByRole('button',{name:'Unsubscribe from project',exact:true}).waitFor();await capture(page.locator('main:visible').first(),'subscriptions-project');
  await navigate(page,base+'/app/views/'+view.id);await page.getByRole('heading',{name:viewName,exact:true}).waitFor();
  await toggle('Subscribe to saved view');await page.getByRole('button',{name:'Unsubscribe from saved view',exact:true}).waitFor();await capture(page.locator('main:visible').first(),'subscriptions-view');
  await navigate(page,base+'/app/issues?team='+team.id+'&label='+label.id);
  await toggle('Subscribe to label');await page.getByRole('button',{name:'Unsubscribe from label',exact:true}).waitFor();await capture(page.locator('main:visible').first(),'subscriptions-team-label');
  await navigate(page,base+'/app/inbox');await page.getByRole('heading',{name:'Inbox',exact:true}).waitFor();
  const issue=await actor('/issues','POST',{teamId:team.id,title:'synthetic-vector-1773-'+width,projectId:project.id,labelIds:[label.id]},201);
  const row=page.locator('.inbox-row').filter({hasText:issue.identifier}).filter({hasText:'created'});
  await row.waitFor();assert.equal(await row.count(),1);
  const notifications=async()=> (await recipient('/notifications?limit=50')).items.filter(n=>n.identifier===issue.identifier);
  assert.equal((await notifications()).length,1);assert.equal((await notifications()).length,1);
  assert.equal((await actor('/notifications?limit=50')).items.filter(n=>n.identifier===issue.identifier).length,0);
  await capture(page.locator('main:visible').first(),'subscriptions-created-inbox');
  await navigate(page,base+'/app/my-work/subscribed');await manager.getByRole('button',{name:'Unsubscribe '+labelName,exact:true}).waitFor();
  await capture(manager,'subscriptions-manager-four-subjects');
  const own=(await recipient('/subscriptions')).subscriptions;
  for(const sub of own){const removed=page.waitForResponse(r=>r.request().method()==='DELETE'&&new URL(r.url()).pathname==='/api/subscriptions/'+sub.id);await manager.getByRole('button',{name:'Unsubscribe '+sub.name,exact:true}).click();assert.equal((await removed).status(),200);await settleReads(page);}
  await manager.getByText('You have no subject subscriptions.',{exact:true}).waitFor();
  const next=await actor('/issues','POST',{teamId:team.id,title:'synthetic-vector-1774-'+width,projectId:project.id,labelIds:[label.id]},201);
  assert.equal((await recipient('/notifications?limit=50')).items.filter(n=>n.identifier===next.identifier).length,0);
 }
 await settleReads(page);assert.deepEqual(errors,[],'subscription screens have no hydration or browser errors');
}
