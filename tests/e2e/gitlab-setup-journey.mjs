import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
export async function exerciseGitlabSetup({page,runtime,cookie,evidence}){
 await runtime.freshRequestWindow();await page.setViewportSize({width:1440,height:1000});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(runtime.base+'/app/settings/connections');const region=page.getByRole('region',{name:'GitLab',exact:true});await region.waitFor();
 const responseFor=(method,path)=>page.waitForResponse(response=>response.request().method()===method&&new URL(response.url()).pathname===path);
 const connect=async(origin)=>{await region.getByLabel('GitLab origin',{exact:true}).fill(origin);await region.getByLabel('GitLab access token',{exact:true}).fill('synthetic-vector-18921');const pending=responseFor('POST','/api/settings/integrations/gitlab');await region.getByRole('button',{name:'Discover GitLab projects',exact:true}).click();const response=await pending;assert.equal(response.status(),201,await response.text());await region.getByLabel('GitLab access token',{exact:true}).waitFor();assert.equal(await region.getByLabel('GitLab access token',{exact:true}).inputValue(),'');return response.json();};
 const register=async(connection,section)=>{for(const id of [18931,18932])await section.getByLabel('Select synthetic-vector/project-'+id,{exact:true}).check();const pending=responseFor('POST','/api/settings/integrations/gitlab/'+connection.id+'/hooks');await section.getByRole('button',{name:'Register selected GitLab hooks',exact:true}).click();const response=await pending;assert.equal(response.status(),200,await response.text());return response.json();};
 const first=await connect('https://gitlab.com');let section=region.getByRole('group',{name:'https://gitlab.com',exact:true});
 assert.deepEqual((await register(first,section)).outcomes,[{projectId:18931,state:'registered'},{projectId:18932,state:'registered'}]);
 await section.getByText('Hook registered. Event processing is not yet implemented.',{exact:true}).first().waitFor();
 const second=await connect('https://gitlab.example.com');const self=region.getByRole('group',{name:'https://gitlab.example.com',exact:true});assert.deepEqual((await register(second,self)).outcomes,[{projectId:18931,state:'registered'},{projectId:18932,state:'unknown'}]);
 await self.getByText('Result unknown. Check GitLab before any further registration.',{exact:true}).waitFor();assert.equal(await self.getByLabel('Select synthetic-vector/project-18932',{exact:true}).isDisabled(),true);
 await page.reload();await region.waitFor();await self.getByText('Result unknown. Check GitLab before any further registration.',{exact:true}).waitFor();
 const calls=async()=>(await readFile(process.env.VECTOR_CHANNEL_EDGE,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse).filter(row=>row.method==='gitlab.hook');
 const hooks=await calls();assert.equal(hooks.length,4);assert.deepEqual(hooks.map(row=>row.path),['/api/v4/projects/18931/hooks','/api/v4/projects/18932/hooks','/api/v4/projects/18931/hooks','/api/v4/projects/18932/hooks']);
 for(const [index,row] of hooks.entries()){const connection=index<2?first:second;assert.equal(row.body.url,runtime.base+'/api/integrations/gitlab/'+connection.id+'/'+(index%2?18932:18931));assert.deepEqual(row.body,{url:row.body.url,enable_ssl_verification:true,push_events:true,merge_requests_events:true,pipeline_events:true,deployment_events:true});}
 assert.equal(new Set(hooks.map(row=>row.secretHash)).size,4);
 await mkdir(resolve(evidence,'gitlab'),{recursive:true});
 const require=createRequire(import.meta.url),axe=require.resolve('axe-core/axe.min.js');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1100});await region.scrollIntoViewIfNeeded();
  assert.equal(await region.evaluate(root=>root.scrollWidth<=root.clientWidth+1),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const small=await region.locator('input,button,label,p,span').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none'&&parseFloat(getComputedStyle(n).fontSize)<13).length);assert.equal(small,0);
  await page.addScriptTag({path:axe});const accessibility=await page.evaluate(async()=>window.axe.run(document.querySelector('[aria-labelledby="gitlab-heading"]')));assert.deepEqual(accessibility.violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
  await region.screenshot({path:resolve(evidence,'gitlab','setup-'+width+'.png'),mask:[page.locator('[data-rer-private]')]});
 }
 await page.setViewportSize({width:1440,height:1000});await region.getByLabel('GitLab origin',{exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await region.getByLabel('GitLab access token',{exact:true}).evaluate(node=>node===document.activeElement),true);
 const removed=responseFor('DELETE','/api/settings/integrations/gitlab/'+first.id);await section.getByRole('button',{name:'Remove GitLab credentials',exact:true}).click();assert.equal((await removed).status(),200);await section.getByText('Credentials removed.',{exact:true}).waitFor();assert.equal(await section.getByLabel('Select synthetic-vector/project-18931',{exact:true}).isDisabled(),true);
 await connect('https://gitlab.com');await register(first,section);const updated=(await calls()).slice(4);assert.deepEqual(updated.map(row=>row.verb),['PUT','PUT']);assert.notEqual(updated[0].secretHash,hooks[0].secretHash);
 assert.deepEqual(errors,[]);console.log('PROBE GITLAB-001 setup: native Settings -> both GitLab origins, exact selected hooks and callback identities, unique secret hashes, persisted partial results, credential removal and re-entry; screens 1440 and 390.');
}
