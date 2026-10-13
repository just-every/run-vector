import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configurationReport} from '../scripts/operations-config.mjs';
import {validatePublicConfiguration,validateSuppliedSecrets} from '../scripts/deployment/input-validation.mjs';
import {validateControllerInputs} from '../scripts/deployment/controller-inputs.mjs';
import {prepareSettings} from '@runeditrun/rer/adapter-settings';
import {writePrivateFile} from '@runeditrun/rer/private-files';
import {settings,validateSettings} from '../scripts/installer/definition.mjs';
export const hosted={VECTOR_OPERATION_MODE:'hosted',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'synthetic-token',APP_ORIGIN:'https://vector.example.test',SESSION_SECRET:'test-only-session-secret-at-least-32-characters',SENDGRID_API_KEY:'synthetic-key',FIRST_OWNER_EMAIL:'owner@example.test',FIRST_OWNER_NAME:'Owner',WORKSPACE_NAME:'Workspace',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Team',DEFAULT_TEAM_PREFIX:'VEC',MAIL_FROM:'signin@example.test'};
const invalid=[['FIRST_OWNER_EMAIL','invalid'],['WORKSPACE_TIMEZONE','Invalid/Zone'],['DEFAULT_TEAM_PREFIX','x'],['MAIL_FROM','invalid'],['SENDGRID_API_KEY','has spaces'],['SESSION_SECRET','x'.repeat(1025)],['FIRST_OWNER_NAME','x'.repeat(201)]];

test('operations shares native deployment validators for every invalid public and secret input',async()=>{
 assert.equal((await configurationReport(hosted)).ok,true);
 for(const [name,value] of invalid){
  const env={...hosted,[name]:value};
  assert.throws(()=>{validatePublicConfiguration(env);validateSuppliedSecrets({SESSION_SECRET:env.SESSION_SECRET,MAIL_API_KEY:env.SENDGRID_API_KEY})});
  const report=await configurationReport(env);
  assert.equal(report.ok,false,name);assert.deepEqual(report.invalid,[name]);
 }
});

test('artifact configuration shares controller syntax admission and reports every invalid field offline',async()=>{
 const env={VECTOR_OPERATION_MODE:'artifact',CF_THROWAWAY_ACCOUNT_ID:'a'.repeat(32),CF_THROWAWAY_API_TOKEN:'fixture-token',RER_DEPLOY_ARTIFACT:'/tmp/fixture-artifact',RER_DEPLOY_ARTIFACT_SHA256:'a'.repeat(64),RER_DEPLOY_SOURCE_SHA:'b'.repeat(40),RER_DEPLOY_RUN_ID:'123',RER_DEPLOY_RUN_ATTEMPT:'1',RER_DEPLOY_RECEIPT:'/tmp/fixture-receipt',RER_DEPLOY_PLAN:'/tmp/fixture-plan',SESSION_SECRET:hosted.SESSION_SECRET,MAIL_API_KEY:hosted.SENDGRID_API_KEY};
 assert.equal((await configurationReport(env)).ok,true);validateControllerInputs(env);
 const invalid={CF_THROWAWAY_ACCOUNT_ID:'invalid',CF_THROWAWAY_API_TOKEN:'has\nnewline',RER_DEPLOY_ARTIFACT:'relative',RER_DEPLOY_ARTIFACT_SHA256:'invalid',RER_DEPLOY_SOURCE_SHA:'invalid',RER_DEPLOY_RUN_ID:'x',RER_DEPLOY_RUN_ATTEMPT:'x',RER_DEPLOY_RECEIPT:'relative',RER_DEPLOY_PLAN:'relative',SESSION_SECRET:'short',MAIL_API_KEY:'has spaces'};
 for(const [name,value] of Object.entries(invalid)) {
  const supplied={...env,[name]:value};assert.throws(()=>validateControllerInputs(supplied));assert.deepEqual((await configurationReport(supplied)).invalid,[name]);
 }
 assert.deepEqual(new Set((await configurationReport({...env,...invalid})).invalid),new Set(Object.keys(invalid)));
});
test('local configuration checks saved settings with the actual development validators',async t=>{
 const root=await mkdtemp(join(tmpdir(),'vector-config-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const context={root,manifest:JSON.parse(await readFile('rer-setup.json','utf8')),input:{FIRST_OWNER_EMAIL:'owner@example.test',FIRST_OWNER_NAME:'Owner',WORKSPACE_NAME:'Work',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Team',DEFAULT_TEAM_PREFIX:'VEC'},store:{step:async()=>{},addSecrets:()=>{}}};
 await prepareSettings(context,{secrets:settings,origin:()=> 'http://127.0.0.1:49123'});
 assert.equal((await configurationReport({},root)).ok,true);validateSettings(context.vars);
 const invalid={FIRST_OWNER_EMAIL:'invalid',WORKSPACE_TIMEZONE:'Invalid/Zone',DEFAULT_TEAM_PREFIX:'x',MAIL_FROM:'invalid',APP_ORIGIN:'https://example.test',MAIL_MODE:'sendgrid',SESSION_SECRET:'short'};
 const values={...context.vars,...invalid};delete values.WORKSPACE_NAME;
 await writePrivateFile(join(root,'.dev.vars'),Object.entries(values).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n');
 assert.throws(()=>validateSettings(values));const report=await configurationReport({},root);
 assert.equal(report.ok,false);assert.deepEqual(report.missing,['WORKSPACE_NAME']);assert.deepEqual(new Set(report.invalid),new Set(Object.keys(invalid)));
});
