import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const root=process.cwd(),load=path=>import(pathToFileURL(root+'/'+path));
const {chromium}=await load('node_modules/@playwright/test/index.mjs');
const {createAdminRuntime,bootstrapOwner}=await load('tests/e2e/admin-runtime-support.mjs');
const {streamControlsJourney}=await load('tests/e2e/core-stream-controls-journey.mjs');
const evidence=root+'/.artifacts/verification/stream-tail-probe';await mkdir(evidence,{recursive:true});
const runtime=createAdminRuntime(1440,[],{port:15954,inspectorPort:15955});let browser;
try{
 runtime.initialize();await runtime.start();browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{Connection:'close'}});
 const page=await context.newPage();await bootstrapOwner(page,runtime);
 await streamControlsJourney(page,context,runtime.base,(...args)=>console.log('PASS',...args),undefined,[1440]);
 console.log('STREAM_PROBE_PASS width=1440');
}finally{await browser?.close();await runtime.stop();}
