import {jsonMediaType} from '../media-types';
import {useState,type FormEvent} from 'react';
import {z} from 'zod';
import {fetchJson,useApiResource} from '../../../app/api-client';
import {tokenScopes} from '../../integrations/feature-scopes';
import {OneTimeSecret} from '../../integrations/ui/one-time-secret';
import {CopyField} from '../../integrations/ui/copy-field';
import '../../integrations/ui/integrations.css';
const inventory=z.object({apps:z.array(z.object({id:z.string(),name:z.string(),redirectUris:z.string(),scopes:z.string(),createdAt:z.number()})),grants:z.array(z.object({id:z.string(),app:z.string(),member:z.string(),scopes:z.string(),createdAt:z.number(),lastUsed:z.number().nullable(),revokedAt:z.number().nullable()}))});
export function OAuthAppsPanel(){
 const data=useApiResource('/api/settings/oauth-apps',inventory),[name,setName]=useState(''),[redirects,setRedirects]=useState(''),[scopes,setScopes]=useState<string[]>(['issues:read']),[secret,setSecret]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const fail=(error:unknown)=>setMessage(error instanceof Error?error.message:'The change could not be saved.');
 const register=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setMessage('');setSecret(null);try{
  const created=await fetchJson('/api/settings/oauth-apps',z.object({id:z.string(),secret:z.string()}),{method:'POST',headers:{'Content-Type':jsonMediaType},body:JSON.stringify({name,redirectUris:redirects.split('\n').map(s=>s.trim()).filter(Boolean),scopes})});
  setSecret(created.secret);setName('');setRedirects('');data.reload();
 }catch(error){fail(error);}finally{setBusy(false);}};
 const revoke=async(id:string)=>{setBusy(true);try{await fetchJson('/api/settings/oauth-apps/grants/'+id,z.object({revoked:z.boolean()}),{method:'DELETE'});setMessage('Authorization revoked. Its next API call will be refused.');data.reload();}catch(error){fail(error);}finally{setBusy(false);}};
 return <section id="oauth-apps" className="integrations-panel" aria-labelledby="oauth-apps-heading"><h2 id="oauth-apps-heading">OAuth apps</h2><p>Register applications with only the API permissions they need. Each member reviews and approves their own access.</p>
 {data.loading&&<p role="status">Loading OAuth apps…</p>}{data.error&&<p role="alert">{data.error.message}</p>}{message&&<p role="status">{message}</p>}
 {secret&&<OneTimeSecret value={{secret}} onClose={()=>setSecret(null)}/>}
 {data.data&&<><form onSubmit={event=>void register(event)}><fieldset disabled={busy}><legend>Register an application</legend><label>Application name<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label><label>Redirect URLs<textarea required value={redirects} onChange={e=>setRedirects(e.target.value)} aria-describedby="oauth-redirect-help"/></label><p id="oauth-redirect-help">One exact HTTPS URL per line. Loopback HTTP is allowed for local development.</p><div className="integration-scopes">{tokenScopes.map(scope=><label key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={e=>setScopes(current=>e.target.checked?[...current,scope]:current.filter(s=>s!==scope))}/>{scope}</label>)}</div><button type="submit" disabled={!scopes.length}>Register application</button></fieldset></form>
 <section aria-labelledby="registered-apps-heading"><h3 id="registered-apps-heading">Registered applications</h3>{!data.data.apps.length&&<p>No applications registered.</p>}<ul>{data.data.apps.map(app=><li key={app.id}><strong>{app.name}</strong><CopyField label={app.name+' client ID'} value={app.id}/><p>{JSON.parse(app.redirectUris).join(', ')}</p><p>Permissions: {JSON.parse(app.scopes).join(', ')}</p></li>)}</ul></section>
 <section aria-labelledby="oauth-grants-heading"><h3 id="oauth-grants-heading">Authorized grants</h3><p>Review every member’s authorization. Revocation takes effect on the next API call.</p>{!data.data.grants.length&&<p>No authorized grants.</p>}<ul>{data.data.grants.map(grant=><li key={grant.id}><strong>{grant.app}</strong> · {grant.member}<p>{JSON.parse(grant.scopes).join(', ')}</p><p>Created {new Date(grant.createdAt).toLocaleString()} · Last used {grant.lastUsed?new Date(grant.lastUsed).toLocaleString():'Never'}</p>{grant.revokedAt?<p>Revoked</p>:<button type="button" disabled={busy} onClick={()=>void revoke(grant.id)}>Revoke {grant.app} for {grant.member}</button>}</li>)}</ul></section></>}
 </section>;
}
