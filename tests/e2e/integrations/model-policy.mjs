import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {navigate,trackRequests} from '../collaboration-navigation.mjs';
/** Native Settings forms and a real intake item; only the external Messages API is faked. */
export async function exerciseModelPolicy({page,runtime,cookie,team,evidence}) {
  const headers={Cookie:cookie,Origin:runtime.base,'Content-Type':'application/json'};
  const call=async(path,method='GET',body,status=200)=>{
    const response=await runtime.req('/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    assert.equal(response.status,status,await response.clone().text());return response.json();
  };
  const modelCalls=async()=>{
    try{return (await readFile(process.env.VECTOR_CHANNEL_EDGE,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(row=>row.method==='model');}
    catch(error){if(error.code==='ENOENT')return [];throw error;}
  };
  await page.setViewportSize({width:1440,height:1000});trackRequests(page);
  const intake=await call('/intake','POST',{teamId:team.id,title:'synthetic-vector-4821',description:'synthetic-vector-4821 intake description'},201);
  await navigate(page,runtime.base+'/app/settings#models');
  const panel=page.getByRole('region',{name:'Models and data',exact:true});await panel.waitFor();
  const connect=async(kind,name)=>{
    await panel.getByText('Connect a model provider',{exact:true}).click();
    const form=panel.getByRole('form',{name:'Connect model provider'});
    await expect(form).toBeVisible();
    await form.getByLabel('Provider type',{exact:true}).selectOption(kind);
    await form.getByLabel('Provider name',{exact:true}).fill(name);
    await form.getByLabel('Model name',{exact:true}).fill(name);
    if(kind==='self-hosted')await form.getByLabel('HTTPS Messages endpoint').fill('https://synthetic-vector-4822.example.test/messages');
    await form.getByLabel('Provider credential').fill('synthetic-vector-4821-credential');
    await form.getByRole('button',{name:'Connect provider',exact:true}).click();
    await panel.getByRole('heading',{name,exact:true}).waitFor();
    await expect(form.getByLabel('Provider credential')).toHaveValue('');
    await panel.getByText('Connect a model provider',{exact:true}).click();
    return (await call('/settings/models')).providers.find(row=>row.name===name);
  };
  const policy=panel.getByRole('form',{name:'Model feature policy'});
  const save=async(scope,provider,enabled)=>{
    await policy.getByLabel('Model feature',{exact:true}).selectOption('triage');
    await policy.getByLabel('Policy scope',{exact:true}).selectOption(scope);
    await policy.getByLabel('Selected provider',{exact:true}).selectOption(provider);
    await policy.getByLabel('Enable this feature for this scope').setChecked(enabled);
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/models/policy'&&r.request().method()==='PUT');
    await policy.getByRole('button',{name:'Save model policy'}).click();return response;
  };
  const declared=await connect('anthropic','synthetic-vector-4821');
  assert.equal((await save('',declared.id,true)).status(),200);
  await expect(panel.getByText('Model settings saved.',{exact:true})).toBeVisible();
  const initialCalls=(await modelCalls()).length;
  await navigate(page,runtime.base+'/app/issues/'+intake.identifier);
  await page.getByRole('button',{name:'Preview model suggestion',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'synthetic-vector-4823'})).toBeVisible();
  const sent=await modelCalls();assert.equal(sent.length,initialCalls+1);
  assert.deepEqual(JSON.parse(sent.at(-1).body.messages[0].content),{feature:'triage',records:[{identifier:intake.identifier,title:'synthetic-vector-4821',description:'synthetic-vector-4821 intake description'}]});
  const original=await call('/issues/'+intake.identifier);
  await navigate(page,runtime.base+'/app/settings#models');
  assert.equal((await save(team.id,declared.id,false)).status(),200);
  await expect(panel.getByText('Current scope: Disabled.',{exact:false})).toBeVisible();
  await navigate(page,runtime.base+'/app/issues/'+intake.identifier);
  await page.getByRole('button',{name:'Preview model suggestion',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Triage suggestions are disabled'})).toBeVisible();
  assert.equal((await modelCalls()).length,initialCalls+1);
  assert.equal((await call('/issues/'+intake.identifier)).version,original.version);
  const capture=async(region,name)=>{
    await mkdir(evidence,{recursive:true});
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000});await region.scrollIntoViewIfNeeded();
      await page.screenshot({path:join(evidence,name+'-'+width+'.png')});
    }
    await page.setViewportSize({width:1440,height:1000});
  };
  await capture(page.locator('.decision-panel'),'model-team-disabled');
  await navigate(page,runtime.base+'/app/settings#models');
  const custom=await connect('self-hosted','synthetic-vector-4822');
  assert.equal((await save('',custom.id,true)).status(),409);
  await expect(panel.getByRole('status')).toContainText('An Owner must record terms');
  const card=panel.locator('.settings-confirm').filter({has:page.getByRole('heading',{name:'synthetic-vector-4822',exact:true})});
  await card.getByText('Owner terms confirmation',{exact:true}).click();
  const terms=card.getByRole('form',{name:'Owner provider terms'});
  await terms.getByLabel('Terms URL',{exact:true}).fill('https://synthetic-vector-4822.example.test/terms');
  await terms.getByLabel('Retention terms',{exact:true}).fill('No retention after the response.');
  await terms.getByRole('checkbox').check();
  await terms.getByRole('button',{name:'Record terms and confirm',exact:true}).click();
  await expect(card.getByText('Owner confirmed:',{exact:false})).toBeVisible();
  assert.equal((await save('',custom.id,true)).status(),200);
  const current=await call('/settings/models');
  assert.equal(current.policies.find(row=>row.feature==='triage'&&row.teamId===null).providerId,custom.id);
  assert.equal(current.providers.find(row=>row.id===custom.id).noTraining,true);
  const audit=await call('/settings/audit?action=model.terms_confirmed');assert.ok(audit.entries.some(row=>row.subjectRef===custom.id&&row.action==='model.terms_confirmed'));
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const findings=await page.evaluate(async()=> (await axe.run(document.getElementById('models'))).violations.filter(row=>['serious','critical'].includes(row.impact)));
  assert.deepEqual(findings,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await capture(card,'model-owner-terms');
  await capture(policy,'model-feature-controls');
  // Remove both credentials through the native Settings door so later integration journeys inherit no model setup.
  await call('/settings/models/providers/'+declared.id,'DELETE');await call('/settings/models/providers/'+custom.id,'DELETE');
}
