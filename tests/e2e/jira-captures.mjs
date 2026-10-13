import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {startDataUiInstallation} from './data-ui-installation.mjs';
import {openAuthenticatedPage} from './ui-runtime-auth.mjs';
import {generateJiraFixture} from '../fixtures/import/jira/generate.mjs';
import {prepareJiraNativeRecords} from './jira-native-setup.mjs';
import {exerciseJiraPublicJourney} from './jira-public-journey.mjs';
import {tableCounts} from './jira-review-checks.mjs';

// This standalone evidence command uses the same genuine configured clone as
// the development UI suite. Build dist first; no provider credentials required.
const directory=resolve('visual/jira');
const proof={passed:false,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),authentication:'development outbox',previews:[],captures:[],externalRequests:0};
let installation,browser,page;
try {
 await mkdir(directory,{recursive:true});
 installation=await startDataUiInstallation();
 browser=await chromium.launch({headless:true});
 page=await openAuthenticatedPage(browser,installation.cookie,installation.runtime.base);
 page.setDefaultTimeout(30000);
 const origin=new URL(installation.runtime.base).origin;
 page.on('request',request=>{
  const url=new URL(request.url());
  if(['http:','https:'].includes(url.protocol)&&url.origin!==origin)proof.externalRequests++;
 });
 const fixture=generateJiraFixture();
 const native=await prepareJiraNativeRecords(page,installation.runtime.base,fixture);
 proof.native={team:native.team.name,operatorMapped:true,labels:fixture.expected.nativeSetup.labels,cycles:native.cycles.map(row=>row.name)};
 const before=tableCounts(installation.runtime);
 // Observe the real scheduler's completion before measuring preview writes.
 // Sample due-reminder work remains enabled and finishes through its own flow.
 await installation.runtime.scheduledRun();
 const reminderReceipts=installation.runtime.sql("SELECT a.action,a.created_at,r.kind,n.causes_json FROM due_reminders r JOIN notifications n ON n.event_id=r.claim_id JOIN audit_records a ON a.id=r.claim_id ORDER BY a.created_at");
 proof.scheduledSetup={completed:true,before,after:tableCounts(installation.runtime),reminderReceipts};
 await exerciseJiraPublicJourney({page,runtime:installation.runtime,native,directory,proof});
 assert.equal(proof.externalRequests,0,'No provider, LiveTL or attachment requests');
 proof.passed=true;
} catch(error) {
 proof.failure={name:error.name,message:error.message};
 if(page&&!page.isClosed())await page.screenshot({path:join(directory,'actual-failure-viewport.png')});
 throw error;
} finally {
 try {await browser?.close();} finally {
  try {await installation?.close();} finally {
   await mkdir(directory,{recursive:true});
   await writeFile(join(directory,'captures.json'),JSON.stringify(proof,null,2)+'\n');
  }
 }
}
console.log(JSON.stringify({passed:proof.passed,sourceCommit:proof.sourceCommit,authentication:proof.authentication,captures:proof.captures.map(({state,width,panel,viewport})=>({state,width,panel,viewport})),previews:proof.previews.map(({variant,ready,tableCount})=>({variant,ready,tableCount})),run:proof.run?.id,report:proof.report,externalRequests:proof.externalRequests},null,2));
