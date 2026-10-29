import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import {createUlid} from '../../../shared/ids';
import {appManager,managed} from '../slack-app/install';
import {sealSecret,newSigningSecret} from '../secrets';
import {auditStatement} from '../../audit/producer';
import {IntegrationError} from '../errors';
import {errorProviderRequest,datadogPayload} from './provider';
export {appManager,managed};
export const errorInput=z.object({provider:z.enum(['sentry','datadog']),teamId:z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/),token:z.string().min(1).max(2000),secret:z.string().min(10).max(2000),regressionRule:z.enum(['reopen','comment','ignore'])}).strict();
export function errorReceiver(origin:string,provider:string,team:string){return origin+'/api/integrations/errors/'+provider+'/'+team;}
export async function errorConnections(env:WorkerBindings,request:Request){
 const owner=await appManager(env,request);
 const [rows]=await managed(env,owner).batch([{sql:`SELECT e.source_id AS id,e.provider,e.regression_rule AS regressionRule,s.team_id AS teamId,s.revoked_at AS revokedAt,NOT EXISTS(SELECT 1 FROM vector_integration_secret_keys k WHERE k.identity='source-error:'||s.id AND k.slot='current') AS requiresReentry FROM vector_error_connections e JOIN vector_integration_sources s ON s.id=e.source_id WHERE s.workspace_id=? ORDER BY s.created_at`,params:[owner.workspace]}]);
 return {connections:rows.map(row=>({...row,receiver:errorReceiver(env.APP_ORIGIN,String(row.provider),String(row.teamId))}))};
}
export async function saveErrorConnection(env:WorkerBindings,request:Request,value:unknown){
 const owner=await appManager(env,request),parsed=errorInput.safeParse(value);
 if(!parsed.success)throw new IntegrationError(400,'invalid_error_connection');
 const input=parsed.data,sql=managed(env,owner);
 const team=await env.DB.prepare('SELECT id FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL').bind(input.teamId,owner.workspace).first();if(!team)throw new IntegrationError(404,'error_team_unavailable');
 const sourceId=input.provider+'-'+input.teamId;
 const existing=await env.DB.prepare('SELECT s.id FROM vector_integration_sources s JOIN vector_error_connections e ON e.source_id=s.id WHERE s.workspace_id=? AND s.source_id=?').bind(owner.workspace,sourceId).first<{id:string}>();
 const at=new Date().toISOString(),id=existing?.id??createUlid(new Date(at)),identity='source-error:'+id;
 const signingSecret=input.provider==='sentry'?input.secret:newSigningSecret(),receiver=errorReceiver(env.APP_ORIGIN,input.provider,input.teamId);
 if(input.provider==='datadog'){
  // Re-entry updates the same named webhook; registration conflicts are visible, never silently accepted.
  const response=await errorProviderRequest('https://api.datadoghq.com/api/v1/integration/webhooks/configuration/webhooks','POST',{'DD-API-KEY':input.token,'DD-APPLICATION-KEY':input.secret},{name:'vector-'+id.toLowerCase(),url:receiver,custom_headers:JSON.stringify({'X-Vector-Secret':signingSecret}),encode_as:'json',payload:datadogPayload});await response.body?.cancel();
 }
 const encrypted=await sealSecret(env,identity,JSON.stringify({token:input.provider==='sentry'?input.token:null,signingSecret}));
 await sql.batch([
  {sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL) THEN 1 ELSE json('error team unavailable') END`,params:[input.teamId,owner.workspace]},
  {sql:`INSERT INTO vector_integration_sources(id,workspace_id,source_id,name,team_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=1,revoked_at=NULL,version=version+1,updated_at=excluded.updated_at`,params:[id,owner.workspace,sourceId,input.provider==='sentry'?'Sentry':'Datadog',input.teamId,at,at]},
  {sql:'INSERT INTO vector_error_connections(source_id,provider,regression_rule,actor_id) VALUES(?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET regression_rule=excluded.regression_rule,actor_id=excluded.actor_id',params:[id,input.provider,input.regressionRule,owner.id]},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted",params:[identity,encrypted]},
  auditStatement({workspace:owner.workspace,actor:owner.id,action:'integration.error_configured',subject:id,at}),
 ]);
 return {id,receiver,saved:true};
}
