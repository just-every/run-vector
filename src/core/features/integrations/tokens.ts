import { TokenService,IntegrationsRepository } from '../../../../vendor/base/integrations';
import type { TokenAuthority } from '../../../../vendor/base/integrations';
import { sha256 } from '../../../../vendor/base/integrations/core/crypto';
import { guardedSql,ownerPredicate,admitted,type IntegrationOwner } from './authority';
import { IntegrationError } from './errors';
import { devMintRefused } from './dev-credentials';
export const tokenScopes=['issues:read','issues:write','comments:write','metadata:read'] as const;
export function ownerTokens(db:D1Database,owner:IntegrationOwner){
 const predicate=ownerPredicate(owner),namespace='vector:'+owner.workspace+':'+owner.id;
 const authority:TokenAuthority<IntegrationOwner>={
  async grant(current){if(current.id!==owner.id||current.workspace!==owner.workspace||!await admitted(db,predicate))throw new IntegrationError(401,'unauthenticated');return {scopes:tokenScopes,commitGuard:{sql:'SELECT 1 WHERE '+predicate.sql,params:predicate.params!}};},
  async administer(current){if(current.id!==owner.id||current.workspace!==owner.workspace||!await admitted(db,predicate))throw new IntegrationError(401,'unauthenticated');},
 };
 return new TokenService(new IntegrationsRepository(guardedSql(db,predicate),namespace),authority);
}
export type TokenActor={id:string;workspace:string;namespace:string;tokenId:string;scopes:readonly string[]};
export function tokenPredicate(actor:TokenActor){return {sql:`EXISTS(SELECT 1 FROM integration_tokens t JOIN vector_integration_tokens b ON b.namespace=t.namespace AND b.token_id=t.id JOIN operators o ON o.id=b.operator_id JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id WHERE t.namespace=? AND t.id=? AND b.operator_id=? AND b.workspace_id=? AND o.workspace_id=b.workspace_id AND o.removed_at IS NULL AND a.status='active' AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AND NOT EXISTS(SELECT value FROM json_each(?) WHERE value NOT IN (SELECT value FROM json_each(t.scopes))) AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=a.id)))`,params:[actor.namespace,actor.tokenId,actor.id,actor.workspace,JSON.stringify(actor.scopes)]};}
export async function authorizeToken(db:D1Database,request:Request,scopes:readonly string[],resource:string):Promise<TokenActor>{
 const header=request.headers.get('Authorization');if(!header||!/^Bearer int_[a-f0-9]{64}$/.test(header))throw new IntegrationError(401,'invalid_token');
 const token=header.slice(7),hash=await sha256(token),row=await db.prepare(`SELECT t.id,t.namespace,b.operator_id,b.workspace_id FROM integration_tokens t JOIN vector_integration_tokens b ON b.namespace=t.namespace AND b.token_id=t.id WHERE t.token_hash=?`).bind(hash).first<{id:string;namespace:string;operator_id:string;workspace_id:string}>();
 if(!row||await devMintRefused(db,request,row.id))throw new IntegrationError(401,'invalid_token');
 const actor:TokenActor={id:row.operator_id,workspace:row.workspace_id,namespace:row.namespace,tokenId:row.id,scopes};
 const predicate=tokenPredicate(actor);
 if(!await admitted(db,predicate))throw new IntegrationError(401,'token_scope_or_authority_refused');
 const unusedAuthority:TokenAuthority<never>={grant:async()=>{throw new IntegrationError(403,'token_admin_forbidden');},administer:async()=>{throw new IntegrationError(403,'token_admin_forbidden');}};
 const service=new TokenService(new IntegrationsRepository(guardedSql(db,predicate),actor.namespace),unusedAuthority);
 let allowed;try{allowed=await service.authorize(token,scopes,{requestId:crypto.randomUUID(),resource});}catch{throw new IntegrationError(503,'token_usage_unavailable');}
 if(!allowed||!await admitted(db,predicate))throw new IntegrationError(401,'invalid_token');return actor;
}
