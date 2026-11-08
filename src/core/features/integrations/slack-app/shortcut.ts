import {z} from 'zod';
import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import type {WorkerBindings} from '../../../app/bindings';
import {receiveThreadMessage,threadMessage} from './thread-mapping';
import {IntegrationError} from '../errors';
const shortcut=z.object({type:z.literal('message_action'),callback_id:z.literal('vector_create_issue'),trigger_id:z.string().min(1).max(500),team:z.object({id:z.string().max(100)}),user:z.object({id:z.string().max(100)}),channel:z.object({id:z.string().max(100)}),message:z.object({user:z.string().min(1).max(100),ts:z.string(),text:z.string(),thread_ts:z.string().optional()})});
/** The signing door dispatches shortcuts before writing its legacy button keys.
 * The acting linked member is the native author; the original Slack author is retained. */
export async function receiveSlackShortcut(env:WorkerBindings,signer:{workspace:string;encrypted:string},payload:unknown){
 const parsed=shortcut.safeParse(payload);
 if(!parsed.success)throw new IntegrationError(400,'slack_payload_unsupported');
 const data=parsed.data;
 const message=threadMessage.safeParse({...data.message,type:'app_mention',user:data.user.id,source_user:data.message.user,channel:data.channel.id});
 if(!message.success)throw new IntegrationError(400,'slack_payload_invalid');
 return receiveThreadMessage(env,signer,data.team.id,message.data,await sha256('shortcut:'+data.team.id+':'+data.channel.id+':'+data.message.ts));
}
