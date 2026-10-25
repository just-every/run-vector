import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {slackAppFixture as fixture} from './channel-provider-edge.mjs';
const require=createRequire(import.meta.url);
/** SLACK-001's existing installation registration also reaches the real Settings UI. */
export async function exerciseSlackAppInstallation({page,runtime,width,evidence}){
 await mkdir(evidence,{recursive:true});await page.setViewportSize({width,height:900});
 const errors=[];const onError=error=>errors.push(error.message),onConsole=message=>{if(message.type()==='error'&&/hydrat/i.test(message.text()))errors.push(message.text());};
 page.on('pageerror',onError);page.on('console',onConsole);
 const panel=page.getByRole('region',{name:'Slack app installation',exact:true});
 const calls=async()=>(await readFile(process.env.VECTOR_CHANNEL_EDGE,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
 const inspect=async name=>{
  await panel.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const findings=await page.evaluate(async()=>{const result=await axe.run();return result.violations.filter(v=>['serious','critical'].includes(v.impact));});
  assert.deepEqual(findings,[]);
  // Match the existing role proof: a tall region capture must not stitch fixed
  // navigation over the form. This changes only the screenshot, not the UI.
  await panel.evaluate(root=>{for(const element of document.querySelectorAll('body *'))if(['fixed','sticky'].includes(getComputedStyle(element).position)&&!root.contains(element)&&!element.contains(root))element.setAttribute('data-capture-hidden','');});
  try{await panel.screenshot({path:resolve(evidence,'slack-app-'+name+'-'+width+'.png'),style:'[data-capture-hidden] { visibility: hidden !important; }'});}
  finally{await page.evaluate(()=>document.querySelectorAll('[data-capture-hidden]').forEach(element=>element.removeAttribute('data-capture-hidden')));}
 };
 const provider=async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='api.slack.com')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><title>Synthetic Slack setup</title><body><main><h1>App created from the prefilled manifest</h1></main></body></html>'});
  assert.equal(url.origin,'https://slack.com');assert.equal(url.pathname,'/oauth/v2/authorize');assert.equal(url.searchParams.get('client_id'),fixture.clientId);
  const callback=new URL(url.searchParams.get('redirect_uri'));assert.equal(callback.href,runtime.base+'/api/integrations/slack/oauth/callback');
  callback.searchParams.set('state',url.searchParams.get('state'));callback.searchParams.set('code','synthetic-vector-32017');
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><title>Synthetic Slack consent</title><body><main><h1>Install Vector</h1><a href="'+callback.href.replaceAll('&','&amp;')+'">Approve fixture installation</a></main></body></html>'});
 };
 await page.context().route('https://slack.com/oauth/v2/authorize**',provider);
 await page.context().route('https://api.slack.com/apps**',provider);
 const receive=async(path,action,status=200)=>{const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations'+path&&r.request().method()==='POST');await action();const response=await pending;assert.equal(response.status(),status);return response;};
 const install=async()=>{
  await panel.getByRole('button',{name:'Install Slack app',exact:true}).click();await page.getByRole('link',{name:'Approve fixture installation',exact:true}).click();
  await page.waitForURL(runtime.base+'/app/settings#integrations');await panel.getByText('App '+fixture.appId+' is configured. Stored secrets are never shown again.',{exact:true}).waitFor();
  await page.getByText('Slack connected to Delivery workspace',{exact:true}).waitFor();await inspect('installed');
 };
 const remove=async(withinApp=true)=>{
  const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations/slack/app'&&r.request().method()==='GET');
  const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations/slack'&&r.request().method()==='DELETE');
  await (withinApp?panel.getByRole('button',{name:'Remove Slack app',exact:true}):page.getByRole('button',{name:'Remove Slack connection',exact:true})).click();assert.equal((await pending).status(),200);assert.equal((await(await refreshed).json()).app,null);
  if(withinApp)await panel.getByText('Slack app removed. Members must link again after reconnecting.',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'Install Slack app',exact:true}).waitFor({state:'hidden'});await page.getByText('Slack is not connected.',{exact:true}).waitFor();
 };
 try{
  await page.goto(runtime.base+'/app/settings#integrations');await panel.getByRole('heading',{name:'Slack app installation',exact:true}).waitFor();
  await panel.getByText('Create an app automatically',{exact:true}).click();const automatic=panel.getByRole('form',{name:'Generate Slack app',exact:true});await inspect('automatic');
  await automatic.getByLabel('App configuration token',{exact:true}).fill('synthetic-vector-32016');await receive('/slack/app/create',()=>automatic.getByRole('button',{name:'Create Slack app',exact:true}).click(),400);
  await panel.getByRole('alert').filter({hasText:'invalid_auth'}).waitFor();assert.equal(await panel.getByRole('button',{name:'Install Slack app',exact:true}).count(),0);
  const before=(await calls()).filter(row=>row.method==='apps.manifest.create').length;
  await automatic.getByLabel('App configuration token',{exact:true}).fill('synthetic-vector-32015');await receive('/slack/app/create',()=>automatic.getByRole('button',{name:'Create Slack app',exact:true}).click());
  await panel.getByRole('button',{name:'Install Slack app',exact:true}).waitFor();assert.equal(await automatic.getByLabel('App configuration token',{exact:true}).inputValue(),'');
  assert.equal((await calls()).filter(row=>row.method==='apps.manifest.create').length,before+1);await install();await remove(false);
  await panel.getByText('Use Slack’s prefilled page',{exact:true}).click();const manual=panel.getByRole('form',{name:'Slack app credentials',exact:true});await inspect('manual');
  const popupPromise=page.waitForEvent('popup');await panel.getByRole('link',{name:'Open Slack app setup',exact:true}).click();const popup=await popupPromise;await popup.waitForURL('https://api.slack.com/apps**');
  const manifest=JSON.parse(new URL(popup.url()).searchParams.get('manifest_json'));assert.deepEqual(manifest.oauth_config.redirect_urls,[runtime.base+'/api/integrations/slack/oauth/callback']);await popup.close();
  for(const [label,value] of [['App ID',fixture.appId],['App client ID',fixture.clientId],['App client secret',fixture.clientSecret],['App signing secret',fixture.signingSecret]])await manual.getByLabel(label,{exact:true}).fill(value);
  await receive('/slack/app',()=>manual.getByRole('button',{name:'Save Slack app credentials',exact:true}).click());await panel.getByRole('button',{name:'Install Slack app',exact:true}).waitFor();
  for(const label of ['App client secret','App signing secret'])assert.equal(await manual.getByLabel(label,{exact:true}).inputValue(),'');
  const oauthBefore=(await calls()).filter(row=>row.method==='oauth.v2.access').length;await install();assert.equal((await calls()).filter(row=>row.method==='oauth.v2.access').length,oauthBefore+1);await remove();
  const reloaded=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations/slack/app'&&r.request().method()==='GET');await page.reload();assert.equal((await(await reloaded).json()).app,null);await panel.getByRole('heading',{name:'Slack app installation',exact:true}).waitFor();assert.equal(await panel.getByRole('button',{name:'Install Slack app',exact:true}).count(),0);assert.deepEqual(errors,[]);
 }finally{await page.context().unroute('https://slack.com/oauth/v2/authorize**',provider);await page.context().unroute('https://api.slack.com/apps**',provider);page.off('pageerror',onError);page.off('console',onConsole);}
}
