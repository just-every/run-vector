import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {join} from 'node:path';

// Delay real network requests to observe loading and pending UI; every response
// comes from the installation's public Worker routes.
function holdRequest(page, pattern) {
 let release, observed;
 const released=new Promise(resolve=>{release=resolve;}),seen=new Promise(resolve=>{observed=resolve;});
 const requests=new Set();
 const handler=route=>{const continued=released.then(()=>route.continue());requests.add(continued);observed();return continued.finally(()=>requests.delete(continued));};
 return {async start(){await page.route(pattern,handler);},seen,async finish(){release();await Promise.all([...requests]);await page.unroute(pattern,handler);}};
}
export async function restoreAccessJourney({page,installation,cookie,peer,evidence}) {
 const endpoint=installation.origin+'/api/data/restore',panel=page.getByRole('region',{name:'After a restore'});
 const capture=async name=>{await panel.scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,name+'.png'),fullPage:false});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Settings fits the viewport');};
 const loading=holdRequest(page,endpoint);await loading.start();
 await page.setViewportSize({width:1440,height:1000});await page.goto(installation.origin+'/app/settings#after-restore');await loading.seen;
 await expect(panel.getByRole('status')).toBeVisible();await capture('restore-loading-1440');await loading.finish();
 const people=panel.getByRole('list',{name:'Restored people'});await expect(people).toBeVisible();
 const status=await(await installation.req('/api/data/restore','GET',undefined,cookie)).json(),person=status.operators.find(row=>row.id===peer);
 assert(person&&!person.approved&&person.eligible);
 const removed=installation.sql('SELECT id FROM operators WHERE removed_at IS NOT NULL');assert(removed.length>0);
 for(const row of removed){assert(!status.operators.some(person=>person.id===row.id));assert.equal((await installation.req('/api/data/restore/operators/'+row.id,'POST',{},cookie)).status,409);}
 for(const width of [1440,390]) {await page.setViewportSize({width,height:1000});await capture('restore-review-'+width);}
 const grant=panel.getByRole('button',{name:`Allow ${person.name} to sign in`,exact:true});
 const grantUrl=endpoint+'/operators/'+peer;
 // A real server refusal must remain visible and must not invent admission.
 await page.route(grantUrl,route=>route.continue({headers:{...route.request().headers(),origin:'https://untrusted.example'}}));
 const refused=page.waitForResponse(response=>response.url()===grantUrl&&response.status()===403);await grant.click();await refused;
 await expect(panel.getByRole('alert')).toBeVisible();await expect(grant).toBeDisabled();await capture('restore-refused-390');await page.unroute(grantUrl);
 await panel.getByRole('button',{name:'Refresh restore status'}).click();await expect(grant).toBeEnabled();
 const pending=holdRequest(page,grantUrl);await pending.start();await grant.click();await pending.seen;
 await expect(panel).toHaveAttribute('aria-busy','true');await expect(panel.getByRole('button',{name:'Granting access…'})).toBeDisabled();await capture('restore-grant-pending-390');await pending.finish();
 await expect(grant).toHaveCount(0);await expect(people.getByRole('listitem').filter({hasText:person.email})).toContainText('Can sign in');
 assert.equal((await(await installation.req('/api/data/restore','GET',undefined,cookie)).json()).operators.find(row=>row.id===peer).approved,1);
 return async()=>{
  const effects=panel.getByRole('button',{name:'Turn on future effects',exact:true});
  const pending=holdRequest(page,endpoint+'/review-effects');await pending.start();await effects.click();await pending.seen;
  await expect(panel).toHaveAttribute('aria-busy','true');await expect(panel.getByRole('button',{name:'Turning on future effects…'})).toBeDisabled();await capture('restore-effects-pending-390');await pending.finish();
  await expect(effects).toHaveCount(0);
  const refreshed=await(await installation.req('/api/data/restore','GET',undefined,cookie)).json();assert.equal(refreshed.status.effectsHeld,0);assert(refreshed.status.reviewedAt);
  await page.reload();await expect(panel.getByRole('list',{name:'Restored people'})).toBeVisible();await expect(effects).toHaveCount(0);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await capture('restore-completed-'+width);}
 };
}
