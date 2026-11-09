import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '/workspace/run-vector/node_modules/@playwright/test/index.mjs';
const mode = process.argv[2] || 'fixed';
const packet = new URL('./', import.meta.url);
const records = [];
const events = (await readFile('/tmp/vector-dev.log','utf8')).split('\n').flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}});
const ready = events.findLast(event=>event.event==='ready');
assert.ok(ready?.openUrl, 'rer dev has a ready owner entry');
const origin = new URL(ready.url).origin;
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
let fixture;
try {
 for (const width of [1440,390]) {
  const context = await browser.newContext({viewport:{width,height:900}});
  const page = await context.newPage();
  try {
   page.setDefaultTimeout(30000);
   await page.goto(ready.openUrl);
   await page.waitForURL(url=>['/app','/setup'].includes(url.pathname));
   const mutate=async(path,data)=>{
    const response=await context.request.post(origin+'/api'+path,{headers:{Origin:origin},data});
    assert.ok(response.ok(), path+' status='+response.status());
    return response.json();
   };
   const setup=await (await context.request.get(origin+'/api/setup')).json();
   if(!setup.completed) await mutate('/setup/complete',{confirmed:true});
   if(!fixture) {
    const stamp=String(Date.now());
    const parentName='Parent '+stamp;
    const suffix=stamp.slice(-6).replace(/[0-9]/g,n=>String.fromCharCode(65+Number(n)));
    const parentPrefix='P'+suffix, childPrefix='C'+suffix;
    const parentState=await mutate('/settings/teams',{name:parentName,identifierPrefix:parentPrefix});
    const parent=parentState.teams.find(t=>t.name===parentName);
    const childState=await mutate('/settings/teams',{name:'Child '+stamp,identifierPrefix:childPrefix,parentTeamId:parent.id});
    const child=childState.teams.find(t=>t.identifierPrefix===childPrefix);
    const own=await mutate('/issues',{teamId:parent.id,title:'Parent list proof '+stamp});
    const nested=await mutate('/issues',{teamId:child.id,title:'Sub-team list proof '+stamp});
    fixture={parent:parent.id,own:own.identifier,child:nested.identifier};
   }
   const path='/app/issues?team='+fixture.parent;
   if(mode==='repro') {
    const response=await page.goto(origin+path+'&includeSubTeams=%22true%22');
    const status=response.status();
    records.push({width,status,quoted:true});
    await page.screenshot({path:new URL('repro-'+width+'.png',packet).pathname,fullPage:true});
    assert.equal(status,500);
   } else {
    const response=await page.goto(origin+path+'&includeSubTeams=false');
    assert.equal(response.status(),200);
    await page.getByRole('heading',{name:'Issues',exact:true}).waitFor();
    const toggle=page.getByRole('checkbox',{name:'Include sub-teams',exact:true});
    await toggle.waitFor();
    await page.getByText(fixture.own,{exact:true}).first().waitFor();
    assert.equal(await page.getByText(fixture.child,{exact:true}).count(),0);
    await page.waitForLoadState('networkidle');
    await toggle.click();
    await page.getByText(fixture.child,{exact:true}).first().waitFor();
    await page.getByText(fixture.own,{exact:true}).first().waitFor();
    assert.equal(await toggle.isChecked(),true);
    await page.screenshot({path:new URL('parent-list-'+width+'.png',packet).pathname,fullPage:true});
    const reload=await page.reload();
    assert.equal(reload.status(),200);
    await page.getByText(fixture.child,{exact:true}).first().waitFor();
    assert.equal(await toggle.isChecked(),true);
    await page.waitForLoadState('networkidle');
    await toggle.click();
    await page.waitForFunction(identifier=>!Array.from(document.querySelectorAll('.issues-table')).some(a=>a.textContent.includes(identifier)),fixture.child);
    await page.getByText(fixture.own,{exact:true}).first().waitFor();
    const invalid=await context.request.get(origin+path+'&includeSubTeams=garbage');
    assert.equal(invalid.status(),400);
    records.push({width,enabledStatus:200,reloadedStatus:reload.status(),disabledParentOnly:true,childVisibleWhenEnabled:true,invalidStatus:invalid.status()});
   }
  } finally {await context.close()}
 }
} finally {
 await browser.close();
 await writeFile(new URL(mode+'-browser.json',packet),JSON.stringify({mode,records},null,2)+'\n');
}
console.log(JSON.stringify({mode,records}));
