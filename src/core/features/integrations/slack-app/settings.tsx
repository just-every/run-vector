import {useState,type FormEvent} from 'react';
import {z} from 'zod';
import {useApiResource} from '../../../app/api-client';
import {send,acknowledged} from '../ui/client';
import {CopyField} from '../ui/copy-field';
const configuration=z.object({manifest:z.unknown(),createUrl:z.string().url(),callback:z.string().url(),app:z.object({appId:z.string(),clientId:z.string()}).nullable()});
export function SlackAppSettings(){
 const config=useApiResource('/api/settings/integrations/slack/app',configuration);
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function save(event:FormEvent<HTMLFormElement>,create=false){
  event.preventDefault();const form=event.currentTarget,body=Object.fromEntries(new FormData(form));setPending(true);setError('');setNotice('');
  try{await send('/slack/app'+(create?'/create':''),acknowledged,body);form.reset();config.reload();setNotice('Slack app credentials saved. Install the app to connect its bot.');}
  catch(error){setError(error instanceof Error?error.message:'Slack app configuration failed.');}finally{setPending(false);}
 }
 async function install(){setPending(true);setError('');try{const result=await send('/slack/app/install',z.object({url:z.string().url()}),{});window.location.assign(result.url);}catch(error){setError(error instanceof Error?error.message:'Slack installation failed.');setPending(false);}}
 return <section className="slack-app-settings" aria-labelledby="slack-app-heading"><h4 id="slack-app-heading">Install your Slack app</h4>
 <p>Use your own Slack app to connect channel notifications and member-linked direct messages. Message intake and synced threads are not available yet.</p>
 {config.error&&<p role="alert">{config.error.message}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {config.data&&<><details><summary>Create or configure a Slack app</summary>
 <p>Create the app with a one-time Slack app configuration token, or open the prefilled manifest in Slack and enter the credentials Slack shows. The configuration token is used once; app secrets are encrypted and never shown again.</p>
 <form aria-label="Create Slack app" onSubmit={event=>void save(event,true)}><fieldset disabled={pending}><label>App configuration token<input name="configurationToken" type="password" autoComplete="off" required minLength={10} maxLength={1000}/></label><button>Create Slack app</button></fieldset></form>
 <p><a href={config.data.createUrl} target="_blank" rel="noreferrer">Open prefilled Slack manifest</a></p>
 <CopyField label="Slack OAuth redirect URL" value={config.data.callback}/>
 <form aria-label="Slack app credentials" onSubmit={event=>void save(event)}><fieldset disabled={pending}>
 <label>Slack app ID<input name="appId" required maxLength={100}/></label><label>Slack client ID<input name="clientId" required maxLength={100}/></label>
 <label>Slack client secret<input name="clientSecret" type="password" autoComplete="off" required minLength={10} maxLength={500}/></label>
 <label>App signing secret<input name="signingSecret" type="password" autoComplete="off" required minLength={20} maxLength={128}/></label><button>Save app credentials</button></fieldset></form></details>
 {config.data.app&&<><p>Configured app: {config.data.app.appId}</p><button type="button" disabled={pending} onClick={()=>void install()}>Install Slack app</button></>}
 </>}
 </section>;
}
