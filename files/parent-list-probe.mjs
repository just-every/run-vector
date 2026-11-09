import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/workspace/run-vector/node_modules/@playwright/test/index.mjs';
import { collaborationRuntime } from '/workspace/run-vector/tests/e2e/collaboration-support.mjs';
import { bootstrapOwner } from '/workspace/run-vector/tests/e2e/admin-runtime-support.mjs';
const packet='/home/agent/rer-consolidation/work/sd-vector-c-f205-fix4-pc1/packet';
const rows=[];
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {
  for (const width of [1440,390]) {
    const runtime=await collaborationRuntime(width);
    let context;
    try {
      runtime.initialize();await runtime.start();console.log('parent-list runtime ready width='+width);
      context=await browser.newContext({viewport:{width,height:width===1440?1000:844}});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));const http=[];page.on('response',r=>{const u=new URL(r.url());if(u.pathname==='/api/issues'||u.pathname==='/app/issues'||u.pathname==='/api/refresh')http.push({path:u.pathname,status:r.status()});});
      await bootstrapOwner(page,runtime);
      async function post(path,data){
        const response=await page.request.post(runtime.base+path,{headers:{Origin:runtime.base},data});
        assert.ok(response.ok(),`${path}: ${response.status()}`);return response.json();
      }
      const parent=(await post('/api/settings/teams',{name:'Parent list proof',identifierPrefix:'PAR'})).teams.find(t=>t.identifierPrefix==='PAR');
      const child=(await post('/api/settings/teams',{name:'Child list proof',identifierPrefix:'CHD',parentTeamId:parent.id})).teams.find(t=>t.identifierPrefix==='CHD');
      const own=await post('/api/issues',{teamId:parent.id,title:'Parent list browser issue'});
      const sub=await post('/api/issues',{teamId:child.id,title:'Child list browser issue'});
      const response=await page.goto(runtime.base+'/app/issues?team='+parent.id);
      assert.equal(response.status(),200);
      const toggle=page.getByRole('checkbox',{name:'Include sub-teams',exact:true});
      const childLink=page.locator('.issues-row').filter({hasText:sub.identifier});
      const parentLink=page.locator('.issues-row').filter({hasText:own.identifier});
      await toggle.waitFor();await parentLink.waitFor();assert.equal(await toggle.isChecked(),false);assert.equal(await childLink.count(),0);
      await toggle.click();await childLink.waitFor();
      assert.equal(await toggle.isChecked(),true);assert.equal(await parentLink.count(),1);
      const enabledSearch=new URL(page.url()).search;
      await page.reload();await childLink.waitFor();assert.equal(await toggle.isChecked(),true);
      await mkdir(packet,{recursive:true});
      await toggle.scrollIntoViewIfNeeded();await page.screenshot({path:packet+'/parent-list-'+width+'.png',fullPage:true});
      await toggle.click();await childLink.waitFor({state:'detached'});await parentLink.waitFor();
      assert.ok(http.length>0);assert.ok(http.every(r=>r.status===200),JSON.stringify(http));
      assert.deepEqual(errors,[]);
      rows.push({width,parentOnlyBefore:true,http,enabledSearch,childVisibleWithToggle:true,reloadRetainsChild:true,childAbsentAfterDisable:true,pageErrors:errors});
      console.log('PROBE TEAM-006 parent-list width='+width+' toggle on/off and reload PASS');
    } catch(error) {console.error('parent-list probe failed: '+error.message);throw error;} finally {await context?.close();await runtime.stop();}
  }
} finally {await browser.close();await writeFile(packet+'/parent-list-receipt.json',JSON.stringify({rows},null,2)+'\n');}
