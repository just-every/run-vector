import {useState} from 'react';
import {z} from 'zod';
import {ApiError} from '../../../app/api-client';
const resultSchema=z.object({diagnostic:z.literal('connected')});

export function GithubTest({receiver,repository,secret}:{receiver:string;repository:string;secret?:string}){
 const [savedSecret,setSavedSecret]=useState(''),[busy,setBusy]=useState(false),[connected,setConnected]=useState(false),[error,setError]=useState('');
 const test=async()=>{
  setBusy(true);setConnected(false);setError('');
  try{
   const encoder=new TextEncoder(),body=JSON.stringify({repository:{full_name:repository}});
   const key=await crypto.subtle.importKey('raw',encoder.encode(secret??savedSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
   const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(body)));
   const signature=Array.from(digest,byte=>byte.toString(16).padStart(2,'0')).join('');
   const response=await fetch(receiver,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+signature,'X-GitHub-Delivery':crypto.randomUUID(),'X-GitHub-Event':'ping'},body});
   const result:unknown=await response.json().catch(()=>null);
   if(!response.ok)throw new ApiError(response.status,result);
   resultSchema.parse(result);setConnected(true);
  }catch(error){setError(error instanceof Error?error.message:'The connection test could not complete.');}finally{setBusy(false);}
 };
 return <section aria-label="GitHub connection test"><p>Send a signed ping from this page to check the receiver URL and secret. It does not create a pull request or change any issues.</p>{!secret&&<label>Saved GitHub secret<input type="password" autoComplete="off" value={savedSecret} onChange={event=>setSavedSecret(event.target.value)} data-rer-private/></label>}<button type="button" disabled={busy||!(secret??savedSecret)} onClick={()=>void test()}>{busy?'Testing GitHub connection…':'Send GitHub connection test'}</button>{error&&<p role="alert">{error}</p>}{connected&&<p role="status">HTTP 200 · connected. Vector accepted the signed ping. Complete the GitHub setup below and check Recent Deliveries to confirm GitHub can reach this URL from its servers.</p>}</section>;
}
