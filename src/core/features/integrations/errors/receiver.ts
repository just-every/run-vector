import seed from '../../../../../seed.json';
import {erasedSourceIdentity} from '../source-identity';
import {requireSourceAdmission} from '../source-admission';
import {errorProviderRequest} from './provider';
import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import {admitRate} from '../../auth/repository';
import {rawIntegrationBody} from '../raw-body';
import {openSecret} from '../secrets';
import {publishSource,storedSourceResult,type RegisteredSource} from '../source-storage';
import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import {IntegrationError} from '../errors';
import {normalizeError} from './input';
import {regressionStatements} from './regression';
export async function receiveError(env:WorkerBindings,request:Request,provider:string,team:string){
 if(!await admitRate(env.DB,'error-source-ip:'+(request.headers.get('CF-Connecting-IP')??'unknown'),seed.limits.publicRequestsPerMinutePerIp,60000))throw new IntegrationError(429,'error_source_rate_limited');
 const source=await env.DB.prepare('SELECT s.*,e.regression_rule,e.actor_id FROM vector_integration_sources s JOIN vector_error_connections e ON e.source_id=s.id WHERE e.provider=? AND s.team_id=? AND s.enabled=1 AND s.revoked_at IS NULL').bind(provider,team).first<RegisteredSource&{regression_rule:string;actor_id:string}>();
 if(!source)throw new IntegrationError(401,'invalid_error_connection');
 const identity='source-error:'+source.id,encrypted=await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot='current'").bind(identity).first<string>('encrypted');
 if(!encrypted)throw new IntegrationError(401,'error_credential_required');
 const {signingSecret,token}=JSON.parse(await openSecret(env,identity,encrypted)) as {signingSecret:string;token:string|null};
 const bytes=await rawIntegrationBody(request);
 if(provider==='sentry'){
  const signature=request.headers.get('Sentry-Hook-Signature')??'';
  if(!/^[a-f0-9]{64}$/.test(signature))throw new IntegrationError(401,'invalid_sentry_signature');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(signingSecret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,new Uint8Array(signature.match(/../g)!.map(pair=>parseInt(pair,16))),new Uint8Array(bytes)))throw new IntegrationError(401,'invalid_sentry_signature');
  if(request.headers.get('Sentry-Hook-Resource')!=='issue')throw new IntegrationError(400,'unsupported_sentry_resource');
 }else if(provider==='datadog'){
  // Datadog's webhook API supports a shared secret custom header, not a body HMAC.
  if(await sha256(request.headers.get('X-Vector-Secret')??'')!==await sha256(signingSecret))throw new IntegrationError(401,'invalid_datadog_secret');
 }else throw new IntegrationError(401,'invalid_error_provider');
 if(!await admitRate(env.DB,'error-source:'+source.id,seed.limits.signalSourceRequestsPerMinutePerSource,60000))throw new IntegrationError(429,'error_source_rate_limited');
 let raw:unknown;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new IntegrationError(400,'invalid_error_payload');}
 const delivery=provider==='sentry'?request.headers.get('Request-ID')??'':'';
 if(provider==='sentry'&&!/^[A-Za-z0-9._-]{1,128}$/.test(delivery))throw new IntegrationError(400,'invalid_sentry_delivery');
 const {input,regression}=normalizeError(provider,team,delivery,raw);
 const admission={source,keySlot:'current',encrypted,credentialKind:'error' as const},hash=await sha256(new TextDecoder().decode(bytes));
 await requireSourceAdmission(env.DB,admission);
 const prior=await storedSourceResult(env.DB,source,input,hash);if(prior){await requireSourceAdmission(env.DB,admission);return prior;}
 // Sentry signs the body, not Request-ID: captured bodies remain replays even with a changed header.
 const repeated=await env.DB.prepare('SELECT r.evidence_id,i.identifier FROM vector_source_receipts r LEFT JOIN issues i ON i.id=r.issue_id WHERE r.source_id=? AND r.payload_hash=? LIMIT 1').bind(source.id,hash).first<{evidence_id:string;identifier:string|null}>();
 if(repeated){await requireSourceAdmission(env.DB,admission);if(!repeated.identifier)throw new IntegrationError(410,'source_issue_deleted');return {identifier:repeated.identifier,evidenceRevisionId:repeated.evidence_id,reused:true};}

 const removed=await env.DB.prepare('SELECT 1 FROM vector_source_records r WHERE r.source_id=? AND ((r.erased=0 AND r.record_id=?) OR (r.erased=1 AND r.record_id=?)) AND NOT EXISTS(SELECT 1 FROM issues i WHERE i.id=r.issue_id)').bind(source.id,input.sourceRecordId,await erasedSourceIdentity(input.sourceRecordId)).first();if(removed)throw new IntegrationError(410,'source_issue_deleted');
 if(provider==='sentry'){
  if(!token)throw new IntegrationError(401,'error_credential_required');
  const response=await errorProviderRequest('https://sentry.io/api/0/issues/'+input.sourceRecordId+'/events/latest/','GET',{Authorization:'Bearer '+token});
  let event:unknown;try{event=await response.json();}catch{throw new IntegrationError(503,'sentry_event_unreadable');}
  const parsed=z.object({release:z.union([z.string().max(20000),z.object({version:z.string().max(20000)})]).nullish()}).safeParse(event);
  if(!parsed.success)throw new IntegrationError(503,'sentry_event_unreadable');
  input.measurements.release=typeof parsed.data.release==='string'?parsed.data.release:parsed.data.release?.version??null;
 }
 return publishSource(env,admission,input,hash,async(issueId,existing,at)=>[env.DB.prepare("SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vector_source_receipts WHERE source_id=? AND payload_hash=?) THEN 1 ELSE json('error payload already received') END").bind(source.id,hash),...existing?await regressionStatements(env.DB,issueId,source,source.regression_rule,source.actor_id,regression,at):[]]);
}
