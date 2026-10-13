import type {WorkerBindings} from '../../app/bindings';
import {guardedSql,ownerPredicate,type IntegrationOwner} from './authority';
import {sealSecret,openSecret,newSigningSecret} from './secrets';
import {IntegrationError} from './errors';
/** Restored configurations retain history. Only a missing or unreadable credential can be
 * re-entered under its existing immutable destination/repository identity. */
export async function reenterCredential(env:WorkerBindings,owner:IntegrationOwner,kind:'destination'|'github',id:string){
 const table=kind==='destination'?'vector_webhook_destinations':'vector_github_repositories',identity=kind+':'+id,secret=newSigningSecret(),encrypted=await sealSecret(env,identity,secret);
 const existing=await env.DB.prepare('SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot=?').bind(identity,'current').first<{encrypted:string}>();
 // A credential that still opens is not replaced; one that no longer opens is.
 const readable=existing?await openSecret(env,identity,existing.encrypted).then(()=>true,()=>false):false;
 if(readable)throw new IntegrationError(409,'credential_reentry_refused');
 try{await guardedSql(env.DB,ownerPredicate(owner)).batch([
  {sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM ${table} WHERE id=? AND workspace_id=? AND revoked_at IS NULL) AND (SELECT count(*) FROM vector_integration_secret_keys WHERE identity=? AND slot='current' AND encrypted IS ?)=? THEN 1 ELSE json('credential reentry refused') END`,params:[id,owner.workspace,identity,existing?.encrypted??null,existing?1:0]},
  {sql:'DELETE FROM vector_integration_secret_keys WHERE identity=?',params:[identity]},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?)",params:[identity,encrypted]},
  {sql:`UPDATE ${table} SET updated_at=? WHERE id=? AND workspace_id=?`,params:[new Date().toISOString(),id,owner.workspace]},
 ]);}catch{throw new IntegrationError(409,'credential_reentry_refused');}
 return {id,secret,...(kind==='github'?{receiver:env.APP_ORIGIN+'/api/integrations/github/'+id}:{})};
}
