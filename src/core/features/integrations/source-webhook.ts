import type { WorkerBindings } from '../../app/bindings';
import { admitRate } from '../auth/repository';
import { equalSignature } from '../../../../vendor/base/integrations/core/crypto';
import { openSecret } from './secrets';
import { rawIntegrationBody } from './raw-body';
import { IntegrationError } from './errors';
import { normalizeSourceWebhook } from './source-webhook-input';
import { publishSource,type RegisteredSource } from './source-storage';

export async function receiveSourceWebhook(env:WorkerBindings,request:Request,id:string,token:string){
 if(!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id)||!/^[a-f0-9]{64}$/.test(token))throw new IntegrationError(401,'invalid_source');
 if(!await admitRate(env.DB,'plain-source-ip:'+(request.headers.get('CF-Connecting-IP')??'unknown'),600,60000))throw new IntegrationError(429,'source_rate_limited');
 const source=await env.DB.prepare('SELECT * FROM vector_integration_sources WHERE id=? AND enabled=1 AND revoked_at IS NULL').bind(id).first<RegisteredSource>();
 if(!source)throw new IntegrationError(401,'invalid_source');
 const identity='source-url:'+id,key=await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot='current' AND (valid_until IS NULL OR valid_until>?)").bind(identity,Date.now()).first<{encrypted:string}>();
 if(!key||!equalSignature(token,await openSecret(env,identity,key.encrypted)))throw new IntegrationError(401,'invalid_source');
 if(!await admitRate(env.DB,'plain-source:'+id,300,60000))throw new IntegrationError(429,'source_rate_limited');
 const body=await rawIntegrationBody(request),contentType=(request.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
 const {input,hash}=await normalizeSourceWebhook(body,contentType,source.team_id);
 return publishSource(env,{source,keySlot:'current',encrypted:key.encrypted,credentialKind:'url'},input,hash);
}
