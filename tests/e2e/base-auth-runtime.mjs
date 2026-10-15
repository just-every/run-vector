import { finishFirstRun } from './first-run-fixture.mjs';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { readLocalD1 } from './local-d1-read.mjs';
import { devKey, keyHeader } from './dev-gate.mjs';
import { readDevelopmentLink } from './outbox-session.mjs';
import { freePort } from '@runeditrun/rer/adapter-settings';

// A fixed port inside the ephemeral range can already be held by another
// socket on a shared runner. One free port serves both starts of this run.
const port = await freePort(), origin = `http://127.0.0.1:${port}`;
const state = `.wrangler/base-auth-${process.pid}`;
const evidence = resolve(process.env.VECTOR_AUTH_EVIDENCE ?? '.wrangler/base-auth-evidence');
const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
const processEnvironment = { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: resolve('.wrangler/base-auth-logs') };
const config = {
  APP_ORIGIN: origin, SEED_SAMPLE_DATA: 'false', MAIL_MODE: 'local-outbox',
  FIRST_OWNER_EMAIL: 'owner@auth-runtime.test', FIRST_OWNER_NAME: 'Workspace owner',
  WORKSPACE_NAME: 'Auth runtime', WORKSPACE_TIMEZONE: 'UTC',
  DEFAULT_TEAM_NAME: 'Delivery', DEFAULT_TEAM_PREFIX: 'AUTH',
  SESSION_SECRET: 'synthetic-fixture-local-runtime-secret-at-least-32-characters',
  MAIL_FROM: 'Vector <signin@auth-runtime.test>', RER_DEV_KEY: devKey,
};
const run = args => execFileSync(process.execPath, [wrangler,...args], { encoding:'utf8',env:processEnvironment,maxBuffer:16*1024*1024 });
const sql = query => readLocalD1(state, query);
const link = email => sql(`SELECT json_extract(message,'$.text') AS sign_in_url FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='${email}' ORDER BY created_at DESC,sequence DESC LIMIT 1`)[0].sign_in_url.match(/https?:\/\/[^\s]+/)[0];
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
let worker, browser;
async function start() {
  worker = spawn(process.execPath,[wrangler,'dev','--config','dist/server/wrangler.json','--local','--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--persist-to',state,...Object.entries(config).flatMap(([key,value])=>['--var',key+':'+value])],{env:processEnvironment,detached:true,stdio:'ignore'});
  for(let attempt=0;attempt<150;attempt++) {
    if(worker.exitCode!==null) throw Error('Auth Worker exited before readiness');
    try { if((await fetch(origin+'/health')).ok) return; } catch {}
    await pause(200);
  }
  throw Error('Auth Worker readiness timed out');
}
async function stop() {
  if(!worker) return;
  const owned=worker; worker=null;
  try { process.kill(-owned.pid,'SIGTERM'); } catch(error) { if(error.code!=='ESRCH') throw error; }
  for(let attempt=0;attempt<100&&owned.exitCode===null;attempt++) await pause(50);
  if(owned.exitCode===null) try {process.kill(-owned.pid,'SIGKILL');} catch(error) {if(error.code!=='ESRCH') throw error;}
  // The restart reuses this port, so the old Worker must have released it.
  for(let attempt=0;attempt<100&&owned.exitCode===null;attempt++) await pause(50);
}
try {
  await mkdir(evidence,{recursive:true});
  run(['d1','migrations','apply','vector-local','--local','--config','wrangler.jsonc','--persist-to',state]);
  await start();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/signin');
  await page.getByLabel('Email',{exact:true}).fill(config.FIRST_OWNER_EMAIL);
  const sent=page.waitForResponse(response=>response.url()===origin+'/auth/request'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Send sign-in link',exact:true}).click();
  assert.equal((await sent).status(),202);
  // The email-link path stays proven: the test observes delivery at the mail edge.
  assert.equal((await fetch(origin+'/__dev/outbox')).status,404,'the captured-mail viewer is retired');
  assert.equal((await fetch(origin+'/__dev/outbox',{headers:keyHeader('not-the-key-'+'x'.repeat(43))})).status,404);
  const ownerLink=await readDevelopmentLink(origin,(path,method,body,cookie,headers)=>fetch(origin+path,{method,headers}),config.FIRST_OWNER_EMAIL,state);
  assert.equal(new URL(ownerLink).pathname,'/auth/confirm');
  await page.goto(ownerLink);
  assert.equal(sql('SELECT count(*) n FROM oa_sessions')[0].n,0);
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.waitForURL(origin+'/setup');
  await finishFirstRun(page,origin);await page.goto(origin+'/app');
  await page.waitForURL(origin+'/app');
  assert.ok((await context.cookies()).some(cookie=>cookie.name==='operator_session_local_'+port));
  assert.ok(!(await context.cookies()).some(cookie=>cookie.name==='vector_session'));
  await page.goto(origin+'/app/settings');
  await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
  await page.getByLabel('Name',{exact:true}).fill('Invited peer');
  await page.getByLabel('Email',{exact:true}).fill('peer@auth-runtime.test');
  const invited=page.waitForResponse(response=>response.url()===origin+'/api/settings/operators/invite');
  await page.getByRole('button',{name:'Send invitation',exact:true}).click();
  const invitation = await invited;
  assert.equal(invitation.status(),202);
  assert.equal((await invitation.json()).delivery,'local');
  const peerContext=await browser.newContext();
  const peer=await peerContext.newPage(); peer.on('pageerror',error=>errors.push(error.message));
  await peer.goto(link('peer@auth-runtime.test'));
  await peer.getByRole('button',{name:'Confirm',exact:true}).click();
  await peer.waitForURL(origin+'/app');
  await peer.goto(origin+'/app/settings');
  await peer.getByRole('button',{name:'Remove Invited peer',exact:true}).waitFor();
  assert.equal(await peer.getByRole('button',{name:'Remove Workspace owner',exact:true}).isDisabled(),true);
  await peer.getByLabel('Name',{exact:true}).fill('Equal operator');
  await peer.getByLabel('Email',{exact:true}).fill('equal@auth-runtime.test');
  const equalInvite=peer.waitForResponse(response=>response.url()===origin+'/api/settings/operators/invite');
  await peer.getByRole('button',{name:'Send invitation',exact:true}).click();
  assert.equal((await equalInvite).status(),202);
  const equalLink=link('equal@auth-runtime.test');
  await page.reload();
  await page.getByRole('button',{name:'Remove Invited peer',exact:true}).waitFor();
  await page.screenshot({path:resolve(evidence,'base-invite-settings-1440.jpg'),type:'jpeg',quality:85,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:resolve(evidence,'base-invite-settings-390.jpg'),type:'jpeg',quality:85,fullPage:true});
  await page.getByRole('button',{name:'Remove Invited peer',exact:true}).click();
  const removed=page.waitForResponse(response=>response.url().startsWith(origin+'/api/settings/operators/')&&response.request().method()==='DELETE');
  await page.getByRole('button',{name:'Confirm removal',exact:true}).click();
  assert.equal((await removed).status(),200);
  await page.getByRole('button',{name:'Remove Invited peer',exact:true}).waitFor({state:'detached'});
  await page.getByRole('group',{name:'Confirm operator removal',exact:true}).waitFor({state:'detached'});
  assert.ok((await page.locator('main.settings-page > [role="status"]').innerText()).trim());
  assert.equal((await peer.request.get(origin+'/api/session')).status(),401);
  assert.equal((await fetch(equalLink)).status,400);
  // Unload app documents while preserving both native cookie jars across restart.
  await Promise.all(browser.contexts().flatMap(context=>context.pages()).map(page=>page.goto('about:blank')));
  await stop(); await start();
  assert.equal((await peerContext.request.get(origin+'/api/session')).status(),401);
  await page.goto(origin+'/app/settings');
  await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
  await peerContext.close();
  assert.equal(sql('SELECT count(*) n FROM operators WHERE removed_at IS NULL')[0].n,1);
  assert.equal(sql('SELECT count(*) n FROM workflow_statuses')[0].n,7);
  assert.deepEqual(errors,[]);
  await writeFile(resolve(evidence,'report.json'),JSON.stringify({status:'passed',checks:['rendered sign-in uses Base','GET confirmation does not admit','POST confirmation sets Base cookie','Settings invitation delivered to explicit outbox','invited equal operator can invite','setup owner protection','responsive settings','removal revokes session and issued invite','restart preserves peer revocation and owner Base session'],scope:'local emitted Worker and headless browser; no remote delivery claimed'},null,2)+'\n');
  console.log('Base authentication runtime: 9 checks passed; '+evidence);
} finally {
  await browser?.close(); await stop();
}
