import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {createUiRuntime} from '../../tests/e2e/ui-runtime-support.mjs';
import {signIn,openAuthenticatedPage} from '../../tests/e2e/ui-runtime-auth.mjs';
import {exerciseGitlabSetup} from '../../tests/e2e/gitlab-setup-journey.mjs';
process.env.VECTOR_CHANNEL_EDGE=resolve('.artifacts/verification/gitlab-edge-'+process.pid+'.jsonl');
const runtime=createUiRuntime();let browser;
try{
 runtime.initialize();runtime.start();await runtime.ready();const {cookie}=await signIn(runtime);
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await openAuthenticatedPage(browser,cookie,runtime.base);
 await exerciseGitlabSetup({page,runtime,cookie,evidence:resolve(process.env.HOME,'rer-consolidation/work/sd-vector-c-f189/packet/browser')});
}finally{await browser?.close();await runtime.stop();}
