import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {navigate,settleReads,trackRequests} from '../collaboration-navigation.mjs';
import {roleScreens} from '../role-ui-support.mjs';
/** One desktop journey; changed screens are also inspected at phone width. */
export async function exerciseBitbucketChain({page:shared,runtime,cookie,team,evidence}){
 const page=await shared.context().newPage();trackRequests(page);await page.setViewportSize({width:1440,height:1000});
 const errors=[],inspect=roleScreens(evidence),headers={Cookie:cookie,Origin:runtime.base,'Content-Type':'application/json'};
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(/hydration|did not match|Minified React error #(418|423|425)/i.test(message.text()))errors.push(message.text());});
 const call=async(path,method='GET',body,status=200)=>{const response=await runtime.req('/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});assert.equal(response.status,status,await response.clone().text());return response.json();};
 try{
  const repository=['synthetic-vector-187','browser'].join('/'),repositoryUuid='{11111111-1111-4111-8111-111111111187}';
  await call('/settings/teams/'+team.id+'/statuses','POST',{name:'Bitbucket review',category:'started'});
  const administration=await call('/settings/teams/'+team.id+'/statuses','POST',{name:'Bitbucket shipped',category:'completed'}),current=administration.teams.find(row=>row.id===team.id),started=current.statuses.find(row=>row.name==='Bitbucket review'),completed=current.statuses.find(row=>row.name==='Bitbucket shipped');
  for(const [trigger,statusId] of [['review',started.id],['merged',completed.id]]){
   const currentRule=(await call('/github/automation')).teams.find(row=>row.id===team.id).rules.find(row=>row.trigger===trigger);
   await call('/settings/teams/'+team.id,'PATCH',{githubAutomation:{trigger,statusId,allowReopen:false,expectedVersion:currentRule.version}});
  }
  await navigate(page,runtime.base+'/app/settings/connections');
  const section=page.getByRole('region',{name:'Bitbucket Cloud pull requests',exact:true});
  await section.getByLabel('Bitbucket connection name',{exact:true}).fill('synthetic-vector-187 browser');
  await section.getByLabel('Bitbucket workspace and repository',{exact:true}).fill(repository);
  await section.getByLabel('Bitbucket repository UUID',{exact:true}).fill(repositoryUuid);
  const saved=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/settings/integrations/bitbucket');
  await section.getByRole('button',{name:'Register Bitbucket repository',exact:true}).click();
  const response=await saved;assert.equal(response.status(),201);const config=await response.json();
  const privatePanel=page.getByRole('region',{name:'Save this credential once',exact:true});
  await privatePanel.getByLabel('Bitbucket webhook URL',{exact:true}).waitFor();
  await privatePanel.getByRole('button',{name:'I saved it; close',exact:true}).click();
  await section.getByText('synthetic-vector-187 browser',{exact:true}).waitFor();
  await inspect(page,section,'bitbucket-settings');await page.setViewportSize({width:1440,height:1000});
  const issue=await call('/issues','POST',{teamId:team.id,title:'synthetic-vector-187 Bitbucket lifecycle'},201);
  const repo={uuid:repositoryUuid,full_name:repository};
  const payload=(state,updated_on)=>({actor:{uuid:'{22222222-2222-4222-8222-222222222187}'},repository:repo,pullrequest:{id:37,title:'Fixes '+issue.identifier,description:'synthetic-vector-187',state,updated_on,destination:{repository:repo},links:{html:{href:'https://bitbucket.org/'+repository+'/pull-requests/37'}}}});
  const send=async(body,id=randomUUID())=>{const text=JSON.stringify(body),signature=createHmac('sha256',config.secret).update(text).digest('hex');const response=await runtime.req(new URL(config.receiver).pathname,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature':'sha256='+signature,'X-Event-Key':body.pullrequest.state==='MERGED'?'pullrequest:fulfilled':'pullrequest:created','X-Request-UUID':id},body:text});assert.equal(response.status,200,await response.clone().text());return response.json();};
  const open=payload('OPEN','2026-10-10T01:00:00.000Z'),merged=payload('MERGED','2026-10-10T02:00:00.000Z'),delivery=randomUUID();
  await send(open);assert.equal((await call('/issues/'+issue.identifier)).status.id,started.id);
  await navigate(page,runtime.base+'/app/issues/'+issue.identifier);
  const links=page.getByRole('region',{name:'Bitbucket links',exact:true});
  const link=links.getByRole('link',{name:'Fixes '+issue.identifier+' · '+repository+' #37',exact:true});await link.waitFor();assert.equal(await link.getAttribute('href'),open.pullrequest.links.html.href);await links.getByText('· Open',{exact:true}).waitFor();
  await inspect(page,links,'bitbucket-opened');await page.setViewportSize({width:1440,height:1000});
  await send(merged,delivery);const finished=await call('/issues/'+issue.identifier);assert.equal(finished.status.id,completed.id);
  await send(merged,delivery);await send(open);assert.equal((await call('/issues/'+issue.identifier)).version,finished.version);
  await navigate(page,runtime.base+'/app/issues/'+issue.identifier);await links.getByText('· Merged',{exact:true}).waitFor();
  const activity=finished.activity.filter(row=>row.kind==='issue.status_changed'&&row.actor==='Bitbucket automation');assert.equal(activity.length,2);
  const inbox=await call('/notifications');assert.ok(JSON.stringify(inbox).includes(issue.identifier));assert.ok(JSON.stringify(inbox).includes('Bitbucket automation'));
  await inspect(page,page.locator('.issue-inspector'),'bitbucket-merged');await page.setViewportSize({width:1440,height:1000});
  await page.reload();await links.getByText('· Merged',{exact:true}).waitFor();assert.equal(await link.getAttribute('href'),open.pullrequest.links.html.href);
  assert.deepEqual(errors,[],'Bitbucket Settings and issue screens have no browser or hydration errors');
  console.log('PROBE BITBUCKET-001 browser: rendered Settings registration -> signed opened and merged PR, exact configured statuses, retained provider link and attributed follower Inbox; changed screens at 1440 and 390');
 }finally{await settleReads(page);await page.close();}
}
