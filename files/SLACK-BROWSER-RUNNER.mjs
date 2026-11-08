import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const moduleAt=path=>import(pathToFileURL(resolve(path)).href);
const {createUiRuntime}=await moduleAt('tests/e2e/ui-runtime-support.mjs');
const {signIn,openAuthenticatedPage}=await moduleAt('tests/e2e/ui-runtime-auth.mjs');
const {exerciseSlackThreads}=await moduleAt('tests/e2e/integrations/slack-threads.mjs');
const {slackAppFixture:fixture}=await moduleAt('tests/e2e/integrations/channel-provider-edge.mjs');
const {chromium}=createRequire(resolve('package.json'))('@playwright/test');
process.env.VECTOR_CHANNEL_EDGE=resolve('.artifacts/verification/slack-thread-focused-'+process.pid+'.jsonl');
const evidence=resolve('/home/agent/rer-consolidation/work/sd-vector-c-f206/packet');
const runtime=createUiRuntime();let browser;
const proof={passed:false,assertionWidth:1440,captureWidths:[1440,390],signedEvents:true,liveProvider:false,source:'tests/e2e/integrations/slack-threads.mjs#exerciseSlackThreads'};
try{
 await mkdir(evidence,{recursive:true});runtime.initialize();runtime.start();await runtime.ready();
 const {cookie}=await signIn(runtime);
 const api=async(path,method='GET',body,status=200)=>{
  const response=await runtime.req('/api'+path,{method,headers:{Cookie:cookie,Origin:runtime.base,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.equal(response.status,status,await response.clone().text());return response.json();
 };
 const admin=await api('/settings/administration'),team=admin.teams.find(row=>!row.archivedAt);
 await api('/settings/integrations/slack/app','POST',{appId:fixture.appId,clientId:fixture.clientId,clientSecret:fixture.clientSecret,signingSecret:fixture.signingSecret});
 const install=await api('/settings/integrations/slack/app/install','POST',{}),state=new URL(install.url).searchParams.get('state');
 const callback=await runtime.req('/api/integrations/slack/oauth/callback?state='+encodeURIComponent(state)+'&code=synthetic-vector-focused',{headers:{Cookie:cookie}});assert.equal(callback.status,303);await callback.body?.cancel();
 const operator=runtime.sql("SELECT id FROM operators WHERE role='owner' AND removed_at IS NULL ORDER BY created_at LIMIT 1")[0];
 await api('/settings/integrations/slack/app/members','POST',{operatorId:operator.id,slackTeamId:fixture.teamId,slackUserId:fixture.memberId});
 await api('/settings/integrations/channels','POST',{scope:'team',objectId:team.id,provider:'slack',channelId:fixture.intakeChannel,channelName:'synthetic-vector-focused',events:['issue.status_changed']},201);
 const payload={type:'event_callback',team_id:fixture.teamId,event_id:'synthetic-vector-focused-root',event:{type:'app_mention',user:fixture.memberId,channel:fixture.intakeChannel,ts:'1730201440.000001',text:'<@'+fixture.botId+'> Focused Slack thread proof'}};
 const body=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000));
 const created=await runtime.req('/api/integrations/slack/events',{method:'POST',headers:{'Content-Type':'application/json','x-slack-request-timestamp':timestamp,'x-slack-signature':'v0='+createHmac('sha256',fixture.signingSecret).update('v0:'+timestamp+':'+body).digest('hex')},body});
 assert.equal(created.status,200,await created.clone().text());const issue=await created.json();proof.identifier=issue.identifier;
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 const page=await openAuthenticatedPage(browser,cookie,runtime.base);await page.setViewportSize({width:1440,height:1000});
 const hydration=[];page.on('console',message=>{if(message.type()==='error'&&/hydrat/i.test(message.text()))hydration.push(message.text());});
 await page.goto(runtime.base+'/app/issues/'+issue.identifier);
 await page.getByRole('heading',{name:'Discussion',exact:true}).waitFor();
 await exerciseSlackThreads({page,runtime,cookie,width:1440,evidence,fixture,issue,payload});
 assert.deepEqual(hydration,[]);proof.hydrationErrors=0;proof.passed=true;
}finally{
 await browser?.close();await runtime.stop();await writeFile(resolve(evidence,'BROWSER-FOCUSED.json'),JSON.stringify(proof,null,2)+'\n');
}
console.log('SLACK-002 signed Events and native discussion passed: one behavioral width, mapped and resolved screen captures at 1440 and 390.');
