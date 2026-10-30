import {randomBytes} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,mkdir,writeFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {main as ownerCli} from '@runeditrun/rer/internal/modules/deploy-kit/owner-cli.mjs';
import {join} from 'node:path';
import declaration from '../../../deploy.json' with {type:'json'};
import {cloudflare} from '@runeditrun/rer/internal/modules/deploy-kit/provider.mjs';
import {ownerTarget,ownerPlan,ownerDeploy} from '@runeditrun/rer/internal/modules/deploy-kit/owner.mjs';
import {hash} from '@runeditrun/rer/internal/modules/deploy-kit/validation.mjs';
import {providerFixture as ownerProvider} from './cloudflare-edge/index.mjs';
const code='export default {fetch(){return new Response("ok")}}',sql='CREATE TABLE notes(id INTEGER PRIMARY KEY, body TEXT NOT NULL);';
const artifact={version:1,source:{sha:'5'.repeat(40),tree:'6'.repeat(40)},run:{id:'0',attempt:'1'},main:'index.js',modules:[{path:'index.js',base64:Buffer.from(code).toString('base64'),sha256:hash(code)}],assets:[],migrations:[{binding:'DB',name:'0001_notes.sql',sql,sha256:hash(sql)}]};
async function fixture(t) {
 const provider=ownerProvider(),root=await mkdtemp(join(await realpath(tmpdir()),'vector-owner-'));t.after(async()=>{provider.close();await rm(root,{recursive:true,force:true})});
 const api=cloudflare(provider),target=await ownerTarget(api,{project:declaration.project,environment:'production'}),plan=ownerPlan(target,declaration,artifact),statePath=join(root,'production.json');
 return {...provider,target,plan,statePath,args:{api,target,plan,artifact,statePath,env:{INSTALLATION_KEY:randomBytes(32).toString('hex'),SESSION_SECRET:'test-only-auth-secret',SETUP_TOKEN:'test-only-setup-token-at-least-32-bytes',SENDGRID_API_KEY:'test-only-sendgrid-key'},fetch:provider.fetch}};
}
test('actual Vector owner plan preserves native data, secrets and state on exact repeat',async t=>{
 const f=await fixture(t);assert.equal(f.target.worker,'vector-projects-production');assert.deepEqual(f.plan.crons,['* * * * *']);
 const first=await ownerDeploy(f.args);assert.equal(first.receipt.changed,true);
 const namespace=first.receipt.durableObjects.find(row=>row.binding==='RESTORE_COORDINATOR');assert(namespace?.id);
 f.state.databases[0].db.prepare("INSERT INTO notes VALUES(1,'retained')").run();
 f.state.objects.set('retained.txt',Buffer.from('retained object'));
 const before=await readFile(f.statePath),writes=f.state.writes.length,secretWrites=JSON.stringify(f.state.secrets);
 const repeat=await ownerDeploy(f.args);assert.equal(repeat.receipt.changed,false);assert.deepEqual(await readFile(f.statePath),before);
 assert.equal(repeat.receipt.durableObjects.find(row=>row.binding==='RESTORE_COORDINATOR').id,namespace.id);
 assert.equal(f.state.writes.length,writes);assert.equal(JSON.stringify(f.state.secrets)===secretWrites,true,'repeat retains private secret bindings');assert.equal(f.state.databases[0].db.prepare('SELECT body FROM notes').get().body,'retained');assert.equal(f.state.objects.get('retained.txt').toString(),'retained object');
});
test('missing owner secrets refuse before resource writes',async t=>{
 const f=await fixture(t),before=f.state.writes.length;await assert.rejects(ownerDeploy({...f.args,env:{}}),/secret/);assert.equal(f.state.writes.length,before);
});
test('an unrelated named resource is refused without adoption',async t=>{
 const f=await fixture(t);f.state.buckets.push({name:f.plan.r2[0].name});await assert.rejects(ownerDeploy(f.args),/collision/);
});
test('lost native create stays uncertain and is never adopted on retry',async t=>{
 const f=await fixture(t);f.fail('POST',/\/d1\/database$/,{afterApply:true});await assert.rejects(ownerDeploy(f.args));
 const databases=f.state.databases.length;assert.equal(databases,1);await assert.rejects(ownerDeploy(f.args));assert.equal(f.state.databases.length,databases);
});

