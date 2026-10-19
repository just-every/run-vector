import { useViewerTime } from '../../../app/viewer-time';
import type { ProjectDetailData } from './data';
const fields:Record<string,string>={startDate:'Start date',targetDate:'Target date',priority:'Priority',labelIds:'Labels',name:'Name',description:'Description',leadOperatorId:'Lead',lifecycle:'Lifecycle',archivedAt:'Archive'};
function value(value:unknown,field:string,formatInstant:(value:string)=>string) {
  if(field==='Labels' && Array.isArray(value))return `${value.length} ${value.length===1?'label':'labels'}`;
  if(field==='Priority' && typeof value==='string')return value==='none'?'No priority':value[0].toUpperCase()+value.slice(1);
  if(value===null)return 'Not set';
  if(field==='Archive'&&typeof value==='string')return formatInstant(value);
  if(Array.isArray(value))return value.length ? value.join(', ') : 'None';
  return typeof value==='string'?value:JSON.stringify(value);
}
export function ProjectActivity({activity}:{activity:ProjectDetailData['activity']}) {
  const { formatInstant } = useViewerTime();
  return <section className="project-detail__section"><h2>Project activity</h2>
    {activity.length===0?<p>No project activity recorded.</p>:<ul className="project-fact-list">{activity.map(entry=>{
      const field=fields[entry.kind.replace(/^project\./,'').replace(/_changed$/,'')];
      return <li key={entry.id}><strong>{field ? `${field} changed` : entry.kind === 'project.created' ? 'Project created' : 'Project updated'}</strong>
        {field&&<span>{value(entry.previousValue,field,formatInstant)} → {value(entry.nextValue,field,formatInstant)}</span>}
        <small>{entry.actorName ?? 'Removed operator'} · <time dateTime={entry.createdAt}>{formatInstant(entry.createdAt)}</time></small></li>;
    })}</ul>}
  </section>;
}
