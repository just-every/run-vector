import {TokenService,IntegrationsRepository,type SqlDatabase,type SqlStatement} from '../../../../vendor/base/integrations';
import {sha256,hex} from '../../../../vendor/base/integrations/core/crypto';
import {guardedSql,ownerPredicate,type IntegrationOwner} from '../integrations/authority';
import {auditStatement} from '../audit/producer';
import {IntegrationError} from '../integrations/errors';
import {recordDevMint} from '../integrations/dev-credentials';
import {tokenScopes} from '../integrations/feature-scopes';
import type {AuthorizationRequest} from './schema';
export const randomSecret=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const pkce=async(verifier:string)=>btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export type Application={id:string;workspace_id:string;name:string;redirect_uris:string;scopes:string;secret_hash:string};
export async function authorization(db:D1Database,input:AuthorizationRequest,workspace?:string){
 const app=await db.prepare('SELECT * FROM vector_oauth_apps WHERE id=?').bind(input.client_id).first<Application>();
 if(!app||workspace&&app.workspace_id!==workspace||!JSON.parse(app.redirect_uris).includes(input.redirect_uri))throw new IntegrationError(400,'invalid_client_or_redirect','The application or exact redirect URL is unavailable.');
 const scopes=[...new Set(input.scope.split(' '))];
 if(scopes.some(scope=>!scope||!tokenScopes.includes(scope as typeof tokenScopes[number])||!JSON.parse(app.scopes).includes(scope)))throw new IntegrationError(400,'invalid_scope','Choose only permissions registered for this application.');
 return {app,scopes};
}
export async function registerApplication(db:D1Database,owner:IntegrationOwner,input:{name:string;redirectUris:string[];scopes:string[]}){
 const id=crypto.randomUUID(),secret=randomSecret(),now=Date.now();
 await guardedSql(db,ownerPredicate(owner)).batch([
  {sql:'INSERT INTO vector_oauth_apps(id,workspace_id,name,redirect_uris,scopes,secret_hash,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',params:[id,owner.workspace,input.name,JSON.stringify([...new Set(input.redirectUris)]),JSON.stringify([...new Set(input.scopes)]),await sha256(secret),owner.id,now]},
  auditStatement({workspace:owner.workspace,actor:owner.id,action:'oauth.app.registered',subject:id}),
 ]);
 return {id,secret,kind:'oauth' as const};
}
export async function consent(db:D1Database,owner:IntegrationOwner,input:AuthorizationRequest,decision:'approve'|'deny',now=Date.now()){
 const {app,scopes}=await authorization(db,input,owner.workspace),url=new URL(input.redirect_uri);
 url.searchParams.delete('code');url.searchParams.delete('error');url.searchParams.set('state',input.state);
 const predicate=ownerPredicate(owner),statements:SqlStatement[]=[];
 if(decision==='approve'){
  const code=randomSecret();url.searchParams.set('code',code);
  statements.push({sql:'INSERT INTO vector_oauth_codes(code_hash,app_id,workspace_id,operator_id,redirect_uri,scopes,challenge,created_at,expires_at,session_id) VALUES(?,?,?,?,?,?,?,?,?,?)',params:[await sha256(code),app.id,owner.workspace,owner.id,input.redirect_uri,JSON.stringify(scopes),input.code_challenge??null,now,now+300000,owner.fence.sessionId]});
 }else url.searchParams.set('error','access_denied');
 statements.push(auditStatement({workspace:owner.workspace,actor:owner.id,action:decision==='approve'?'oauth.consent.approved':'oauth.consent.denied',subject:app.id}));
 await guardedSql(db,predicate).batch(statements);return {redirect:url.href};
}
type Code={code_hash:string;app_id:string;workspace_id:string;operator_id:string;redirect_uri:string;scopes:string;challenge:string|null;expires_at:number;used_at:number|null;grant_id:string|null;session_id:string};
export async function revokeGrant(db:D1Database,workspace:string,actor:string,id:string,sql?:SqlDatabase){
 const statements:SqlStatement[]=[
  {sql:'UPDATE vector_oauth_grants SET revoked_at=COALESCE(revoked_at,?) WHERE workspace_id=? AND id=?',params:[Date.now(),workspace,id]},
  {sql:'UPDATE integration_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE namespace IN(SELECT namespace FROM vector_oauth_grants WHERE workspace_id=? AND id=?)',params:[Date.now(),workspace,id]},
  auditStatement({workspace,actor,action:'oauth.grant.revoked',subject:id,condition:{sql:'EXISTS(SELECT 1 FROM vector_oauth_grants WHERE workspace_id=? AND id=?)',params:[workspace,id]}}),
 ];
 await (sql??new IntegrationsRepositoryDatabase(db)).batch(statements);
}
// Reuse revocation runs without a browser session, under the authenticated client.
class IntegrationsRepositoryDatabase implements SqlDatabase{
 constructor(private db:D1Database){}
 async batch(statements:SqlStatement[]){return (await this.db.batch<Record<string,unknown>>(statements.map(s=>this.db.prepare(s.sql).bind(...s.params??[])))).map(r=>r.results);}
}
export async function exchange(db:D1Database,input:{client_id:string;client_secret:string;code:string;redirect_uri:string;code_verifier?:string},now=Date.now()){
 const app=await db.prepare('SELECT * FROM vector_oauth_apps WHERE id=?').bind(input.client_id).first<Application>();
 if(!app||app.secret_hash!==await sha256(input.client_secret))throw new IntegrationError(401,'invalid_client');
 const hash=await sha256(input.code),code=await db.prepare('SELECT * FROM vector_oauth_codes WHERE code_hash=?').bind(hash).first<Code>();
 const invalid=()=>new IntegrationError(400,'invalid_grant');
 if(!code||code.app_id!==app.id||code.redirect_uri!==input.redirect_uri)throw invalid();
 const revokeReuse=async()=>{if(code.grant_id)await revokeGrant(db,code.workspace_id,code.operator_id,code.grant_id);};
 if(code.used_at!==null){await revokeReuse();throw invalid();}
 if(code.expires_at<=now||code.challenge&&(!input.code_verifier||await pkce(input.code_verifier)!==code.challenge))throw invalid();
 const id=crypto.randomUUID(),namespace='oauth:'+code.workspace_id+':'+code.operator_id+':'+id;
 const eligible={sql:`EXISTS(SELECT 1 FROM vector_oauth_codes c JOIN operators o ON o.id=c.operator_id JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id WHERE c.code_hash=? AND c.used_at IS NULL AND c.expires_at>? AND o.workspace_id=c.workspace_id AND o.removed_at IS NULL AND o.role IN ('owner','admin','member') AND a.status='active' AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=a.id))) AND NOT EXISTS(SELECT 1 FROM vector_http_restore)`,params:[hash,now]};
 const guard={sql:'SELECT CASE WHEN ('+eligible.sql+") THEN 1 ELSE json('oauth code refused') END",params:eligible.params};
 const native=new IntegrationsRepositoryDatabase(db);
 const sql:SqlDatabase={async batch(statements){return native.batch([
  guard,
  {sql:'INSERT INTO vector_oauth_grants(id,app_id,workspace_id,operator_id,scopes,namespace,created_at) VALUES(?,?,?,?,?,?,?)',params:[id,app.id,code.workspace_id,code.operator_id,code.scopes,namespace,now]},
  {sql:'UPDATE vector_oauth_codes SET used_at=?,grant_id=? WHERE code_hash=? AND used_at IS NULL',params:[now,id,hash]},
  ...statements,
  {sql:'UPDATE vector_oauth_grants SET token_id=(SELECT id FROM integration_tokens WHERE namespace=?) WHERE id=?',params:[namespace,id]},
  auditStatement({workspace:code.workspace_id,actor:code.operator_id,action:'oauth.grant.issued',subject:id}),
 ]).then(rows=>rows.slice(3,3+statements.length));}};
 const scopes=JSON.parse(code.scopes) as string[];
 const service=new TokenService(new IntegrationsRepository(sql,namespace),{
  grant:async()=>({scopes,commitGuard:{sql:'SELECT 1 FROM vector_oauth_codes WHERE code_hash=? AND grant_id=? AND used_at=?',params:[hash,id,now]}}),
  administer:async()=>{throw new IntegrationError(403,'forbidden');},
 },()=>now);
 try{
  const issued=await service.issue(null,{name:app.name,scopes});
  await recordDevMint(db,code.session_id,issued.credential.id);
  return {access_token:issued.token,token_type:'Bearer',scope:scopes.join(' '),grant_id:id};
 }catch{
  const current=await db.prepare('SELECT grant_id FROM vector_oauth_codes WHERE code_hash=? AND used_at IS NOT NULL').bind(hash).first<{grant_id:string}>();
  if(current)await revokeGrant(db,code.workspace_id,code.operator_id,current.grant_id);
  throw invalid();
 }
}
