import '../../documents/ui/documents.css';
import {Link} from '@tanstack/react-router';
import {useApiResource} from '../../../app/api-client';
import {channelConfiguration,channelEventLabels} from '../../integrations/channels/schema';
/** Where this initiative posts, from the channel read only Owners and Admins may make. */
export function InitiativeChannelLine({id}:{id:string}){
 const config=useApiResource('/api/settings/integrations/channels',channelConfiguration);
 if(config.error)return <p role="alert">{config.error.message}</p>;
 if(!config.data)return null;
 const binding=config.data.bindings.find(binding=>binding.scope==='initiative'&&binding.objectId===id);
 return <p>{binding?<>Posts to {binding.provider==='slack'?'Slack':'Discord'} #{binding.channelName} · {binding.events.map(event=>channelEventLabels[event]).join(', ')}{binding.suspendedReason?' · Routing suspended':binding.needsAttention?' · Needs attention':''}</>:'Not posted to a channel'} · <Link className="document-team-link" to="/app/settings" hash="integrations">{binding?'Change':'Set up'}</Link></p>;
}
