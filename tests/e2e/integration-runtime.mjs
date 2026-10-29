import {exerciseModelPolicy} from './integrations/model-policy.mjs';
import {exerciseOAuthApps} from './integrations/oauth-apps.mjs';
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
 await mkdir(evidence,{recursive:true});runtime.initialize();runtime.start();await runtime.ready();const {cookie}=await signIn(runtime);browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:["--use-mock-keychain","--password-store=basic","--no-sandbox"]});const page=await openAuthenticatedPage(browser,cookie,runtime.base);
 const admin=await(await runtime.req('/api/settings/administration',{headers:{Cookie:cookie}})).json(),team=admin.teams.find(row=>!row.archivedAt);
 await exerciseModelPolicy({page,runtime,cookie,team,evidence});
 if(!process.argv.includes('--models')){
 await exerciseOAuthApps({page,runtime,cookie,evidence});
 for(const width of [1440,390]){await exerciseIntegrationSettings({page,runtime,cookie,team,width,evidence});await exerciseGithubChain({page,runtime,cookie,team,width,evidence});proof.widths.push(width);}
 }
 proof.passed=true;
}finally{await browser?.close();await runtime.stop();await mkdir(evidence,{recursive:true});await writeFile(join(evidence,'browser-proof.json'),JSON.stringify(proof,null,2)+'\n');}
console.log(process.argv.includes('--models')?'[SEC-002] Model provider Settings, team off, Owner confirmation and audit passed; screens captured at 1440 and 390.':'[SLACK-003 SLACK-004 NOTIFY-007] Native channel bindings, Slack creation and delivery, Discord, member-linked Slack direct messages, per-event email choices and workspace defaults passed at 1440 and 390.');
