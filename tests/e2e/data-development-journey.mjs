import assert from 'node:assert/strict';
/** Exercise lazy mapping controls through the development server's public door. */
export async function reviewDevelopmentImport(page,base){
 const panel=page.locator('#data');await panel.getByRole('heading',{name:'Data / Move in',exact:true}).waitFor();
 const response=await page.request.get(base+'/api/data/import/options');assert.equal(response.status(),200);const options=await response.json(),team=options.references.teams.find(row=>!row.archived_at),status=options.references.statuses.find(row=>row.team_id===team.id&&row.category==='unstarted');assert(team&&status);
 const before=await(await page.request.get(base+'/api/data/import/runs')).json();
 await panel.getByLabel('File format',{exact:true}).selectOption('json');await panel.getByLabel('Import source name',{exact:true}).fill('development-mapping');
 await panel.getByLabel('Issue export file',{exact:true}).setInputFiles({name:'development.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([{sourceId:'development-record',title:'Development preflight',team:team.name}]))});
 await panel.getByLabel('Default status',{exact:true}).selectOption(status.id);
 const reviewed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/data/import/preview'&&r.request().method()==='POST');await panel.getByRole('button',{name:'Preview import',exact:true}).click();const result=await reviewed;assert.equal(result.status(),200);assert.equal((await result.json()).ready,true);
 assert.deepEqual(await(await page.request.get(base+'/api/data/import/runs')).json(),before,'Development preflight creates no durable import run');
}
