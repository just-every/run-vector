import {exerciseChannels} from './integrations/channel-settings.mjs';
import {exerciseSlackDirectMessages} from './integrations/slack-dm-settings.mjs';
import assert from 'node:assert/strict';
import {createWebhookProtocol} from '../../vendor/base/integrations/core/webhook.ts';
import {sendSignedPullRequest,pullRequestRepository} from './integration-signed-pr.mjs';
export async function exerciseIntegrationSettings({page,runtime,cookie,team,width,evidence}){
 await page.setViewportSize({width,height:900});await page.goto(runtime.base+'/app/settings');const panel=page.locator('#integrations');await panel.getByRole('heading',{name:'Integrations',exact:true}).waitFor();
 const receipt=async(path,action,status=201)=>{const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations'+path&&r.request().method()==='POST');await action();const response=await pending;assert.equal(response.status(),status);return response.json();};
 const reveal=async value=>{const input=panel.getByLabel('New credential',{exact:true});await input.waitFor();assert.equal(await input.inputValue()===value,true,'The reveal contains the issued credential');assert.equal(await input.getAttribute('type'),'password');await panel.getByRole('button',{name:'Show credential',exact:true}).click();assert.equal(await input.getAttribute('type'),'text');await panel.getByRole('button',{name:'Hide credential',exact:true}).click();await panel.getByRole('button',{name:'I saved it; close',exact:true}).click();assert.equal(await input.count(),0);};
 const name='Browser token '+width;await panel.getByLabel('Token name',{exact:true}).fill(name);const token=await receipt('/tokens',()=>panel.getByRole('button',{name:'Create token',exact:true}).click());await reveal(token.token);
 const used=await runtime.req('/api/v1/issues',{headers:{Authorization:'Bearer '+token.token}});assert.equal(used.status,200);await used.body.cancel();
 const usage=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/settings/integrations/tokens/usage');await panel.getByRole('button',{name:'Refresh token usage',exact:true}).click();assert.equal((await usage).status(),200);
 await panel.getByLabel('Source name',{exact:true}).fill('Browser source '+width);await panel.getByLabel('Stable source ID',{exact:true}).fill('browser-source-'+width);await panel.getByLabel('Intake team',{exact:true}).selectOption(team.id);const source=await receipt('/sources',()=>panel.getByRole('button',{name:'Register source',exact:true}).click());await reveal(source.secret);
 const input={teamId:team.id,title:'Native signed signal '+width,summary:'Observed source evidence',sourceRecordId:'record-'+width,sourceRevisionId:'revision-1',observedAt:'2026-10-01T01:00:00.000Z',assertions:{hypothesis:{value:'Source hypothesis '+width,attribution:'source'},verified:{value:false,attribution:'source'}}};
 const protocol=createWebhookProtocol({resolveDestination:async()=>source.receiver,signingKey:async()=>new Uint8Array(Buffer.from(source.secret,'hex'))}),wire=await protocol.prepare({id:crypto.randomUUID(),tenant:source.workspaceId,destinationId:source.sourceId,event:'signal.revision',protocol:'webhook',body:JSON.stringify(input)},Date.now());
 const admitted=await fetch(source.receiver,{method:'POST',headers:wire.headers,body:wire.body});assert.equal(admitted.status,200);const issue=await admitted.json();
 const plainBody={title:'Plain webhook alert '+width};
 const postPlain=url=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(plainBody)});
 const plain=await postPlain(source.webhookUrl);assert.equal(plain.status,200);const plainIssue=await plain.json();assert.equal(plainIssue.reused,false);
 const replayPlain=await postPlain(source.webhookUrl);assert.equal(replayPlain.status,200);assert.deepEqual(await replayPlain.json(),{...plainIssue,reused:true});
 await page.goto(runtime.base+'/app/issues/'+plainIssue.identifier);await page.getByRole('heading',{name:plainBody.title,exact:true}).waitFor();
 await page.goto(runtime.base+'/app/settings');await panel.getByRole('heading',{name:'Integrations',exact:true}).waitFor();
 const replaced=await receipt('/sources/'+source.id+'/webhook-url',()=>panel.getByRole('button',{name:'Replace webhook URL for Browser source '+width,exact:true}).click());await reveal(replaced.webhookUrl);
 assert.equal((await postPlain(source.webhookUrl)).status,401);
 const acceptedReplacement=await postPlain(replaced.webhookUrl);assert.equal(acceptedReplacement.status,200);assert.deepEqual(await acceptedReplacement.json(),{...plainIssue,reused:true});
 const revokeSource=page.waitForResponse(r=>r.request().method()==='DELETE'&&new URL(r.url()).pathname==='/api/settings/integrations/sources/'+source.id);await panel.getByRole('button',{name:'Revoke Browser source '+width,exact:true}).click();assert.equal((await revokeSource).status(),200);assert.equal((await postPlain(replaced.webhookUrl)).status,401);

 await exerciseChannels({page,runtime,cookie,team,width,evidence});
 await exerciseSlackDirectMessages({page,runtime,width,evidence});
 await panel.getByLabel('Destination name',{exact:true}).fill('Browser receiver '+width);await panel.getByLabel('Public HTTPS destination',{exact:true}).fill('https://receiver.example.com/events');const destination=await receipt('/destinations',()=>panel.getByRole('button',{name:'Register destination',exact:true}).click());await reveal(destination.secret);
 const config=await(await runtime.req('/api/settings/integrations',{headers:{Cookie:cookie}})).json();assert.equal(config.outboundConfigured,false);assert(!JSON.stringify(config).includes(token.token));assert(!JSON.stringify(config).includes(source.secret));assert(!JSON.stringify(config).includes(source.webhookUrl));assert(!JSON.stringify(config).includes(replaced.webhookUrl));assert(!JSON.stringify(config).includes(destination.secret));
 await panel.getByLabel('Repository name',{exact:true}).fill('Browser repository '+width);await panel.getByLabel('GitHub owner/repository',{exact:true}).fill(pullRequestRepository(width));const github=await receipt('/github',()=>panel.getByRole('button',{name:'Register repository',exact:true}).click());await reveal(github.secret);
 await sendSignedPullRequest(github,issue.identifier,width);
 await page.reload();assert.equal(await panel.getByLabel('New credential',{exact:true}).count(),0);
 await panel.getByRole('button',{name:'Revoke '+name,exact:true}).waitFor();
 await page.goto(runtime.base+'/app/issues/'+issue.identifier);const pr=page.getByRole('link',{name:'Fix '+issue.identifier+' · '+pullRequestRepository(width)+' #42',exact:true});await pr.waitFor();assert.equal(await pr.getAttribute('href'),'https://github.com/'+pullRequestRepository(width)+'/pull/42');await page.getByText('· merged',{exact:true}).waitFor();await pr.scrollIntoViewIfNeeded();
 await page.goto(runtime.base+'/app/settings');const revoked=page.waitForResponse(r=>r.request().method()==='DELETE'&&new URL(r.url()).pathname.startsWith('/api/settings/integrations/tokens/'));await panel.getByRole('button',{name:'Revoke '+name,exact:true}).click();assert.equal((await revoked).status(),200);assert.equal((await runtime.req('/api/v1/issues',{headers:{Authorization:'Bearer '+token.token}})).status,401);
}
