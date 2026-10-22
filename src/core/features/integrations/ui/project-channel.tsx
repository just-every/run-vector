import {z} from 'zod';
import {useState,type FormEvent} from 'react';
import {useApiResource} from '../../../app/api-client';
import {useAdministrationAction} from '../../settings/ui/administration-action';
import {AdministrationFeedback} from '../../settings/ui/administration-feedback';
const channel=z.object({channelId:z.string(),channelName:z.string()});
const configuration=z.object({channels:z.array(channel),current:channel.nullable()});
export function ProjectChannel({projectId}:{projectId:string}){
 const path=`/api/projects/${projectId}/slack-channel`,resource=useApiResource(path,configuration);
 const action=useAdministrationAction(resource.reload),[selected,setSelected]=useState('');
 async function bind(event:FormEvent<HTMLFormElement>){event.preventDefault();if(await action.run(path,'POST',{channelId:selected}))setSelected('');}
 return <details><summary>Project Slack channel</summary>
 <p>Post new issue, triage and status events to a channel an Owner or Admin already bound or allowed.</p>
 {resource.error&&<p role="alert">{resource.error.message}</p>}
 {resource.data&&<><p>{resource.data.current?`Bound to #${resource.data.current.channelName}`:'No Slack channel bound.'}</p>
 <form aria-label="Project Slack channel" onSubmit={bind}><fieldset disabled={action.pending}><label>Approved Slack channel<select required value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Choose an approved channel</option>{resource.data.channels.map(channel=><option key={channel.channelId} value={channel.channelId}>#{channel.channelName}</option>)}</select></label>
 {!resource.data.channels.length&&<p>An Owner or Admin can bind or allow a channel in Settings → Integrations.</p>}
 <button disabled={!selected}>Bind project channel</button></fieldset></form></>}
 <AdministrationFeedback action={action}/></details>;
}
