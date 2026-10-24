import {calendarAccessCells} from './calendar-access-cells.mjs';
import {calendarMonthJourney} from './calendar-month-journey.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {beforePrivateNavigation} from './collaboration-navigation.mjs';
const require=createRequire(import.meta.url),axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
export async function calendarFeedsJourney(page,context,runtime,output) {
 const base=runtime.base,errors=[];
 const consoleError=m=>{if(/hydrat|did not match|Minified React error #(418|423|425)/i.test(m.text()))errors.push(m.text());};
 const pageError=e=>errors.push(e.message);page.on('console',consoleError);page.on('pageerror',pageError);
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
 const api=async(path,method='GET',data)=>{const r=await context.request.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});assert(r.ok(),method+' '+path+' '+r.status());return r.json();};
 for(const theme of ['light','dark'])for(const width of [1440,390]) {
  await api('/settings/appearance','PATCH',{theme});await page.setViewportSize({width,height:width===390?844:1000});
  await beforePrivateNavigation(page,base+'/app/calendar');assert.equal((await page.goto(base+'/app/calendar')).status(),200);
  await page.locator('[data-calendar-ready="true"]').waitFor();
  await page.getByRole('button',{name:'Create feed',exact:true}).click();
  const field=page.getByRole('textbox',{name:'New feed URL',exact:true});await field.waitFor();const original=await field.inputValue();
  const anonymous=await context.browser().newContext();
  try {
   const feed=await anonymous.request.get(original);assert.equal(feed.status(),200);assert.equal(feed.headers()['cache-control'],'no-store');assert.equal(feed.headers()['set-cookie'],undefined);
   assert.match(await feed.text(),/BEGIN:VCALENDAR/);
   await page.getByRole('button',{name:'Copy URL',exact:true}).click();await page.getByText('Feed URL copied.',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),original);
   await page.getByRole('button',{name:'I saved it; close',exact:true}).click();await field.waitFor({state:'detached'});
   const record=page.locator('.calendar-feed-record').filter({has:page.getByRole('button',{name:'Rotate URL',exact:true})}).first();
   await record.getByRole('button',{name:'Rotate URL',exact:true}).click();await field.waitFor();const rotated=await field.inputValue();assert(original!==rotated);
   assert.equal((await anonymous.request.get(original)).status(),404);assert.equal((await anonymous.request.get(rotated)).status(),200);
   await page.getByRole('button',{name:'I saved it; close',exact:true}).click();await field.waitFor({state:'detached'});
   await page.locator('[data-calendar-ready="true"]').waitFor();
   await record.getByRole('button',{name:'Revoke feed',exact:true}).click();await page.getByText('Feed revoked. Its old URL no longer works.',{exact:true}).waitFor();
   assert.equal((await anonymous.request.get(rotated)).status(),404);
  } finally {await anonymous.close();}
  await page.locator('[data-calendar-ready="true"]').waitFor();
  await page.evaluate(source=>{if(window.axe)return;const s=document.createElement('script');const nonce=document.querySelector('script[nonce]')?.nonce;if(nonce)s.nonce=nonce;s.textContent=source;document.head.append(s);},axe);
  const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[],`${theme} ${width} calendar accessibility`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('heading',{name:'Calendar',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/calendar-feeds-${theme}-${width}.png`,fullPage:true});
  console.log(`CAL-001 ${theme} ${width}: create, copy, rotate, revoke, anonymous response, axe and overflow PASS`);
 }
 assert.deepEqual(errors,[],'no calendar hydration mismatch or page errors');page.off('console',consoleError);page.off('pageerror',pageError);
 await api('/settings/appearance','PATCH',{theme:'system'});
 await calendarMonthJourney(page,context,runtime,output);
 await calendarAccessCells(page,context,runtime,output);
}
