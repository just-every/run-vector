import type { WorkerBindings } from '../../app/bindings';
import { guardedSql,ownerPredicate,type IntegrationOwner } from './authority';
import { newSigningSecret,sealSecret } from './secrets';
import { IntegrationError } from './errors';

export async function newSourceWebhook(env:WorkerBindings,id:string){
 const token=newSigningSecret(),identity='source-url:'+id;
 return {identity,encrypted:await sealSecret(env,identity,token),webhookUrl:env.APP_ORIGIN+'/api/integrations/sources/'+id+'/receive/'+token};
}
export async function replaceSourceWebhook(env:WorkerBindings,owner:IntegrationOwner,id:string){
 const source=await env.DB.prepare('SELECT source_id AS sourceId,team_id AS teamId FROM vector_integration_sources WHERE id=? AND workspace_id=? AND revoked_at IS NULL').bind(id,owner.workspace).first<{sourceId:string;teamId:string}>();
 if(!source)throw new IntegrationError(404,'source_unavailable');
 const credential=await newSourceWebhook(env,id),sql=guardedSql(env.DB,ownerPredicate(owner));
 await sql.batch([
  {sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_integration_sources WHERE id=? AND workspace_id=? AND revoked_at IS NULL) THEN 1 ELSE json('source unavailable') END`,params:[id,owner.workspace]},
  {sql:"DELETE FROM vector_integration_secret_keys WHERE identity=?",params:[credential.identity]},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?)",params:[credential.identity,credential.encrypted]},
 ]);
 return {id,...source,workspaceId:owner.workspace,receiver:env.APP_ORIGIN+'/api/integrations/sources/'+id+'/events',webhookUrl:credential.webhookUrl};
}
