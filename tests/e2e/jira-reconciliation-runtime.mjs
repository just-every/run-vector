import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {chromium} from '@playwright/test';
import {startDataUiInstallation} from './data-ui-installation.mjs';
import {openAuthenticatedPage} from './ui-runtime-auth.mjs';
import {generateJiraFixture} from '../fixtures/import/jira/generate.mjs';
import {prepareJiraNativeRecords} from './jira-native-setup.mjs';
import {exerciseMappedReconciliation} from './mapped-reconciliation-journey.mjs';
const execute=promisify(execFile);

export async function runReconciliationJourney(exercise) {
 const directory=resolve(process.env.JIRA_EVIDENCE_DIR??'.artifacts/verification/jira');
 const scratch=await mkdtemp(join(tmpdir(),'vector-reconciliation-'));
 const proof={passed:false,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),captureWidths:process.env.JIRA_BROWSER_PROOF==='1'?[1440,390]:[1440],previews:[],captures:[],externalRequests:0};
 let installation,browser,page;
 try {
  await mkdir(directory,{recursive:true});
  installation=await startDataUiInstallation();
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
  page=await openAuthenticatedPage(browser,installation.cookie,installation.runtime.base);
  page.setDefaultTimeout(30000);await page.setViewportSize({width:1440,height:900});
  const origin=new URL(installation.runtime.base).origin;
  page.on('request',request=>{const url=new URL(request.url());if(['http:','https:'].includes(url.protocol)&&url.origin!==origin)proof.externalRequests++;});
  const fixture=generateJiraFixture(),native=await prepareJiraNativeRecords(page,installation.runtime.base,fixture);
  // Let the real scheduler finish sample reminders before preview's no-write check.
  await installation.runtime.scheduledRun();
  const session=join(scratch,'session');await writeFile(session,installation.cookie,{mode:0o600});
  const terminalReport=async id=>{
   const csv=join(scratch,id+'.csv');await rm(csv,{force:true});
   const {stdout}=await execute('pnpm',['--silent','run','import:issues','--','report','--origin',origin,'--session-file',session,'--run',id,'--csv',csv],{env:{...process.env,CI:'true'},maxBuffer:8*1024*1024});
   assert(!stdout.includes(installation.cookie),'The terminal never prints its session');
   assert.equal((await stat(csv)).mode&0o777,0o600,'The report file is private');
   terminalReport.csv=await readFile(csv,'utf8');return JSON.parse(stdout.trim());
  };
  await exercise({page,runtime:installation.runtime,native,directory,proof,terminalReport});
  await exerciseMappedReconciliation({page,runtime:installation.runtime,native,terminalReport,directory,proof});
  assert.equal(proof.externalRequests,0,'No provider or attachment requests');
  proof.passed=true;
 } catch(error) {
  proof.failure={name:error.name,message:error.message};
  if(page&&!page.isClosed())await page.screenshot({path:join(directory,'failure.png')});
  throw error;
 } finally {
  try{await browser?.close();}finally{try{await installation?.close();}finally{
   await rm(scratch,{recursive:true,force:true});await mkdir(directory,{recursive:true});
   await writeFile(join(directory,'proof.json'),JSON.stringify(proof,null,2)+'\n');
  }}
 }
}
