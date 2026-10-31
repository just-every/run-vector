import {useState} from 'react';
import {useAdministrationAction} from './administration-action';
import {AdministrationFeedback} from './administration-feedback';
import type {Administration} from '../../administration/schema';
import type {TriageResponsibility} from '../../administration/triage-responsibility';
export function TeamTriageResponsibility({team,data,editable,onChanged}:{team:Administration['teams'][number];data:Administration;editable:boolean;onChanged:()=>void}) {
 const [draft,setDraft]=useState<TriageResponsibility>(team.triageResponsibility ?? {mode:'fixed',operatorIds:[],startsOn:new Intl.DateTimeFormat('en-CA',{timeZone:data.workspace.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())});
 const action=useAdministrationAction(onChanged);
 const people=data.operators.filter(person=>['owner','admin','member'].includes(person.role) && team.members.some(member=>member.operatorId===person.id));
 return <form aria-label={`Triage responsibility for ${team.name}`} onSubmit={event=>{event.preventDefault();void action.run(`/api/settings/teams/${team.id}`,'PATCH',{triageResponsibility:draft});}}>
  <h3>Triage responsibility</h3>
  <p>Choose a fixed person or a weekly rotation. Weekly handover follows workspace calendar dates, including daylight-saving changes. New intake notifies the responsible person once in Inbox, except the author. Current lists the incoming person's pending work.</p>
  <fieldset disabled={!editable || action.pending || !!team.archivedAt}>
   <label>Responsibility mode<select aria-label="Responsibility mode" value={draft.mode} onChange={event=>setDraft({...draft,mode:event.target.value as TriageResponsibility['mode'],operatorIds:[]})}><option value="fixed">Fixed person</option><option value="weekly">Weekly rotation</option></select></label>
   {draft.mode==='fixed' ? <label>Responsible person<select aria-label="Responsible person" required value={draft.operatorIds[0] ?? ''} onChange={event=>setDraft({...draft,operatorIds:event.target.value?[event.target.value]:[]})}><option value="">Choose a team member</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label> : <>
    <fieldset><legend>Rotation members in selection order</legend>{people.map(person=><label key={person.id} className="admin-checkbox"><input type="checkbox" checked={draft.operatorIds.includes(person.id)} onChange={event=>setDraft({...draft,operatorIds:event.target.checked?[...draft.operatorIds,person.id]:draft.operatorIds.filter(id=>id!==person.id)})}/>{person.name}</label>)}</fieldset>
    <p>Order: {draft.operatorIds.map(id=>people.find(person=>person.id===id)?.name ?? 'Unavailable member').join(', ') || 'Choose at least two members'}</p>
    <label>Rotation starts on<input type="date" required value={draft.startsOn} onChange={event=>setDraft({...draft,startsOn:event.target.value})}/></label>
   </>}
   <button>Save triage responsibility</button>
   {team.triageResponsibility && <button type="button" onClick={()=>void action.run(`/api/settings/teams/${team.id}`,'PATCH',{triageResponsibility:null})}>Clear triage responsibility</button>}
  </fieldset><AdministrationFeedback action={action}/>
 </form>;
}
