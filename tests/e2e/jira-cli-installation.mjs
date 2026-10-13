import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {parseEnv} from 'node:util';
import {createCommands} from '@runeditrun/rer/commands';
import {commandEnvironment} from '../../scripts/installer-env.mjs';
import {freePort} from '@runeditrun/rer/adapter-settings';
import {confirmLink,readDevelopmentLink} from './outbox-session.mjs';
import {readCheckoutKey} from './dev-gate.mjs';
import {readLocalD1} from './local-d1-read.mjs';
/** A genuine rer setup/dev installation with the current worktree's implementation.
 * No importer seed, browser, built artifact or direct database mutation. */
export async function startJiraCliInstallation(){
 const scratch=await mkdtemp(join(tmpdir(),'vector-jira-cli-')),root=join(scratch,'app');let commands,child;
 const close=async()=>{try{if(child)await commands.stop(child);await commands?.closeCommands();}finally{await rm(scratch,{recursive:true,force:true});}};
 try{
  execFileSync('git',['clone','--quiet','--no-hardlinks','--no-checkout',process.cwd(),root],{stdio:'ignore'});
  // Copy the tracked worktree so merged manifests and CLI removals are reflected.
  // Checking out HEAD alone would exercise the pre-merge installation.
  const deleted=new Set(execFileSync('git',['ls-files','--deleted','-z'],{encoding:'utf8'}).split('\0'));
  const files=execFileSync('git',['ls-files','--cached','-z'],{encoding:'utf8'}).split('\0').filter(file=>file&&!deleted.has(file));
  for(const file of files)await cp(resolve(file),join(root,file),{recursive:true});
  await symlink(resolve('node_modules'),join(root,'node_modules'),'dir');
  const logDirectory=join(scratch,'private');await mkdir(logDirectory,{mode:0o700});
  const commandState={logs:[]};commands=await createCommands(logDirectory,commandState,{terminal:()=>{}});
  const environment=commandEnvironment({CI:'true',RER_SERVER_JOURNEY:'1',RER_LOCAL_OPERATION:undefined});
  const rer=join(root,'node_modules/@runeditrun/rer/bin/rer.mjs'),answers='jira-cli-setup-answers.json';
  await writeFile(join(root,answers),JSON.stringify({target:'local'}),{mode:0o600});
  const port=await freePort();await commands.run('Configure Jira CLI installation',process.execPath,[rer,'setup','--answers',answers,'--owner-email','jira-cli@example.test','--port',String(port),'--non-interactive'],{cwd:root,env:environment});
  const settings=parseEnv(await readFile(join(root,'.dev.vars'),'utf8')),origin=settings.APP_ORIGIN;
  commands.addSecrets([settings.SESSION_SECRET,settings.SETUP_TOKEN]);
  child=commands.spawn('Jira CLI development',process.execPath,[rer,'dev','--login'],{cwd:root,env:environment});
  // The native CLI completes its startup authentication checks after health.
  // Wait for its ready receipt so authentication setup cannot race preview counts.
  await commands.waitForReady('Jira CLI ready',child,async signal=>{try{const response=await fetch(origin+'/health',{signal});await response.arrayBuffer();return {ready:response.ok&&commandState.logs.some(line=>line.includes('RER_READY '+origin))};}catch{return {ready:false};}},{timeoutMs:120000});
  const request=async(path,method='GET',body,cookie='',extra={})=>{
   const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const bytes=await response.arrayBuffer();return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,headers:response.headers});
  };
  assert.equal((await request('/auth/request','POST',{email:'jira-cli@example.test'})).status,202);
  const link=await readDevelopmentLink(origin,request,'jira-cli@example.test',await readCheckoutKey(root));
  const confirmed=await confirmLink(link);assert.equal(confirmed.status,303);const cookie=confirmed.headers.get('set-cookie').split(';')[0];commands.addSecrets([cookie]);
  const setup=await request('/api/setup','GET',undefined,cookie);assert.equal(setup.status,200);const review=await setup.json();
  if(review.owner&&!review.completed)assert.equal((await request('/api/setup/complete','POST',{confirmed:true},cookie)).status,200);
  return {scratch,root,origin,cookie,close,environment,sql:query=>readLocalD1(join(root,'.wrangler/state'),query),request:(path,method='GET',body)=>request(path,method,body,cookie)};
 }catch(error){await close();throw error;}
}
