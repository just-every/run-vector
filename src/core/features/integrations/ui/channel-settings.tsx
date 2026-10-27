import {SlackAppSettings} from './slack-app-settings';
import {useState,type FormEvent} from 'react';
import {useApiResource} from '../../../app/api-client';
import {channelConfiguration,channelEventLabels,scopeEvents} from '../channels/schema';
import {acknowledged,send} from './client';
import {CopyField} from './copy-field';
export function ChannelSettings(){
 const config=useApiResource('/api/settings/integrations/channels',channelConfiguration);
 const [appRevision,setAppRevision]=useState(0);
 const [provider,setProvider]=useState('slack'),[pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 // The chosen object's scope decides the offered events and their defaults; reset fires no change event, so it is cleared with the form.
 const [chosen,setChosen]=useState(''),offered=scopeEvents(chosen.split(':')[0]);
 async function run(path:string,body:unknown,method='POST'){
  setPending(true);setError('');setNotice('');
  try{await send(path,acknowledged,body,method);config.reload();if(path==='/slack'&&method==='DELETE')setAppRevision(value=>value+1);return true;}catch(error){setError(error instanceof Error?error.message:'Channel settings could not be saved.');return false;}finally{setPending(false);}
 }
 async function connect(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;
  if(await run('/slack',{botToken:new FormData(form).get('botToken')})){form.reset();setNotice('Slack connected. The bot token is stored securely.');}
 }
 async function saveSigningSecret(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;
  if(await run('/slack/signing-secret',{signingSecret:new FormData(form).get('signingSecret')})){form.reset();setNotice('Signing secret saved. Assign to me and Change status are on for new Slack direct messages.');}
 }
 async function allow(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,data=new FormData(form);
  if(await run('/channels/allowed',{channelId:data.get('channelId'),channelName:data.get('channelName')})){form.reset();setNotice('Channel allowed for project creators.');}
 }
 async function bind(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,data=new FormData(form),[scope,objectId]=String(data.get('object')).split(':');
  if(await run('/channels',{scope,objectId,provider,channelName:data.get('channelName'),events:data.getAll('events'),...(provider==='slack'?{channelId:data.get('channelId')}:{webhookUrl:data.get('webhookUrl')})})){form.reset();setChosen('');setNotice('Channel binding saved. Future selected events will be posted.');}
 }
 return <section className="channel-settings" aria-labelledby="channel-settings-heading"><h3 id="channel-settings-heading">Slack and Discord channels</h3>
 <p>Post selected changes from a team, project, saved view or initiative.</p>
 {config.error&&<p role="alert">{config.error.message}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {config.data&&<>
 <SlackAppSettings key={appRevision} onChanged={config.reload}/>
 <p>{config.data.slack.needsAttention?'Slack needs attention. Re-enter the bot token.':config.data.slack.connected?`Slack connected to ${config.data.slack.teamName}`:'Slack is not connected.'}</p>
 <details><summary>{config.data.slack.connected?'Replace Slack bot token':'Connect Slack'}</summary>
 <p>Use a Slack bot token with chat:write and channels:manage; Slack direct messages also need im:write and users:read.email. Only public channels can be created. Add the bot to an existing destination channel in Slack before binding it. Removing the connection revokes its bot token in Slack, deletes the signing secret and unlinks every member. Channels must be active, unshared and include the bot; Vector checks this when selected and before posting.</p>
 <form aria-label="Slack credential" onSubmit={connect}><fieldset disabled={pending}><label>Slack bot token<input name="botToken" type="password" autoComplete="off" required maxLength={500}/></label><button>Validate and save Slack token</button></fieldset></form>
 {config.data.slack.connected&&<form aria-label="Slack action verification" onSubmit={saveSigningSecret}><fieldset disabled={pending}><label>Slack signing secret<input name="signingSecret" type="password" autoComplete="off" required minLength={20} maxLength={128} pattern="[A-Za-z0-9]{20,128}" aria-describedby="slack-signing-help"/></label><small id="slack-signing-help">Copy it from your Slack app’s Basic Information page. Vector seals it beside the bot token and never shows it again; a restored installation needs it entered again.</small><button>Save signing secret</button></fieldset></form>}</details>
 {config.data.slack.connected&&<div className="slack-direct-actions" role="group" aria-labelledby="slack-direct-actions-heading"><h4 id="slack-direct-actions-heading">Slack direct message actions</h4>
 <p>{config.data.slack.signingSecret?'Assign to me and Change status are on. Vector verifies every Slack action with the signing secret.':'Assign to me and Change status are off until the signing secret is entered. Direct messages offer Open only.'}</p>
 <CopyField label="Interactivity Request URL" value={config.data.slack.interactivityUrl}/><small>In your Slack app, turn on Interactivity and paste this Request URL. Members link their own Slack accounts in Settings → Notifications.</small></div>}
 {config.data.slack.connected&&<button type="button" disabled={pending} onClick={()=>void run('/slack',undefined,'DELETE')}>Remove Slack connection</button>}
 <form aria-label="Allow project channel" onSubmit={allow}><fieldset disabled={pending||!config.data.slack.connected}><legend>Allow a Slack channel for projects</legend>
 <p>Members who create projects can bind them to a channel already bound by an Owner or Admin, or allowed here.</p>
 <label>Allowed channel name<input name="channelName" required maxLength={120}/></label><label>Allowed Slack channel ID<input name="channelId" required pattern="[CG][A-Z0-9]{2,30}"/></label><button>Allow channel</button></fieldset></form>
 <ul>{config.data.allowedChannels.map(channel=><li key={channel.channelId}>#{channel.channelName} <button type="button" disabled={pending} onClick={()=>void run('/channels/allowed/'+channel.channelId,undefined,'DELETE')}>Remove allowance for {channel.channelName}</button></li>)}</ul>
 <form aria-label="Bind notification channel" onSubmit={bind}><fieldset disabled={pending}><legend>Bind a channel</legend>
 <label>Team, project, saved view or initiative<select name="object" required defaultValue="" onChange={event=>setChosen(event.target.value)}><option value="">Choose where events come from</option>{config.data.objects.map(object=><option key={object.scope+object.id} value={object.scope+':'+object.id}>{object.scope==='view'?'Saved view':object.scope==='team'?'Team':object.scope==='initiative'?'Initiative':'Project'} · {object.name}</option>)}</select></label>
 <label>Channel service<select value={provider} onChange={event=>setProvider(event.target.value)}><option value="slack">Slack</option><option value="discord">Discord</option></select></label>
 <label>Channel display name<input name="channelName" required maxLength={120} placeholder="delivery-updates"/></label>
 {provider==='slack'?<label>Slack channel ID<input name="channelId" required pattern="[CG][A-Z0-9]{2,30}" placeholder="C0123456789"/><small>In Slack, open the channel details and copy its channel ID.</small></label>:<label>Discord webhook URL<input type="password" autoComplete="off" name="webhookUrl" required maxLength={2048}/><small>HTTPS on discord.com or discordapp.com, beginning /api/webhooks/. The URL is stored securely and never shown again.</small></label>}
 <fieldset key={chosen}><legend>Chosen events</legend>{offered.events.map(event=><label className="admin-checkbox" key={event}><input name="events" type="checkbox" value={event} defaultChecked={offered.checked.includes(event)}/>{channelEventLabels[event]}{offered.hedged.includes(event)?' (when available)':''}</label>)}</fieldset>
 <button disabled={provider==='slack'&&!config.data.slack.connected}>Save channel binding</button></fieldset></form>
 <p>A new binding replaces this object’s previous channel. Removing a binding stops future posts. Messages already posted remain in Slack or Discord.</p>
 <ul>{config.data.bindings.map(binding=><li key={binding.id}><strong>{binding.objectName}</strong> → {binding.provider==='slack'?'Slack':'Discord'} #{binding.channelName}{binding.suspendedReason&&<p role="alert">Routing suspended ({binding.suspendedReason}). Choose this object and save its channel binding again to confirm access. Held events are not replayed.</p>}{binding.needsAttention&&!binding.suspendedReason&&<p role="status">Needs attention: re-enter {binding.provider==='slack'?'the Slack token':'this Discord webhook URL by saving the binding again'}.</p>}<p>{binding.events.map(event=>channelEventLabels[event]).join(', ')}</p><button type="button" disabled={pending} onClick={()=>void run('/channels/'+binding.id,undefined,'DELETE')}>Remove binding for {binding.objectName}</button></li>)}</ul>
 </>}
 </section>;
}
