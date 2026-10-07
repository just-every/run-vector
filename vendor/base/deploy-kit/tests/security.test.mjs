import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, link, rm, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cloudflare } from '../provider.mjs';
import { regularBytes, readArtifact, collectFiles } from '../artifact.mjs';
import { assertCredentialFree } from '../prepare.mjs';
import { hash } from '../validation.mjs';
import { createTemplates, lockTemplates } from '../templates.mjs';
import { inspectOperations } from '../../../operations/operations.mjs';
const accountId='a'.repeat(32);
const response=(result,result_info)=>Response.json({success:true,result,errors:[],result_info});
async function temporary(t) {const dir=await realpath(await mkdtemp(join(tmpdir(),'deploy-kit-')));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('transport uses exact account, rejects arbitrary URLs, redacts provider errors, and has no retry',async()=>{
  let calls=0;const api=cloudflare({accountId,token:'test-secret',fetch:async(url,init)=>{calls++;assert.equal(url,`https://api.cloudflare.com/client/v4/accounts/${accountId}/queues`);assert.equal(init.redirect,'error');return Response.json({error:'test-secret'},{status:403});}});
  await assert.rejects(api.request('https://evil.test'),/invalid-provider-path/);assert.equal(calls,0);
  await assert.rejects(api.request('/queues'),error=>error.message==='provider-http-403');assert.equal(calls,1);
});
test('complete multi-page listing, partial page failure and request limits',async()=>{
  let calls=0;const api=cloudflare({accountId,token:'test',fetch:async()=>{calls++;return response([{name:`resource-${calls}`}],{page:calls,total_pages:2,total_count:2});}});
  assert.equal((await api.list('/d1/database')).length,2);
  const partial=cloudflare({accountId,token:'test',fetch:async()=>response([],{page:1,total_pages:1,total_count:2})});await assert.rejects(partial.list('/queues'),/partial-list/);
  const missing=cloudflare({accountId,token:'test',fetch:async()=>response([])});await assert.rejects(missing.list('/queues'),/incomplete-pagination/);
  const bounded=cloudflare({accountId,token:'test',maxRequests:1,fetch:async()=>response({})});await bounded.request('/queues');await assert.rejects(bounded.request('/queues'),/budget/);
});
test('R2 cursor traversal uses encoded cursors, rejects cycles and missing completion evidence',async()=>{
  let calls=0;const api=cloudflare({accountId,token:'test',fetch:async(url)=>{calls++;if(calls===1)return response({buckets:[{name:'one'}]},{per_page:1,cursor:'YWJj=='});assert(url.endsWith('cursor=YWJj%3D%3D'));return response({buckets:[]},{per_page:1});}});
  assert.equal((await api.list('/r2/buckets',{field:'buckets',pagination:'cursor'})).length,1);
  const cyclic=cloudflare({accountId,token:'test',fetch:async()=>response({buckets:[]},{per_page:100,cursor:'same'})});await assert.rejects(cyclic.list('/r2/buckets',{field:'buckets',pagination:'cursor'}),/cursor/);
});
test('body size, malformed success and malformed JSON fail closed',async()=>{
  for(const fetch of [async()=>Response.json({success:false,result:[]}),async()=>new Response('{'),async()=>new Response(' '.repeat(4*1024*1024+1))]) {const api=cloudflare({accountId,token:'test',fetch});await assert.rejects(api.request('/queues'));}
});
test('artifact rejects symlink, hardlink, directory, symlink parent and custody/hash mismatch',async t=>{
  const dir=await temporary(t);const file=join(dir,'data.json');await writeFile(file,'{}');await symlink(file,join(dir,'alias'));await assert.rejects(regularBytes(join(dir,'alias')));await link(file,join(dir,'hard'));await assert.rejects(regularBytes(file));await assert.rejects(regularBytes(dir));
  await mkdir(join(dir,'real'));await writeFile(join(dir,'real','file'),'data');await symlink(join(dir,'real'),join(dir,'fake'));await assert.rejects(regularBytes(join(dir,'fake','file')));
  const data={version:1,source:{sha:'1'.repeat(40),tree:'2'.repeat(40)},run:{id:'1',attempt:'1'},main:'index.js',modules:[{path:'index.js',base64:'',sha256:hash('')}],assets:[],migrations:[]};const path=join(dir,'artifact.json');const bytes=JSON.stringify(data);await writeFile(path,bytes);const expected={sha256:hash(bytes),sourceSha:data.source.sha,runId:'1',runAttempt:'1'};
  assert.equal((await readArtifact(path,expected)).main,'index.js');await assert.rejects(readArtifact(path,{...expected,runAttempt:'2'}),/custody/);await assert.rejects(readArtifact(path,{...expected,sha256:'0'.repeat(64)}),/digest/);
});
test('prepare refuses provider/mail/evidence credentials and Node injection before project execution',()=>{
  for(const name of ['CF_THROWAWAY_API_TOKEN','RESEND_API_KEY','SENDGRID_API_KEY','EVIDENCE_WRITE_TOKEN','GITHUB_TOKEN','ACTIONS_RUNTIME_TOKEN','NODE_OPTIONS','NODE_PATH']) assert.throws(()=>assertCredentialFree({[name]:'value'}));
  assert.doesNotThrow(()=>assertCredentialFree({PATH:'/usr/bin',CI:'true'}));
});
test('operations v2 required mail fails with missing, blank or wrong selected key; optional loops remain optional',async t=>{
  const dir=await temporary(t);await writeFile(join(dir,'verify.mjs'),'');
  const descriptor={version:2,project:'example/edition',runtime:{requirements:[]},requiredEnvironment:[],commands:{verify:{argv:['node','verify.mjs'],inputs:['verify.mjs'],effects:'Local validation'}},loops:[{id:'ticket-replies',type:'mail',required:true,enabled:true,provider:'resend'}]};
  await writeFile(join(dir,'OPERATIONS.json'),JSON.stringify(descriptor));
  for(const env of [{},{RESEND_API_KEY:' '},{SENDGRID_API_KEY:'fixture'},{RESEND_API_KEY:'fixture',MAIL_PROVIDER:'sendgrid'}]){const result=await inspectOperations(dir,env);assert.equal(result.ok,false);assert(!JSON.stringify(result).includes('fixture'));}
  assert.equal((await inspectOperations(dir,{RESEND_API_KEY:'fixture'})).ok,true);
  descriptor.loops[0].enabled=false;descriptor.loops[0].required=false;await writeFile(join(dir,'OPERATIONS.json'),JSON.stringify(descriptor));assert.equal((await inspectOperations(dir,{})).ok,true);
  descriptor.loops[0].required=true;await writeFile(join(dir,'OPERATIONS.json'),JSON.stringify(descriptor));assert.equal((await inspectOperations(dir,{RESEND_API_KEY:'fixture'})).ok,false);
});
test('new template calls real authoring lock/check and refuses any existing destination/lock',async t=>{
  const dir=await temporary(t);const root=join(dir,'edition');const args={destination:root,project:'example/edition',sourcePaths:['app.mjs'],commands:{verify:{argv:['node','app.mjs'],inputs:['app.mjs'],effects:'Local app validation'}}};
  await createTemplates(args);await writeFile(join(root,'app.mjs'),'export const value=1;');const git=(...argv)=>execFileSync('git',argv,{cwd:root,stdio:'pipe'});git('init');git('add','.');
  await lockTemplates(root);const lock=JSON.parse(await readFile(join(root,'sources.lock.json'),'utf8'));assert(lock.toolchain?.sha256 ?? lock.tools?.sha256 ?? JSON.stringify(lock).includes(hash('export const value=1;')));
  assert.equal((await inspectOperations(root,{})).ok,true);await assert.rejects(createTemplates(args));await assert.rejects(lockTemplates(root),/existing-source-lock/);
});
test('D1 documented pagination without total_pages follows total_count and rejects unstable counts',async()=>{
  let page=0;const api=cloudflare({accountId,token:'test',fetch:async()=>{page++;return response([{name:`db-${page}`}],{page,per_page:1,total_count:2});}});assert.equal((await api.list('/d1/database')).length,2);
  page=0;const unstable=cloudflare({accountId,token:'test',fetch:async()=>{page++;return response([{name:`db-${page}`}],{page,per_page:1,total_count:page+1});}});await assert.rejects(unstable.list('/d1/database'),/pagination-changed/);
});
test('CLI missing inputs exits nonzero with names only',()=>{
  let output='';try{execFileSync(process.execPath,['modules/deploy-kit/cli.mjs','deploy'],{cwd:process.cwd(),env:{PATH:process.env.PATH},stdio:'pipe'});assert.fail('unexpected success');}catch(error){assert.equal(error.status,1);output=error.stderr.toString();}
  const result=JSON.parse(output);assert.equal(result.code,'missing-input');assert(result.inputs.includes('CF_THROWAWAY_API_TOKEN'));assert(result.inputs.includes('RER_DEPLOY_SOURCE_SHA'));
});
test('actual packer reads Vite-shaped regular output and binds file hashes; escaping main is refused',async t=>{
  const {packageBuild}=await import('../prepare.mjs');const dir=await temporary(t);const root=join(dir,'source');
  for(const path of ['default-seed/dist/server/assets','default-seed/dist/server/.vite','default-seed/dist/client','default-seed/migrations/core'])await mkdir(join(root,path),{recursive:true});
  await writeFile(join(root,'default-seed/dist/server/wrangler.json'),JSON.stringify({main:'index.js',no_bundle:true,rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}]}));await writeFile(join(root,'default-seed/dist/server/index.js'),'export default {};');await writeFile(join(root,'default-seed/dist/server/assets/chunk.js'),'export const value=1;');await writeFile(join(root,'default-seed/dist/client/index.html'),'<h1>fixture</h1>');await writeFile(join(root,'default-seed/migrations/core/0001_schema.sql'),'CREATE TABLE example(id TEXT);');
  await writeFile(join(root,'default-seed/dist/server/.vite/manifest.json'),JSON.stringify({'virtual:cloudflare/worker-entry':{file:'index.js',isEntry:true}}));
  const args={root,source:{sha:'1'.repeat(40),tree:'2'.repeat(40)},runIdentity:{id:'1',attempt:'1'}};const artifact=await packageBuild(args);assert.equal(artifact.modules.length,2);assert.equal(artifact.assets.length,1);assert.equal(artifact.migrations[0].sha256,hash('CREATE TABLE example(id TEXT);'));
  await writeFile(join(root,'default-seed/dist/server/wrangler.json'),JSON.stringify({main:'../../outside.js'}));await assert.rejects(packageBuild(args),/local-path/);
});