test('owner exact repeat refuses live cron drift without writes or state replacement',async t=>{
 const f=await fixture(t);await ownerDeploy(f.args);const before=await readFile(f.statePath),writes=f.state.writes.length;
 f.state.schedules=[];await assert.rejects(ownerDeploy(f.args),/cron-drift/);
 assert.equal(f.state.writes.length,writes);assert.deepEqual(await readFile(f.statePath),before);
});

// This is a provider/CLI protocol fixture, not a real Worker execution proof.
// The separate native installer journey builds and serves the real application.
test('real owner CLI packages the Vector declaration, maps mail credentials and preserves state on deploy/health repeat',async t=>{
 const provider=ownerProvider(),root=await mkdtemp(join(await realpath(tmpdir()),'vector-owner-cli-'));
 t.after(async()=>{provider.close();await rm(root,{recursive:true,force:true})});
 for(const dir of ['dist/server','dist/client','migrations/core'])await mkdir(join(root,dir),{recursive:true});
 await writeFile(join(root,'dist/server/index.js'),code);
 await writeFile(join(root,'dist/server/wrangler.json'),JSON.stringify({main:'index.js',no_bundle:true,rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}]}));
 await writeFile(join(root,'dist/client/index.html'),'<h1>Protocol fixture</h1>');
 await writeFile(join(root,'migrations/core/0001_notes.sql'),sql);
 await writeFile(join(root,'deploy.json'),JSON.stringify({...declaration,vars:{...declaration.vars,FIRST_OWNER_EMAIL:'owner@cli.test',FIRST_OWNER_NAME:'Owner',WORKSPACE_NAME:'CLI fixture',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Delivery',DEFAULT_TEAM_PREFIX:'VEC',MAIL_FROM:'signin@cli.test'}}));
 await writeFile(join(root,'.gitignore'),'dist/\n.rer/\n');
 const git=(...args)=>execFileSync('env',['GIT_AUTHOR_NAME=Vector fixture','GIT_AUTHOR_EMAIL=fixture@example.test','GIT_COMMITTER_NAME=Vector fixture','GIT_COMMITTER_EMAIL=fixture@example.test','git','-c','commit.gpgsign=false',...args],{cwd:root,stdio:'pipe'});
 git('init','-q');git('add','.');git('commit','-qm','Owner CLI protocol fixture');
 const argv=['deploy','--declaration','deploy.json','--environment','production'],options={cwd:root,fetch:provider.fetch};
 const env={INSTALLATION_KEY:randomBytes(32).toString('hex'),CLOUDFLARE_ACCOUNT_ID:provider.accountId,CLOUDFLARE_API_TOKEN:provider.token,SESSION_SECRET:'test-only-session-secret',SETUP_TOKEN:'test-only-setup-token-at-least-32-bytes',SENDGRID_API_KEY:'test-only-sendgrid-key'};
 await assert.rejects(ownerCli(argv,{},options),error=>error.message==='missing-input');assert.equal(provider.state.writes.length,0);
 const first=await ownerCli(argv,env,options);assert.equal(first.changed,true);assert.equal(first.worker,'vector-projects-production');
 assert.equal(provider.state.secrets.find(row=>row.name==='MAIL_API_KEY').value,env.SENDGRID_API_KEY);assert.equal(provider.state.secrets.some(row=>row.name==='SENDGRID_API_KEY'),false);
 provider.state.databases[0].db.prepare("INSERT INTO notes VALUES(1,'retained CLI data')").run();provider.state.objects.set('retained.txt',Buffer.from('retained CLI object'));
 const before=await readFile(first.state),writes=provider.state.writes.length;
 assert.equal((await ownerCli(argv,env,options)).changed,false);
 assert.equal((await ownerCli(['health',...argv.slice(1)],env,options)).ok,true);
 assert.equal(provider.state.writes.length,writes);assert.deepEqual(await readFile(first.state),before);
 assert.equal(provider.state.databases[0].db.prepare('SELECT body FROM notes').get().body,'retained CLI data');assert.equal(provider.state.objects.get('retained.txt').toString(),'retained CLI object');
});
