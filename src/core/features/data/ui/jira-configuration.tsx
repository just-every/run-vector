import { useState } from 'react';
import type { ImportInput } from '../import/types';
type Configuration=NonNullable<ImportInput['jira']>;
type Priority=NonNullable<Configuration['priorities']>[string];
export function JiraConfiguration({value,onChange,busy}:{value:Configuration;onChange:(value:Configuration)=>void;busy:boolean}) {
 const [source,setSource]=useState(''),[priority,setPriority]=useState<Priority>('none');
 return <fieldset disabled={busy}><legend>Jira date and priority policy</legend>
  <p>Documented profile, synthetic validation only. This file importer makes no Atlassian requests. Each unsupported column occurrence remains visible in the omissions; comments, attachment metadata, sprints, labels and relationships are not yet applied.</p>
  <label>Source UTC offset<input value={value.sourceOffset??''} placeholder="+10:00 or Z" pattern="Z|[+-](0[0-9]|1[0-3]):[0-5][0-9]|[+-]14:00" onChange={event=>onChange({...value,sourceOffset:event.target.value||undefined})}/></label>
  <p>Use the exporting user’s offset. A fixed offset does not infer daylight saving changes. Files spanning different offsets must contain explicit offsets.</p>
  <label>Short-year century<input type="number" min={1000} max={9900} step={100} value={value.shortYearCentury??''} placeholder="2000" onChange={event=>onChange({...value,shortYearCentury:event.target.value===''?undefined:Number(event.target.value)})}/></label>
  <p>Required for two-digit years: 2000 means 00–99 are 2000–2099. Confirm the exporting file’s century; Vector never guesses it.</p>
  <label>Jira priority<input value={source} maxLength={300} onChange={event=>setSource(event.target.value)}/></label>
  <label>Vector priority<select value={priority} onChange={event=>setPriority(event.target.value as Priority)}>{(['none','low','medium','high','urgent'] as const).map(item=><option key={item}>{item}</option>)}</select></label>
  <button type="button" disabled={!source} onClick={()=>{onChange({...value,priorities:{...value.priorities,[source]:priority}});setSource('');}}>Confirm priority mapping</button>
  {Object.entries(value.priorities??{}).map(([source,target])=><p key={source}>{source} → {target} <button type="button" onClick={()=>{const priorities={...value.priorities};delete priorities[source];onChange({...value,priorities});}}>Remove mapping</button></p>)}
 </fieldset>;
}
