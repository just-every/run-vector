import { useState } from 'react';
import type { ImportInput } from '../import/types';
type Configuration=NonNullable<ImportInput['jira']>;
type Priority=NonNullable<Configuration['priorities']>[string];
export function JiraConfiguration({value,onChange,busy}:{value:Configuration;onChange:(value:Configuration)=>void;busy:boolean}) {
 const [source,setSource]=useState(''),[priority,setPriority]=useState<Priority>('none');
 return <fieldset disabled={busy}><legend>Jira date and priority policy</legend>
  <p>Documented profile, synthetic validation only. This file importer makes no Atlassian requests. Each unsupported column occurrence remains visible in the omissions; comments, old keys and in-file parents, Blocks and Duplicate links become Vector issues, comments and relationships. Attachment bytes are absent and never fetched.</p>
  <label>Source UTC offset<input value={value.sourceOffset??''} placeholder="+10:00 or Z" pattern={"Z|[+\\-](0[0-9]|1[0-3]):[0-5][0-9]|[+\\-]14:00"} onChange={event=>onChange({...value,sourceOffset:event.target.value||undefined})}/></label>
  <p>Use the exporting user’s offset. A fixed offset does not infer daylight saving changes. Files spanning different offsets must contain explicit offsets.</p>
  <label>Short-year century<input type="number" min={1000} max={9900} step={100} value={value.shortYearCentury??''} placeholder="2000" onChange={event=>onChange({...value,shortYearCentury:event.target.value===''?undefined:Number(event.target.value)})}/></label>
  <p>Required for two-digit years: 2000 means 00–99 are 2000–2099. Confirm the exporting file’s century; Vector never guesses it.</p>
  <label>Seconds per Vector estimate point (optional)<input type="number" min={1} step={1} value={value.originalEstimateSecondsPerUnit??''} onChange={event=>onChange({...value,originalEstimateSecondsPerUnit:event.target.value===''?undefined:Number(event.target.value)})}/></label>
  <p>No default conversion or rounding. Converted estimates must be exact integers from 1 to 100; story points take precedence and original seconds remain retained.</p>
  <label>Completion time when Resolved is absent<select value={value.completedAtFallback??''} onChange={event=>onChange({...value,completedAtFallback:(event.target.value||undefined) as Configuration['completedAtFallback']})}><option value="">Require source Resolved</option><option value="updated">Use Updated</option><option value="created">Use Created</option><option value="effective">Use reviewed import time</option></select></label>
  <label><input type="checkbox" checked={value.attachmentLinks??false} onChange={event=>onChange({...value,attachmentLinks:event.target.checked})}/>Import valid attachment URLs as named HTTPS links</label>
  <p>Only the filename and URL become a link. Source author and timestamp remain metadata; no bytes are fetched.</p>
  <label>Jira priority<input value={source} maxLength={300} onChange={event=>setSource(event.target.value)}/></label>
  <label>Vector priority<select value={priority} onChange={event=>setPriority(event.target.value as Priority)}>{(['none','low','medium','high','urgent'] as const).map(item=><option key={item}>{item}</option>)}</select></label>
  <button type="button" disabled={!source} onClick={()=>{onChange({...value,priorities:{...value.priorities,[source]:priority}});setSource('');}}>Confirm priority mapping</button>
  {Object.entries(value.priorities??{}).map(([source,target])=><p key={source}>{source} → {target} <button type="button" onClick={()=>{const priorities={...value.priorities};delete priorities[source];onChange({...value,priorities});}}>Remove mapping</button></p>)}
 </fieldset>;
}
