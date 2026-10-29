import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

// Independent CSV decoding: quoted commas, quotes and newlines stay in one cell.
function csvRows(text) {
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<text.length;i++) {
  const char=text[i];
  if(char==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&(char===','||char==='\n')){row.push(value.replace(/\r$/,''));value='';if(char==='\n'){rows.push(row);row=[];}}
  else value+=char;
 }
 assert.equal(quoted,false);assert.equal(value,'');assert.deepEqual(row,[]);return rows;
}

export async function verifyReconciliationDoors({page,section,report,fixture,terminalReport}) {
 assert.deepEqual(await terminalReport(report.run.id),report,'Settings and terminal return the same report');
 const downloaded=page.waitForEvent('download');
 await section.getByRole('button',{name:'Download report CSV (source ID to Vector identifier)',exact:true}).click();
 const download=await downloaded;assert.equal(await download.failure(),null);
 const csv=await readFile(await download.path(),'utf8');
 assert.equal(csv,terminalReport.csv,'Settings and terminal download the same CSV');
 const [headers,...rows]=csvRows(csv),column=name=>headers.indexOf(name);
 assert.equal(rows.length,fixture.expected.issueCount);
 assert.deepEqual(rows.map(row=>row[column('source_id')]),fixture.expected.sourceIds);
 assert.equal(rows.filter(row=>row[column('written')]==='yes').length,report.totals.issuesWritten);
 assert.equal(rows.filter(row=>row[column('written')]==='no').length,report.totals.rowsNotWritten);
 for(const mapping of report.mapping) {
  const row=rows.find(row=>row[column('source_id')]===mapping.sourceId);
  assert.equal(row[column('source_row')],String(mapping.row));
  assert.equal(row[column('vector_identifier')],mapping.identifier??'');
 }
 const body=await section.innerText();
 assert(body.includes(report.totals.rowsRead+' source rows'));
 assert(body.includes(report.totals.issuesWritten+' Vector issues'));
 const names={team:'Team',status:'Status',project:'Project',cycle:'Cycle',assignee:'Assignee'};
 for(const [field,name] of Object.entries(names)) {
  const table=section.getByRole('table',{name:name+': read and written',exact:true});
  assert.equal(await table.locator('tbody > tr').count(),report.dimensions[field].length);
  assert.equal(report.dimensions[field].reduce((n,g)=>n+g.read,0),fixture.expected.issueCount);
  assert.equal(report.dimensions[field].reduce((n,g)=>n+g.written,0),report.totals.issuesWritten);
 }
 assert(report.omitted.length>0&&report.references.length>0&&report.notInFile.length>0);
 for(const group of report.omitted) {
  assert.equal(group.count,group.rows.length);assert(body.includes(group.message));
  assert(body.includes('· '+group.count+' (row '),'Each omission count is visible');
  for(const row of group.rows)assert(rows.find(record=>record[column('source_row')]===String(row))[column('not_imported_fields')].includes(group.field??group.code));
 }
 for(const reference of report.references) {
  assert(body.includes(reference.value),reference.code+' value is visible');
  assert(body.includes('Row '+reference.row),reference.code+' source row is visible');
 }
 assert(report.references.some(row=>row.code==='jira_reference_outside_file'),'The ignored external relation is reported');
 let physicalRow=2;
 const sourceRows=new Map();
 for(const row of fixture.rows) {
  sourceRows.set(row[0],physicalRow);
  physicalRow+=1+row.reduce((n,value)=>n+(value.match(/\n|\r(?!\n)/g)?.length??0),0);
 }
 assert.deepEqual(report.references.filter(row=>row.code==='jira_reference_outside_file').map(({row,sourceId,value})=>({row,sourceId,value})),
  fixture.expected.relations.externalLinks.map(({sourceIssueId,targetKey})=>({row:sourceRows.get(sourceIssueId),sourceId:sourceIssueId,value:targetKey})),
  'The ignored reference names its actual physical CSV row and source issue');
 assert(report.references.some(row=>row.code==='unresolved_assignee'),'The unmapped person is reported');
 const plugin=fixture.headers.indexOf('Plugin Rollout Tag');
 const pluginRows=fixture.rows.filter(row=>row[plugin].trim()).length;
 assert.equal(report.omitted.filter(group=>group.field==='Plugin Rollout Tag [column '+(plugin+1)+']').reduce((n,g)=>n+g.count,0),pluginRows);
 for(const absent of report.notInFile)assert(body.includes(absent));
 assert(report.notInFile.some(value=>value.includes('attachment file bytes')));
 return {state:report.run.state,totals:report.totals,csvRows:rows.length,omissions:report.omitted.length,references:report.references.length};
}

export async function verifyImportedLookup({page,runtime,fixture,report,directory,proof}) {
 const sourceId=fixture.expected.sourceIds[0],sourceKey=fixture.expected.sourceKeys[0];
 const mapping=report.mapping.find(row=>row.sourceId===sourceId);assert(mapping?.identifier);
 await page.setViewportSize({width:1440,height:900});
 const response=await page.request.get(runtime.base+'/api/search?q='+encodeURIComponent(sourceId));assert.equal(response.status(),200);
 const result=await response.json();assert(result.issues.some(issue=>issue.identifier===mapping.identifier));
 await page.goto(runtime.base+'/app/search');
 await page.getByRole('searchbox',{name:'Search workspace',exact:true}).fill(sourceId);
 const link=page.getByRole('link').filter({hasText:mapping.identifier}).first();await link.waitFor();await link.click();
 await page.getByText('Imported from '+sourceKey+' · source ID '+sourceId+' (jira-public-300)',{exact:false}).waitFor();
 for(const width of proof.captureWidths) {
  await page.setViewportSize({width,height:900});
  await page.screenshot({path:join(directory,'imported-source-'+width+'.png')});
 }
 proof.lookup={sourceId,sourceKey,identifier:mapping.identifier,searchFound:true,issueShowsSource:true};
}
