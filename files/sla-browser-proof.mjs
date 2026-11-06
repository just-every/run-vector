import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const req=createRequire(process.cwd()+'/package.json'),{chromium}=req('@playwright/test');
const {runResolutionSlaRuntime}=await import(pathToFileURL(resolve('tests/e2e/resolution-sla-journey.mjs')));
const packet=resolve('../packet');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {
 await runResolutionSlaRuntime({browser,evidence:packet+'/screens'});
 await writeFile(packet+'/candidate-sla-browser.json',JSON.stringify({head,passed:true,widths:[1440,390],command:'node --import ./tests/e2e/integrations/register-loader.mjs /tmp/vector-final-sla-proof.mjs',door:'native Settings, issue detail and Inbox; real fixed-clock scheduled export',liveProvider:false,credentialsCaptured:false},null,2)+'\n');
}finally{await browser.close();}
