import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from '@playwright/test';
import {createUiRuntime} from './ui-runtime-support.mjs';
import {signIn,openAuthenticatedPage} from './ui-runtime-auth.mjs';
import {exerciseIntegrationSettings} from './integration-settings-journey.mjs';
const runtime=createUiRuntime(),evidence=resolve('evidence/integrations');let browser;
const proof={passed:false,widths:[],credentialsCaptured:false,liveProvider:false};
try{
 await mkdir(evidence,{recursive:true});runtime.initialize();runtime.start();await runtime.ready();const {cookie}=await signIn(runtime);browser=await chromium.launch({headless:true});const page=await openAuthenticatedPage(browser,cookie,runtime.base);
 const admin=await(await runtime.req('/api/settings/administration',{headers:{Cookie:cookie}})).json(),team=admin.teams.find(row=>!row.archivedAt);
 for(const width of [1440,390]){await exerciseIntegrationSettings({page,runtime,cookie,team,width,evidence});proof.widths.push(width);}
 proof.passed=true;
}finally{await browser?.close();await runtime.stop();await mkdir(evidence,{recursive:true});await writeFile(join(evidence,'browser-proof.json'),JSON.stringify(proof,null,2)+'\n');}
console.log('Native token, source, destination and signed PR link journeys passed at 1440 and 390.');
