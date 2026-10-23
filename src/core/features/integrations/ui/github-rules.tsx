import {useState} from 'react';
import {z} from 'zod';
import {fetchJson,useApiResource} from '../../../app/api-client';
const ruleSchema=z.object({trigger:z.enum(['draft','review','merged','deploy']),statusId:z.string().nullable(),allowReopen:z.number(),version:z.number()});
const teamSchema=z.object({id:z.string(),name:z.string(),statuses:z.array(z.object({id:z.string(),name:z.string()})),rules:z.array(ruleSchema)});
const schema=z.object({teams:z.array(teamSchema)});
const names={draft:'Draft PR opened',review:'Review requested',merged:'PR merged',deploy:'Production deployed'};
function Rule({team,rule,onSaved}:{team:z.infer<typeof teamSchema>;rule:z.infer<typeof ruleSchema>;onSaved:()=>void}){
 const [status,setStatus]=useState(rule.statusId??''),[reopen,setReopen]=useState(Boolean(rule.allowReopen)),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function save(){setBusy(true);setMessage('');try{await fetchJson('/api/settings/teams/'+team.id,z.object({saved:z.boolean()}),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({githubAutomation:{trigger:rule.trigger,statusId:status||null,allowReopen:reopen,expectedVersion:rule.version}})});setMessage('Rule saved.');onSaved();}catch(e){setMessage(e instanceof Error?e.message:'Rule could not be saved.');}finally{setBusy(false);}}
 return <form onSubmit={event=>{event.preventDefault();void save();}}><fieldset disabled={busy}><legend>{names[rule.trigger]}</legend><label htmlFor={team.id+'-'+rule.trigger}>{team.name} {names[rule.trigger]} status</label><select id={team.id+'-'+rule.trigger} value={status} onChange={e=>setStatus(e.target.value)}><option value="">Do not move</option>{team.statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><label><input type="checkbox" checked={reopen} onChange={e=>setReopen(e.target.checked)}/>Allow this rule to reopen completed issues</label><button type="submit">Save {names[rule.trigger]} rule</button>{message&&<p role="status">{message}</p>}</fieldset></form>;
}
export function GithubRules(){
 const data=useApiResource('/api/github/automation',schema);
 if(data.error)return <p role="alert">{data.error.message}</p>;
 return <section aria-label="Git automation rules"><h4>Team automation</h4><p>Rules act as Git automation. Completed issues stay completed unless their rule explicitly allows reopening. Production means an environment named production.</p>{data.data?.teams.map(team=><details key={team.id}><summary>{team.name} Git automation</summary>{team.rules.map(rule=><Rule key={rule.trigger} team={team} rule={rule} onSaved={data.reload}/>)}</details>)}</section>;
}
