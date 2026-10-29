import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect} from '@playwright/test';

async function assertControls(page) {
 const controls=await page.locator('#data button:visible, #data input:visible, #data select:visible').all();
 for(const control of controls)await expect(control).toHaveAccessibleName(/\S/);
 return controls;
}

async function checkMobileReviewTables({page,panel,directory,name}) {
 const checks=[];
 for(const region of await panel.getByRole('region',{name:/table, scroll horizontally to see all columns$/}).all()) {
  const label=await region.getAttribute('aria-label');
  await region.scrollIntoViewIfNeeded();await region.focus();
  assert.equal(await region.evaluate(element=>document.activeElement===element),true,label+' keyboard focus');
  const start=await region.evaluate(element=>({left:element.scrollLeft,width:element.clientWidth,content:element.scrollWidth}));
  assert(start.content>start.width,label+' retains a readable scrollable table');
  // Tab reaches the actual far-column select or source-details disclosure.
  // Read-only report tables instead use the region's native arrow scrolling.
  const control=region.locator('select,summary').first();
  if(await control.count()) {
   await page.keyboard.press('Tab');
   assert.equal(await control.evaluate(element=>document.activeElement===element),true,label+' far-column control is in tab order');
   const visible=await control.evaluate(element=>{
    const box=element.getBoundingClientRect(),region=element.closest('[role="region"]').getBoundingClientRect();
    return box.left>=region.left&&box.right<=region.right;
   });
   assert.equal(visible,true,label+' focused control is visible');
  } else {
   for(let step=0;step<100;step++) {
    const edge=await region.evaluate(element=>element.scrollLeft+element.clientWidth>=element.scrollWidth-1);
    if(edge)break;
    await region.press('ArrowRight',{delay:25});
   }
   await page.waitForFunction(element=>element.scrollLeft+element.clientWidth>=element.scrollWidth-1,await region.elementHandle());
  }
  const far=await region.evaluate(element=>element.scrollLeft);
  assert(far>0,label+' can reach far columns');
  const file=name+'-'+(label.startsWith('Status')?'statuses':label.startsWith('Priority')?'priorities':'concepts')+'-far-columns.png';
  await region.screenshot({path:join(directory,file)});
  await region.focus();
  for(let step=0;step<100;step++) {
   if(await region.evaluate(element=>element.scrollLeft===0))break;
   await region.press('ArrowLeft',{delay:25});
  }
  await page.waitForFunction(element=>element.scrollLeft===0,await region.elementHandle());
  checks.push({label,start,far,returnedTo:await region.evaluate(element=>element.scrollLeft),capture:file});
 }
 return checks;
}

export async function captureJiraState({page,panel,directory,state,proof,focus=panel}) {
 // Close the native disclosure controls so 300 raw rows stay available without
 // making an unbounded open-detail screenshot. No DOM or stylesheet mutation.
 for(const summary of await panel.locator('details[open] > summary').all())await summary.click();
 for(const width of proof.captureWidths??[1440,390]) {
  await page.setViewportSize({width,height:900});
  const name=state+'-'+width;
  const mobileTables=width===390?await checkMobileReviewTables({page,panel:focus,directory,name}):[];
  if(width===390&&state!=='jira-choice')assert.equal(mobileTables.length,3,name+' status, priority and concept scroll regions');
  await focus.scrollIntoViewIfNeeded();
  if(!await page.evaluate(()=>typeof axe!=='undefined')) {
   await page.addScriptTag({content:await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')});
  }
  const violations=await page.evaluate(async()=>{
   const result=await axe.run(document.querySelector('#data'));
   return result.violations.filter(row=>['serious','critical'].includes(row.impact)).map(({id,impact,nodes})=>({id,impact,targets:nodes.map(node=>node.target)}));
  });
  const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  const record={state,width,violations,overflow,mobileTables,panel:name+'-panel.png',viewport:name+'-viewport.png'};
  proof.captures.push(record);
  // Retain actual visible evidence even when a product check fails.
  await panel.screenshot({path:join(directory,record.panel)});
  if(focus!==panel){record.focus=name+'-focus.png';await focus.screenshot({path:join(directory,record.focus)});}
  // Tall reviews can already cover the viewport while their heading is far
  // above it. Frame the state after element screenshots finish their scrolling.
  await focus.getByRole('heading').first().evaluate(element=>element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  await page.screenshot({path:join(directory,record.viewport)});
  assert.deepEqual(violations,[],name+' serious/critical accessibility violations');
  assert(overflow.document<=width&&overflow.body<=width,name+' horizontal overflow: '+JSON.stringify(overflow));
  record.controls=(await assertControls(page,'Jira '+name)).length;
 }
}
