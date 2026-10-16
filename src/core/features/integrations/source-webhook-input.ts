import { sha256 } from '../../../../vendor/base/integrations/core/crypto';
import { canonicalSource,sourceInputSchema } from './source-input';
import { IntegrationError } from './errors';

const invalid=()=>new IntegrationError(400,'invalid_source_body','Send a JSON object, form fields or text with a title, subject, message or monitor name.');
function first(value:Record<string,unknown>,keys:string[]){
 for(const key of keys)if(value[key]!==undefined&&value[key]!==null&&value[key]!=='')return value[key];
}
function identity(value:unknown){return typeof value==='number'?String(value):value;}
function observed(value:unknown){
 if(value===undefined)return undefined;
 const numeric=typeof value==='number'||typeof value==='string'&&/^\d+(\.\d+)?$/.test(value)?Number(value):undefined;
 const date=numeric===undefined?new Date(String(value)):new Date(numeric<1e12?numeric*1000:numeric);
 if(!Number.isFinite(date.getTime()))throw invalid();return date.toISOString();
}
export async function normalizeSourceWebhook(body:Uint8Array,contentType:string,teamId:string){
 let value:unknown;
 try{
  const text=new TextDecoder('utf-8',{fatal:true}).decode(body);
  if(contentType==='application/x-www-form-urlencoded'){
   const fields=new URLSearchParams(text),record:Record<string,string>={};
   for(const [key,item] of fields){if(Object.hasOwn(record,key))throw invalid();Object.defineProperty(record,key,{value:item,enumerable:true});}value=record;
  }else if(contentType==='text/plain')value={message:text};
  else if(contentType==='application/json'||contentType.endsWith('+json')||!contentType)value=JSON.parse(text);
  else throw new IntegrationError(400,'unsupported_source_content_type','Use application/json, application/x-www-form-urlencoded or text/plain.');
 }catch(error){if(error instanceof IntegrationError)throw error;throw invalid();}
 if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();
 const payload=value as Record<string,unknown>,digest=await sha256(canonicalSource(payload));
 const details=first(payload,['summary','message','text','alertDetails','details','description']);
 const status=first(payload,['alertTypeFriendlyName','status']);
 const summary=typeof status==='string'&&typeof details==='string'?status+': '+details:details??status;
 const explicitTitle=first(payload,['title','subject','name','monitorFriendlyName','monitor']);
 const title=explicitTitle??(typeof summary==='string'?summary.trim().split('\n')[0].slice(0,500):undefined);
 const at=observed(first(payload,['observedAt','timestamp','alertDateTime','updated_at']));
 const normalized=sourceInputSchema.safeParse({
  teamId,title,summary:summary??title,description:payload.description??'',
  sourceRecordId:identity(first(payload,['sourceRecordId','recordId','id','ticket_id','monitorID']))??digest,
  sourceRevisionId:identity(first(payload,['sourceRevisionId','revisionId','event_id']))??digest,
  observedAt:at??new Date().toISOString(),link:payload.link,
  measurements:payload.measurements,customerReports:payload.customerReports,
  assertions:payload.assertions,expectedOutcome:payload.expectedOutcome,customerImpact:payload.customerImpact,
 });
 if(!normalized.success)throw invalid();
 // Receipt identity is stable when a tool cannot supply an observation time.
 // The first accepted delivery supplies the received-time default.
 const hash=await sha256(canonicalSource({...normalized.data,observedAt:at??null}));
 return {input:normalized.data,hash};
}
