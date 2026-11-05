import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=process.cwd(), at=path=>pathToFileURL(root+'/'+path).href;
const require=createRequire(root+'/package.json');
const {chromium,expect}=require('@playwright/test');
const {collaborationRuntime}=await import(at('tests/e2e/collaboration-support.mjs'));
const {bootstrapOwner}=await import(at('tests/e2e/admin-runtime-support.mjs'));
const {attachmentImagesJourney}=await import(at('tests/e2e/attachment-images-journey.mjs'));
const output=process.env.PNG_PROBE_OUTPUT;
await mkdir(output,{recursive:true});
const runtime=await collaborationRuntime('png-selected');
let browser,context,page;
const startedAt=new Date().toISOString();
try {
  runtime.initialize();await runtime.start();
  browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
  context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();
  await bootstrapOwner(page,runtime);
  await page.goto(runtime.base+'/app/new-issue');
  await page.getByLabel(/^Title/).fill('synthetic-vector-2420');
  await page.getByLabel('Description',{exact:true}).fill('synthetic-vector-2421');
  const created=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/issues');
  await page.getByRole('button',{name:'Create issue',exact:true}).click();
  const response=await created;assert.equal(response.status(),201);const issue=await response.json();
  await page.getByRole('heading',{name:'synthetic-vector-2420',exact:true}).waitFor();
  if(process.env.PNG_PROBE_ALT==='1') {
    const press=page.keyboard.press.bind(page.keyboard);
    page.keyboard.press=async(key,...rest)=>{
      await press(key,...rest);
      if(key==='ArrowRight') await expect(page.getByRole('dialog',{name:'Image viewer'}).getByRole('img')).toHaveAttribute('alt','Screenshot 2');
    };
  }
  await attachmentImagesJourney({page,runtime,output,returnIssue:issue});
  await writeFile(output+'/receipt.json',JSON.stringify({passed:true,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedAt,completedAt:new Date().toISOString(),door:'rendered browser, native Worker, D1 and R2',assertionWidth:1440,proofWidths:[1440,390],browser:'/usr/bin/chromium'},null,2)+'\n');
} catch(error) {
  await writeFile(output+'/failure.json',JSON.stringify({passed:false,message:error.message,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()},null,2)+'\n');
  if(page) await page.screenshot({path:output+'/failure.png',fullPage:true});
  throw error;
} finally {
  await context?.close();await browser?.close();await runtime.stop();
}
