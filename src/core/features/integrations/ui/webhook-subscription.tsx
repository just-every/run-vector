import {useId,useState,type FormEvent} from 'react';
import {z} from 'zod';
import {legacyWebhookEvents,webhookEventLabels,webhookEvents,type WebhookEvent} from '../subscription-schema';
import {send,type Configuration} from './client';
export type WebhookTeam={id:string;name:string;isPrivate:boolean;archivedAt:string|null};
type Destination=Configuration['destinations'][number];
/** The form's choice. "all" is saved as an empty team list, which means every public team. */
type Selection={events:string[];teams:'all'|'selected';teamIds:string[]};
const savedSchema=z.object({id:z.string(),events:z.array(z.string()),teamIds:z.array(z.string())});
const groups=[['Issues','issue.'],['Comments','comment.']] as const;
export const defaultSelection=():Selection=>({events:[...legacyWebhookEvents],teams:'all',teamIds:[]});
/** Only public, active teams are offered: a team filter never authorizes private-work export. */
const offeredTeams=(teams:WebhookTeam[])=>teams.filter(team=>!team.isPrivate&&!team.archivedAt);
/** Saved teams outside the offered list send nothing; a new choice keeps only offered teams. */
const chosenTeams=(selection:Selection,teams:WebhookTeam[])=>offeredTeams(teams).map(team=>team.id).filter(id=>selection.teamIds.includes(id));
export const subscriptionBody=(selection:Selection,teams:WebhookTeam[])=>({events:webhookEvents.filter(event=>selection.events.includes(event)),teamIds:selection.teams==='all'?[]:chosenTeams(selection,teams)});
export const selectionProblem=(selection:Selection,teams:WebhookTeam[])=>!selection.events.length?'Choose at least one event.':selection.teams==='selected'&&!chosenTeams(selection,teams).length?'Choose at least one team, or send from all public teams.':'';
export function subscriptionSummary(destination:Destination,teams:WebhookTeam[]){
 const known=new Map(teams.map(team=>[team.id,team]));
 const from=destination.teamIds.map(id=>{const team=known.get(id);return team?team.name+(team.isPrivate?' (private, never sent)':team.archivedAt?' (archived)':''):'Unlisted team';});
 return 'Events: '+destination.events.map(event=>webhookEventLabels[event as WebhookEvent]??event).join(', ')+' · Teams: '+(from.length?from.join(', '):'All public teams');
}
export function SubscriptionChoices({selection,teams,onChange}:{selection:Selection;teams:WebhookTeam[];onChange:(selection:Selection)=>void}){
 const scope=useId(),problem=selectionProblem(selection,teams);
 const toggle=(list:string[],value:string,on:boolean)=>on?[...list,value]:list.filter(item=>item!==value);
 return <div className="webhook-subscription">
  <fieldset><legend>Events to send</legend><div className="webhook-choice-groups">{groups.map(([label,prefix])=><fieldset key={prefix}><legend>{label}</legend>{webhookEvents.filter(event=>event.startsWith(prefix)).map(event=><label className="admin-checkbox" key={event}><input type="checkbox" checked={selection.events.includes(event)} onChange={change=>onChange({...selection,events:toggle(selection.events,event,change.target.checked)})}/>{webhookEventLabels[event]}</label>)}</fieldset>)}</div><small>Comment events carry issue and comment identifiers only, never comment text or its author.</small></fieldset>
  <fieldset><legend>Teams to send from</legend>
   <label className="admin-checkbox"><input type="radio" name={scope} checked={selection.teams==='all'} onChange={()=>onChange({...selection,teams:'all'})}/>All public teams</label>
   <label className="admin-checkbox"><input type="radio" name={scope} checked={selection.teams==='selected'} onChange={()=>onChange({...selection,teams:'selected'})}/>Only selected teams</label>
   {selection.teams==='selected'&&<div className="webhook-choice-teams" role="group" aria-label="Selected teams">{offeredTeams(teams).map(team=><label className="admin-checkbox" key={team.id}><input type="checkbox" checked={selection.teamIds.includes(team.id)} onChange={change=>onChange({...selection,teamIds:toggle(selection.teamIds,team.id,change.target.checked)})}/>{team.name}</label>)}</div>}
   <small>Private teams are never sent.</small>
  </fieldset>
  {problem&&<p className="integration-attention" aria-live="polite">{problem}</p>}
 </div>;
}
export function SubscriptionEditor({destination,teams,onSaved,onClose,onError}:{destination:Destination;teams:WebhookTeam[];onSaved:()=>void;onClose:()=>void;onError:(error:unknown)=>void}){
 const [selection,setSelection]=useState<Selection>(()=>({events:destination.events,teams:destination.teamIds.length?'selected':'all',teamIds:destination.teamIds})),[busy,setBusy]=useState(false);
 const save=async(event:FormEvent)=>{event.preventDefault();setBusy(true);try{await send('/destinations/'+destination.id+'/subscriptions',savedSchema,subscriptionBody(selection,teams),'PUT');onSaved();}catch(error){onError(error);}finally{setBusy(false);}};
 return <form className="webhook-subscription-editor" aria-label={'Events and teams for '+destination.name} onSubmit={event=>void save(event)}><fieldset disabled={busy}><legend>Events and teams</legend><SubscriptionChoices selection={selection} teams={teams} onChange={setSelection}/><div className="integration-actions"><button type="submit" disabled={Boolean(selectionProblem(selection,teams))}>Save events and teams</button><button type="button" onClick={onClose}>Cancel</button></div></fieldset></form>;
}
