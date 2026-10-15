import { loadInstallerSeed } from '@runeditrun/rer/setup-manifest';
import {populateArchive,compareArchives} from './readme-archive.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {parseEnv} from 'node:util';
import {chromium} from '@playwright/test';
import {createState} from '@runeditrun/rer/state';
import {createSeed} from '../../scripts/installer/seed.mjs';
import {commandEnvironment} from '../../scripts/installer-env.mjs';
import {freePort} from '@runeditrun/rer/adapter-settings';
import {publicDevelopment} from '../e2e/public-development.mjs';
import {readCheckoutKey} from '../e2e/dev-gate.mjs';
import {localCliProof} from '@runeditrun/rer/adapter-auth';
process.env.RER_SERVER_JOURNEY = '1';
const markdown=await readFile('README.md','utf8');
const literal=name=>{const match=markdown.match(new RegExp('<!-- vector-'+name+' -->\\s*```sh\\n([\\s\\S]*?)```'));assert(match,'README literal '+name);return match[1].trim();};
test('README literal clone, own frozen install, optional setup and dev automatically sign in the local owner', {timeout:2700000},async()=>{
 const work=await mkdtemp(join(tmpdir(),'vector-readme-')),evidence=resolve('evidence/readme');await mkdir(evidence,{recursive:true});let store,browser,development;const controller=new AbortController();
 const result={status:'running',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commands:['README install rer','README clone','README optional setup','setup repeat','README start','confirmed reset'],publicMirrorProof:false};
 try {
  store=await createState(work,await loadInstallerSeed(process.cwd(),createSeed()));store.setCommandSignal(controller.signal);
  // The README's own two steps: install rer (its npm form, into a private prefix), then clone and start.
  // The clone names the public repository; the journey clones this checkout in its place.
  const start=literal('start').split('\n'),install=markdown.match(/`(npm install --global @runeditrun\/rer@[0-9.]+)`/);assert(install,'README npm install of rer');
  const setupCommand=literal('setup');const port=await freePort();
  const prefix=join(work,'cli');
  const path=join(prefix,'bin')+':'+process.env.PATH;
  const environment=extra=>commandEnvironment({PATH:path,npm_config_prefix:prefix,...extra});
  await store.run('README install rer','/bin/sh',['-eu','-c',install[1]],{cwd:work,env:environment({CI:'true'})});
  await store.run('README clone','/bin/sh',['-eu','-c',start[0].replace('https://github.com/just-every/run-vector.git',process.cwd())],{cwd:work,env:commandEnvironment({})});
  const root=join(work,'vector');
  await store.run('README optional setup','/bin/sh',['-eu','-c',setupCommand],{cwd:root,env:environment({VECTOR_PORT:String(port),CI:'true',RER_LOCAL_OPERATION:undefined,RER_SERVER_JOURNEY:'1'})});
  const before=await readFile(join(root,'.dev.vars'));
  await store.run('README setup repeat','/bin/sh',['-eu','-c',setupCommand],{cwd:root,env:environment({VECTOR_PORT:String(port),CI:'true',RER_LOCAL_OPERATION:undefined,RER_SERVER_JOURNEY:'1'})});
  assert.deepEqual(await readFile(join(root,'.dev.vars')),before);
  assert.equal((await stat(join(root,'.dev.vars'))).mode&0o777,0o600);
  result.setupPreserved=true;
  const settings=parseEnv(await readFile(join(root,'.dev.vars'),'utf8'));store.addSecrets([settings.SESSION_SECRET]);
  development=publicDevelopment(store,root,environment({CI:'true',RER_LOCAL_OPERATION:undefined,RER_SERVER_JOURNEY:'1'}),settings.APP_ORIGIN);
  await development.start('README development','/bin/sh',['-eu','-c','cd .. && '+start.at(-1)]);
  browser=await chromium.launch({headless:true});const page=await browser.newPage();
  result.developmentAssetFailures=[];result.browserErrorTypes=[];
  page.on('pageerror',error=>result.browserErrorTypes.push(error.name));
  page.on('response',response=>{const path=new URL(response.url()).pathname;if(response.status()>=400&&/^\/(?:src|node_modules|@)/.test(path))result.developmentAssetFailures.push({path,status:response.status()});});
  for(const path of ['/','/signin','/does-not-exist'])assert.equal((await page.request.get(settings.APP_ORIGIN+path)).status(),path==='/does-not-exist'?404:200);
  assert.equal((await page.request.get(settings.APP_ORIGIN+'/api/session')).status(),401);
  assert.equal((await page.request.get(settings.APP_ORIGIN+'/__dev/outbox')).status(),404);
  const devKey=await readCheckoutKey(root);store.addSecrets([devKey]);
  const entry=settings.APP_ORIGIN+'/__dev/key#'+new URLSearchParams({'rer-dev':devKey,as:'owner',next:'/auth/dev/enter?as=owner&returnTo='+encodeURIComponent('/setup')});
  await page.goto(entry);await page.waitForURL(settings.APP_ORIGIN+'/setup');
  const signedIn=await page.request.get(settings.APP_ORIGIN+'/auth/session');assert.equal(signedIn.status(),200);
  const ownerSession=await signedIn.json();assert.equal(ownerSession.kind,'dev');assert.equal(ownerSession.operator.email,settings.FIRST_OWNER_EMAIL);assert.equal(ownerSession.operator.role,'owner');
  const ownerResponse=await page.request.get(settings.APP_ORIGIN+'/api/session');assert.equal(ownerResponse.status(),200);const owner=await ownerResponse.json();
  assert.equal((await page.request.get(settings.APP_ORIGIN+'/__dev/outbox')).status(),404);
  assert.equal(await page.locator('#rer-dev-badge').count(),0);
  result.autoOwnerEntry=true;
  const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8');
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:width===390?844:1000});
   await page.goto(settings.APP_ORIGIN+'/app/settings');await page.waitForURL(settings.APP_ORIGIN+'/setup');
   await page.getByRole('button',{name:'Open my workspace',exact:true}).waitFor();
   await page.waitForFunction(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Open my workspace');return button&&!button.disabled;});
   await page.addScriptTag({content:axe});
   assert.deepEqual(await page.evaluate(async()=>{const r=await axe.run();return r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id)}),[]);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:join(evidence,'first-run-'+width+'.png'),fullPage:true});
  }
  await page.getByRole('button',{name:'Open my workspace',exact:true}).click();await page.waitForURL(settings.APP_ORIGIN+'/app');
  await page.goto(settings.APP_ORIGIN+'/setup');await page.waitForURL(settings.APP_ORIGIN+'/app');result.firstRunCompleted=true;
  assert.equal((await page.request.get(settings.APP_ORIGIN+'/api/session')).status(),200);
  await page.getByRole('heading',{name:'Current',exact:true}).waitFor();
  for(const width of [1440,390]) {await page.setViewportSize({width,height:1000});await page.addScriptTag({content:axe});const serious=await page.evaluate(async()=>{const r=await axe.run();return r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id)});assert.deepEqual(serious,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(evidence,'workspace-'+width+'.png'),fullPage:true});}
  const denied=await page.request.post(settings.APP_ORIGIN+'/auth/confirm',{headers:{Origin:'https://foreign.example.test'},data:{token:'not-a-token'}});assert.notEqual(denied.status(),200);
  const identifier=await populateArchive(page,settings.APP_ORIGIN);
  await development.stop('Stop README development');
  const run=async (label,...args)=>store.run(label,process.execPath,['node_modules/@runeditrun/rer/bin/rer.mjs',...args],{cwd:root,env:commandEnvironment({CI:'true',RER_LOCAL_OPERATION:undefined,RER_SERVER_JOURNEY:'1'})});
  await run('Export through the public command','export','--target','local','--output','exports/retained-export.jsonl','--non-interactive');
  assert.equal((await stat(join(root,'exports/retained-export.jsonl'))).mode&0o777,0o600);
  await mkdir(join(root,'.rer/deploy'),{recursive:true});await writeFile(join(root,'.rer/deploy','retained.json'),'{}');
  await store.run('Confirmed local reset',process.execPath,['node_modules/@runeditrun/rer/bin/rer.mjs','reset','--yes','--non-interactive'],{cwd:root,env:commandEnvironment({CI:'true',RER_LOCAL_OPERATION:undefined,RER_SERVER_JOURNEY:'1'})});
  for(const path of ['.dev.vars','.wrangler/state','.seed/installer','.rer/local'])await assert.rejects(stat(join(root,path)),{code:'ENOENT'});
  for(const path of ['package.json','pnpm-lock.yaml','exports/retained-export.jsonl','.rer/deploy/retained.json'])assert((await stat(join(root,path))).isFile());
  await store.run('Idempotent local reset',process.execPath,['node_modules/@runeditrun/rer/bin/rer.mjs','reset','--yes','--non-interactive'],{cwd:root,env:commandEnvironment({CI:'true',RER_LOCAL_OPERATION:undefined,RER_SERVER_JOURNEY:'1'})});
  await run('Restore through the public command','import','--target','local','--input','exports/retained-export.jsonl','--yes','--non-interactive');
  await run('Export the restored installation','export','--target','local','--output','exports/restored-export.jsonl','--non-interactive');
  result.archive=await compareArchives(root,'exports/retained-export.jsonl','exports/restored-export.jsonl');
  await run('Configure fresh destination authority','setup','--owner-email',settings.FIRST_OWNER_EMAIL,'--port',String(port),'--non-interactive');
  await development.start('Restored development');
  const restoredPage=await browser.newPage();
  assert.equal((await restoredPage.request.get(settings.APP_ORIGIN+'/api/session')).status(),401);
  assert.equal((await page.request.get(settings.APP_ORIGIN+'/api/session')).status(),401,'the pre-reset dev session cannot authenticate the restored installation');
  // Recovery review needs ordinary owner proof. The local CLI door issues a
  // native session and fresh proof; a dev persona does not stand in for either.
  const restoredSettings=parseEnv(await readFile(join(root,'.dev.vars'),'utf8'));store.addSecrets([restoredSettings.SESSION_SECRET]);
  const recovered=await restoredPage.request.post(settings.APP_ORIGIN+'/auth/local/cli-session',{headers:{Origin:settings.APP_ORIGIN,'x-rer-local-cli':localCliProof(restoredSettings.SESSION_SECRET)},data:{returnTo:'/app'},maxRedirects:0});
  assert.equal(recovered.status(),303);assert.equal(recovered.headers().location,'/app');
  const nativeResponse=await restoredPage.request.get(settings.APP_ORIGIN+'/auth/session');assert.equal(nativeResponse.status(),200);
  const nativeSession=await nativeResponse.json();assert.equal(nativeSession.kind,'native');assert.equal(nativeSession.operator.id,ownerSession.operator.id);assert.equal(nativeSession.operator.email,settings.FIRST_OWNER_EMAIL);assert.equal(nativeSession.operator.role,'owner');
  const restoredOwner=await restoredPage.request.get(settings.APP_ORIGIN+'/api/session');assert.equal(restoredOwner.status(),200);assert.deepEqual(await restoredOwner.json(),owner);
  await restoredPage.goto(settings.APP_ORIGIN+'/app');await restoredPage.waitForURL(settings.APP_ORIGIN+'/app');
  assert.equal((await restoredPage.request.get(settings.APP_ORIGIN+'/__dev/outbox')).status(),404);
  assert.equal(await restoredPage.locator('#rer-dev-badge').count(),0);
  assert.equal((await restoredPage.request.get(settings.APP_ORIGIN+'/api/issues/'+identifier)).status(),200);
  assert.equal((await restoredPage.request.get(settings.APP_ORIGIN+'/api/data/restore')).status(),200);
  result.restoredNativeOwnerProof=true;
  await development.stop('Stop restored development');
  result.resetPreservedSourceExportsDeploy=true;
  result.status='passed';result.axeSerious=0;result.overflow=false;result.ownFrozenInstall=true;
 } finally {
  try {await development?.stop('Stop README development during teardown');result.processGroupGone=true;}
  finally {controller.abort();await browser?.close();await store?.closeCommands();}
  await writeFile(join(evidence,'proof.json'),JSON.stringify(result,null,2)+'\n');await rm(work,{recursive:true,force:true});
 }
});
