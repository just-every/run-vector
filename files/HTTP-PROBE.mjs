import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
const root=process.cwd(),packet=process.argv[2];
const require=createRequire(resolve(root,'package.json'));
const {chromium}=require('@playwright/test');
const {createAdminRuntime,bootstrapOwner}=await import(pathToFileURL(resolve(root,'tests/e2e/admin-runtime-support.mjs')));
const {inviteReader}=await import(pathToFileURL(resolve(root,'tests/e2e/role-reader-support.mjs')));
const runtime=createAdminRuntime(390,[],{port:15964,inspectorPort:15965});
let browser,context,member,step='initialize',cleaning;
const receipt={product_head:'36530f6ec447f66fe76ca2c7cef9adecbab53d1f',runtime:'built production Worker over real loopback HTTP and local D1',width:390,passed:false,statuses:[]};
async function cleanup(){
 if(cleaning)return cleaning;
 cleaning=(async()=>{await member?.context.close();await context?.close();await browser?.close();await runtime.stop();})();
 return cleaning;
}
process.once('SIGTERM',async()=>{await cleanup();process.exit(124);});
try{
 runtime.initialize();await runtime.start();
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:390,height:844}});
 const owner=await context.newPage();step='owner bootstrap';await bootstrapOwner(owner,runtime);
 step='member invitation';member=await inviteReader({owner,browser,runtime,email:'synthetic-vector-http-member@vector.test',name:'Synthetic permission member',role:'member',width:390});
 const call=(who,path,method='GET',data)=>who.request.fetch(runtime.base+'/api'+path,{method,headers:{Origin:runtime.base},...(data===undefined?{}:{data})});
 const ok=async(path,method,data)=>{const r=await call(owner,path,method,data);assert.equal(r.status(),200);return r.json();};
 const make=async(name,prefix,parent)=>{const r=await ok('/settings/teams','POST',{name,identifierPrefix:prefix,...(parent?{parentTeamId:parent}:{})});return r.teams.find(t=>t.identifierPrefix===prefix);};
 step='parent child setup';
 const parent=await make('Synthetic HTTP permission parent','HPPAR');
 await ok(`/settings/teams/${parent.id}/permissions`,'PUT',{settings:'all_members',planning:'team_owners'});
 const child=await make('Synthetic HTTP permission child','HPCHD',parent.id);
 for(const id of [parent.id,child.id])await ok(`/settings/teams/${id}/members/${member.id}`,'PUT',{role:'member'});
 const current=async()=> (await ok('/settings/administration')).teams.find(t=>t.id===child.id);
 const probe=async(label,who,path,body,expected)=>{step=label;const r=await call(who,path,'PUT',body);receipt.statuses.push({door:label,status:r.status()});assert.equal(r.status(),expected);return r;};
 step='inherited no-op';assert.equal((await current()).permissionsInherited,true);
 const initial={settings:'all_members',planning:'team_owners'};
 await probe('child inherited no-op Member',member.page,`/settings/teams/${child.id}/permissions`,initial,403);
 assert.equal((await current()).permissionsInherited,true);
 for(const key of ['planning','settings']){
  const before=await current();
  const next={settings:before.settingsPermission,planning:before.planningPermission,[key]:key==='planning'?'all_members':'team_owners'};
  await probe(`root ${key} Member`,member.page,`/settings/teams/${parent.id}/permissions`,next,403);
  await probe(`hierarchy ${key} Member`,member.page,`/settings/teams/${child.id}/hierarchy`,{version:before.hierarchyVersion,permissionsInherited:false,[key==='planning'?'planningPermission':'settingsPermission']:next[key]},403);
  await probe(`child ${key} Member`,member.page,`/settings/teams/${child.id}/permissions`,next,403);
  assert.deepEqual(await current(),before);
  await probe(`child ${key} Owner`,owner,`/settings/teams/${child.id}/permissions`,next,200);
  const after=await current();assert.equal(after.settingsPermission,next.settings);assert.equal(after.planningPermission,next.planning);
 }
 await probe('child privacy Member',member.page,`/settings/teams/${child.id}/privacy`,{isPrivate:true},403);
 await probe('child privacy Owner',owner,`/settings/teams/${child.id}/privacy`,{isPrivate:true},200);
 receipt.passed=true;
 console.log('HTTP PROBE child permission door: Member -> 403; Owner -> 200 (settings and planning); root -> 403; hierarchy -> 403; inherited no-op preserved.');
}catch(error){receipt.failure={step,name:error.name,code:error.code??null};console.log('HTTP PROBE failed at '+step+' ('+error.name+')');process.exitCode=1;}
finally{await cleanup();await writeFile(resolve(packet,'HTTP-PROBE.json'),JSON.stringify(receipt,null,2)+'\n');}
