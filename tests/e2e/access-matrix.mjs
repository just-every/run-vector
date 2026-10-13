import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,readdir,writeFile,cp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createState} from '../../scripts/base-onboarding/state.mjs';
import {freePort} from '../../scripts/base-onboarding/adapter-settings.mjs';
import {readOwnedGroup} from '../../scripts/base-onboarding/local/process-table.mjs';
import {commandEnvironment} from '../../scripts/installer-env.mjs';
import {opaqueToken,hashToken} from '../../vendor/base/operator-auth/crypto.mjs';
import {readLocalD1} from './local-d1-read.mjs';
const root=process.cwd(),work=await mkdtemp(join(tmpdir(),'vector-access-'));
const store=await createState(work,{product:'Vector access proof',model:{safeKeys:[]}}),signal=new AbortController();
store.setCommandSignal(signal.signal);
const secret='test-only-access-matrix-secret-with-at-least-32-characters';
store.addSecrets([secret]);
const report={checks:[],teardown:[],source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()};
const wrangler=resolve('node_modules/wrangler/bin/wrangler.js'),state=join(work,'state');
let child;
const command=(label,args)=>store.run(label,process.execPath,[wrangler,...args],{cwd:root,env:commandEnvironment()});
const sql=query=>readLocalD1(state,query);
async function stop(){if(child){const owned=child;child=undefined;await store.stop(owned);report.teardown.push({group:owned.pid,gone:(await readOwnedGroup(owned.pid)).length===0});}}
try {
 await cp('dist/server',join(work,'server'),{recursive:true});await cp('dist/client',join(work,'client'),{recursive:true});
 await cp('tests/e2e/access-worker-fixture.mjs',join(work,'server/probe.mjs'));
 const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
 config.main='probe.mjs';config.find_additional_modules=true;
 config.d1_databases[0].migrations_dir=resolve('migrations/core');
 const configPath=join(work,'server/wrangler.json');
 const port=await freePort(),wire='http://127.0.0.1:'+port;
 const fetchWire=(path,options={})=>fetch(wire+path,{redirect:'manual',...options});
 async function start(hosted){
  const origin=(hosted?'https':'http')+'://127.0.0.1:'+port;
  config.vars={...config.vars,APP_ORIGIN:origin,SEED_SAMPLE_DATA:'true',FIRST_OWNER_EMAIL:'sarah@vector.test',FIRST_OWNER_NAME:'Sarah',WORKSPACE_NAME:'Access proof',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Flow',DEFAULT_TEAM_PREFIX:'FLW',SESSION_SECRET:secret,MAIL_FROM:'Vector <signin@vector.test>',MAIL_MODE:hosted?'production':'local-outbox',MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'test-only-no-provider-request'};
  await writeFile(configPath,JSON.stringify(config));
  child=store.spawn('Access Worker',process.execPath,[wrangler,'dev','--config',configPath,'--local','--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--persist-to',state,'--show-interactive-dev-session=false'],{cwd:root,env:commandEnvironment()});
  await store.waitForReady('Access Worker health',child,async signal=>{try{return {ready:(await fetchWire('/health',{signal})).ok}}catch{return {ready:false}}},{signal:signal.signal});
  return origin;
 }
 await command('Native migrations',['d1','migrations','apply','vector-local','--local','--config','wrangler.jsonc','--persist-to',state]);
 await start(false);await stop();
 const owner=sql("SELECT id FROM oa_operators WHERE email='sarah@vector.test'")[0].id;
 const fixtures=new Map(),now=Date.now();
 for(const mode of ['local','hosted'])for(const kind of ['valid','expired','revoked','document','api','function','file']){
  const token=opaqueToken(),id=mode+'-'+kind;store.addSecrets([token]);fixtures.set(id,token);
 }
 const statements=await Promise.all([...fixtures].map(async([id,token])=>`INSERT INTO oa_sessions(id,operator_id,operator_version,kind,token_hash,expires_at,revoked_at,created_at) SELECT '${id}',id,version,'native','${await hashToken(secret,'session',token)}',${id.endsWith('expired')?now-1000:now+86400000},${id.endsWith('revoked')?now:'NULL'},${now} FROM oa_operators WHERE id='${owner}';`));
 const fixturePath=join(work,'session-fixture.sql');await writeFile(fixturePath,statements.join('\n'),{mode:0o600});
 await command('Native sessions',['d1','execute','vector-local','--local','--config','wrangler.jsonc','--persist-to',state,'--file',fixturePath]);await rm(fixturePath);
 const loaders=(await readdir('dist/server/assets')).find(name=>name.startsWith('loaders-')&&name.endsWith('.js'));
 const generated=(await readFile('dist/server/assets/'+loaders,'utf8')).match(/id:\s*"([a-f0-9]{64})"/)[1];
 for(const hosted of [false,true]){
  const mode=hosted?'hosted':'local',origin=await start(hosted),cookieName=hosted?'__Host-operator_session':'operator_session_local_'+new URL(origin).port;
  const headers=kind=>({Cookie:cookieName+'='+fixtures.get(mode+'-'+kind),Origin:origin});
  const created=await fetchWire('/api/issues',{method:'POST',headers:{...headers('valid'),'Content-Type':'application/json'},body:JSON.stringify({title:'Private matrix issue',teamId:sql('SELECT id FROM teams LIMIT 1')[0].id})});assert.equal(created.status,201);const issue=await created.json();
  const uploaded=await fetchWire('/api/issues/'+issue.identifier+'/files',{method:'POST',headers:{...headers('valid'),'Content-Type':'text/plain','x-file-name':'matrix.txt'},body:'private matrix attachment'});assert.equal(uploaded.status,201);const file=await uploaded.json();
  const surfaces={document:'/app',api:'/api/issues',function:'/_serverFn/'+generated,file:'/api/issues/'+issue.identifier+'/files/'+file.id};
  for(const stateName of ['missing','expired','revoked','valid'])for(const [surface,path] of Object.entries(surfaces)){
   const response=await fetchWire(path,{headers:{...(stateName==='missing'?{Origin:origin}:headers(stateName)),...(surface==='function'?{'x-tsr-serverFn':'true','Sec-Fetch-Site':'same-origin',Accept:'application/json'}:{})}});
   const text=await response.text();
   assert.equal(response.status,stateName==='valid'?200:surface==='document'?302:surface==='function'?200:401,mode+' '+surface+' '+stateName);
   if(stateName!=='valid'){assert(!text.includes('Private matrix issue'));assert(!text.includes('private matrix attachment'));if(surface==='function')assert.match(text,/signin/);}
   else if(surface==='file')assert.equal(text,'private matrix attachment');
   report.checks.push({mode,surface,state:stateName,status:response.status});
  }
  for(const [surface,path] of Object.entries(surfaces)){
   const response=await fetchWire(path,{headers:{...headers(surface),'x-vector-test-revoke':mode+'-'+surface,...(surface==='function'?{'x-tsr-serverFn':'true','Sec-Fetch-Site':'same-origin',Accept:'application/json'}:{})}});
   assert.equal(response.headers.get('x-vector-test-revoked'),'true');assert.equal(response.status,401);
   assert.equal(sql(`SELECT count(*) n FROM oa_sessions WHERE id='${mode}-${surface}' AND revoked_at IS NULL`)[0].n,0);
   const body=await response.text();assert(!body.includes('private matrix attachment'));assert(!body.includes('Private matrix issue'));
   report.checks.push({mode,surface,state:'revoked-at-final-read',status:response.status});
  }
  if(hosted)assert.equal((await fetchWire('/__dev/outbox')).status,404);
  await stop();
 }
 assert(report.teardown.every(row=>row.gone));report.transport='loopback with test-only HTTPS request adapter; no hosted deployment';report.status='passed';console.log('Native access matrix: '+report.checks.length+' checks passed.');
}finally{
 signal.abort();await stop();await store.closeCommands();
 await mkdir('evidence/access',{recursive:true});await writeFile('evidence/access/proof.json',JSON.stringify(report,null,2)+'\n');await rm(work,{recursive:true,force:true});
}
