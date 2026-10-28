import {scopeLabels} from '../../integrations/scope-labels';
import {tokenScopes} from '../../integrations/feature-scopes';
import {jsonMediaType} from '../media-types';
import {useState} from 'react';
import {Link,useLocation} from '@tanstack/react-router';
import {z} from 'zod';
import {ApiError,fetchJson,useApiResource} from '../../../app/api-client';
import '../../settings/ui/settings.css';
import '../../integrations/ui/integrations.css';

const consent=z.object({name:z.string(),scopes:z.array(z.enum(tokenScopes)),redirectUri:z.string()});
const invalidLink="This sign-in link from the app is out of date. Go back to the app and start again; if it keeps happening, tell the app’s developer.";
function ConsentProblem({refused=false}:{refused?:boolean}){
 return <><p role="alert">{refused?"Your role can’t give apps access. Ask a workspace Admin.":invalidLink}</p><Link to="/app">Back to Vector</Link></>;
}
export function OAuthConsentPage(){
 const query=useLocation({select:location=>location.searchStr}),params=new URLSearchParams(query);
 return <main className="settings-page"><section className="integrations-panel" aria-labelledby="oauth-consent-heading">
  <h1 id="oauth-consent-heading">Authorize an application</h1>
  {params.has('error')||!params.has('client_id')?<ConsentProblem/>:<ConsentRequest query={query}/>}
 </section></main>;
}
function ConsentRequest({query}:{query:string}){
 const data=useApiResource('/api/oauth/consent'+query,consent),[busy,setBusy]=useState(false),[error,setError]=useState<Error|null>(null);
 const decide=async(decision:'approve'|'deny')=>{
  setBusy(true);setError(null);
  try{
   const result=await fetchJson('/api/oauth/consent',z.object({redirect:z.string()}),{method:'POST',headers:{'Content-Type':jsonMediaType},body:JSON.stringify({request:Object.fromEntries(new URLSearchParams(query)),decision})});
   window.location.assign(result.redirect);
  }catch(cause){setError(cause instanceof Error?cause:new Error());setBusy(false);}
 };
 const failure=data.error??error;
 if(failure)return <ConsentProblem refused={failure instanceof ApiError&&failure.status===403}/>;
 return <>{data.loading&&<p role="status">Loading authorization…</p>}{data.data&&<>
  <h2>{data.data.name}</h2><p>This application requests access to your Vector account:</p>
  <ul>{data.data.scopes.map(scope=><li key={scope}><strong>{scopeLabels[scope]}</strong></li>)}</ul>
  <p>Access follows your current workspace role and team visibility. An Admin can revoke it at any time.</p>
  <p className="integration-url">After your decision, return to {data.data.redirectUri}</p>
  <div className="integration-actions"><button disabled={busy} type="button" onClick={()=>void decide('approve')}>Approve access</button><button disabled={busy} type="button" onClick={()=>void decide('deny')}>Deny access</button></div>
 </>}</>;
}
