import assert from 'node:assert/strict';

export function tableCounts(runtime) {
 const tables=runtime.sql("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(row=>row.name);
 const quote=name=>'"'+name.replaceAll('"','""')+'"';
 return Object.fromEntries(runtime.sql(tables.map(name=>`SELECT '${name.replaceAll("'","''")}' AS name,count(*) AS n FROM ${quote(name)}`).join(' UNION ALL ')).map(row=>[row.name,row.n]));
}

/** Independently count physical CSV cells, including repeated columns. */
export function expectedConcepts(fixture) {
 const groups=new Map();
 let line=2;
 const physicalRows=fixture.rows.map(row=>{
  const start=line;
  line+=1+row.reduce((n,value)=>n+(value.match(/\n|\r(?!\n)/g)?.length??0),0);
  return start;
 });
 fixture.headers.forEach((header,index)=>{
  const name=header.trim().toLowerCase(),group=groups.get(name)??{headers:[],rows:new Set(),values:0,occurrences:new Map()};
  group.headers.push({name:header,column:index+1});
  fixture.rows.forEach((row,offset)=>{if(row[index]?.trim()){
   group.rows.add(physicalRows[offset]);group.values++;
   group.occurrences.set(physicalRows[offset]+':'+(index+1),{value:row[index],sourceId:row[0],sourceKey:row[1]});
  }});
  groups.set(name,group);
 });
 return groups;
}

export async function verifyJiraReview(panel, preview, fixture) {
 assert.equal(preview.count,fixture.expected.issueCount);
 assert(preview.jiraReview,'Jira loss review must be returned');
 const expected=expectedConcepts(fixture),actual=preview.jiraReview.concepts;
 assert.equal(actual.length,expected.size);
 const table=panel.getByRole('table',{name:'Every present concept — distinct physical rows and nonempty values',exact:true});
 assert.equal(await table.locator('tbody > tr').count(),expected.size);
 for(const concept of actual) {
  const wanted=expected.get(concept.name);assert(wanted,'Unknown concept '+concept.name);
  assert.deepEqual(concept.headers,wanted.headers);
  assert.equal(concept.rowCount,wanted.rows.size,concept.name+' physical rows');
  assert.equal(concept.valueCount,wanted.values,concept.name+' occurrences');
  assert.equal(concept.occurrences.length,wanted.values);
  assert.deepEqual(concept.rows,[...wanted.rows].sort((a,b)=>a-b),concept.name+' physical starting lines');
  const locations=new Set();
  for(const occurrence of concept.occurrences) {
   const location=occurrence.row+':'+occurrence.column;locations.add(location);
   const cell=wanted.occurrences.get(location);assert(cell,concept.name+' cell '+location);
   assert.equal(occurrence.value,cell.value);
   assert.equal(occurrence.sourceId,cell.sourceId);
   assert.equal(occurrence.sourceKey,cell.sourceKey);
  }
  assert.equal(locations.size,wanted.values,concept.name+' every physical cell once');
  assert.equal(concept.values.reduce((n,row)=>n+row.count,0),wanted.values);
  assert.equal(concept.dispositions.reduce((n,row)=>n+row.valueCount,0),wanted.values);
  const row=table.locator('tbody > tr').filter({hasText:concept.headers.map(h=>`${h.name} [column ${h.column}]`).join(', ')});
  assert.equal(await row.count(),1);
  assert.equal(await row.locator('td').nth(2).innerText(),String(wanted.rows.size));
  assert.equal(await row.locator('td').nth(3).innerText(),String(wanted.values));
 }
 for(const kind of ['statuses','priorities']) {
  for(const item of preview.jiraReview[kind]) {
   const counts=kind==='statuses'?fixture.expected.statuses.counts:fixture.expected.priorities.counts;
   assert.equal(item.rows.length,counts[item.source],kind+' '+item.source+' row count');
   const mapping=panel.getByLabel('Confirm '+kind+' '+item.source,{exact:true});
   assert.equal(await mapping.inputValue(),item.target??'');
  }
 }
 return actual.map(({name,rowCount,valueCount,headers})=>({name,rowCount,valueCount,headers}));
}

export async function verifyReport(panel, report, fixture) {
 assert.equal(report.run.state,'completed');
 assert.equal(report.totals.rowsRead,fixture.expected.issueCount);
 assert.equal(report.totals.issuesWritten,fixture.expected.issueCount);
 assert.equal(report.totals.rowsNotWritten,0);
 assert.equal(report.mapping.length,fixture.expected.issueCount);
 assert(report.mapping.every(row=>row.identifier));
 assert.deepEqual(report.mapping.map(row=>row.sourceId),fixture.expected.sourceIds);
 assert.equal(new Set(report.mapping.map(row=>row.identifier)).size,fixture.expected.issueCount);
 const expectedEffects={labels:173,parents:5,dependencies:2,related:1,duplicates:2,comments:102,links:2,files:0};
 const effects=panel.getByRole('table',{name:'Planned changes and current Vector records',exact:true});
 assert.equal(await effects.locator('tbody > tr').count(),Object.keys(expectedEffects).length);
 for(const [name,count] of Object.entries(expectedEffects)) {
  assert.deepEqual(report.effects.counts[name],{planned:count,written:count},name+' native effects');
  // A `has` locator is evaluated within each row. It must not contain the
  // report's ancestor selector, which cannot occur inside one of its own rows.
  const row=effects.locator('tbody > tr').filter({has:panel.page().getByRole('cell',{name,exact:true})});
  assert.equal(await row.count(),1,name+' effect row');
  const cells=row.locator('td');
  assert.equal(await cells.nth(1).innerText(),String(count));
  assert.equal(await cells.nth(2).innerText(),String(count));
 }
 const labelColumns=fixture.headers.flatMap((name,index)=>name.toLowerCase()==='labels'?[index]:[]);
 const typeColumn=fixture.headers.indexOf('Issue Type'),labelCounts={};
 for(const source of fixture.rows) {
  const names=new Set(labelColumns.map(index=>source[index].trim()).filter(Boolean));
  if(source[typeColumn].trim().toLowerCase()==='epic')names.add('epic');
  for(const name of names)labelCounts[name]=(labelCounts[name]??0)+1;
 }
 assert.deepEqual(Object.fromEntries(report.effects.labels.map(row=>[row.name,{planned:row.planned,written:row.written}])),Object.fromEntries(Object.entries(labelCounts).map(([name,count])=>[name,{planned:count,written:count}])));
 const labels=panel.getByRole('table',{name:'Label assignments',exact:true});
 assert.equal(await labels.locator('tbody > tr').count(),Object.keys(labelCounts).length);
 for(const [name,count] of Object.entries(labelCounts)) {
  const row=labels.locator('tbody > tr').filter({has:panel.page().getByRole('cell',{name,exact:true})});
  assert.equal(await row.count(),1,name+' label row');
  const cells=row.locator('td');
  assert.equal(await cells.nth(1).innerText(),String(count));
  assert.equal(await cells.nth(2).innerText(),String(count));
 }
 assert.deepEqual(Object.fromEntries(report.dimensions.status.map(row=>[row.source,row.written])),fixture.expected.statuses.counts);
 const cycles=report.dimensions.cycle.flatMap(row=>row.vector).filter(row=>row.name!=='(none)').reduce((n,row)=>n+row.count,0);
 assert.equal(cycles,125,'Native cycle commitments');
 const names={team:'Team',status:'Status',project:'Project',cycle:'Cycle',assignee:'Assignee'};
 for(const [field,name] of Object.entries(names)) {
  const table=panel.getByRole('table',{name:name+': read and written',exact:true});
  const groups=report.dimensions[field];
  assert.equal(groups.reduce((n,row)=>n+row.read,0),fixture.expected.issueCount,field+' read');
  assert.equal(groups.reduce((n,row)=>n+row.written,0),fixture.expected.issueCount,field+' written');
  assert.equal(await table.locator('tbody > tr').count(),groups.length);
  for(const [index,group] of groups.entries()) {
   const cells=table.locator('tbody > tr').nth(index).locator('td');
   assert.equal(await cells.nth(0).innerText(),group.source||'(empty)');
   assert.equal(await cells.nth(1).innerText(),String(group.read));
   assert.equal(await cells.nth(2).innerText(),String(group.written));
   assert.equal(await cells.nth(3).innerText(),group.vector.map(value=>group.vector.length>1?`${value.name} (${value.count})`:value.name).join(', '));
   assert.equal(group.vector.reduce((n,value)=>n+value.count,0),group.written);
  }
 }
 return {totals:report.totals,effects:report.effects,cycleCommitments:cycles,dimensions:report.dimensions};
}
