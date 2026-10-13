import assert from 'node:assert/strict';
import {assertControls} from './ui-controls-checks.mjs';
import {observeImportBatches} from './data-progress-checks.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function exerciseDataMapping({page,runtime,team,status,width,evidence,baselineEvidence=false}){
 await page.setViewportSize({width,height:900});const panel=page.locator('#data');const observer=await observeImportBatches(page,panel,{width,evidence,baselineEvidence});
 try { await page.goto(runtime.base+'/app/settings');await observer.staleReady;await panel.getByRole('heading',{name:'Data / Move in',exact:true}).waitFor();
 await panel.getByLabel('File format',{exact:true}).selectOption('json');await panel.getByLabel('Stable source name',{exact:true}).fill('ui-mapped-'+width);
 const choose=rows=>panel.getByLabel('Issue export file',{exact:true}).setInputFiles({name:'mapped.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(rows))});
 const map=async()=>{await panel.getByLabel('Source record ID column',{exact:true}).selectOption('key');await panel.getByLabel('Title column',{exact:true}).selectOption('headline');await panel.getByLabel('Team column',{exact:true}).selectOption('organisation');await panel.getByLabel('Default status',{exact:true}).selectOption(status.id);};
 const review=async()=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/data/import/preview'&&r.request().method()==='POST');await panel.getByRole('button',{name:'Preview import',exact:true}).click();const result=await response;assert.equal(result.status(),200);return result.json();};
 const before=runtime.sql('SELECT count(*) AS n FROM issues')[0].n;
 await choose([{key:'bad-one',headline:'',organisation:team.name},{key:'bad-two',headline:'Invalid target',organisation:'Unknown team'}]);await map();const invalid=await review();assert.equal(invalid.ready,false);assert.deepEqual([...new Set(invalid.errors.map(row=>row.row))],[1,2]);assert.equal(runtime.sql('SELECT count(*) AS n FROM issues')[0].n,before);assert.equal(await panel.getByRole('button',{name:'Apply reviewed run',exact:true}).isDisabled(),true);
 await capture('mapping-errors');
 const rows=Array.from({length:80},(_,index)=>({key:'good-'+width+'-'+index,headline:'Mapped UI '+width+' '+index,organisation:team.name,retainedOnly:'Unsupported source column'}));
 await choose(rows);await map();const valid=await review();assert.equal(valid.ready,true);assert(valid.omissions.length>0);assert.equal(await panel.getByRole('button',{name:'Apply reviewed run',exact:true}).isDisabled(),true);
 await capture('mapping-review');
 await panel.getByLabel('I reviewed these omissions.',{exact:true}).check();
 const applied=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/data/import/apply'&&r.request().method()==='POST');await panel.getByRole('button',{name:'Apply reviewed run',exact:true}).click();const result=await applied;assert.equal(result.status(),200);
 const {run,snapshots}=await observer.finish(await result.json());assert.equal(run.state,'completed');assert.equal(run.progress.batchesApplied,run.progress.batchesTotal);
 await writeFile(join(evidence,'batch-progress-'+width+'.json'),JSON.stringify(snapshots,null,2)+'\n');
 await panel.getByText(run.id,{exact:true}).waitFor();await page.reload();await panel.getByText(run.id,{exact:true}).waitFor();assert.equal(runtime.sql('SELECT count(*) AS n FROM issues')[0].n,before+rows.length);
 await capture('mapped');
 } finally {await observer.close();}
 async function capture(state){
  await page.addScriptTag({content:await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')});const violations=await page.evaluate(async()=>{const result=await axe.run(document.querySelector('#data'));return result.violations.filter(row=>['serious','critical'].includes(row.impact)).map(row=>row.id)});assert.deepEqual(violations,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await assertControls(page,'Mapped import '+width+' '+state);await panel.screenshot({path:join(evidence,state+'-'+width+'.png')});
 }
}
