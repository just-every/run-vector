import assert from 'node:assert/strict';
import {roleScreens} from '../role-ui-support.mjs';
import {readFile} from 'node:fs/promises';
export async function exerciseSlackApp({page,runtime,width,evidence}){
 const panel=page.getByRole('region',{name:'Install your Slack app',exact:true}),screens=roleScreens(evidence);
 const inspect=async(...args)=>{const viewport=page.viewportSize();await screens(...args);await page.setViewportSize(viewport);};
 await panel.getByRole('heading',{name:'Install your Slack app',exact:true}).waitFor();
 await panel.getByText('Create or configure a Slack app',{exact:true}).click();
 await inspect(page,panel,'slack-app-configuration-'+width);
 const form=panel.getByRole('form',{name:'Create Slack app',exact:true});
 await form.getByLabel('App configuration token',{exact:true}).fill('synthetic-vector-'+width+'-configuration');
 const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations/slack/app/create'&&r.request().method()==='POST');
 await form.getByRole('button',{name:'Create Slack app',exact:true}).click();assert.equal((await created).status(),200);
 await panel.getByText('Configured app: synthetic-vector-2000',{exact:true}).waitFor();assert.equal(await form.getByLabel('App configuration token',{exact:true}).inputValue(),'');
 const manifestUrl=await panel.getByRole('link',{name:'Open prefilled Slack manifest',exact:true}).getAttribute('href');
 const manifest=JSON.parse(new URL(manifestUrl).searchParams.get('manifest_json'));
 assert.equal(manifest.oauth_config.redirect_urls[0],runtime.base+'/api/integrations/slack/oauth/callback');
 await inspect(page,panel,'slack-app-ready-'+width);
 const authorize='https://slack.com/oauth/v2/authorize**';let callback;
 const route=async route=>{const url=new URL(route.request().url());assert.equal(url.searchParams.get('client_id'),'synthetic-vector-2001');callback=runtime.base+'/api/integrations/slack/oauth/callback?state='+encodeURIComponent(url.searchParams.get('state'))+'&code=synthetic-vector-2006';await route.fulfill({status:302,headers:{Location:callback}});};
 await page.route(authorize,route);
 try{await panel.getByRole('button',{name:'Install Slack app',exact:true}).click();await page.waitForURL(runtime.base+'/app/settings#integrations');}
 finally{await page.unroute(authorize,route);}
 await page.locator('.channel-settings').getByText('Slack connected to Delivery workspace',{exact:true}).waitFor();
 await inspect(page,panel,'slack-app-installed-'+width);
 const replay=await page.request.get(callback);assert.equal(replay.status(),403);
 const calls=(await readFile(process.env.VECTOR_CHANNEL_EDGE,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
 assert.equal(calls.filter(c=>c.method==='oauth.v2.access').length,width===1440?1:2);
 const removed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations/slack'&&r.request().method()==='DELETE');
 await page.locator('.channel-settings').getByRole('button',{name:'Remove Slack connection',exact:true}).click();assert.equal((await removed).status(),200);
 await page.locator('.channel-settings').getByText('Slack is not connected.',{exact:true}).waitFor();
 assert.equal((await (await page.request.get(runtime.base+'/api/settings/integrations/slack/app')).json()).app,null);
}
