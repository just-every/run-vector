import {exerciseGithubChain} from './integrations/github-chain.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from '@playwright/test';
import {createUiRuntime} from './ui-runtime-support.mjs';
import {signIn,openAuthenticatedPage} from './ui-runtime-auth.mjs';
import {exerciseIntegrationSettings} from './integration-settings-journey.mjs';
process.env.VECTOR_CHANNEL_EDGE=resolve('.artifacts/verification/channel-edge-'+process.pid+'.jsonl');
const runtime=createUiRuntime(),evidence=resolve(process.env.VECTOR_EVIDENCE_DIR??'evidence/integrations');let browser;
const proof={passed:false,widths:[],credentialsCaptured:false,liveProvider:false};
try{
 await mkdir(resolve('.artifacts/verification'),{recursive:true});
 await mkdir(evidence,{recursive:true});runtime.initialize();runtime.start();await runtime.ready();const {cookie}=await signIn(runtime);browser=await chromium.launch({headless:true,args:["--use-mock-keychain","--password-store=basic"]});const page=await openAuthenticatedPage(browser,cookie,runtime.base),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const admin=await(await runtime.req('/api/settings/administration',{headers:{Cookie:cookie}})).json(),team=admin.teams.find(row=>!row.archivedAt);
 for(const width of [1440,390]){await exerciseIntegrationSettings({page,runtime,cookie,team,width,evidence});await exerciseGithubChain({page,runtime,cookie,team,width,evidence});proof.widths.push(width);}
 assert.deepEqual(errors,[],'No hydration or browser execution errors');
 proof.passed=true;
}finally{await browser?.close();await runtime.stop();await mkdir(evidence,{recursive:true});await writeFile(join(evidence,'browser-proof.json'),JSON.stringify(proof,null,2)+'\n');}
console.log('[SLACK-003 SLACK-004 NOTIFY-007] Native channel bindings, Slack creation and delivery, Discord, member-linked Slack direct messages, per-event email choices and workspace defaults passed at 1440 and 390.');
