import {useState} from 'react';
import {useLocation} from '@tanstack/react-router';
import {z} from 'zod';
import {fetchJson,useApiResource} from '../../../app/api-client';
import '../../settings/ui/settings.css';
import '../../integrations/ui/integrations.css';
const consent=z.object({name:z.string(),scopes:z.array(z.string()),redirectUri:z.string()});
const descriptions:Record<string,string>={'issues:read':'Read issues you can access','issues:write':'Create and update issues','metadata:read':'Read workspace metadata','comments:read':'Read comments you can access','comments:write':'Add comments'};
export function OAuthConsentPage(){
 const query=useLocation({select:location=>location.searchStr});
 const data=useApiResource('/api/oauth/consent'+query,consent),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const decide=async(decision:'approve'|'deny')=>{setBusy(true);setError('');try{
  const result=await fetchJson('/api/oauth/consent',z.object({redirect:z.string()}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request:Object.fromEntries(new URLSearchParams(query)),decision})});window.location.assign(result.redirect);
 }catch(error){setError(error instanceof Error?error.message:'The authorization could not be saved.');setBusy(false);}};
 return <main className="settings-page"><section className="integrations-panel" aria-labelledby="oauth-consent-heading"><h1 id="oauth-consent-heading">Authorize an application</h1>{data.loading&&<p role="status">Loading authorization…</p>}{(data.error||error)&&<p role="alert">{data.error?.message??error}</p>}{data.data&&<><h2>{data.data.name}</h2><p>This application requests access to your Vector account:</p><ul>{data.data.scopes.map(scope=><li key={scope}><strong>{descriptions[scope]??scope.replaceAll(':',' — ')}</strong><p>{scope}</p></li>)}</ul><p>Access follows your current workspace role and team visibility. An Admin can revoke it at any time.</p><p className="integration-url">After your decision, return to {data.data.redirectUri}</p><div className="integration-actions"><button disabled={busy} type="button" onClick={()=>void decide('approve')}>Approve access</button><button disabled={busy} type="button" onClick={()=>void decide('deny')}>Deny access</button></div></>}</section></main>;
}
