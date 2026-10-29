import './release-calendar.css';
import {useEffect,useState} from 'react';
import {z} from 'zod';
import {ApiError,fetchJson,useApiResource} from '../../app/api-client';
import {monthCalendarSchema,type MonthEvent} from './schema';
import {layoutWeek} from './month-layout';
import './calendar.css';
const dayLabel=(day:string)=>new Intl.DateTimeFormat('en',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
function shifted(month:string,delta:number){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);return d.toISOString().slice(0,7);}
function days(month:string){const date=new Date(month+'-01T12:00:00Z');date.setUTCDate(1-(date.getUTCDay()+6)%7);return Array.from({length:42},(_,i)=>{const d=new Date(date);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);}).filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day));}
const weeks=(all:string[])=>Array.from({length:Math.ceil(all.length/7)},(_,i)=>all.slice(i*7,i*7+7));
const onDay=(event:MonthEvent,day:string)=>event.firstDay<=day&&event.lastDay>=day;
const kindName={issue:'Due issue',cycle:'Cycle',milestone:'Milestone',release:'Release'};
const countWord=(n:number)=>n===1?'event':'events';
export function MonthCalendar(){
 const [month,setMonth]=useState(''),[selected,setSelected]=useState(''),[editing,setEditing]=useState<MonthEvent|null>(null),[date,setDate]=useState(''),[dragged,setDragged]=useState<MonthEvent|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const data=useApiResource('/api/calendar/events'+(month?'?month='+month:''),monthCalendarSchema);
 useEffect(()=>{const changed=()=>data.reload();window.addEventListener('vector:issues-changed',changed);return()=>window.removeEventListener('vector:issues-changed',changed);},[data.reload]);
 async function move(event:MonthEvent,next:string){
  if(!data.data?.canEdit||busy||!event.identifier||!event.version||next===event.start)return;
  setBusy(true);setError('');setMessage('');
  try{await fetchJson('/api/issues/'+event.identifier,z.object({identifier:z.string(),version:z.number()}),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:event.version,dueDate:next})});setMessage(event.identifier+' due date changed to '+next+'.');setSelected(next);if(next.slice(0,7)!==data.data?.month)setMonth(next.slice(0,7));setEditing(null);data.reload();}
  catch(e){setError(e instanceof ApiError&&e.status===409?'This issue changed since the calendar was loaded. Your date change was not saved. The calendar has refreshed; review the current date and try again.':e instanceof Error?e.message:'The due date could not be changed.');setEditing(null);data.reload();}
  finally{setBusy(false);setDragged(null);}
 }
 const current=data.data,selectedDay=selected&&selected.startsWith(current?.month??'!')?selected:current?(current.today.startsWith(current.month)?current.today:current.month+'-01'):'';
 const events=current?.events.filter(e=>onDay(e,selectedDay))??[];
 return <section className="insights-card month-calendar" aria-label="Month calendar" data-month-calendar-ready={current&&!data.loading&&!busy&&!data.error?'true':'false'}>
  <div className="insights-heading"><div><h2>Month calendar</h2><p>Due issues, cycles, milestones and releases · {current?.timezone??'Loading timezone…'}</p></div><button type="button" disabled={busy} onClick={()=>{setMonth('');setSelected('');setEditing(null);data.reload();}}>Today</button></div>
  {data.error&&<p role="alert">{data.error.message} <button onClick={data.reload}>Retry calendar</button></p>}
  {!current&&!data.error&&<p role="status">Loading month…</p>}
  {current&&<>
   <div className="month-navigation"><button disabled={busy||current.month==='0001-01'} onClick={()=>{setMonth(shifted(current.month,-1));setEditing(null);}}>Previous month</button><label>Calendar month<input aria-label="Calendar month" type="month" min="0001-01" max="9999-12" value={current.month} onChange={e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)){setMonth(e.target.value);setEditing(null);}}}/></label><button disabled={busy||current.month==='9999-12'} onClick={()=>{setMonth(shifted(current.month,1));setEditing(null);}}>Next month</button></div>
   <p className="insights-note">Select a day to see its events. Drag an issue from the day’s list onto another date, or choose Change due date. Cycles, milestones and releases open their own pages.</p>
   <ul className="calendar-legend" aria-label="Event kinds">{(['issue','cycle','milestone','release'] as const).map(kind=><li className={'calendar-kind calendar-kind--'+kind} key={kind}>{kindName[kind]}</li>)}</ul>
   <div className="calendar-weekdays" aria-hidden="true">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span key={day}>{day}</span>)}</div>
   <div className="month-grid" aria-label={'Dates in '+current.month}>
    {weeks(days(current.month)).map(week=>{const layout=layoutWeek(week,current.events),lanes=layout[0].lanes.length;return <div key={week[0]} className="month-week" style={{gridTemplateRows:'auto'+' auto'.repeat(lanes)+' 1fr'}}>
     {week.map((day,column)=>{const items=current.events.filter(e=>onDay(e,day)),inside=day.startsWith(current.month),{lanes:bars,singles,more}=layout[column];return <div key={day} className={'month-day'+(!inside?' month-day--outside':'')+(day===selectedDay?' month-day--selected':'')} style={{gridColumn:column+1,gridRow:'1 / -1'}} data-calendar-day={day} onDragOver={e=>{if(dragged&&!busy&&inside){e.preventDefault();e.dataTransfer.dropEffect='move';}}} onDrop={e=>{e.preventDefault();if(dragged&&inside)void move(dragged,day);}}>
      <button type="button" disabled={!inside||busy} aria-label={dayLabel(day)+', '+items.length+' '+countWord(items.length)} aria-pressed={day===selectedDay} aria-current={day===current.today?'date':undefined} onClick={()=>setSelected(day)}><span>{Number(day.slice(-2))}</span><span className="calendar-event-count">{items.length>0&&<>{items.length}<span className="calendar-count-word"> {countWord(items.length)}</span></>}</span></button>
      <ul className="calendar-day-lanes" aria-hidden="true">{bars.map((bar,lane)=>bar&&<li key={bar.event.id} className={'calendar-kind calendar-kind--'+bar.event.kind+' calendar-bar'} style={{gridRow:lane+2,width:`calc(${bar.span*100}% + ${(bar.span-1)*11}px)`}}>{bar.event.title}</li>)}</ul>
      <ul className="calendar-day-preview" style={{gridRow:bars.length+2}} aria-hidden="true">{singles.map(e=><li key={e.id} className={'calendar-kind calendar-kind--'+e.kind}>{e.title}</li>)}{more>0&&<li>+{more} more</li>}</ul>
     </div>;})}
    </div>;})}
   </div>
   <div className="calendar-agenda" role="region" aria-label="Selected day events"><h3>{dayLabel(selectedDay)}</h3>{!events.length&&<p>No events on this day.</p>}
    {events.map(event=><article key={event.id} className={'calendar-event calendar-kind--'+event.kind} data-calendar-event={event.identifier??event.id} draggable={current.canEdit&&event.kind==='issue'&&!busy} onDragStart={e=>{if(!current.canEdit||event.kind!=='issue')return;setDragged(event);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',event.identifier!);}} onDragEnd={()=>setDragged(null)}>
     <p className="insights-note">{kindName[event.kind]}{event.kind==='cycle'?' · '+event.firstDay+' to '+event.lastDay:''}</p><a draggable={false} href={new URL(event.url).pathname}>{event.title}</a>
     {current.canEdit&&event.kind==='issue'&&<button type="button" disabled={busy} aria-label={'Change due date for '+event.identifier} onClick={()=>{setEditing(event);setDate(event.start);setError('');}}>Change due date</button>}
    </article>)}
   </div>
  </>}
  {editing&&<form className="calendar-date-editor" aria-label={'Change due date for '+editing.identifier} onSubmit={e=>{e.preventDefault();void move(editing,date);}}><fieldset disabled={busy}><legend>Change due date · {editing.identifier}</legend><label>New due date<input aria-label="New due date" type="date" value={date} required onChange={e=>setDate(e.target.value)}/></label><button type="submit" disabled={date===editing.start}>Save due date</button><button type="button" onClick={()=>setEditing(null)}>Cancel date change</button></fieldset></form>}
  {busy&&<p role="status">Saving due date…</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
