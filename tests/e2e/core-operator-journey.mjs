import assert from 'node:assert/strict';
import {readDevelopmentLink} from './outbox-session.mjs';
import {beforePrivateNavigation,navigate,settleReads} from './collaboration-navigation.mjs';
import {openDisclosures} from './ui-controls-checks.mjs';

/** Independent jobs use genuine invited operators and their own rate budgets. */
export async function withInvitedOperator(page,context,base,state,journey,displayName='Stream planning teammate'){
 const original=await context.cookies(),email=`stream-planning-${Date.now()}@vector.test`;
 await navigate(page,base+'/app/settings');await openDisclosures(page);
 const operators=page.getByRole('region',{name:'Operators',exact:true});
 await operators.getByLabel('Name',{exact:true}).fill(displayName);
 await operators.getByLabel('Email',{exact:true}).fill(email);
 const invited=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/settings/operators/invite'&&response.request().method()==='POST');
 await operators.getByRole('button',{name:'Send invitation',exact:true}).click();
 const response=await invited;assert.equal(response.status(),202);assert.equal(await response.finished(),null);
 const link=await readDevelopmentLink(base,context.request,email,state);
 await beforePrivateNavigation(page,link);await page.goto(link);await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.waitForURL(base+'/app');await settleReads(page);
 try{await journey()}finally{
  await beforePrivateNavigation(page,base+'/');await page.goto(base+'/');await page.waitForLoadState('networkidle');
  await context.clearCookies();await context.addCookies(original);
 }
}
