import {useRef,useState,type DragEvent,type CSSProperties} from 'react';
import {ApiError,fetchJson,useApiResource} from '../../app/api-client';
import {Tooltip} from '../../ui/tooltip';
import {roadmapSchema,type Placement,type RoadmapProject} from './schema';
import {dayAt,dayNumber,roadmapGeometry,shiftDate,type Zoom} from './placement';
import {RoadmapEditor,type PlanningChange} from './editor';
import './roadmap.css';

type Drag = {project:RoadmapProject;mode:'body'|'startDate'|'targetDate'|'unscheduled';grabDay:number};
const statusNames={planned:'Planned',active:'Active',completed:'Completed',canceled:'Canceled'};
export function RoadmapPage() {
  const resource=useApiResource('/api/roadmap',roadmapSchema,5000);
  const [zoom,setZoom]=useState<Zoom>('month'),[editing,setEditing]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const drag=useRef<Drag|null>(null);
  const denied=resource.error instanceof ApiError&&[401,403,404].includes(resource.error.status);
  const data=denied?null:resource.data;
  const geometry=data?roadmapGeometry([
    ...data.projects.map(p=>p.placement),...data.initiatives.map(n=>n.placement),
    ...data.projects.flatMap(p=>p.milestones.flatMap(m=>m.targetDate?[{kind:'diamond' as const,start:m.targetDate,end:m.targetDate}]:[])),
  ],data.today,zoom):null;
  async function save(project:RoadmapProject,change:PlanningChange) {
    if(busy||!data?.canEdit)return;
    setBusy(true);setError('');setMessage('');
    try {
      await fetchJson('/api/roadmap/projects/'+project.id,roadmapSchema,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:project.version,...change})});
      await resource.refreshAfterMutation();setMessage(project.name+' planning updated.');
    } catch(cause) {
      setError(cause instanceof ApiError&&cause.status===409?'This project changed. Your edit was not saved. Review the refreshed roadmap before trying again.':cause instanceof Error?cause.message:'The project could not be changed.');
      if(cause instanceof ApiError&&[401,403,404,409].includes(cause.status)){setEditing(null);resource.reload();}
    } finally {setBusy(false);drag.current=null;}
  }
  function begin(event:DragEvent,project:RoadmapProject,mode:Drag['mode']) {
    if(!data?.canEdit||busy||!geometry)return;
    event.stopPropagation();const track=event.currentTarget.closest('.roadmap-track')?.getBoundingClientRect();
    const grabDay=track?Math.round(geometry.first+(event.clientX-track.left)/track.width*geometry.span):0;
    drag.current={project,mode,grabDay};event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',project.id);
  }
  function drop(event:DragEvent<HTMLDivElement>) {
    const moving=drag.current;if(!moving||!geometry||busy||!data?.canEdit)return;
    event.preventDefault();const box=event.currentTarget.getBoundingClientRect();
    const day=Math.round(geometry.first+Math.max(0,Math.min(1,(event.clientX-box.left)/box.width))*geometry.span),date=dayAt(day);
    let change:PlanningChange;
    if(moving.mode==='unscheduled')change={startDate:date,targetDate:shiftDate(date,zoom,1)};
    else if(moving.mode!=='body')change={[moving.mode]:date};
    else {
      const delta=day-moving.grabDay;
      change={...(moving.project.startDate?{startDate:dayAt(dayNumber(moving.project.startDate)+delta)}:{}),...(moving.project.targetDate?{targetDate:dayAt(dayNumber(moving.project.targetDate)+delta)}:{})};
    }
    void save(moving.project,change);
  }
  function moveKey(event:React.KeyboardEvent,project:RoadmapProject) {
    if(!['ArrowLeft','ArrowRight'].includes(event.key)||!data?.canEdit||busy)return;
    event.preventDefault();const direction=event.key==='ArrowLeft'?-1:1;
    void save(project,{...(project.startDate?{startDate:shiftDate(project.startDate,zoom,direction)}:{}),...(project.targetDate?{targetDate:shiftDate(project.targetDate,zoom,direction)}:{})});
  }
  const position=(placement:Placement):CSSProperties=>({left:geometry!.position(placement.start!)+'%',width:placement.kind==='diamond'?undefined:Math.max(.5,geometry!.position(placement.end!)-geometry!.position(placement.start!))+'%'});
  function dates(project:RoadmapProject) {
    return project.startDate&&project.targetDate?project.startDate+' to '+project.targetDate:project.targetDate?'Target '+project.targetDate:project.startDate?'From '+project.startDate+' · Open end':'Unscheduled';
  }
  function label(project:RoadmapProject) {
    return <div className="roadmap-label"><a href={'/app/projects/'+project.id}>{project.name}</a><span>{statusNames[project.lifecycle]} · {project.priority} priority</span>
      {project.labelIds.length>0&&<span>{project.labelIds.map(id=>data!.labels.find(l=>l.id===id)?.name).filter(Boolean).join(', ')}</span>}
      {data!.canEdit&&<button disabled={busy} onClick={()=>{setEditing(project.id);setError('');}}>Edit planning<span className="sr-only"> for {project.name}</span></button>}
    </div>;
  }
  const edited=data?.projects.find(p=>p.id===editing);
  return <main className="roadmap-page" data-roadmap-ready={data&&!busy&&!resource.loading&&!resource.error?'true':'false'}>
    <header className="roadmap-heading"><div><p className="roadmap-eyebrow">Planning</p><h1>Roadmap</h1></div>
      <div role="group" aria-label="Roadmap zoom" className="roadmap-zoom">{(['week','month','quarter'] as const).map(value=><button key={value} aria-pressed={zoom===value} onClick={()=>setZoom(value)}>{value[0]!.toUpperCase()+value.slice(1)}</button>)}</div>
    </header>
    {resource.error&&<p role="alert">{resource.error.message} <button onClick={resource.reload}>Retry roadmap</button></p>}
    {!data&&!resource.error&&<p role="status">Loading roadmap…</p>}
    {error&&<p role="alert">{error}</p>}<p role="status" className="roadmap-message">{message}</p>
    {data&&geometry&&<>
      <p className="roadmap-legend">◆ Target only · Dashed open end: start only · ◇ Milestone · Today {data.today} · {data.timezone}</p>
      {data.canEdit&&<p className="roadmap-instructions">Drag a bar or either end to change dates. Use left and right arrow keys on a focused project to move one {zoom}.</p>}
      {!data.projects.length&&<p>No visible projects yet.</p>}
      <div className="roadmap-desktop">
        <div className="roadmap-layout">
          <div className="roadmap-scroll" role="region" aria-label="Project timeline" tabIndex={0}>
            <div className="roadmap-canvas" style={{width:geometry.width+240}}>
              <div className="roadmap-axis"><span>Initiatives and projects</span><div>{geometry.ticks.map(tick=><time key={tick} dateTime={tick} style={{left:geometry.position(tick)+'%'}}>{tick}</time>)}</div></div>
              {data.initiatives.map(node=><div className="roadmap-row roadmap-initiative" key={node.id} data-roadmap-initiative={node.id} data-date-kind={node.placement.kind}>
                <div className="roadmap-label"><a href={'/app/initiatives/'+node.id}>{node.name}</a><span>Initiative · {node.projectIds.length} visible projects</span></div>
                <div className="roadmap-track">{node.placement.start?<span className={'roadmap-span roadmap-span--'+node.placement.kind} style={position(node.placement)} aria-label={'Initiative '+node.name+' '+node.placement.start+' to '+node.placement.end}>{node.placement.kind==='diamond'?'◆':''}</span>:<span className="roadmap-no-dates">Unscheduled</span>}</div>
              </div>)}
              {data.projects.filter(p=>p.placement.kind!=='unscheduled').map(project=><article className="roadmap-row" key={project.id} data-roadmap-project={project.id} data-date-kind={project.placement.kind} data-start-date={project.startDate??''} data-target-date={project.targetDate??''}>
                {label(project)}
                <div className="roadmap-track" onDragOver={event=>{if(drag.current&&!busy)event.preventDefault();}} onDrop={drop} aria-label={'Timeline dates for '+project.name}>
                  <span className="roadmap-today" style={{left:geometry.position(data.today)+'%'}} role="img" aria-label={'Today '+data.today}/>
                  <div className={'roadmap-mark roadmap-mark--'+project.placement.kind+' roadmap-mark--'+project.lifecycle} style={position(project.placement)}>
                    {data.canEdit?<>
                      <Tooltip label="Move project"><button className="roadmap-body" disabled={busy} draggable={!busy} onDragStart={event=>begin(event,project,'body')} onDragEnd={()=>{drag.current=null;}} onKeyDown={event=>moveKey(event,project)} aria-label={'Move '+project.name+' · '+dates(project)}>{project.placement.kind==='diamond'?'◆':<span className="sr-only">{statusNames[project.lifecycle]}</span>}</button></Tooltip>
                      {project.startDate&&<Tooltip label="Drag start date"><button className="roadmap-handle roadmap-handle--start" aria-label={'Drag start date for '+project.name} disabled={busy} draggable={!busy} onDragStart={event=>begin(event,project,'startDate')} onDragEnd={()=>{drag.current=null;}} onClick={()=>setEditing(project.id)}>‹</button></Tooltip>}
                      {project.targetDate&&project.placement.kind!=='diamond'&&<Tooltip label="Drag target date"><button className="roadmap-handle roadmap-handle--target" aria-label={'Drag target date for '+project.name} disabled={busy} draggable={!busy} onDragStart={event=>begin(event,project,'targetDate')} onDragEnd={()=>{drag.current=null;}} onClick={()=>setEditing(project.id)}>›</button></Tooltip>}
                    </>:<span className="roadmap-read-mark" role="img" aria-label={dates(project)}>{project.placement.kind==='diamond'?'◆':''}</span>}
                  </div>
                  {project.milestones.filter(m=>m.targetDate).map(m=><Tooltip key={m.id} label={m.name+' · '+m.targetDate+(m.completed?' · Complete':'')}><span className="roadmap-milestone" tabIndex={0} role="img" aria-label={'Milestone '+m.name+' '+m.targetDate} style={{left:geometry.position(m.targetDate!)+'%'}}>◇</span></Tooltip>)}
                </div>
              </article>)}
              <div className="roadmap-drop-row"><span>Schedule a project</span><div className="roadmap-track" aria-label="Schedule an Unscheduled project" onDragOver={event=>{if(drag.current&&!busy)event.preventDefault();}} onDrop={drop}>Drop an Unscheduled project here</div></div>
            </div>
          </div>
          <aside className="roadmap-unscheduled" aria-label="Unscheduled projects"><h2>Unscheduled</h2>{data.projects.filter(p=>p.placement.kind==='unscheduled').map(project=><article key={project.id} data-unscheduled-project={project.id}>
            {label(project)}{data.canEdit&&<button draggable={!busy} disabled={busy} onDragStart={event=>begin(event,project,'unscheduled')} onDragEnd={()=>{drag.current=null;}} aria-label={'Schedule '+project.name}>Drag onto timeline</button>}
          </article>)}{!data.projects.some(p=>p.placement.kind==='unscheduled')&&<p>Every visible project has a date.</p>}</aside>
        </div>
      </div>
      <section className="roadmap-mobile" aria-label="Roadmap list equivalent">
        {data.initiatives.map(node=><article className="roadmap-mobile-initiative" key={node.id}><a href={'/app/initiatives/'+node.id}>{node.name}</a><p>Initiative · {node.placement.start?node.placement.start+' to '+node.placement.end:'Unscheduled'}</p></article>)}
        {data.projects.map(project=><article key={project.id} data-roadmap-list-project={project.id}>{label(project)}<p>{dates(project)}</p>
          {project.milestones.map(m=><p key={m.id}>◇ {m.name} · {m.targetDate??'No target date'}{m.completed?' · Complete':''}</p>)}
        </article>)}
      </section>
      {edited&&data.canEdit&&<RoadmapEditor key={edited.id+edited.version} project={edited} labels={data.labels} busy={busy} save={change=>save(edited,change)} close={()=>setEditing(null)}/>}
    </>}
  </main>;
}
