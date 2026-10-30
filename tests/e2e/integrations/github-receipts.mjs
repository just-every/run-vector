import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {roleScreens} from '../role-ui-support.mjs';
import {resendPullRequest} from '../integration-signed-pr.mjs';

/** INTEG-002's visible GitHub receipt in Settings → Integrations: each repository row shows the
 * last event its own receiver durably accepted, or an explicit no-event state before the first. */
export function githubReceipts({page,panel,runtime,cookie,width,evidence}){
 const inspect=roleScreens(evidence),section=panel.getByRole('region',{name:'GitHub pull request webhooks',exact:true});
 const row=name=>section.getByRole('listitem').filter({has:page.getByText(name,{exact:true})});
 // Every row's receipt line, keyed by repository name: its machine time and its visible text.
 const shown=()=>section.evaluate(root=>Object.fromEntries([...root.querySelectorAll(':scope > ul > li')].map(item=>[item.querySelector(':scope > strong').textContent,{at:item.querySelector(':scope > p > time')?.dateTime??null,text:item.querySelector(':scope > p')?.textContent??null}])));
 const recorded=id=>runtime.sql(`SELECT max(received_at) AS at FROM vector_github_deliveries WHERE repository_id='${id}'`)[0].at;
 const othersUnchanged=(before,after,name)=>{for(const [other,receipt] of Object.entries(before))if(other!==name)assert.deepEqual(after[other],receipt,other+' keeps its own receipt');};
 return {
  /** Before the first delivery: the new row says so explicitly, with no time. */
  async none(name){
   await row(name).getByText('No GitHub event received yet',{exact:true}).waitFor();
   const before=await shown();assert.deepEqual(before[name],{at:null,text:'No GitHub event received yet'});
   if(width===390){await inspect(page,section,'github-receipts-'+width);await page.setViewportSize({width,height:900});}
   return before;
  },
  /** After signed deliveries and a reload: the row shows the recorded receipt in the viewer's time;
   * an identical replay, a wrongly signed delivery and further reloads leave it unchanged. */
  async received(github,name,delivery,before){
   const errors=[],pageError=error=>errors.push(error.message),hydration=message=>{if(/hydration|did not match|Minified React error #(418|423|425)/i.test(message.text()))errors.push(message.text());};
   const own=row(name);await own.locator('time').waitFor();
   const at=recorded(github.id),clock=await(await runtime.req('/api/settings/personal-time',{headers:{Cookie:cookie}})).json();
   const local=await page.evaluate(([at,zone,workspace])=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:zone}).format(new Date(at))+(zone!==workspace?` (${zone})`:''),[at,clock.effectiveTimezone,clock.workspaceTimezone]);
   const first=await shown();assert.deepEqual(first[name],{at,text:'Last GitHub event received '+local});othersUnchanged(before,first,name);
   assert.equal(await resendPullRequest(github,delivery),200,'an identical replay is acknowledged');
   assert.equal(await resendPullRequest(github,{...delivery,delivery:randomUUID()},'synthetic-vector-2301'),401,'a wrongly signed delivery is refused');
   page.on('pageerror',pageError);page.on('console',hydration);
   try{await page.reload();await own.locator('time').waitFor();assert.deepEqual(await shown(),first,'reload keeps every recorded receipt');}
   finally{page.off('pageerror',pageError);page.off('console',hydration);}
   assert.deepEqual(errors,[],'GitHub receipt rows hydrate without browser errors');
   assert.equal(recorded(github.id),at);
   const revoke=own.getByRole('button',{name:'Revoke '+name,exact:true}),setup=own.locator('details');
   await revoke.focus();await page.keyboard.press('Tab');
   assert.ok(await setup.locator('summary').evaluate(summary=>summary===document.activeElement),'Tab moves from Revoke to the row setup');
   await page.keyboard.press('Enter');await own.getByLabel('GitHub payload URL',{exact:true}).waitFor();
   await page.keyboard.press('Enter');assert.equal(await setup.evaluate(details=>details.open),false);
   if(width===1440){await inspect(page,section,'github-receipt-'+width);await page.setViewportSize({width,height:900});}
   return first[name];
  },
  /** A revoked receiver refuses a correctly signed delivery, and the row keeps its last receipt. */
  async revoked(github,name,delivery,receipt){
   const done=page.waitForResponse(response=>response.request().method()==='DELETE'&&new URL(response.url()).pathname==='/api/settings/integrations/github/'+github.id);
   await row(name).getByRole('button',{name:'Revoke '+name,exact:true}).click();assert.equal((await done).status(),200);
   assert.equal(await resendPullRequest(github,{...delivery,delivery:randomUUID()}),401,'the revoked receiver refuses a signed delivery');
   await page.reload();assert.match(await row(name).textContent(),/ · Revoked/,'the row shows its revoked state');
   assert.equal(await row(name).getByRole('button',{name:'Revoke '+name,exact:true}).count(),0);
   assert.deepEqual((await shown())[name],receipt,'the revoked row keeps its last receipt');
  },
 };
}
