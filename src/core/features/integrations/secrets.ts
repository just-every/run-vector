import { hex } from '../../../../vendor/base/integrations/core/crypto';
import { IntegrationError } from './errors';
import type { WorkerBindings } from '../../app/bindings';
const encoder=new TextEncoder();
async function encryptionKey(env:WorkerBindings){if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)throw new IntegrationError(503,'integration_secret_custody_unavailable');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode('vector-integrations-secret-v1:'+env.SESSION_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export function newSigningSecret(){return hex(crypto.getRandomValues(new Uint8Array(32)));}
export async function sealSecret(env:WorkerBindings,identity:string,value:string){const iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(identity)},await encryptionKey(env),encoder.encode(value)));return hex(iv)+':'+hex(encrypted);}
export async function openSecret(env:WorkerBindings,identity:string,sealed:string){
 try{const [iv,cipher]=sealed.split(':');if(!/^[a-f0-9]{24}$/.test(iv)||!/^(?:[a-f0-9]{2}){16,}$/.test(cipher))throw Error();const bytes=(value:string)=>new Uint8Array(value.match(/../g)!.map(pair=>parseInt(pair,16)));return new TextDecoder('utf-8',{fatal:true}).decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:encoder.encode(identity)},await encryptionKey(env),bytes(cipher)));}catch{throw new IntegrationError(503,'integration_secret_reentry_required');}
}
