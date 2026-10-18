import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {createAdminRuntime,bootstrapOwner} from './admin-runtime-support.mjs';
import {exerciseProfileBrowser} from './data-profile-journey.mjs';
import {exerciseProfileCli} from './data-staged-cli.mjs';
const evidence=resolve(process.env.VECTOR_PROFILE_EVIDENCE??'.artifacts/verification/profiles'),scratch=await mkdtemp(join(tmpdir(),'vector-profiles-'));
await mkdir(evidence,{recursive:true});
const runtime=createAdminRuntime(1440,[],{port:15966,inspectorPort:15967});let browser,page;
try {
 runtime.initialize();await runtime.start();browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();page.setDefaultTimeout(20000);await bootstrapOwner(page,runtime);
 const state=await (await context.request.get(runtime.base+'/api/settings/administration')).json(),team=state.teams[0],status=team.statuses.find(s=>s.category==='unstarted');
 for(const width of [1440,390])await exerciseProfileBrowser({page,runtime,team,status,width,evidence});
 const cookie=(await context.cookies()).map(c=>c.name+'='+c.value).join('; '),session=join(scratch,'session');await writeFile(session,cookie,{mode:0o600});
 const command=(verb,...args)=>{const out=execFileSync(process.execPath,['scripts/data/import-issues.mjs',verb,'--origin',runtime.base,'--session-file',session,...args],{encoding:'utf8',maxBuffer:1024*1024});assert.ok(!out.includes(cookie));return JSON.parse(out);};
 await exerciseProfileCli({runtime,scratch,command,team,status});
} catch(error) {if(page)await page.screenshot({path:evidence+'/DATA-015-failure.png'}).catch(()=>{});throw error;}
finally {if(browser)await browser.close();await runtime.stop();await rm(scratch,{recursive:true,force:true});}
