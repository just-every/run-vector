import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {startDataUiInstallation} from './data-ui-installation.mjs';
import {openAuthenticatedPage} from './ui-runtime-auth.mjs';
import {exerciseDataMapping} from './data-ui-journey.mjs';
import {exerciseStagedCli} from './data-staged-cli.mjs';
const evidence=resolve('evidence/data'),scratch=await mkdtemp(join(tmpdir(),'vector-import-cli-'));let browser,installation;
const proof={passed:false,widths:[],publicCommands:[],privateReview:false};
try{
 await mkdir(evidence,{recursive:true});installation=await startDataUiInstallation();const {runtime,cookie}=installation;
 browser=await chromium.launch({headless:true});const page=await openAuthenticatedPage(browser,cookie,runtime.base);
 const options=await(await runtime.req('/api/data/import/options',{headers:{Cookie:cookie}})).json(),team=options.references.teams.find(row=>!row.archived_at),status=options.references.statuses.find(row=>row.team_id===team.id&&row.category==='unstarted')??options.references.statuses.find(row=>row.team_id===team.id);
 for(const width of [1440,390]){await exerciseDataMapping({page,runtime,team,status,width,evidence});proof.widths.push(width);}
 const session=join(scratch,'session'),file=join(scratch,'issues.json'),mapping=join(scratch,'mapping.json'),review=join(scratch,'review.json');
 await writeFile(session,cookie,{mode:0o600});await writeFile(file,JSON.stringify([{key:'cli-record',headline:'Public CLI mapped issue',organisation:team.name}]),{mode:0o600});
 await writeFile(mapping,JSON.stringify({mapping:{sourceId:'key',title:'headline',team:'organisation'},defaults:{status:status.id}}),{mode:0o600});
 const command=(verb,...args)=>{
  const stdout=execFileSync('pnpm',['--silent','run','import:issues','--',verb,'--origin',runtime.base,'--session-file',session,...args],{encoding:'utf8',env:{...process.env,CI:'true'},maxBuffer:1024*1024});
  assert(!stdout.includes(cookie),'CLI never prints a session');proof.publicCommands.push(verb);return JSON.parse(stdout.trim());
 };
 const preview=command('preview','--file',file,'--format','json','--source','cli-mapped-source','--mapping',mapping,'--review',review);assert.equal(preview.ready,true);assert.equal(preview.rows,1);assert.equal((await stat(review)).mode&0o777,0o600);proof.privateReview=true;
 const applied=command('apply','--review',review,'--yes');assert.equal(applied.state,'completed');assert.equal(applied.checkpoint,1);
 assert.deepEqual(command('apply','--review',review,'--yes'),applied);assert.equal(command('status','--run',applied.id).state,'completed');assert.equal(command('resume','--run',applied.id).state,'completed');
 const before=runtime.sql("SELECT count(*) AS n FROM issues WHERE title='Public CLI mapped issue'")[0].n;assert.equal(before,1);
 assert.equal(command('rollback','--run',applied.id,'--yes').state,'rolled_back');assert.equal(runtime.sql("SELECT count(*) AS n FROM issues WHERE title='Public CLI mapped issue'")[0].n,0);
 proof.staged=await exerciseStagedCli({runtime,cookie,scratch,command,session});
 proof.passed=true;
}finally{await browser?.close();await installation?.close();await rm(scratch,{recursive:true,force:true});await mkdir(evidence,{recursive:true});await writeFile(join(evidence,'mapping-proof.json'),JSON.stringify(proof,null,2)+'\n');}
console.log('Mapped import UI at 1440/390, public CLI preview/apply/status/resume/rollback and the staged 2,000-issue CLI run passed.');
