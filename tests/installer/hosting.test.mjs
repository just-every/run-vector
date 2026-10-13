import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile,stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import declaration from '../../deploy.json' with {type:'json'};
import { prepareHosting,hostingDeclaration,hostingSecrets } from '../../scripts/installer/hosting.mjs';
test('owner declaration maps the one SendGrid input to the established Worker binding',()=>{
 assert.deepEqual(declaration.d1,[{binding:'DB'}]);assert.deepEqual(declaration.r2,[{binding:'FILES'}]);assert.deepEqual(declaration.crons,['* * * * *']);
 assert.equal(declaration.originVar,'APP_ORIGIN');assert.deepEqual(declaration.secrets,[{binding:'SESSION_SECRET',environment:'SESSION_SECRET'},{binding:'MAIL_API_KEY',environment:'SENDGRID_API_KEY'}]);
});
test('hosting preparation refuses missing public inputs and reuses private secrets without rotation',async t=>{
 const root=await mkdtemp(join(tmpdir(),'vector-hosting-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const captured=[];const context={root,store:{step:async()=>{},report:()=>{},addSecrets:values=>captured.push(...values)},fail:()=>Error('deployment inputs missing')};
 await assert.rejects(prepareHosting(context,{}),/inputs missing/);
 await assert.rejects(readFile(join(root,hostingSecrets)),error=>error.code==='ENOENT');
 const env={FIRST_OWNER_EMAIL:'owner@hosted.test',FIRST_OWNER_NAME:'Owner',WORKSPACE_NAME:'Work',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Delivery',DEFAULT_TEAM_PREFIX:'VEC',MAIL_FROM:'signin@hosted.test',SENDGRID_API_KEY:'test-only-mail-key'};
 const first=await prepareHosting(context,env), before=await readFile(join(root,hostingSecrets));
 assert(captured.includes(first.SESSION_SECRET));assert.equal((await stat(join(root,hostingSecrets))).mode&0o777,0o600);
 await prepareHosting(context,{...env,SENDGRID_API_KEY:'test-only-replacement'});
 assert.deepEqual(await readFile(join(root,hostingSecrets)),before);
 const declared=JSON.parse(await readFile(join(root,hostingDeclaration)));assert.equal(declared.vars.FIRST_OWNER_EMAIL,env.FIRST_OWNER_EMAIL);
 assert.equal(declared.vars.SENDGRID_API_KEY,undefined);assert.equal(declared.vars.SESSION_SECRET,undefined);
});
