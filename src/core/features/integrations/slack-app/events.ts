import {receiveThreadMessage,threadMessage} from './thread-mapping';
import {unfurlSlackLinks,linkSharedEvent} from './unfurl';
import {providerUninstall} from './retire';
import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import {signedInstallation} from '../slack-dm/signing';
import {rawIntegrationBody} from '../raw-body';
import {IntegrationError} from '../errors';
const callback=z.object({type:z.literal('event_callback'),team_id:z.string().max(100),event_id:z.string().min(1).max(200),event:z.union([linkSharedEvent,threadMessage])});
/** The signature identifies the installation; neither an untrusted team ID nor
 * a browser session selects it. No request state is written before admission. */
export async function receiveSlackEvent(env:WorkerBindings,request:Request){
 const timestamp=request.headers.get('x-slack-request-timestamp')??'',signature=request.headers.get('x-slack-signature')??'';
 if(!/^[0-9]{1,12}$/.test(timestamp)||!/^v0=[0-9a-f]{64}$/.test(signature))throw new IntegrationError(401,'slack_signature_invalid');
 if(Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>300)throw new IntegrationError(401,'slack_request_stale');
 let body:string;
 try{body=new TextDecoder('utf-8',{fatal:true}).decode(await rawIntegrationBody(request,131072));}catch(error){if(error instanceof IntegrationError)throw error;throw new IntegrationError(400,'slack_payload_invalid');}
 const signer=await signedInstallation(env,timestamp,body,signature.slice(3));
 if(!signer)throw new IntegrationError(401,'slack_signature_invalid');
 let payload:unknown;try{payload=JSON.parse(body);}catch{throw new IntegrationError(400,'slack_payload_invalid');}
 const verification=z.object({type:z.literal('url_verification'),challenge:z.string().min(1).max(3000)}).safeParse(payload);
 if(verification.success)return {challenge:verification.data.challenge};
 const uninstall=z.object({type:z.literal('event_callback'),event:z.object({type:z.enum(['app_uninstalled','tokens_revoked'])})}).safeParse(payload);
 if(uninstall.success)return providerUninstall(env,signer);
 const parsed=callback.safeParse(payload);
 if(!parsed.success)throw new IntegrationError(400,'slack_event_unsupported');
 const {event,event_id,team_id}=parsed.data;
 const key=await sha256(event_id);
 if(event.type==='link_shared')return unfurlSlackLinks(env,signer,team_id,event,key);
 return receiveThreadMessage(env,signer,team_id,event,key);
}
