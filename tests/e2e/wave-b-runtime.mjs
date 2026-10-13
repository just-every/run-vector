import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from '@playwright/test';
import {freePort} from '../../scripts/base-onboarding/adapter-settings.mjs';
import {waveBProvider} from './wave-b-provider.mjs';
import {waveBWorker} from './wave-b-worker.mjs';
import {readLocalD1} from './local-d1-read.mjs';

const evidence=resolve('evidence/wave-b'),origin='http://127.0.0.1:'+await freePort();
await mkdir(evidence,{recursive:true});
const email='owner@claim-browser.test',provider=await waveBProvider(origin,email);
let worker,browser,untrusted,journeyError;const report={passed:false,widths:[],scope:'real local Vector Worker and native auth; labeled test-only management peer; no hosted installation'};
try {
  const config={SEED_SAMPLE_DATA:'false',MAIL_MODE:'local-outbox',MAIL_FROM:'signin@claim-browser.test',FIRST_OWNER_EMAIL:email,FIRST_OWNER_NAME:'Owner',WORKSPACE_NAME:'Claim proof',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Delivery',DEFAULT_TEAM_PREFIX:'CLM',SESSION_SECRET:'test-only-session-secret-with-at-least-32-characters',SETUP_TOKEN:'test-only-hidden-setup-token-with-at-least-32-characters',RER_OWNER_CLAIM_ISSUER:provider.origin,RER_OWNER_CLAIM_APP_ORIGIN:origin,RER_OWNER_CLAIM_INSTALLATION_ID:'vector-browser',RER_OWNER_CLAIM_PUBLIC_KEYS:provider.publicKeys,RER_MANAGEMENT_ORIGIN:provider.origin,RER_INSTALLATION_ID:'vector-browser'};
  worker=await waveBWorker(origin,config,evidence);
  const rows=sql=>readLocalD1(worker.state,sql);
  assert.equal(rows('SELECT count(*) AS n FROM oa_operators')[0].n,0);
  browser=await chromium.launch({headless:true});const context=await browser.newContext(),page=await context.newPage();
  assert.equal((await page.request.get(origin+'/api/editor/config')).status(),403);
  await page.goto(provider.origin+'/install');
  const opened=context.waitForEvent('page');await page.getByRole('button',{name:'Open claim',exact:true}).click();
  const claim=await opened;await claim.getByRole('button',{name:'Claim your workspace',exact:true}).waitFor({state:'visible'});
  await claim.waitForFunction(()=>!document.querySelector('button').disabled);
  assert.equal(rows('SELECT count(*) AS n FROM oa_operators')[0].n,0);
  const axe=await readFile(resolve('node_modules/axe-core/axe.min.js'),'utf8');
  async function capture(page,name,width) {
    if(page.viewportSize()?.width!==width)await page.setViewportSize({width,height:1000});
    await page.evaluate(source=>{
      const script=document.createElement('script'),nonce=document.querySelector('script[nonce]')?.nonce;
      if(nonce)script.nonce=nonce;
      script.textContent=source;document.head.append(script);
    },axe);
    const violations=await page.evaluate(async()=>{const result=await axe.run();return result.violations.filter(item=>['serious','critical'].includes(item.impact)).map(item=>item.id);});
    assert.deepEqual(violations,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:join(evidence,name+'-'+width+'.png'),fullPage:name!=='editor'});
  }
  for(const width of [1440,390])await capture(claim,'claim',width);
  await claim.getByRole('button',{name:'Claim your workspace',exact:true}).click();await claim.waitForURL(origin+'/setup');await claim.getByRole('button',{name:'Open my workspace',exact:true}).click();await claim.waitForURL(origin+'/app');
  assert.equal((await claim.request.get(origin+'/api/session')).status(),200);
  assert.equal((await claim.request.post(origin+'/auth/owner-claim',{headers:{Origin:origin},data:{token:provider.token()}})).status(),409);
  assert.equal(rows('SELECT count(*) AS n FROM oa_operators')[0].n,1);
  const grant=await claim.request.get(origin+'/api/editor/config');assert.equal(grant.status(),200);const initialGrant=await grant.json();assert.equal(initialGrant.config.managementOrigin,provider.origin);
  for(const width of [1440,390]) {
    await claim.setViewportSize({width,height:1000});await claim.getByRole('button',{name:'Open Run Edit Run',exact:true}).click();
    await claim.waitForFunction(()=>document.querySelector('[data-rer-editor]')?.dataset.connection==='connected');
    const editor=claim.frameLocator('[data-rer-editor] iframe');
    await editor.getByRole('textbox',{name:'Draft',exact:true}).click();
    await editor.getByRole('textbox',{name:'Draft',exact:true}).fill('Unsaved local editing draft');
    if(width===1440){
      assert(await claim.evaluate(()=>{window.__leaseFrame=document.querySelector('[data-rer-editor]')?.shadowRoot?.querySelector('iframe');return !!window.__leaseFrame;}));
      await claim.waitForTimeout(Math.max(0,initialGrant.expiresAt-Date.now())+5000);
      assert(await claim.evaluate(()=>window.__leaseFrame===document.querySelector('[data-rer-editor]')?.shadowRoot?.querySelector('iframe')));
      assert.equal(await editor.getByRole('textbox',{name:'Draft',exact:true}).inputValue(),'Unsaved local editing draft');report.leaseRetainsDraft=true;
    }
    await capture(claim,'editor',width);await claim.getByRole('button',{name:'Close Run Edit Run',exact:true}).click();
    await claim.getByRole('link',{name:'Settings',exact:true}).first().click();await claim.getByRole('heading',{name:'Settings',exact:true}).waitFor();
    await claim.getByRole('button',{name:'Open Run Edit Run',exact:true}).waitFor();
    await claim.goto(origin+'/app');report.widths.push({width,axeSerious:0,overflow:false});
  }
  const policy=(await claim.request.get(origin+'/app')).headers()['content-security-policy'];
  assert(policy.includes("frame-ancestors 'self' "+provider.origin));assert(policy.includes("frame-src 'self' "+provider.origin));
  const framed=await context.newPage();await framed.goto(provider.origin+'/embed');
  await framed.frameLocator('iframe').getByRole('heading',{level:1}).waitFor();
  untrusted=await waveBProvider(origin,email);const denied=await context.newPage();
  const blocked=denied.waitForEvent('framenavigated',{predicate:frame=>frame.parentFrame()!==null&&frame.url()!=='about:blank'});
  await denied.goto(untrusted.origin+'/embed');const blockedFrame=await blocked;
  assert(!blockedFrame.url().startsWith(origin+'/'));await framed.close();await denied.close();
  report.framingAllowed=true;report.untrustedFramingDenied=true;
  await claim.getByRole('button',{name:'Sign out',exact:true}).first().click();
  await claim.waitForURL(origin+'/signin');assert.equal(await claim.locator('[data-rer-editor]').count(),0);
  assert.equal((await claim.request.get(origin+'/api/editor/config')).status(),403);
  assert.equal((await claim.request.get(origin+'/does-not-exist')).status(),404);
  report.passed=true;report.nativeOwnerCount=1;report.secondClaim=409;report.anonymousConfig=403;
} catch(error) {journeyError=error;throw error;} finally {
  const cleanup=await Promise.allSettled([browser?.close(),worker?.stop(),provider.close(),untrusted?.close()]);
  report.processGroupGone=cleanup[1].status==='fulfilled';
  report.passed=report.passed&&cleanup.every(result=>result.status==='fulfilled');
  await rm(join(evidence,'private-wrangler-logs'),{recursive:true,force:true});
  await writeFile(join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(!journeyError&&cleanup.some(result=>result.status==='rejected'))
    throw new AggregateError(cleanup.filter(result=>result.status==='rejected').map(result=>result.reason),'Wave B cleanup failed');
}
console.log('Wave B: signed owner claim, second refusal, editor and CSP at 1440/390 passed.');
