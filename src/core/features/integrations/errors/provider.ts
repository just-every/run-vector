import {IntegrationError} from '../errors';
export async function errorProviderRequest(url:string,method:'POST'|'PUT',headers:Record<string,string>,body:unknown){
 const target=new URL(url);
 if(!((target.origin==='https://sentry.io'&&/^\/api\/0\/issues\/[0-9]+\/$/.test(target.pathname))||(target.origin==='https://api.datadoghq.com'&&/^\/api\/v1\/integration\/webhooks\/configuration\/webhooks(?:\/vector-[a-z0-9]+)?$/.test(target.pathname))))throw new IntegrationError(400,'error_provider_destination_invalid');
 let response:Response;
 try{response=await fetch(target,{method,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{throw new IntegrationError(503,'error_provider_result_unknown','The provider result is unknown. Check the provider before retrying.');}
 if(!response.ok)throw new IntegrationError(response.status>=500?503:400,'error_provider_refused','The provider refused this request. Check the connection and its permissions.');
 return response;
}
export const datadogPayload=JSON.stringify({id:'$ALERT_ID',eventId:'$ID',transition:'$ALERT_TRANSITION',title:'$TITLE',message:'$TEXT_ONLY_MSG',link:'$LINK',date:'$DATE'});
