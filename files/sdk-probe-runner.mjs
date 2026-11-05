import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const at=path=>pathToFileURL(resolve(path)).href;
const {buildSdk}=await import(at('sdk/build.mjs'));
const {exerciseSdkIntake}=await import(at('tests/e2e/integrations/sdk-intake.mjs'));
const {createUiRuntime}=await import(at('tests/e2e/ui-runtime-support.mjs'));
const {signIn,openAuthenticatedPage}=await import(at('tests/e2e/ui-runtime-auth.mjs'));
const {chromium}=createRequire(resolve('package.json'))('@playwright/test');
const runtime=createUiRuntime(), observations=[];let browser;
const originalFetch=globalThis.fetch;
globalThis.fetch=async function(input,init) {
  const observed=init?.method==='PATCH' && new URL(String(input)).pathname.startsWith('/api/v1/');
  try {const response=await originalFetch.call(this,input,init);if(observed)observations.push({transport:'response',status:response.status});return response;}
  catch(error) {if(observed)observations.push({transport:'rejected',errorClass:error?.constructor?.name,causeCode:/^[A-Z0-9_]{1,80}$/.test(error?.cause?.code??'')?error.cause.code:null});throw error;}
};
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
try {
  buildSdk();
  const {VectorClient}=await import(at('sdk/dist/client.js'));
  const request=VectorClient.prototype.request;
  VectorClient.prototype.request=async function(id,input,...rest) {
    try {
      const value=await request.call(this,id,input,...rest);
      if(id==='issues_get_4') observations.push({operation:id,versionType:typeof value.data?.version});
      if(id==='issues_update_5') observations.push({operation:id,outcome:'fulfilled',status:value.status,expectedVersionFinite:Number.isFinite(input.body?.expectedVersion)});
      return value;
    } catch(error) {
      if(id==='issues_update_5') observations.push({operation:id,outcome:'rejected',errorClass:error?.constructor?.name,status:error?.status??null,sdkMessage:['Vector API transport failed','Unknown published operation','Missing or invalid path parameter'].includes(error?.message)?error.message:'other SDK error'});
      throw error;
    }
  };
  runtime.initialize();runtime.start();await runtime.ready();
  const {cookie}=await signIn(runtime);
  browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
  await openAuthenticatedPage(browser,cookie,runtime.base);
  const admin=await(await runtime.req('/api/settings/administration',{headers:{Cookie:cookie}})).json();
  await exerciseSdkIntake({runtime,cookie,team:admin.teams.find(row=>!row.archivedAt)});
  await writeFile(process.env.SDK_PROBE_OUTPUT,JSON.stringify({head,passed:true,exit:0,observations},null,2)+'\n');
  console.log('SDK main comparison passed');
} catch(error) {
  const failure=error?.code==='ERR_ASSERTION'?'assert.ok(error instanceof ApiError)':error?.constructor?.name;
  const {createWorkerExceptionDiagnostics}=await import(at('tests/e2e/worker-exception-diagnostics.mjs'));const diagnostics=createWorkerExceptionDiagnostics([]);diagnostics.append(runtime.log);
  await writeFile(process.env.SDK_PROBE_OUTPUT,JSON.stringify({head,passed:false,exit:1,test:'exerciseSdkIntake stale-version refusal',failure,observations,workerExceptions:diagnostics.snapshot()},null,2)+'\n');
  console.log('SDK comparison failed:',failure,JSON.stringify(observations));
  process.exitCode=1;
} finally {await browser?.close();await runtime.stop();}
