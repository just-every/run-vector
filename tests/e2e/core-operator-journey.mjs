import assert from 'node:assert/strict';
import {readDevelopmentLink} from './outbox-session.mjs';
import {beforePrivateNavigation,settleReads} from './collaboration-navigation.mjs';

/** Independent jobs use genuine invited operators and their own rate budgets. */
export async function withInvitedOperator(page,context,base,state,journey,displayName='Stream planning teammate'){
 const original=await context.cookies(),email=`stream-planning-${Date.now()}@vector.test`;
 // Use the app's browser transport and current cookie jar. Playwright's API
 // context keeps an independent pool across the long browser journeys here.
 const invited=await page.evaluate(async({displayName,email})=>{
  const response=await fetch('/api/settings/operators/invite',{
   method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({displayName,email}),
  });
  await response.arrayBuffer();
  return response.status;
 },{displayName,email});assert.equal(invited,202);
 const link=await readDevelopmentLink(base,context.request,email,state);
 await beforePrivateNavigation(page,link);await page.goto(link);await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.waitForURL(base+'/app');await settleReads(page);
 try{await journey()}finally{
  await beforePrivateNavigation(page,base+'/');await page.goto(base+'/');await page.waitForLoadState('networkidle');
  await context.clearCookies();await context.addCookies(original);
 }
}
