import { finishFirstRun } from '../e2e/first-run-fixture.mjs';
import { prepareStartupFixture } from './startup-fixture.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod,mkdir,mkdtemp,readFile,stat,writeFile,rm,symlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import { readLocalD1 } from '../e2e/local-d1-read.mjs';
import { openGate, readCheckoutKey } from '../e2e/dev-gate.mjs';
process.env.RER_SERVER_JOURNEY = '1';
const axeSource=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8');
const source=process.cwd(), slow=process.argv.includes('--slow'), evidence=resolve(process.env.VECTOR_INSTALLER_EVIDENCE??'evidence/installer');
const report={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),slow,checks:[],captures:[],teardown:[]};
const check=name=>{report.checks.push(name);console.log('Installer proof: '+name)};
const answers={FIRST_OWNER_NAME:'Installation owner',FIRST_OWNER_EMAIL:'owner@installer.test',WORKSPACE_NAME:'Installation workspace',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Delivery',DEFAULT_TEAM_PREFIX:'VEC'};
await mkdir(evidence,{recursive:true});
const realPnpm=execFileSync('/bin/sh',['-c','command -v pnpm'],{encoding:'utf8'}).trim();
const work=await mkdtemp(join(tmpdir(),'vector-native-installer-')), root=join(work,'source');
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
const timing=join(work,'timing');const originalPath=process.env.PATH;
let browser,installer,page,token,startInstaller,createSeed,readOwnedGroup;let phase='provisioning';
const ports=new Set(),groups=new Set();
async function close(){try{await page?.close();}finally{page=undefined;await installer?.close();installer=undefined;}}
try{
execFileSync('git',['clone','--quiet','--no-local','--depth=1','--single-branch',source,root],{stdio:['ignore','pipe','pipe']});
// An explicit tool directory prevents ambient provider discovery from contacting accounts.
// Invoke pnpm at its discovered location: shell launchers can resolve their package relative to $0.
const basePath=await shim('tools','');
for(const name of ['node','npm','npx','git','sh','date','sleep','env','ps','uname','mkdir','rm','chmod','which','sed','dirname','basename','readlink']) {try {const path=execFileSync('/bin/sh',['-c','command -v '+name],{encoding:'utf8'}).trim();await symlink(path,join(basePath,name));}catch {if(['node','git','sh','date','sleep'].includes(name))throw Error('Required proof tool unavailable.');}}

async function shim(name,body) {const dir=join(work,name);await mkdir(dir);await writeFile(join(dir,'pnpm'),'#!/bin/sh\n'+body+'\nexec '+quote(realPnpm)+' "$@"\n');await chmod(join(dir,'pnpm'),0o755);return dir;}
const failing=await shim('failure','if [ "$1" = "install" ]; then echo "forced dependency failure"; exit 1; fi');
// The installer itself now lives in the declared package. Provision this clone's own
// frozen dependencies before importing it; the browser still exercises rer install below.
process.env.PATH=basePath;
execFileSync(realPnpm,['install','--frozen-lockfile'],{cwd:root,stdio:['ignore','pipe','pipe']});
check('fresh clone provisions its own frozen installer dependencies');
// rer install may recreate node_modules (as it does on the Linux CI runner).
// Place the disposable delay only after each successful real dependency install.
await prepareStartupFixture({root,work,timing,slow,pnpm:realPnpm,shim:join(basePath,'pnpm')});
({startInstaller}=await import(pathToFileURL(join(root,'node_modules/@runeditrun/rer/onboarding/server.mjs'))));
({createSeed}=await import(pathToFileURL(join(root,'scripts/installer/seed.mjs'))));
({readOwnedGroup}=await import(pathToFileURL(join(root,'node_modules/@runeditrun/rer/onboarding/local/process-table.mjs'))));
browser=await chromium.launch({headless:true});
async function open(resume){
 const seed=createSeed(),install=seed.install;seed.install=(root,input,store,onApp,signal)=>install(root,input,store,child=>{groups.add(child.pid);onApp(child)},signal);
 installer=await startInstaller(root,{seed,...(resume?{resume:true}:{noPrefill:true})});ports.add(Number(new URL(installer.origin).port));
 page=await browser.newPage({bypassCSP:true});page.on('request',request=>{const value=request.headers()['x-installer-token'];if(value)token=value});
 await page.goto(installer.origin);await page.waitForFunction(()=>!document.querySelector('#form').hidden);
}
const api=(path,body)=>page.evaluate(async({path,body,token})=>{const response=await fetch(path,{...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{'Content-Type':'application/json','X-Installer-Token':token}});return {status:response.status,body:await response.json()}},{path,body,token});
async function until(observe){for(let i=0;i<3600;i++){const {body}=await api('/api/state');await observe?.(body);if(['failed','complete'].includes(body.phase))return body;await new Promise(resolve=>setTimeout(resolve,500));}throw Error('Installer operational deadline exceeded.');}
async function capture(name){if(name==='setup'){await page.locator('#form').waitFor({state:'visible'});}else await page.getByRole('heading',{name:name==='failure'?'Installation needs attention':name==='complete'?'Your workspace is ready':'Making a home for your team',exact:true}).waitFor();for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);await page.addScriptTag({content:axeSource});const violations=await page.evaluate(async()=>{const result=await axe.run();return result.violations.filter(row=>['serious','critical'].includes(row.impact)).map(row=>row.id)});assert.deepEqual(violations,[]);report.axeSerious=0;report.overflow=false;const file=`${name}-${width}.png`;await page.screenshot({path:join(evidence,file),fullPage:true});report.captures.push(file);}}
 phase='forced-failure';process.env.PATH=failing+':'+basePath;await open(false);assert.equal((await api('/api/start',{...answers,target:'remote'})).status,400);assert.equal((await api('/api/state')).body.phase,'ready');check('unsupported browser target refuses before installation');assert.equal((await api('/api/draft',answers)).status,200);await page.reload();await capture('setup');assert.equal((await api('/api/start',answers)).status,202);
 const failed=await until();assert.equal(failed.phase,'failed');assert.match(failed.error,/installing dependencies/);await capture('failure');await close();check('forced failure drains and stops its command');
 phase='resumed-install';process.env.PATH=basePath;await open(true);const resumed=(await api('/api/state')).body.draft;for(const [key,value] of Object.entries(answers))assert.equal(resumed[key],value);const manifest=JSON.parse(await readFile(join(root,'rer-setup.json'),'utf8'));for(const field of manifest.fields.filter(field=>field.kind==='secret'))assert.equal(Object.hasOwn(resumed,field.name),false);assert.equal((await api('/api/start',answers)).status,202);
 let delayed=false;
 const complete=await until(async state=>{if(!slow||delayed)return;let at;try{at=Number(await readFile(timing,'utf8'))}catch{return}if(Date.now()-at>121000){assert.equal(state.phase,'running');assert.match(state.logs.join('\n'),/Still starting/);delayed=true;report.slowStartupObservedMs=Date.now()-at;await capture('slow-start')}});
 assert.equal(complete.phase,'complete','Native installation failed; inspect the local private installation diagnostic');if(slow)assert(delayed);check('saved-answer resume reaches the real Worker'+(slow?' after more than 120 seconds':''));
 const origin=new URL(complete.appUrl).origin;ports.add(Number(new URL(origin).port));assert.equal((await fetch(origin+'/health')).status,200);
 const sql=query=>readLocalD1(join(root,'.wrangler/state'),query);
 assert.deepEqual([sql('SELECT count(*) n FROM workspace_settings')[0].n,sql('SELECT count(*) n FROM operators')[0].n,sql('SELECT count(*) n FROM teams')[0].n,sql('SELECT count(*) n FROM workflow_statuses')[0].n],[1,1,1,7]);
 const owner=sql('SELECT id,email FROM operators')[0];assert.equal(owner.email,answers.FIRST_OWNER_EMAIL);check('configured first owner, one workspace, one team and seven categories');
 await capture('complete');
 const app=await browser.newPage();try{
  // Native bootstrap has already issued the setup session. Link navigation must
  // leave that session inventory unchanged until the person confirms the POST.
  const sessions=()=>({...sql('SELECT count(*) total, count(CASE WHEN revoked_at IS NULL THEN 1 END) active FROM oa_sessions')[0]});
  const beforeSignIn=sessions();
  await openGate(app.context(),origin,await readCheckoutKey(root));await app.goto(complete.appUrl);await app.getByRole('link',{name:'Read message'}).first().click();await app.getByRole('link',{name:'Open this link',exact:true}).click();assert.deepEqual(sessions(),beforeSignIn);
  await app.getByRole('button',{name:'Confirm',exact:true}).click();await app.waitForURL(origin+'/setup');await finishFirstRun(app,origin);await app.goto(origin+'/app');await app.waitForURL(origin+'/app');
  const session=await app.evaluate(async()=>({status:(await fetch('/api/session')).status}));assert.equal(session.status,200);
  assert.deepEqual(sessions(),{total:beforeSignIn.total+1,active:beforeSignIn.active+1});
  for(const path of ['/','/signin','/does-not-exist'])assert.equal((await app.request.get(origin+path)).status(),path==='/does-not-exist'?404:200);
  check('outbox navigation, inert GET, confirmation POST, session and document status matrix');
 }finally{await app.close();}
 const before=await readFile(join(root,'.dev.vars')),values=parseEnv(before.toString());const log=await readFile(join(root,'.seed/installer/install.log'),'utf8');
 assert.equal((await stat(join(root,'.seed/installer/install.log'))).mode&0o777,0o600);assert.equal((await stat(join(root,'.dev.vars'))).mode&0o777,0o600);
 for(const text of [log,JSON.stringify(complete),await page.locator('body').innerText(),await readFile(join(root,'.seed/installer/state.json'),'utf8')])assert.equal(text.includes(values.SESSION_SECRET),false,'generated credential absent');
 check('0600 settings and diagnostics; generated credentials absent from state, page and log');
 await close();process.env.PATH=basePath;await open(true);assert.equal((await api('/api/start',answers)).status,202);const repeated=await until();assert.equal(repeated.phase,'complete');assert.deepEqual(await readFile(join(root,'.dev.vars')),before);assert.equal(new URL(repeated.appUrl).origin,origin);assert.deepEqual(sql('SELECT id,email FROM operators'),[owner]);check('real rerun preserves exact settings, origin and owner');
 report.status='passed';
}catch(error){report.failedPhase=phase;report.failureType=error?.name??'Error';report.failureLocation=String(error?.stack??'').match(/native-proof\.mjs:\d+:\d+/)?.[0]??null;report.status='failed';process.exitCode=1;console.error('Native installer proof failed; no private diagnostic contents exported.');}
finally{
 process.env.PATH=originalPath;
 for(const cleanup of [close,()=>browser?.close()]){try{await cleanup();}catch{report.teardown.push({cleanup:false});}}
 for(const port of ports){const free=await new Promise(done=>{const socket=createServer();socket.once('error',()=>done(false));socket.listen(port,'127.0.0.1',()=>socket.close(()=>done(true)))});report.teardown.push({port,free});}
 for(const group of groups){try{report.teardown.push({processGroup:group,gone:(await readOwnedGroup(group)).length===0});}catch{report.teardown.push({processGroup:group,gone:false});}}
 if(!report.teardown.every(row=>row.free??row.gone)){report.status='failed';process.exitCode=1;}
 try{await writeFile(join(evidence,'proof.json'),JSON.stringify(report,null,2)+'\n');}finally{await rm(work,{recursive:true,force:true});}
}
