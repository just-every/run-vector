import {useState} from 'react';
import {MentionTextarea} from '../../notifications/ui/mention-textarea';
import {EstimateChoice} from '../../issues/ui/estimate-choice';
import {useAdministrationAction} from './administration-action';
import {AdministrationFeedback} from './administration-feedback';
import type {Administration} from '../../administration/schema';

export function TeamDefaultTemplate({team,data,editable,onChanged}:{team:Administration['teams'][number];data:Administration;editable:boolean;onChanged:()=>void}) {
  const [draft,setDraft]=useState(team.defaultIssueTemplate ?? {name:'',title:'',description:'',priority:'none' as const,estimate:null,labelIds:[] as string[]});
  const action=useAdministrationAction(onChanged);
  return <form aria-label={`Default issue template for ${team.name}`} onSubmit={event=>{event.preventDefault();void action.run(`/api/settings/teams/${team.id}`,'PATCH',{defaultIssueTemplate:draft});}}>
    <h3>Default issue template</h3>
    <p>Prefill new issues for this team. Typed fields take precedence. Existing issues keep their content when this default changes or is removed.</p>
    <fieldset disabled={!editable || action.pending || !!team.archivedAt}>
      <label>Template name<input required maxLength={120} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
      <label>Default issue title<input maxLength={500} value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
      <label>Default issue description<MentionTextarea aria-label="Default issue description" value={draft.description} maxLength={100000} disabled={!editable || action.pending} onValueChange={description=>setDraft({...draft,description})}/></label>
      <label>Default issue priority<select value={draft.priority} onChange={event=>setDraft({...draft,priority:event.target.value as typeof draft.priority})}>
        {(['none','low','medium','high','urgent'] as const).map(value=><option key={value} value={value}>{value==='none'?'No priority':value[0].toUpperCase()+value.slice(1)}</option>)}
      </select></label>
      {team.estimatesEnabled && <EstimateChoice label="Default issue estimate" scale={team.estimateScale} value={draft.estimate === null ? '' : String(draft.estimate)} onChange={value=>setDraft({...draft,estimate:value ? Number(value) : null})}/>}
      <fieldset><legend>Default issue labels</legend>{data.labels.map(label=><label key={label.id} className="admin-checkbox"><input type="checkbox" checked={draft.labelIds.includes(label.id)} onChange={event=>setDraft({...draft,labelIds:event.target.checked?[...draft.labelIds,label.id]:draft.labelIds.filter(id=>id!==label.id)})}/>{label.name}</label>)}</fieldset>
      <button>Save default issue template</button>
      {team.defaultIssueTemplate && <button type="button" onClick={()=>void action.run(`/api/settings/teams/${team.id}`,'PATCH',{defaultIssueTemplate:null})}>Remove default issue template</button>}
    </fieldset>
    <AdministrationFeedback action={action}/>
  </form>;
}
