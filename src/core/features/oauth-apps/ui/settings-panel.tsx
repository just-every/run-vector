import {jsonMediaType} from '../media-types';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {z} from 'zod';
import {ApiError,fetchJson,useApiResource} from '../../../app/api-client';
import {useViewerTime} from '../../../app/viewer-time';
import {tokenScopes} from '../../integrations/feature-scopes';
import {scopeLabels,scopeDescription} from '../../integrations/scope-labels';
import {OneTimeSecret} from '../../integrations/ui/one-time-secret';
import {CopyField} from '../../integrations/ui/copy-field';
import '../../integrations/ui/integrations.css';

const inventory=z.object({
 apps:z.array(z.object({id:z.string(),name:z.string(),redirectUris:z.string(),scopes:z.string(),createdAt:z.number()})),
 grants:z.array(z.object({id:z.string(),app:z.string(),member:z.string(),scopes:z.string(),createdAt:z.number(),lastUsed:z.number().nullable(),revokedAt:z.number().nullable()})),
});
type Failure={message:string;network:boolean;redirect:boolean};
function failure(cause:unknown):Failure{
 const network=cause instanceof TypeError,body=cause instanceof ApiError?cause.body:null;
 return {
  message:network?"Couldn’t reach Vector. Check the connection and try again.":cause instanceof ApiError?cause.message:'The change could not be saved. Try again.',
  network,redirect:typeof body==='object'&&body!==null&&'error' in body&&body.error==='invalid_redirect',
 };
}
function ActionFailure({error,retry}:{error:Failure;retry:()=>void}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{ref.current?.scrollIntoView({block:'nearest'});},[error]);
 return <div ref={ref} role="alert"><p>{error.message}</p>{error.network&&<button type="button" onClick={retry}>Retry</button>}</div>;
}
export function OAuthAppsPanel(){
 const {formatInstant}=useViewerTime(),data=useApiResource('/api/settings/oauth-apps',inventory);
 const [name,setName]=useState(''),[redirects,setRedirects]=useState(''),[scopes,setScopes]=useState<string[]>(['issues:read']);
 const [secret,setSecret]=useState<string|null>(null),[busy,setBusy]=useState(false),[registerError,setRegisterError]=useState<Failure|null>(null);
 const [revokeErrors,setRevokeErrors]=useState<Record<string,Failure|undefined>>({});
 const register=async(event?:FormEvent)=>{
  event?.preventDefault();setBusy(true);setRegisterError(null);setSecret(null);
  try{
   const created=await fetchJson('/api/settings/oauth-apps',z.object({id:z.string(),secret:z.string()}),{
    method:'POST',headers:{'Content-Type':jsonMediaType},
    body:JSON.stringify({name,redirectUris:redirects.split('\n').map(s=>s.trim()).filter(Boolean),scopes}),
   });
   setSecret(created.secret);setName('');setRedirects('');data.reload();
  }catch(cause){setRegisterError(failure(cause));}finally{setBusy(false);}
 };
 const revoke=async(id:string)=>{
  setBusy(true);setRevokeErrors(current=>({...current,[id]:undefined}));
  try{
   await fetchJson('/api/settings/oauth-apps/grants/'+id,z.object({revoked:z.boolean()}),{method:'DELETE'});
   data.reload();
  }catch(cause){setRevokeErrors(current=>({...current,[id]:failure(cause)}));}finally{setBusy(false);}
 };
 return <section id="oauth-apps" className="integrations-panel" aria-labelledby="oauth-apps-heading">
  <h2 id="oauth-apps-heading">OAuth apps</h2><p>Register applications with only the API permissions they need. Each member reviews and approves their own access.</p>
  {data.loading&&<p role="status">Loading OAuth apps…</p>}{data.error&&<p role="alert">{data.error.message}</p>}
  {secret&&<OneTimeSecret value={{secret}} onClose={()=>setSecret(null)}/>}
  {data.data&&<>
   <form onSubmit={event=>void register(event)}><fieldset disabled={busy}>
    <legend>Register an application</legend>
    <label>Application name<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label htmlFor="oauth-redirects">Redirect URLs</label><textarea id="oauth-redirects" required value={redirects} onChange={e=>setRedirects(e.target.value)}
     aria-invalid={registerError?.redirect||undefined} aria-describedby={'oauth-redirect-help'+(registerError?.redirect?' oauth-redirect-error':'')}/>
    <p id="oauth-redirect-help">One exact HTTPS URL per line. Loopback HTTP is allowed for local development.</p>
    {registerError?.redirect&&<p id="oauth-redirect-error">{registerError.message}</p>}
    <div className="integration-scopes">{tokenScopes.map(scope=><label key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={e=>setScopes(current=>e.target.checked?[...current,scope]:current.filter(s=>s!==scope))}/>{scopeLabels[scope]}</label>)}</div>
    <button type="submit" disabled={!scopes.length}>Register application</button>
    {registerError&&<ActionFailure error={registerError} retry={()=>void register()}/>}
   </fieldset></form>
   <section aria-labelledby="registered-apps-heading"><h3 id="registered-apps-heading">Registered applications</h3>
    {!data.data.apps.length&&<p>No applications registered.</p>}
    <ul>{data.data.apps.map(app=><li key={app.id}><strong>{app.name}</strong><CopyField label={app.name+' client ID'} value={app.id}/>
     <p className="integration-url">{JSON.parse(app.redirectUris).join(', ')}</p><p>Permissions: {scopeDescription(app.scopes)}</p>
    </li>)}</ul>
   </section>
   <section aria-labelledby="oauth-grants-heading"><h3 id="oauth-grants-heading">Authorized grants</h3>
    <p>Review every member’s authorization. Revocation takes effect on the next API call.</p>
    {!data.data.grants.length&&<p>No authorized grants.</p>}
    <ul>{data.data.grants.map(grant=><li key={grant.id}>
     <p><strong>{grant.member}</strong> allowed {grant.app} to {scopeDescription(grant.scopes)} · Created {formatInstant(grant.createdAt)} · Last used {grant.lastUsed!==null?formatInstant(grant.lastUsed):'Never'}</p>
     {grant.revokedAt?<p role="status">Revoked</p>:<button type="button" disabled={busy} onClick={()=>void revoke(grant.id)}>Revoke {grant.app} for {grant.member}</button>}
     {revokeErrors[grant.id]&&<ActionFailure error={revokeErrors[grant.id]!} retry={()=>void revoke(grant.id)}/>}
    </li>)}</ul>
   </section>
  </>}
 </section>;
}
