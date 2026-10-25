import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {origin,migrate,start,stop,signIn,api,sql} from './removal-runtime-support.mjs';
import { fetchHeld } from './route-fetch.mjs';
// Hold a real native response at the browser boundary; no response is fabricated.
const evidence=resolve(process.env.VECTOR_MUTATION_EVIDENCE??'evidence/mutation-refresh');
let browser,release;
const proof={passed:false,nativeHeldResponse:true,abortedReads:0};
try {
  await mkdir(evidence,{recursive:true});migrate();await start();
  const cookie=await signIn('owner@removal.test');
  const teamId=sql('SELECT id FROM teams')[0].id;
  const created=await api(cookie,'/issues','POST',{title:'Committed refresh authority',teamId});assert.equal(created.status,201);
  const issue=await created.json();browser=await chromium.launch({headless:true,args:["--use-mock-keychain","--password-store=basic"]});const context=await browser.newContext();
  const split=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage();await page.goto(origin+'/app/issues/'+issue.identifier);
  await page.getByRole('heading',{name:'Committed refresh authority',exact:true}).waitFor();
  const target=origin+'/api/issues/'+issue.identifier;
  let heldResolve;const held=new Promise(resolve=>{heldResolve=resolve});
  const barrier=new Promise(resolve=>{release=resolve});let reads=0;
  page.on('requestfailed',request=>{if(request.url()===target)proof.abortedReads++});
  await page.route(target,async route=>{
    const response=await fetchHeld(route);assert.equal(response.status(),200);reads++;
    if(reads===1){heldResolve();await barrier;}
    await route.fulfill({response});
  });
  async function comment(body) {
    await page.getByPlaceholder('Write a comment…').fill(body);
    const response=page.waitForResponse(r=>r.url()===target+'/comments'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Add comment',exact:true}).click();assert.equal((await response).status(),201);
  }
  await comment('First committed update');await held;
  await comment('Second committed update');
  assert.equal(reads,1,'second commit queues a fresh read instead of superseding the admitted read');
  const currentRead=page.waitForResponse(r=>r.url()===target&&r.status()===200&&reads===2);
  release();
  await page.getByText('Second committed update',{exact:true}).waitFor();
  await currentRead;
  assert.equal(reads,2);assert.equal(proof.abortedReads,0);
  const response=await api(cookie,'/issues/'+issue.identifier);assert.equal(response.status,200);
  assert.equal(sql("SELECT count(*) n FROM issue_comments WHERE issue_id='"+issue.id+"'")[0].n,2);
  proof.nativeReads=reads;proof.committedComments=2;proof.passed=true;
} finally {
  release?.();await browser?.close();await stop();
  await writeFile(resolve(evidence,'proof.json'),JSON.stringify(proof,null,2)+'\n');
}
