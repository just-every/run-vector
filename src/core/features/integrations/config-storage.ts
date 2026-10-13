import type { WorkerBindings } from '../../app/bindings';
import { createUlid } from '../../shared/ids';
import { validateDestination } from '../../../../vendor/base/integrations';
import { ownerPredicate,guardedSql,type IntegrationOwner } from './authority';
import { newSigningSecret,sealSecret } from './secrets';
import { IntegrationError } from './errors';
import type { z } from 'zod';
import type { sourceConfigInput,destinationInput,githubInput } from './config-input';
const safeError=()=>new IntegrationError(409,'integration_configuration_conflict');
export async function registerSource(env:WorkerBindings,owner:IntegrationOwner,input:z.infer<typeof sourceConfigInput>){
 const now=new Date(),at=now.toISOString(),id=createUlid(now),identity='source:'+id,secret=newSigningSecret(),encrypted=await sealSecret(env,identity,secret);
 const sql=guardedSql(env.DB,ownerPredicate(owner));
 try{await sql.batch([
  {sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL) AND (SELECT count(*) FROM vector_integration_sources WHERE workspace_id=? AND revoked_at IS NULL)<50 THEN 1 ELSE json('source option denied') END`,params:[input.teamId,owner.workspace,owner.workspace]},
  {sql:'INSERT INTO vector_integration_sources(id,workspace_id,source_id,name,team_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',params:[id,owner.workspace,input.sourceId,input.name,input.teamId,at,at]},
  {sql:'INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,?,?)',params:[identity,'current',encrypted]},
 ]);}catch{throw safeError();}
 return {id,sourceId:input.sourceId,workspaceId:owner.workspace,secret,receiver:env.APP_ORIGIN+'/api/integrations/sources/'+id+'/events'};
}
export async function rotateSource(env:WorkerBindings,owner:IntegrationOwner,id:string,hours:number){
 const identity='source:'+id,secret=newSigningSecret(),encrypted=await sealSecret(env,identity,secret),now=Date.now(),at=new Date(now).toISOString();
 const source=await env.DB.prepare('SELECT version FROM vector_integration_sources WHERE id=? AND workspace_id=? AND revoked_at IS NULL').bind(id,owner.workspace).first<{version:number}>();if(!source)throw new IntegrationError(404,'source_unavailable');
 const sql=guardedSql(env.DB,ownerPredicate(owner));await sql.batch([
  {sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_integration_sources WHERE id=? AND workspace_id=? AND version=? AND revoked_at IS NULL) THEN 1 ELSE json('source version changed') END`,params:[id,owner.workspace,source.version]},
  {sql:'DELETE FROM vector_integration_secret_keys WHERE identity=? AND slot=?',params:[identity,'previous']},
  ...(hours?[{sql:"UPDATE vector_integration_secret_keys SET slot='previous',valid_until=? WHERE identity=? AND slot='current'",params:[now+hours*3600000,identity]}]:[{sql:'DELETE FROM vector_integration_secret_keys WHERE identity=?',params:[identity]}]),
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?)",params:[identity,encrypted]},
  {sql:'UPDATE vector_integration_sources SET version=version+1,enabled=1,updated_at=? WHERE id=? AND workspace_id=?',params:[at,id,owner.workspace]},
 ]);return {id,secret,overlapHours:hours};
}
export async function registerDestination(env:WorkerBindings,owner:IntegrationOwner,input:z.infer<typeof destinationInput>){
 let url;try{url=validateDestination(input.url);if(url.search)throw Error();}catch{throw new IntegrationError(400,'invalid_destination','Use a public HTTPS URL without credentials, query or fragment.');}
 const now=new Date(),id=createUlid(now),at=now.toISOString(),identity='destination:'+id,secret=newSigningSecret(),encrypted=await sealSecret(env,identity,secret);
 await guardedSql(env.DB,ownerPredicate(owner)).batch([
  {sql:"SELECT CASE WHEN (SELECT count(*) FROM vector_webhook_destinations WHERE workspace_id=? AND revoked_at IS NULL)<50 THEN 1 ELSE json('destination limit') END",params:[owner.workspace]},
  {sql:'INSERT INTO vector_webhook_destinations(id,workspace_id,name,url,created_at,updated_at) VALUES(?,?,?,?,?,?)',params:[id,owner.workspace,input.name,url.href,at,at]},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?)",params:[identity,encrypted]},
 ]);return {id,secret,dispatchConfigured:Boolean(env.INTEGRATION_EGRESS&&env.INTEGRATION_EGRESS_POLICY==='public-dns-pinned-tls-v1')};
}
export async function registerGithub(env:WorkerBindings,owner:IntegrationOwner,input:z.infer<typeof githubInput>){
 const repository=input.repository.toLowerCase();if(repository.split('/').some(part=>part==='.'||part==='..'))throw new IntegrationError(400,'invalid_repository');
 const now=new Date(),id=createUlid(now),at=now.toISOString(),identity='github:'+id,secret=newSigningSecret(),encrypted=await sealSecret(env,identity,secret);
 try{await guardedSql(env.DB,ownerPredicate(owner)).batch([
  {sql:'INSERT INTO vector_github_repositories(id,workspace_id,repository,name,created_at,updated_at) VALUES(?,?,?,?,?,?)',params:[id,owner.workspace,repository,input.name,at,at]},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?)",params:[identity,encrypted]},
 ]);}catch{throw safeError();}return {id,secret,receiver:env.APP_ORIGIN+'/api/integrations/github/'+id};
}
export async function revokeConfiguration(env:WorkerBindings,owner:IntegrationOwner,kind:'source'|'destination'|'github',id:string){
 const table={source:'vector_integration_sources',destination:'vector_webhook_destinations',github:'vector_github_repositories'}[kind],at=new Date().toISOString();
 const rows=await guardedSql(env.DB,ownerPredicate(owner)).batch([
  {sql:`UPDATE ${table} SET enabled=0,revoked_at=COALESCE(revoked_at,?),updated_at=? WHERE id=? AND workspace_id=? RETURNING id`,params:[at,at,id,owner.workspace]},
  {sql:`DELETE FROM vector_integration_secret_keys WHERE identity=? AND EXISTS(SELECT 1 FROM ${table} WHERE id=? AND workspace_id=? AND revoked_at IS NOT NULL)`,params:[kind+':'+id,id,owner.workspace]},
 ]);if(!rows[0].length)throw new IntegrationError(404,'configuration_unavailable');return {revoked:true};
}
