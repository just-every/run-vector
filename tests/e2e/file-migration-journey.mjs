import assert from 'node:assert/strict';
import { join } from 'node:path';

/** The public file form creates both reviewed runs; the final file is absent. */
export async function exerciseFileMigration({page,runtime,team,status,width,evidence}) {
  await page.setViewportSize({width,height:1000});
  await page.goto(runtime.base+'/app/settings/move-in');
  const panel=page.locator('#data'),migrations=panel.locator('.file-migrations'),source='synthetic-vector-files-'+width;
  await migrations.getByLabel('Source workspace name',{exact:true}).fill(source);
  const creation=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/data/migrations'&&response.request().method()==='POST');
  await migrations.getByRole('button',{name:'Start file migration',exact:true}).click();
  const created=await creation;assert.equal(created.status(),200);const migration=await created.json();
  await page.waitForFunction(id=>document.querySelector('[aria-label="Migration for this file"]')?.value===id,migration.id);
  assert.equal(await panel.getByLabel('Import source name',{exact:true}).inputValue(),source);
  assert.equal(await panel.getByLabel('Import source name',{exact:true}).evaluate(element=>element.readOnly),true);
  await panel.getByLabel('File format',{exact:true}).selectOption('json');
  const expected=[];
  for(const suffix of ['one','two']) {
    const sourceId='synthetic-vector-'+width+'-'+suffix,targetSourceId='synthetic-vector-missing-'+width+'-'+suffix;
    const rows=[{sourceId,title:'File migration '+suffix,team:team.name,status:status.name,dependencies:'source:'+targetSourceId}];
    await panel.getByLabel('Issue export file',{exact:true}).setInputFiles({name:suffix+'.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(rows))});
    const previewResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/data/import/preview'&&response.request().method()==='POST');
    await panel.getByRole('button',{name:'Preview import',exact:true}).click();
    const response=await previewResponse;assert.equal(response.status(),200);const preview=await response.json();assert.equal(preview.ready,true);assert.deepEqual(preview.pending,[{row:1,sourceId,targetSourceId,kind:'dependencies'}]);
    await panel.getByRole('heading',{name:'Pending migration relations',exact:true}).waitFor();
    await panel.getByText(sourceId+' → '+targetSourceId+' · dependencies · row 1',{exact:true}).waitFor();
    if(suffix==='one') {
      await panel.locator('form .import-file-fields').screenshot({path:join(evidence,'file-migration-file-'+width+'.png')});
      await panel.locator('[aria-labelledby="import-review-heading"]').screenshot({path:join(evidence,'file-migration-review-'+width+'.png')});
    }
    const appliedResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/data/import/apply'&&response.request().method()==='POST');
    await panel.getByRole('button',{name:'Apply reviewed run',exact:true}).click();
    const applied=await appliedResponse;assert.equal(applied.status(),200);const run=await applied.json();
    await page.waitForFunction(()=>!document.querySelector('#data input[type="file"]')?.disabled);
    await migrations.getByText(new RegExp(suffix==='one'?'1 reviewed runs':'2 reviewed runs')).waitFor();
    await migrations.getByRole('button',{name:'Finish migration',exact:true}).waitFor();
    expected.push({sourceId,targetSourceId,runId:run.id});
  }
  await migrations.getByRole('button',{name:'Refresh migration report',exact:true}).click();
  await migrations.getByRole('heading',{name:'Pending relations (2)',exact:true}).waitFor();
  const report=await page.request.get(runtime.base+'/api/data/migrations/'+migration.id);assert.equal(report.status(),200);const current=await report.json();
  assert.deepEqual(current.pending.map(({sourceId,targetSourceId,runId})=>({sourceId,targetSourceId,runId})).sort((a,b)=>a.sourceId.localeCompare(b.sourceId)),expected);
  assert.deepEqual(current.totals,{rowsRead:2,issuesWritten:2});
  assert.equal(await migrations.getByRole('button',{name:'Finish migration',exact:true}).isDisabled(),true);
  const downloadReady=page.waitForEvent('download');await migrations.getByRole('button',{name:'Download migration CSV',exact:true}).click();const download=await downloadReady;await download.saveAs(join(evidence,'file-migration-'+width+'.csv'));
  await migrations.scrollIntoViewIfNeeded();await migrations.screenshot({path:join(evidence,'file-migration-pending-'+width+'.png')});
  const consent=migrations.getByLabel('I accept this current list of 2 pending relations as omissions.',{exact:true});await consent.check();
  const finishing=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/data/migrations/'+migration.id+'/finish'&&response.request().method()==='POST');
  await migrations.getByRole('button',{name:'Finish migration',exact:true}).click();const finished=await finishing;assert.equal(finished.status(),200);const terminal=await finished.json();assert.equal(terminal.migration.state,'finished');assert.equal(terminal.pending.length,0);assert.equal(terminal.omissions.length,2);
  await migrations.getByRole('heading',{name:'Accepted omissions (2)',exact:true}).waitFor();assert.equal(await migrations.getByRole('button',{name:'Finish migration',exact:true}).count(),0);
  await page.reload();await migrations.getByLabel('Migration for this file',{exact:true}).selectOption(migration.id);
  await migrations.getByRole('heading',{name:'Accepted omissions (2)',exact:true}).waitFor();
  for(const row of expected)await migrations.getByText(row.sourceId+' → '+row.targetSourceId,{exact:true}).waitFor();
  assert.equal(await migrations.getByRole('heading',{name:'Pending relations (0)',exact:true}).count(),1);
  await migrations.scrollIntoViewIfNeeded();await migrations.screenshot({path:join(evidence,'file-migration-finished-'+width+'.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'The migration fits the viewport');
  const small=await migrations.locator('*').evaluateAll(elements=>elements.filter(element=>element.textContent?.trim()&&element.getClientRects().length&&parseFloat(getComputedStyle(element).fontSize)<13).map(element=>element.tagName));assert.deepEqual(small,[]);
  // Leave the existing standalone journeys on their ordinary import path.
  await migrations.getByLabel('Migration for this file',{exact:true}).selectOption('');
  return {migrationId:migration.id,pending:expected,finished:true};
}
