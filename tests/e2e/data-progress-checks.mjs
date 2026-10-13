import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';

/** Hold only real network receipts. The next resume request gives a stable
 * observation boundary for each published batch, without slowing application code. */
export async function observeImportBatches(page,panel,{width,evidence,baselineEvidence=false}) {
 const waiting=[], readers=[],active=new Set();
 let releaseList, staleRead,finishStale,releaseAdvanced,firstList=true;
 const staleFinished=new Promise(resolve=>{finishStale=resolve;});
 const staleReady=new Promise(resolve=>{staleRead=resolve;});
 const advancedGate=new Promise(resolve=>{releaseAdvanced=resolve;});
 const listGate=new Promise(resolve=>{releaseList=resolve;});
 const listHandler=async route=>{
  const initial=firstList;firstList=false;const response=await route.fetch();
  if(initial){staleRead();await listGate;}
  else if((await response.json()).runs.some(run=>run.namespace==='vector-import:ui-mapped-'+width&&run.checkpoint>0))await advancedGate;
  // The application may abort this stale read when a receipt replaces it.
  try{await route.fulfill({response});}catch(error){if(!/cancel|closed|abort|Invalid Interception/i.test(String(error)))throw error;}finally{if(initial)finishStale();}
 };
 await page.route('**/api/data/import/runs',listHandler);
 const resumeHandler=async route=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const next={route,release};active.add(next);const reader=readers.shift();if(reader)reader(next);else waiting.push(next);
  await gate;active.delete(next);
 };
 await page.route('**/api/data/import/runs/*/resume',resumeHandler);
 const take=()=>waiting.length?Promise.resolve(waiting.shift()):new Promise(resolve=>readers.push(resolve));
 const snapshots=[];
 const rowFor=run=>panel.locator('.import-runs > li').filter({has:page.getByText(run.id,{exact:true})});
 // Frame the receipt and the retained row in the real viewport. Reserve the
 // sticky settings links and fixed mobile navigation without changing the UI.
 const captureProgress=async(state,run)=>{
  await panel.evaluate((element,runId)=>{
   const status=element.querySelector('[role="status"]');
   const row=[...element.querySelectorAll('.import-runs > li')].find(item=>item.querySelector('code')?.textContent===runId);
   const line=row?.querySelector(':scope > p');
   const targets=[status,row,line].filter(Boolean).map(target=>target.getBoundingClientRect());
   if(targets.length){
    const settings=document.querySelector('.settings-sections');
    const mobile=document.querySelector('.app-mobile-nav');
    const settingsStyle=settings&&getComputedStyle(settings);
    const top=settings?.getClientRects().length&&settingsStyle.position==='sticky'?settings.getBoundingClientRect().height+(parseFloat(settingsStyle.top)||0):0;
    const bottom=mobile?.getClientRects().length&&getComputedStyle(mobile).position==='fixed'?mobile.getBoundingClientRect().top:innerHeight;
    const start=Math.min(...targets.map(rect=>rect.top));
    // The row's namespace, ID and progress line are the evidence target;
    // controls below that line can stay below the viewport on narrow screens.
    const end=Math.max(status?.getBoundingClientRect().bottom??start,line?.getBoundingClientRect().bottom??start);
    scrollTo({top:scrollY+start-top-Math.max(0,(bottom-top-(end-start))/2),behavior:'instant'});
   }
  },run.id);
  await page.screenshot({path:join(evidence,`${state}-${width}.png`)});
 };
 const check=async(run,{stopped=false}={})=>{
  const row=rowFor(run),status=panel.getByRole('status');
  const batches=new RegExp(`applied ${run.progress.batchesApplied} of ${run.progress.batchesTotal} batches`,'i');
  const records=new RegExp(`${run.checkpoint} of ${run.total} source records`);
  try{
   // The evidence-only baseline predates this attribute; its visible progress
   // and row still undergo exactly the same receipt checks. CI stays strict.
   if(!baselineEvidence)await expect(status).toHaveAttribute('data-run-id',run.id);
   await expect(status).toContainText(batches);await expect(status).toContainText(records);
   if(stopped)await expect(status).toContainText(/stopped/i);else await expect(status).not.toContainText(/stopped|unfinished/i);
   await expect(row).toHaveCount(1);
   const line=row.locator(':scope > p');
   if(run.state==='completed')await expect(line).toContainText(new RegExp(`Completed.*${run.total} source records`));
   else {await expect(line).toContainText(batches);await expect(line).toContainText(records);}
   snapshots.push({state:run.state,stopped,checkpoint:run.checkpoint,total:run.total,batchesApplied:run.progress.batchesApplied,batchesTotal:run.progress.batchesTotal,row:await line.textContent(),progress:await status.textContent()});
  }catch(error){
   const line=row.locator(':scope > p');
   const snapshot={state:run.state,checkpoint:run.checkpoint,total:run.total,batchesApplied:run.progress.batchesApplied,batchesTotal:run.progress.batchesTotal,row:await line.count()===1?await line.textContent():null,progress:await status.count()===1?await status.textContent():null};
   await captureProgress('progress-mismatch',run);
   await writeFile(join(evidence,`progress-mismatch-${width}.json`),JSON.stringify(snapshot,null,2)+'\n');
   error.importProgressSnapshot=snapshot;throw error;
  }
 };
 return {
  staleReady,
  async finish(created) {
   let current=created,interrupted=false,resumed=false;
   while(current.progress.unfinished){
    const next=await take();await check(current,{stopped:interrupted&&!resumed});
    if(!interrupted&&current.progress.batchesApplied>0){
     releaseList();await staleFinished;await captureProgress('mid-apply',current);await check(current);
     // Interrupt transport before it reaches the Worker; every published batch
     // still comes from a real public request and its unchanged response.
     await next.route.abort('failed');next.release();
     const resume=rowFor(current).getByRole('button',{name:'Read / resume',exact:true});
     await expect(resume).toBeEnabled();await check(current,{stopped:true});
     await captureProgress('interrupted',current);
     interrupted=true;await resume.click();continue;
    }
    const response=await next.route.fetch();assert.equal(response.status(),200);current=await response.json();await next.route.fulfill({response});next.release();if(interrupted)resumed=true;
   }
   await check(current);assert(interrupted&&resumed,'Journey must resume an interrupted apply');
   // Repeated checks around interruption keep the same receipt; every new
   // receipt, including completion, must cover the run's actual batch sequence.
   const observedBatches=snapshots.map(snapshot=>snapshot.batchesApplied).filter((batch,index,batches)=>index===0||batch!==batches[index-1]);
   assert.deepEqual(observedBatches,Array.from({length:current.progress.batchesTotal+1},(_,batch)=>batch),'Journey must observe every batch receipt in order');
   await captureProgress('completed',current);releaseAdvanced();
   return {run:current,snapshots};
  },
  async close(){releaseList();releaseAdvanced();for(const next of active){await next.route.abort().catch(()=>{});next.release();}await page.unroute('**/api/data/import/runs/*/resume',resumeHandler);await page.unroute('**/api/data/import/runs',listHandler);},
 };
}
