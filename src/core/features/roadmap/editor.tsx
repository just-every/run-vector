import {useState} from 'react';
import type {RoadmapData,RoadmapProject} from './schema';
export type PlanningChange = Partial<Pick<RoadmapProject,'startDate'|'targetDate'|'priority'|'labelIds'>>;
export function RoadmapEditor({project,labels,busy,save,close}:{project:RoadmapProject;labels:RoadmapData['labels'];busy:boolean;save:(change:PlanningChange)=>Promise<void>;close:()=>void}) {
  const [start,setStart]=useState(project.startDate??''),[target,setTarget]=useState(project.targetDate??'');
  const [priority,setPriority]=useState(project.priority),[selected,setSelected]=useState(project.labelIds);
  return <section className="roadmap-editor" aria-label={'Planning fields for '+project.name}>
    <div className="roadmap-heading"><h2>{project.name}</h2><button onClick={close}>Close editor</button></div>
    <form aria-label="Project dates" onSubmit={event=>{event.preventDefault();void save({startDate:start||null,targetDate:target||null});}}>
      <label>Start date<input type="date" value={start} onChange={e=>setStart(e.target.value)} disabled={busy}/></label>
      <label>Target date<input type="date" value={target} onChange={e=>setTarget(e.target.value)} disabled={busy}/></label>
      <button disabled={busy}>Save dates</button>
    </form>
    <form aria-label="Project priority" onSubmit={event=>{event.preventDefault();void save({priority});}}>
      <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as RoadmapProject['priority'])} disabled={busy}>
        {(['none','low','medium','high','urgent'] as const).map(value=><option key={value} value={value}>{value[0]!.toUpperCase()+value.slice(1)}</option>)}
      </select></label><button disabled={busy}>Save priority</button>
    </form>
    <form aria-label="Project labels" onSubmit={event=>{event.preventDefault();void save({labelIds:selected});}}>
      <fieldset disabled={busy}><legend>Labels</legend>{labels.length?labels.map(label=><label className="roadmap-checkbox" key={label.id}>
        <input type="checkbox" checked={selected.includes(label.id)} onChange={event=>setSelected(event.target.checked?[...selected,label.id]:selected.filter(id=>id!==label.id))}/>{label.name}
      </label>):<p>No project labels are configured.</p>}</fieldset><button disabled={busy}>Save labels</button>
    </form>
  </section>;
}
