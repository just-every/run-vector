import { useDateFormat } from '../../../shared/date-format';
import { projectIcon } from '../appearance';
import type { ProjectDetailData } from './data';
const fields:Record<string,string>={color:'Color',icon:'Icon',startDate:'Start date',targetDate:'Target date',priority:'Priority',labelIds:'Labels',name:'Name',description:'Description',leadOperatorId:'Lead',lifecycle:'Lifecycle',archivedAt:'Archive'};
function value(value:unknown,field:string,formatInstant:(value:string)=>string,formatDate:(value:string)=>string) {
  if(field==='Icon') {
    const emoji = projectIcon.safeParse(value);
    return emoji.success ? emoji.data : 'Not set';
  }
  if(field==='Labels' && Array.isArray(value))return `${value.length} ${value.length===1?'label':'labels'}`;
  if(field==='Priority' && typeof value==='string')return value==='none'?'No priority':value[0].toUpperCase()+value.slice(1);
  if(value===null)return 'Not set';
  if((field==='Start date'||field==='Target date')&&typeof value==='string')return formatDate(value);
  if(field==='Archive'&&typeof value==='string')return formatInstant(value);
  if(Array.isArray(value))return value.length ? value.join(', ') : 'None';
  return typeof value==='string'?value:JSON.stringify(value);
}
export function ProjectActivity({activity}:{activity:ProjectDetailData['activity']}) {
  const { dateTime: formatInstant, date } = useDateFormat();
  return <section className="project-detail__section"><h2>Project activity</h2>
    {activity.length===0?<p>No project activity recorded.</p>:<ul className="project-fact-list">{activity.map(entry=>{
      const field=fields[entry.kind.replace(/^project\./,'').replace(/_changed$/,'')];
      return <li key={entry.id}><strong>{field ? `${field} changed` : entry.kind === 'project.created' ? 'Project created' : 'Project updated'}</strong>
        {field&&<span>{value(entry.previousValue,field,formatInstant,date)} → {value(entry.nextValue,field,formatInstant,date)}</span>}
        <small>{entry.actorName ?? 'Removed operator'} · <time dateTime={entry.createdAt}>{formatInstant(entry.createdAt)}</time></small></li>;
    })}</ul>}
  </section>;
}
