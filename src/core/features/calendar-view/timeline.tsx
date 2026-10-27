import {useEffect,useId,useState,type DragEvent} from 'react';
import {z} from 'zod';
import {ApiError,fetchJson,useApiResource} from '../../app/api-client';
import {Tooltip} from '../../ui/tooltip';
import type {IssueListQuery} from '../issues/list-schema';
import {defaultIssueListQuery,issueListSearch} from '../issues/ui/issue-list-controls';
import {timelineSchema,type TimelineIssue} from './timeline-schema';
import {dayAt,issueInterval,timelineGeometry} from './timeline-dates';
import './timeline.css';

type DateField='startDate'|'dueDate';
type Change={issue:TimelineIssue;field:DateField};
const receipt=z.object({identifier:z.string(),version:z.number()});
export function IssueTimeline({query=defaultIssueListQuery}:{query?:IssueListQuery}){
  const data=useApiResource('/api/calendar/timeline'+issueListSearch(query),timelineSchema,5000);
  const [drag,setDrag]=useState<Change|null>(null),[editing,setEditing]=useState<Change|null>(null),[date,setDate]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const marker=useId().replaceAll(':','');
  const denied=data.error instanceof ApiError&&[401,403,404].includes(data.error.status);
  const current=denied?null:data.data;
  const scheduled=current?.issues.filter(issue=>issue.startDate||issue.dueDate)??[];
  const unscheduled=current?.issues.filter(issue=>!issue.startDate&&!issue.dueDate)??[];
  const geometry=current?timelineGeometry(scheduled,current.today):null;
  useEffect(()=>{const changed=()=>data.refreshAfterMutation();window.addEventListener('vector:issues-changed',changed);return()=>window.removeEventListener('vector:issues-changed',changed);},[data.refreshAfterMutation]);
  async function move(change:Change,next:string){
    if(busy||!current?.canEdit||next===change.issue[change.field])return;
    setBusy(true);setError('');setMessage('');
    try{
      await fetchJson('/api/issues/'+change.issue.identifier,receipt,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:change.issue.version,[change.field]:next||null})});
      setMessage(change.issue.identifier+' '+(change.field==='startDate'?'start':'due')+' date changed.');setEditing(null);
      await data.refreshAfterMutation();
    }catch(cause){
      setError(cause instanceof ApiError&&cause.status===409?'This issue changed. Your date change was not saved. Review the refreshed timeline before trying again.':cause instanceof Error?cause.message:'The date could not be changed.');
      if(cause instanceof ApiError&&cause.status===409){setEditing(null);data.reload();}
    }finally{setBusy(false);setDrag(null);}
  }
  function begin(event:DragEvent,change:Change){
    setDrag(change);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',change.issue.identifier);setError('');
  }
  function drop(event:DragEvent<HTMLDivElement>){
    if(!drag||!geometry||busy)return;
    event.preventDefault();const box=event.currentTarget.getBoundingClientRect();
    const fraction=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width));
    void move(drag,dayAt(Math.round(geometry.first+fraction*geometry.span)));
  }
  function open(issue:TimelineIssue,field:DateField){setEditing({issue,field});setDate(issue[field]??'');setError('');}
  return <section className="issue-timeline" aria-label="Issue timeline" data-timeline-ready={current&&!data.loading&&!busy&&!data.error?'true':'false'}>
    <div className="insights-heading"><h2>Timeline</h2>{current&&<span>{current.timezone}</span>}</div>
    {data.error&&<p role="alert">{data.error.message} <button onClick={data.reload}>Retry timeline</button></p>}
    {!current&&!data.error&&<p role="status">Loading timeline…</p>}
    {current&&geometry&&<>
      <p className="timeline-legend">Start to due · ◆ Due only · Dashed to today: start only</p>
      <div className="timeline-layout">
        <div className="timeline-scroll" role="region" aria-label="Scheduled issues" tabIndex={0}>
          <div className="timeline-canvas">
            <div className="timeline-axis"><span>Issue</span><div>{geometry.ticks.map((tick,index)=><time key={index} dateTime={tick} style={{left:index/6*100+'%'}}>{tick.slice(5)}</time>)}</div></div>
            <div className="timeline-lines" style={{height:scheduled.length*88}} aria-hidden={undefined}>
              <svg viewBox={'0 0 1000 '+Math.max(1,scheduled.length*88)} preserveAspectRatio="none" role="img" aria-label="Issue dependencies">
                <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
                {current.dependencies.map(link=>{
                  const from=scheduled.findIndex(issue=>issue.identifier===link.blocking),to=scheduled.findIndex(issue=>issue.identifier===link.blocked);
                  if(from<0||to<0)return null;
                  const a=issueInterval(scheduled[from]!,current.today),b=issueInterval(scheduled[to]!,current.today);
                  const x1=geometry.position(a.end)*10,x2=geometry.position(b.start)*10,y1=from*88+44,y2=to*88+44;
                  return <path key={link.blocking+link.blocked} data-dependency-from={link.blocking} data-dependency-to={link.blocked} d={`M ${x1} ${y1} C ${x1+35} ${y1}, ${x2-35} ${y2}, ${x2} ${y2}`} markerEnd={'url(#'+marker+')'}><title>{link.blocking} blocks {link.blocked}</title></path>;
                })}
              </svg>
            </div>
            {scheduled.map(issue=>{
              const interval=issueInterval(issue,current.today),left=geometry.position(interval.first),right=geometry.position(interval.last);
              return <article className="timeline-row" key={issue.identifier} data-timeline-issue={issue.identifier} data-date-kind={interval.kind} data-start-date={issue.startDate??''} data-due-date={issue.dueDate??''}>
                <div className="timeline-label"><a href={'/app/issues/'+issue.identifier}>{issue.identifier} · {issue.title}</a>{current.canEdit&&<button disabled={busy} onClick={()=>open(issue,issue.startDate?'startDate':'dueDate')} aria-label={'Change dates for '+issue.identifier}>Change dates</button>}</div>
                <div className="timeline-track" onDragOver={event=>{if(drag&&!busy){event.preventDefault();event.dataTransfer.dropEffect='move';}}} onDrop={drop}>
                  <span className="timeline-today" style={{left:geometry.position(current.today)+'%'}}/>
                  <div className={'timeline-bar timeline-bar--'+interval.kind} style={{left:left+'%',width:interval.kind==='diamond'?undefined:Math.max(1,right-left)+'%',flexDirection:interval.kind==='open'&&issue.startDate!>current.today?'row-reverse':undefined}} aria-label={issue.identifier+(issue.startDate?' starts '+issue.startDate:'')+(issue.dueDate?' due '+issue.dueDate:' open to today '+current.today)}>
                    {interval.kind==='diamond'?<span className="timeline-diamond">◆</span>:null}
                    {current.canEdit?<>
                      {issue.startDate&&<Tooltip label="Drag start date"><button className="timeline-handle timeline-handle--start" draggable={!busy} disabled={busy} aria-label={'Drag start date for '+issue.identifier} onDragStart={event=>begin(event,{issue,field:'startDate'})} onDragEnd={()=>setDrag(null)} onClick={()=>open(issue,'startDate')}>Start</button></Tooltip>}
                      {issue.dueDate&&<Tooltip label="Drag due date"><button className="timeline-handle timeline-handle--due" draggable={!busy} disabled={busy} aria-label={'Drag due date for '+issue.identifier} onDragStart={event=>begin(event,{issue,field:'dueDate'})} onDragEnd={()=>setDrag(null)} onClick={()=>open(issue,'dueDate')}>Due</button></Tooltip>}
                    </>:<span className="timeline-read-date">{issue.startDate??issue.dueDate}</span>}
                  </div>
                </div>
              </article>;
            })}
            {!scheduled.length&&<p>No scheduled issues on this page.</p>}
          </div>
        </div>
        <aside className="timeline-unscheduled" aria-label="Unscheduled issues"><h3>Unscheduled</h3>{unscheduled.length?<ul>{unscheduled.map(issue=><li key={issue.identifier}><a href={'/app/issues/'+issue.identifier}>{issue.identifier} · {issue.title}</a>{current.canEdit&&<button disabled={busy} aria-label={'Schedule '+issue.identifier} onClick={()=>open(issue,'startDate')}>Set dates</button>}</li>)}</ul>:<p>No unscheduled issues on this page.</p>}</aside>
      </div>
      {current.total>current.issues.length&&<p>{current.issues.length} of {current.total} issues. Use the issue list filters and pages to narrow the timeline.</p>}
    </>}
    {editing&&<form className="timeline-date-editor" aria-label={'Change dates for '+editing.issue.identifier} onSubmit={event=>{event.preventDefault();void move(editing,date);}}>
      <fieldset disabled={busy}><legend>{editing.issue.identifier} dates</legend><label>Date to change<select aria-label="Date to change" value={editing.field} onChange={event=>{const field=event.target.value as DateField;setEditing({...editing,field});setDate(editing.issue[field]??'');}}><option value="startDate">Start date</option><option value="dueDate">Due date</option></select></label><label>New date<input aria-label="New date" type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><button type="submit">Save date</button><button type="button" onClick={()=>setEditing(null)}>Cancel date change</button></fieldset>
    </form>}
    {busy&&<p role="status">Saving date…</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
