import { admitRate } from '../auth/repository';
import { verifyWebhook } from '../../../../vendor/base/integrations';
import { sha256 } from '../../../../vendor/base/integrations/core/crypto';
import type { WorkerBindings } from '../../app/bindings';
import { rawIntegrationBody } from './raw-body';
import { openSecret } from './secrets';
import { IntegrationError } from './errors';
import { sourceInputSchema,canonicalSource } from './source-input';
import { publishSource,type RegisteredSource,type SourceAdmission } from './source-storage';
export async function ingestSource(env:WorkerBindings,request:Request,id:string){
 if(!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id))throw new IntegrationError(401,'invalid_source');
 const source=await env.DB.prepare('SELECT * FROM vector_integration_sources WHERE id=? AND enabled=1 AND revoked_at IS NULL').bind(id).first<RegisteredSource>();if(!source)throw new IntegrationError(401,'invalid_source');
 const body=await rawIntegrationBody(request),keys=(await env.DB.prepare("SELECT slot,encrypted FROM vector_integration_secret_keys WHERE identity=? AND (valid_until IS NULL OR valid_until>?)").bind('source:'+id,Date.now()).all<{slot:string;encrypted:string}>()).results;
 let admission:SourceAdmission|undefined,verified:Awaited<ReturnType<typeof verifyWebhook>>|undefined;
 for(const key of keys){try{const secret=await openSecret(env,'source:'+id,key.encrypted),bytes=new Uint8Array(secret.match(/../g)!.map(pair=>parseInt(pair,16)));verified=await verifyWebhook({body,headers:request.headers,key:bytes,tenant:source.workspace_id,destinationId:source.source_id});admission={source,keySlot:key.slot,encrypted:key.encrypted};break;}catch{}}
 if(!admission||!verified)throw new IntegrationError(401,'invalid_source_signature');
 if(!await admitRate(env.DB,'signed-source-ip:'+ (request.headers.get('CF-Connecting-IP')??'unknown'),600,60000))throw new IntegrationError(429,'source_rate_limited');
 if(!await admitRate(env.DB,'signed-source:'+id,300,60000))throw new IntegrationError(429,'source_rate_limited');
 if(verified.envelope.event!=='signal.revision')throw new IntegrationError(400,'invalid_source_event');
 let parsed:unknown;try{parsed=JSON.parse(verified.envelope.body);}catch{throw new IntegrationError(400,'invalid_source_body');}
 const normalized=sourceInputSchema.safeParse(parsed);if(!normalized.success||normalized.data.teamId!==source.team_id)throw new IntegrationError(400,'invalid_source_body');
 return publishSource(env,admission,normalized.data,await sha256(canonicalSource(normalized.data)));
}
