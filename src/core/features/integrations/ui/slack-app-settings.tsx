import {useState,type FormEvent} from 'react';
import {z} from 'zod';
import {useApiResource} from '../../../app/api-client';
import {acknowledged,send} from './client';

const configuration=z.object({createUrl:z.string().url(),app:z.object({appId:z.string(),clientId:z.string()}).nullable()});
const installation=z.object({url:z.string().url()});
/** The existing sealed app configuration and actor-bound OAuth doors, in Settings. */
export function SlackAppSettings({onChanged}:{onChanged:()=>void}){
 const resource=useApiResource('/api/settings/integrations/slack/app',configuration);
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function configure(event:FormEvent<HTMLFormElement>,automatic:boolean){
  event.preventDefault();const form=event.currentTarget,data=new FormData(form);
  setPending(true);setError('');setNotice('');
  try{
   await send(automatic?'/slack/app/create':'/slack/app',acknowledged,Object.fromEntries(data));
   form.reset();resource.reload();setNotice('Slack app configured. Install it in your workspace next.');
  }catch(cause){setError(cause instanceof Error?cause.message:'Slack app could not be configured.');}
  finally{setPending(false);}
 }
 async function install(){
  setPending(true);setError('');setNotice('');
  try{const result=await send('/slack/app/install',installation,{});window.location.assign(result.url);}
  catch(cause){setError(cause instanceof Error?cause.message:'Slack installation could not start.');setPending(false);}
 }
 async function remove(){
  setPending(true);setError('');setNotice('');
  try{await send('/slack',acknowledged,undefined,'DELETE');resource.reload();onChanged();setNotice('Slack app removed. Members must link again after reconnecting.');}
  catch(cause){setError(cause instanceof Error?cause.message:'Slack app could not be removed.');}
  finally{setPending(false);}
 }
 return <section aria-labelledby="slack-app-installation-heading"><h4 id="slack-app-installation-heading">Slack app installation</h4>
 <p>Create an app for this Vector installation, then install it to enable channel and personal notifications.</p>
 {resource.error&&<p role="alert">{resource.error.message}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {resource.data&&<>
 <details><summary>Create an app automatically</summary>
 <form aria-label="Generate Slack app" onSubmit={event=>void configure(event,true)}><fieldset disabled={pending}>
 <label>App configuration token<input name="configurationToken" type="password" autoComplete="off" required minLength={10} maxLength={1000}/></label>
 <p>Vector uses this token once to create the app with this installation’s URLs and permissions.</p><button>Create Slack app</button>
 </fieldset></form></details>
 <details><summary>Use Slack’s prefilled page</summary>
 <p><a href={resource.data.createUrl} target="_blank" rel="noopener noreferrer">Open Slack app setup</a>, create the app, then enter the credentials Slack shows.</p>
 <form aria-label="Slack app credentials" onSubmit={event=>void configure(event,false)}><fieldset disabled={pending}>
 <div className="integration-fields"><label>App ID<input name="appId" required maxLength={100}/></label><label>App client ID<input name="clientId" required maxLength={100}/></label>
 <label>App client secret<input name="clientSecret" type="password" autoComplete="off" required minLength={10} maxLength={500}/></label><label>App signing secret<input name="signingSecret" type="password" autoComplete="off" required minLength={20} maxLength={128}/></label></div>
 <button>Save Slack app credentials</button></fieldset></form></details>
 {resource.data.app&&<><p>App {resource.data.app.appId} is configured. Stored secrets are never shown again.</p>
 <div className="integration-actions"><button type="button" disabled={pending} onClick={()=>void install()}>Install Slack app</button><button type="button" disabled={pending} onClick={()=>void remove()}>Remove Slack app</button></div>
 <p>Removing the app revokes its bot token and removes stored app credentials and member links.</p></>}
 </>}
 </section>;
}
