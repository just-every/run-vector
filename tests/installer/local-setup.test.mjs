import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,stat,rm,writeFile,mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareSettings, readSettings } from '../../scripts/base-onboarding/adapter-settings.mjs';
import { settings,validateSettings } from '../../scripts/installer/definition.mjs';
import { withoutLocalVariables } from '../../scripts/base-onboarding/local/build.mjs';
const input={FIRST_OWNER_EMAIL:'owner@installation.test',FIRST_OWNER_NAME:'Owner',WORKSPACE_NAME:'Workspace',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Work',DEFAULT_TEAM_PREFIX:'VEC'};
export async function localFixture(t) {
 const root=await mkdtemp(join(tmpdir(),'vector-settings-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const secrets=[];const context={root,manifest:JSON.parse(await readFile('rer-setup.json','utf8')),input,store:{step:async()=>{},addSecrets:values=>secrets.push(...values)}};
 return {root,context,secrets};
}
test('private settings preserve exact bytes, owner and saved origin across reruns and builds',async t=>{
 const {root,context,secrets}=await localFixture(t);
 await prepareSettings(context,{secrets:settings});
 const before=await readFile(join(root,'.dev.vars'));
 assert.equal((await stat(join(root,'.dev.vars'))).mode&0o777,0o600);
 assert.equal(context.vars.FIRST_OWNER_EMAIL,input.FIRST_OWNER_EMAIL);
 assert.equal(context.vars.DEFAULT_TEAM_PREFIX,input.DEFAULT_TEAM_PREFIX);
 assert(secrets.includes(context.vars.SESSION_SECRET));
 const origin=validateSettings(context.vars).origin;
 await prepareSettings({...context,input:{...input,FIRST_OWNER_EMAIL:'replacement@installation.test'}},{secrets:settings});
 assert.deepEqual(await readFile(join(root,'.dev.vars')),before);
 // This scratch installation acquires its own real lease; the inherited rer verify lease belongs to the parent checkout.
 await withoutLocalVariables(root,async()=>assert.rejects(readFile(join(root,'.dev.vars')),error=>error.code==='ENOENT'),{nested:null});
 assert.deepEqual(await readFile(join(root,'.dev.vars')),before);
 assert.equal((await readSettings(root,settings)).values.APP_ORIGIN,origin);
});
