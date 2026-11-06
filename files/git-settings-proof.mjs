import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const req=createRequire(process.cwd()+'/package.json'),{chromium}=req('@playwright/test');
const load=path=>import(pathToFileURL(resolve(path)));
const {createUiRuntime}=await load('tests/e2e/ui-runtime-support.mjs');
const {signIn,openAuthenticatedPage}=await load('tests/e2e/ui-runtime-auth.mjs');
const {exerciseGithubChain}=await load('tests/e2e/integrations/github-chain.mjs');
process.env.VECTOR_CHANNEL_EDGE=resolve('.artifacts/verification/saved-status-edge-'+process.pid+'.jsonl');
const runtime=createUiRuntime();let browser;
try {
 runtime.initialize();runtime.start();await runtime.ready();
 const {cookie}=await signIn(runtime);
 const admin=await(await runtime.req('/api/settings/administration',{headers:{Cookie:cookie}})).json();
 const team=admin.teams.find(t=>!t.archivedAt);
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await openAuthenticatedPage(browser,cookie,runtime.base);page.setDefaultTimeout(20000);
 for(const width of [1440,390])await exerciseGithubChain({page,runtime,cookie,team,width,evidence:resolve('.artifacts/verification/saved-status-proof')});
 console.log('PROBE Saved status: existing native Git Settings journey passes unchanged at 1440 and 390, including serious and critical axe checks.');
}finally{await browser?.close();await runtime.stop();}
