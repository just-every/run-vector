import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {openAuthenticatedPage} from '../ui-runtime-auth.mjs';
import {confirmLink,readDevelopmentLink} from '../outbox-session.mjs';
import {navigate,settleReads,trackRequests} from '../collaboration-navigation.mjs';
import {roleScreens} from '../role-ui-support.mjs';

/** Mounted native install, attributed edit and Admin management in real sessions. */
export async function exerciseAppActors({page,runtime,cookie,team,evidence}) {
 const inspect=roleScreens(evidence),name='synthetic-vector-19241',headers={Cookie:cookie,Origin:runtime.base,'Content-Type':'application/json'};
 const call=async(path,method='GET',body,status=200)=>{
  const response=await runtime.req('/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal(response.status,status,method+' '+path+' '+await response.clone().text());return response.json();
 };
 await page.setViewportSize({width:1440,height:1000});trackRequests(page);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await navigate(page,runtime.base+'/app/settings/developers/apps');
 const panel=page.getByRole('region',{name:'Installed agents',exact:true});await panel.getByRole('heading',{name:'Installed agents',exact:true}).waitFor();
 await panel.getByLabel('Agent name',{exact:true}).fill(name);await panel.getByLabel('Agent team',{exact:true}).selectOption(team.id);
 const permission=panel.getByRole('checkbox',{name:'Allow issue title changes',exact:true});await permission.focus();await page.keyboard.press('Space');assert.equal(await permission.isChecked(),true);
 const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/app-actors'&&r.request().method()==='POST');
 await panel.getByRole('button',{name:'Install agent',exact:true}).click();const installed=await pending;assert.equal(installed.status(),201);const agent=await installed.json();
 const secret=panel.getByLabel('New credential',{exact:true});await secret.waitFor();assert.equal(await secret.inputValue(),agent.token);assert.equal(await secret.getAttribute('type'),'password');
 await panel.getByRole('button',{name:'I saved it; close',exact:true}).click();assert.equal(await secret.count(),0);
 await panel.getByRole('button',{name:'Pause '+name,exact:true}).waitFor();await settleReads(page);await page.reload();await panel.getByRole('button',{name:'Pause '+name,exact:true}).waitFor();
 assert.equal((await page.content()).includes(agent.token),false);await inspect(page,panel,'app-actor-installed');await page.setViewportSize({width:1440,height:1000});
 const issue=await call('/issues','POST',{teamId:team.id,title:'synthetic-vector-19242'},201),path='/issues/'+issue.identifier;
 const api=async(method='GET',body)=>runtime.req('/api/v1'+path,{method,headers:{Authorization:'Bearer '+agent.token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await api()).status,200);
 const changed=await api('PATCH',{expectedVersion:issue.version,title:'synthetic-vector-19243'});assert.equal(changed.status,200);
 const detail=await call(path),entry=detail.activity.find(row=>row.nextValue?.title==='synthetic-vector-19243');assert.ok(entry.actor.startsWith(name+' · installed by '));
 const audit=await call('/settings/audit?kind=agent&subject='+issue.id);assert.ok(audit.entries.some(row=>row.actorRef==='app-agent:'+agent.id&&row.actorName===entry.actor));
 await navigate(page,runtime.base+'/app'+path);await page.getByRole('heading',{name:detail.title,exact:true}).waitFor();await page.locator('.issue-history > summary').click();
 await expect(page.locator('.activity-list')).toContainText(entry.actor);await settleReads(page);await page.reload();await page.getByRole('heading',{name:detail.title,exact:true}).waitFor();
 await page.locator('.issue-history > summary').click();await expect(page.locator('.activity-list')).toContainText(entry.actor);
 await inspect(page,page.locator('main:visible').first(),'app-actor-attributed-issue');await page.setViewportSize({width:1440,height:1000});
 await navigate(page,runtime.base+'/app/settings/audit');const auditPanel=page.locator('#audit');await auditPanel.getByRole('heading',{name:'Audit log',exact:true}).waitFor();
 await expect(auditPanel).toContainText(entry.actor);await inspect(page,auditPanel,'app-actor-audit');await page.setViewportSize({width:1440,height:1000});
 const adminEmail=['synthetic-vector-19244','vector.test'].join(String.fromCharCode(64));
 await call('/settings/operators/invite','POST',{email:adminEmail,displayName:'synthetic-vector-19244',role:'admin'},202);
 const link=await readDevelopmentLink(runtime.base,runtime.req,adminEmail,runtime.state),confirmed=await confirmLink(link);assert.equal(confirmed.status,303);
 const adminCookie=confirmed.headers.get('set-cookie').split(';')[0],admin=await openAuthenticatedPage(page.context().browser(),adminCookie,runtime.base);
 try{
  await admin.setViewportSize({width:1440,height:1000});trackRequests(admin);await navigate(admin,runtime.base+'/app/settings/developers/apps');
  const management=admin.getByRole('region',{name:'Installed agents',exact:true}),pause=management.getByRole('button',{name:'Pause '+name,exact:true});await pause.waitFor();
  await pause.focus();await expect(pause).toBeFocused();
  let response=admin.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/settings/app-actors/'+agent.id);
  await admin.keyboard.press('Enter');assert.equal((await response).status(),200);await management.getByText('paused',{exact:true}).waitFor();assert.equal((await api()).status,401);
  response=admin.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/settings/app-actors/'+agent.id);
  await management.getByRole('button',{name:'Revoke '+name,exact:true}).click();assert.equal((await response).status(),200);
  await management.getByText('revoked · Credential unavailable; install a new identity to grant future access.',{exact:true}).waitFor();
  await settleReads(admin);await admin.reload();await management.getByText('revoked · Credential unavailable; install a new identity to grant future access.',{exact:true}).waitFor();
  await inspect(admin,management,'app-actor-admin-revoked');
 }finally{await admin.context().close();}
 assert.equal((await api('PATCH',{expectedVersion:detail.version,title:'synthetic-vector-19245'})).status,401);
 assert.equal((await call(path)).title,detail.title);assert.deepEqual((await call('/settings/audit?kind=agent&subject='+issue.id)).entries,audit.entries);
 assert.deepEqual(errors,[]);console.log('PROBE ROLE-006 browser: native Settings installation and credential reveal -> attributed title and audit; Admin keyboard pause and revoke -> refused next calls; reload retains history; management, issue and audit shown at 1440 and 390.');
}
