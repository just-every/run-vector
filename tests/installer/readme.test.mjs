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
import {openGate,readCheckoutKey} from '../e2e/dev-gate.mjs';
process.env.RER_SERVER_JOURNEY = '1';
const markdown=await readFile('README.md','utf8');
const literal=name=>{const match=markdown.match(new RegExp('<!-- vector-'+name+' -->\\s*```sh\\n([\\s\\S]*?)```'));assert(match,'README literal '+name);return match[1].trim();};
test('README literal clone, own frozen install, setup and dev reach a real outbox-confirmed owner', {timeout:2700000},async()=>{
 const work=await mkdtemp(join(tmpdir(),'vector-readme-')),evidence=resolve('evidence/readme');await mkdir(evidence,{recursive:true});let store,browser,development;const controller=new AbortController();
 const result={status:'running',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commands:['README clone','README frozen install/check/setup/dev','setup repeat','confirmed reset'],publicMirrorProof:false};
 try {
  store=await createState(work,await loadInstallerSeed(process.cwd(),createSeed()));store.setCommandSignal(controller.signal);
  await store.run('README clone','/bin/sh',['-eu','-c',literal('clone')],{cwd:work,env:commandEnvironment({VECTOR_SOURCE:process.cwd()})});
  const root=join(work,'vector'),commands=literal('terminal').split('\n');const port=await freePort();
  const prefix=join(work,'cli');
  const path=join(prefix,'bin')+':'+process.env.PATH;
  const environment=extra=>commandEnvironment({PATH:path,npm_config_prefix:prefix,...extra});
  await store.run('README installation','/bin/sh',['-eu','-c',commands.slice(0,-1).join('\n')],{cwd:root,env:environment({VECTOR_PORT:String(port),CI:'true',RER_LOCAL_OPERATION:undefined,RER_SERVER_JOURNEY:'1'})});
  const before=await readFile(join(root,'.dev.vars'));
  await store.run('README setup repeat','/bin/sh',['-eu','-c',commands.find(line=>line.startsWith('rer setup'))],{cwd:root,env:environment({VECTOR_PORT:String(port),CI:'true',RER_LOCAL_OPERATION:undefined,RER_SERVER_JOURNEY:'1'})});
  assert.deepEqual(await readFile(join(root,'.dev.vars')),before);
  assert.equal((await stat(join(root,'.dev.vars'))).mode&0o777,0o600);
  result.setupPreserved=true;
  const settings=parseEnv(await readFile(join(root,'.dev.vars'),'utf8'));store.addSecrets([settings.SESSION_SECRET]);
  development=publicDevelopment(store,root,environment({CI:'true',RER_LOCAL_OPERATION:undefined,RER_SERVER_JOURNEY:'1'}),settings.APP_ORIGIN);
  await development.start('README development','/bin/sh',['-eu','-c',commands.at(-1)]);
  browser=await chromium.launch({headless:true});const page=await browser.newPage();
  result.developmentAssetFailures=[];result.browserErrorTypes=[];
  page.on('pageerror',error=>result.browserErrorTypes.push(error.name));
  page.on('response',response=>{const path=new URL(response.url()).pathname;if(response.status()>=400&&/^\/(?:src|node_modules|@)/.test(path))result.developmentAssetFailures.push({path,status:response.status()});});
  for(const path of ['/','/signin','/does-not-exist'])assert.equal((await page.request.get(settings.APP_ORIGIN+path)).status(),path==='/does-not-exist'?404:200);
  await page.goto(settings.APP_ORIGIN+'/setup');await page.waitForURL(url=>new URL(url).pathname==='/signin'&&new URL(url).searchParams.get('returnTo')==='/setup');await page.getByLabel('Email',{exact:true}).fill(settings.FIRST_OWNER_EMAIL);const sent=page.waitForResponse(r=>new URL(r.url()).pathname==='/auth/request');await page.getByRole('button',{name:'Send sign-in link',exact:true}).click();assert.equal((await sent).status(),202);
  await openGate(page.context(),settings.APP_ORIGIN,await readCheckoutKey(root));await page.goto(settings.APP_ORIGIN+'/__dev/outbox');await page.getByRole('link',{name:'Read message',exact:true}).first().click();await page.getByRole('link',{name:'Open this link',exact:true}).click();
  assert.equal((await page.request.get(settings.APP_ORIGIN+'/api/session')).status(),401);await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.waitForURL(settings.APP_ORIGIN+'/setup');
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
  assert.equal((await restoredPage.request.post(settings.APP_ORIGIN+'/auth/request',{headers:{Origin:settings.APP_ORIGIN},data:{email:settings.FIRST_OWNER_EMAIL}})).status(),202);
  await openGate(restoredPage.context(),settings.APP_ORIGIN,await readCheckoutKey(root));await restoredPage.goto(settings.APP_ORIGIN+'/__dev/outbox');await restoredPage.getByRole('link',{name:'Read message',exact:true}).first().click();await restoredPage.getByRole('link',{name:'Open this link',exact:true}).click();await restoredPage.getByRole('button',{name:'Confirm',exact:true}).click();await restoredPage.waitForURL(settings.APP_ORIGIN+'/app');
  assert.equal((await restoredPage.request.get(settings.APP_ORIGIN+'/api/issues/'+identifier)).status(),200);
  assert.equal((await restoredPage.request.get(settings.APP_ORIGIN+'/api/data/restore')).status(),200);
  await development.stop('Stop restored development');
  result.resetPreservedSourceExportsDeploy=true;
  result.status='passed';result.axeSerious=0;result.overflow=false;result.ownFrozenInstall=true;
 } finally {
  try {await development?.stop('Stop README development during teardown');result.processGroupGone=true;}
  finally {controller.abort();await browser?.close();await store?.closeCommands();}
  await writeFile(join(evidence,'proof.json'),JSON.stringify(result,null,2)+'\n');await rm(work,{recursive:true,force:true});
 }
});
