import type { WorkerBindings } from '../../app/bindings';
import { z } from 'zod';
import { createUlid } from '../../shared/ids';
import { settingsActor } from '../settings/repository';
import { IntegrationError } from '../integrations/errors';
import { sealSecret } from '../integrations/secrets';
import { auditStatement } from '../audit/producer';
import { providerInput, confirmationInput, policyInput, features, featureNames, categories, modelSettingsSchema } from './schema';
import { providerDisclosure } from './catalog';
export type ProviderRow = {id:string;name:string;kind:'anthropic'|'self-hosted';endpoint:string;model:string;terms_url:string|null;retention:string|null;confirmed_at:string|null};
export async function modelAdmin(db:D1Database,actor:string,owner=false) {
  const access = await settingsActor(db,actor);
  if (owner ? access.role !== 'owner' : !['owner','admin'].includes(access.role))
    throw new IntegrationError(403,'model_policy_forbidden',owner?'Only an Owner can confirm provider terms.':'Only Owners and Admins manage model settings.');
  return access.workspace_id;
}
export async function readModelSettings(db:D1Database,actor:string) {
  const workspace = await modelAdmin(db,actor);
  const providers = (await db.prepare(`SELECT p.*,EXISTS(SELECT 1 FROM vector_integration_secret_keys k WHERE k.identity='model:'||p.id AND k.slot='current') AS ready FROM vector_model_providers p WHERE workspace_id=? ORDER BY name,id`).bind(workspace).all<ProviderRow & {ready:number}>()).results;
  const policies = (await db.prepare("SELECT feature,NULLIF(team_id,'') AS teamId,enabled,provider_id AS providerId FROM vector_model_policies WHERE workspace_id=? ORDER BY feature,team_id").bind(workspace).all<{feature:string;teamId:string|null;enabled:number;providerId:string|null}>()).results;
  const access = await settingsActor(db,actor);
  return modelSettingsSchema.parse({providers:providers.map(row => ({id:row.id,name:row.name,kind:row.kind,endpoint:row.endpoint,model:row.model,...providerDisclosure(row),confirmedAt:row.confirmed_at,ready:row.ready===1})),
    policies:policies.map(row=>({...row,enabled:row.enabled===1})), features:features.map(id=>({id,name:featureNames[id],data:[...categories]})),owner:access.role==='owner'});
}
async function batch(db:D1Database,statements:{sql:string;params?:readonly unknown[]}[]) {
  await db.batch(statements.map(entry=>db.prepare(entry.sql).bind(...(entry.params??[]))));
}
export async function registerProvider(env:WorkerBindings,actor:string,input:z.infer<typeof providerInput>) {
  const workspace=await modelAdmin(env.DB,actor),id=createUlid(new Date()),at=new Date().toISOString();
  const encrypted=await sealSecret(env,'model:'+id,input.credential);
  await batch(env.DB,[{sql:'INSERT INTO vector_model_providers(id,workspace_id,name,kind,endpoint,model,created_at) VALUES(?,?,?,?,?,?,?)',params:[id,workspace,input.name,input.kind,input.endpoint,input.model,at]},
    {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?)",params:['model:'+id,encrypted]},
    auditStatement({workspace,actor,action:'model.provider_registered',subject:id})]);
  return {id};
}
export async function confirmProvider(db:D1Database,actor:string,id:string,input:z.infer<typeof confirmationInput>) {
  const workspace=await modelAdmin(db,actor,true),at=new Date().toISOString();
  if(!await db.prepare('SELECT id FROM vector_model_providers WHERE id=? AND workspace_id=?').bind(id,workspace).first())throw new IntegrationError(404,'model_provider_unavailable');
  await batch(db,[{sql:'UPDATE vector_model_providers SET terms_url=?,retention=?,confirmed_at=? WHERE id=? AND workspace_id=?',params:[input.termsUrl,input.retention,at,id,workspace]},
    // A revised declaration never silently changes an enabled feature's processor terms.
    {sql:'UPDATE vector_model_policies SET enabled=0 WHERE workspace_id=? AND provider_id=?',params:[workspace,id]},
    auditStatement({workspace,actor,action:'model.terms_confirmed',subject:id})]);
  return {saved:true};
}
export async function saveModelPolicy(db:D1Database,actor:string,input:z.infer<typeof policyInput>) {
  const workspace=await modelAdmin(db,actor);
  if(input.teamId && !await db.prepare('SELECT id FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL').bind(input.teamId,workspace).first())throw new IntegrationError(404,'model_team_unavailable');
  if(input.enabled) {
    const provider=await db.prepare('SELECT * FROM vector_model_providers WHERE id=? AND workspace_id=?').bind(input.providerId,workspace).first<ProviderRow>();
    if(!provider || !providerDisclosure(provider).noTraining || !providerDisclosure(provider).termsUrl || !providerDisclosure(provider).retention)
      throw new IntegrationError(409,'model_terms_required','An Owner must record terms, retention and confirm no training before enabling this provider.');
    if(!await db.prepare("SELECT identity FROM vector_integration_secret_keys WHERE identity=? AND slot='current'").bind('model:'+provider.id).first())throw new IntegrationError(409,'model_credential_required');
  }
  await batch(db,[{sql:'INSERT INTO vector_model_policies(workspace_id,feature,team_id,enabled,provider_id) VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,feature,team_id) DO UPDATE SET enabled=excluded.enabled,provider_id=excluded.provider_id',params:[workspace,input.feature,input.teamId??'',Number(input.enabled),input.enabled?input.providerId:null]},
    auditStatement({workspace,actor,action:input.enabled?'model.feature_enabled':'model.feature_disabled',subject:input.teamId??workspace})]);
  return {saved:true};
}
export async function removeProvider(db:D1Database,actor:string,id:string) {
  const workspace=await modelAdmin(db,actor);
  await batch(db,[{sql:"DELETE FROM vector_integration_secret_keys WHERE identity=? AND EXISTS(SELECT 1 FROM vector_model_providers WHERE id=? AND workspace_id=?)",params:['model:'+id,id,workspace]},
    {sql:'DELETE FROM vector_model_policies WHERE workspace_id=? AND provider_id=?',params:[workspace,id]},
    {sql:'DELETE FROM vector_model_providers WHERE id=? AND workspace_id=?',params:[id,workspace]},
    auditStatement({workspace,actor,action:'model.provider_removed',subject:id})]);
  return {saved:true};
}

export async function reenterProvider(env:WorkerBindings,actor:string,id:string,credential:string) {
  const workspace=await modelAdmin(env.DB,actor);
  if(!await env.DB.prepare('SELECT id FROM vector_model_providers WHERE id=? AND workspace_id=?').bind(id,workspace).first())throw new IntegrationError(404,'model_provider_unavailable');
  const encrypted=await sealSecret(env,'model:'+id,credential);
  await batch(env.DB,[{sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted",params:['model:'+id,encrypted]},
    {sql:'UPDATE vector_model_policies SET enabled=0 WHERE workspace_id=? AND provider_id=?',params:[workspace,id]},
    auditStatement({workspace,actor,action:'model.credential_replaced',subject:id})]);
  return {saved:true};
}
