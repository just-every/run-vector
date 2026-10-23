import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {z} from 'zod';
import {fetchJson,useApiResource} from '../../app/api-client';
import {workspaceOptionsSchema} from '../../shared/workspace-options';
import {InsightChart} from '../insights/chart';
import {metrics,metricNames,type InsightQuery} from '../insights/schema';
import type {IssueListQuery} from '../issues/list-schema';
import {dashboardListSchema,dashboardReadSchema,dashboardSchema,dashboardFiltersSchema,type DashboardInput,type Dashboard,type DashboardFilters,type Widget} from './schema';
import './dashboards.css';
type Source={filters:IssueListQuery;chart:InsightQuery};
const number=(value:number|null)=>value===null?'—':new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(value);
export function DashboardsPage({source}:{source:Source}) {
 const list=useApiResource('/api/dashboards',dashboardListSchema),options=useApiResource('/api/options',workspaceOptionsSchema);
 const [selected,setSelected]=useState(''),[draft,setDraft]=useState<DashboardInput|null>(null),[editing,setEditing]=useState<Dashboard|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const widget=(kind:Widget['kind']):Widget=>({name:kind==='chart'?metricNames[source.chart.metric]:kind==='count'?'Issue count':'Issues',kind,filters:{...source.filters},chart:{...source.chart,bucket:''}});
 async function save(){if(!draft||busy)return;setBusy(true);setError('');try{
  const saved=await fetchJson('/api/dashboards'+(editing?'/'+editing.id:''),dashboardSchema,{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,...(editing?{expectedVersion:editing.version}:{})})});
  setDraft(null);setEditing(null);setSelected(saved.id);list.reload();
 }catch(cause){setError(cause instanceof Error?cause.message:'Dashboard could not be saved.');}finally{setBusy(false);}}
 return <div role="region" aria-label="Dashboards" data-dashboards-ready={list.data&&!list.loading&&!list.error?'true':'false'}>
  <div className="insights-card"><h2>Dashboards</h2><p>Combine saved charts, counts and issue lists. Each person sees results computed from their own access.</p>
   {options.error&&<p role="alert">{options.error.message} <button onClick={options.reload}>Retry filter choices</button></p>}
   {list.error&&<p role="alert">{list.error.message} <button onClick={list.reload}>Retry dashboards</button></p>}
   <div className="insights-controls"><label>Open dashboard<select aria-label="Open dashboard" value={selected} onChange={e=>{setSelected(e.target.value);setDraft(null);setError('');}}><option value="">Choose a dashboard</option>{list.data?.dashboards.map(d=><option key={d.id} value={d.id}>{d.name}{d.isShared?' · Shared':' · Private'}</option>)}</select></label></div>
   <button onClick={()=>{setEditing(null);setDraft({name:'',teamId:null,isShared:false,widgets:[widget('chart')]});setError('');}}>New dashboard</button>
  </div>
  {draft&&<form className="insights-card dashboard-editor" aria-label="Edit dashboard" onSubmit={e=>{e.preventDefault();void save();}}>
   <fieldset disabled={busy}><legend>{editing?'Edit dashboard':'New dashboard'}</legend>
    <div className="insights-controls"><label>Dashboard name<input aria-label="Dashboard name" required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <label>Dashboard audience<select aria-label="Dashboard audience" value={draft.teamId??''} onChange={e=>setDraft({...draft,teamId:e.target.value||null})}><option value="">Workspace leadership</option>{options.data?.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
    <label className="dashboard-check"><input type="checkbox" checked={draft.isShared} onChange={e=>setDraft({...draft,isShared:e.target.checked})}/>Share inside the workspace</label>
    <p className="insights-note">Private by default. Shared team dashboards open to that team’s members; sharing requires membership. Workspace dashboards open to everyone who can use Insights.</p>
    {draft.widgets.map((w,index)=><fieldset key={index} className="dashboard-widget-editor"><legend>Widget {index+1}</legend>
     <div className="insights-controls"><label>Widget name<input aria-label="Widget name" required maxLength={120} value={w.name} onChange={e=>setDraft({...draft,widgets:draft.widgets.map((v,i)=>i===index?{...v,name:e.target.value}:v)})}/></label><label>Widget kind<select aria-label="Widget kind" value={w.kind} onChange={e=>setDraft({...draft,widgets:draft.widgets.map((v,i)=>i===index?{...v,kind:e.target.value as Widget['kind']}:v)})}><option value="chart">Chart</option><option value="count">Count</option><option value="list">Issue list</option></select></label></div>
     <WidgetFields widget={w} options={options.data} change={next=>setDraft({...draft,widgets:draft.widgets.map((v,i)=>i===index?next:v)})}/>
     <div className="dashboard-actions"><button type="button" disabled={index===0} onClick={()=>{const next=[...draft.widgets];[next[index-1],next[index]]=[next[index],next[index-1]];setDraft({...draft,widgets:next});}}>Move up</button>
      <button type="button" disabled={index===draft.widgets.length-1} onClick={()=>{const next=[...draft.widgets];[next[index+1],next[index]]=[next[index],next[index+1]];setDraft({...draft,widgets:next});}}>Move down</button>
      <button type="button" disabled={draft.widgets.length===1} onClick={()=>setDraft({...draft,widgets:draft.widgets.filter((_,i)=>i!==index)})}>Remove widget</button></div>
    </fieldset>)}
    <div className="dashboard-actions">{(['chart','count','list'] as const).map(kind=><button type="button" key={kind} disabled={draft.widgets.length>=12} onClick={()=>setDraft({...draft,widgets:[...draft.widgets,widget(kind)]})}>{kind==='chart'?'Add current Insights chart':kind==='count'?'Add count':'Add issue list'}</button>)}</div>
    <p className="insights-note">New widgets use the filters currently selected in the Charts tab. Up to 12 widgets; counts and lists use the native issue-list defaults.</p>
    <div className="dashboard-actions"><button type="submit">Save dashboard</button><button type="button" onClick={()=>{setDraft(null);setEditing(null);}}>Cancel dashboard edit</button></div>
   </fieldset>
  </form>}
  {error&&<p role="alert">{error}</p>}
  {selected&&!draft&&<DashboardDetail key={selected} id={selected} options={options.data} edit={d=>{setEditing(d);setDraft({name:d.name,teamId:d.teamId,isShared:d.isShared,widgets:d.widgets});}} deleted={()=>{setSelected('');list.reload();}}/>}
 </div>;
}
function WidgetFields({widget:w,options,change}:{widget:Widget;options:z.infer<typeof workspaceOptionsSchema>|null;change:(w:Widget)=>void}) {
 const filters=(patch:Partial<IssueListQuery>)=>change({...w,filters:{...w.filters,...patch}});
 return <details><summary>Widget filters and chart definition</summary><div className="insights-controls">
  <label>Title or identifier<input aria-label="Title or identifier" value={w.filters.q} onChange={e=>filters({q:e.target.value})}/></label>
  <label>Issue scope<select aria-label="Issue scope" value={w.filters.scope} onChange={e=>filters({scope:e.target.value as IssueListQuery['scope']})}><option value="all">All visible issues</option><option value="created">Created by the viewer</option><option value="subscribed">Followed by the viewer</option></select></label>
  <label>Widget team<select aria-label="Widget team" value={w.filters.team} onChange={e=>filters({team:e.target.value,status:'all',cycle:'all'})}><option value="all">All teams</option>{options?.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
  <label>Widget project<select aria-label="Widget project" value={w.filters.project} onChange={e=>filters({project:e.target.value})}><option value="all">All projects</option><option value="none">No project</option>{options?.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  <label>Widget category<select aria-label="Widget category" value={w.filters.category} onChange={e=>filters({category:e.target.value as IssueListQuery['category'],status:'all'})}>{['all','intake','backlog','unstarted','started','completed','canceled','duplicate'].map(c=><option key={c} value={c}>{c}</option>)}</select></label>
  <label>Widget priority<select aria-label="Widget priority" value={w.filters.priority} onChange={e=>filters({priority:e.target.value as IssueListQuery['priority']})}>{['all','urgent','high','medium','low','none'].map(c=><option key={c} value={c}>{c}</option>)}</select></label>
  {w.kind==='chart'&&<><label>Saved chart<select aria-label="Saved chart" value={w.chart.metric} onChange={e=>change({...w,chart:{...w.chart,metric:e.target.value as InsightQuery['metric']}})}>{metrics.map(m=><option key={m} value={m}>{metricNames[m]}</option>)}</select></label>
   <label>Saved grouping<select aria-label="Saved grouping" value={w.chart.group} onChange={e=>change({...w,chart:{...w.chart,group:e.target.value as InsightQuery['group']}})}>{['none','team','project','label','assignee','priority'].map(g=><option key={g} value={g}>{g}</option>)}</select></label>
   <label>Saved measure<select aria-label="Saved measure" value={w.chart.unit} onChange={e=>change({...w,chart:{...w.chart,unit:e.target.value as InsightQuery['unit']}})}><option value="count">Issue count</option><option value="estimate">Estimate points</option></select></label>
   <label>Saved chart from<input type="date" value={w.chart.from} onChange={e=>change({...w,chart:{...w.chart,from:e.target.value}})}/></label><label>Saved chart through<input type="date" value={w.chart.to} onChange={e=>change({...w,chart:{...w.chart,to:e.target.value}})}/></label></>}
 </div></details>;
}
function DashboardDetail({id,options,edit,deleted}:{id:string;options:z.infer<typeof workspaceOptionsSchema>|null;edit:(d:Dashboard)=>void;deleted:()=>void}) {
 const [filters,setFilters]=useState<DashboardFilters>(()=>dashboardFiltersSchema.parse({})),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const search=new URLSearchParams(Object.entries(filters).map(([key,value])=>[key,String(value)]));
 const data=useApiResource('/api/dashboards/'+id+'?'+search,dashboardReadSchema);
 const change=(patch:Partial<DashboardFilters>)=>setFilters({...filters,...patch,widget:-1,bucket:''});
 async function remove(){if(!data.data||busy)return;setBusy(true);setError('');try{await fetchJson('/api/dashboards/'+id,z.object({deleted:z.literal(true)}),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:data.data.dashboard.version})});deleted();}catch(cause){setError(cause instanceof Error?cause.message:'Dashboard could not be deleted.');}finally{setBusy(false);}}
 return <div role="region" aria-label="Open dashboard" data-dashboard-ready={data.data&&!data.loading&&!data.error?'true':'false'}>
  <div className="insights-card"><h2>{data.data?.dashboard.name??'Loading dashboard…'}</h2><p>{data.data?.dashboard.isShared?'Shared':'Private'} · Results use your current access.</p>
   <div className="insights-controls"><label>Dashboard team<select aria-label="Dashboard team" value={filters.team} onChange={e=>change({team:e.target.value})}><option value="all">All teams</option>{options?.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>Dashboard project<select aria-label="Dashboard project" value={filters.project} onChange={e=>change({project:e.target.value})}><option value="all">All projects</option><option value="none">No project</option>{options?.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Due from<input aria-label="Due from" type="date" value={filters.from} onChange={e=>change({from:e.target.value})}/></label><label>Due through<input aria-label="Due through" type="date" value={filters.to} onChange={e=>change({to:e.target.value})}/></label></div>
   <p className="insights-note">Due-date ranges and team/project filters narrow every saved widget. They intersect its own filters.</p>
   {data.data?.dashboard.canEdit&&<div className="dashboard-actions"><button onClick={()=>edit(data.data!.dashboard)}>Edit dashboard</button><button onClick={()=>setConfirm(true)}>Delete dashboard</button></div>}
   {confirm&&<div role="group" aria-label="Confirm dashboard deletion"><p>Delete this dashboard and its widgets? Issues stay unchanged.</p><button disabled={busy} onClick={()=>void remove()}>Delete dashboard and widgets</button> <button onClick={()=>setConfirm(false)}>Cancel deletion</button></div>}
  </div>
  {error&&<p role="alert">{error}</p>}{data.error&&<p role="alert">{data.error.message} <button onClick={data.reload}>Refresh dashboard</button></p>}
  {data.data&&!data.error&&data.data.dashboard.widgets.map((widget,index)=>{const result=data.data!.results[index];return <section key={index} className="insights-card dashboard-widget" aria-label={widget.name}>
   <h3>{widget.name}</h3>
   {widget.kind==='count'&&<p className="dashboard-count"><strong>{result.count}</strong> issues</p>}
   {widget.kind==='list'&&<><p>{result.count} issues · first 25 shown</p><ul>{result.issues.map(issue=><li key={issue.identifier}><Link to="/app/issues/$identifier" params={{identifier:issue.identifier}}>{issue.identifier} · {issue.title}</Link></li>)}</ul></>}
   {result.report&&<><a href={result.csvHref} download>{result.report.drill?"Export counted issues CSV":"Export chart CSV"}</a><p className="insights-note">{result.report.timezone} · Weeks start Monday · Duration percentiles use nearest rank.</p><InsightChart report={result.report} select={bucket=>setFilters({...filters,widget:index,bucket})}/>
    <div className="insights-table" role="region" aria-label="Saved chart data" tabIndex={0}><table><caption>{metricNames[widget.chart.metric]} · text equivalent</caption><thead><tr><th>Week</th><th>Group</th><th>Series</th><th>Issues</th><th>{result.report.duration?'Total days':widget.chart.unit==='estimate'?'Points':'Count'}</th>{result.report.duration&&<><th>Median days</th><th>75th percentile</th><th>90th percentile</th></>}</tr></thead><tbody>{result.report.rows.map(row=><tr key={row.key}><th scope="row">{row.week}</th><td>{row.group}</td><td>{row.series.split(' · ')[0]}</td><td>{row.count}</td><td>{number(row.value)}</td>{result.report?.duration&&<><td>{number(row.median)}</td><td>{number(row.p75)}</td><td>{number(row.p90)}</td></>}</tr>)}</tbody></table></div>
    {result.report.limitations.map(text=><p className="insights-note" key={text}>{text}</p>)}
    {result.report.drill&&<div aria-label="Counted dashboard issues"><h4>Counted issues ({result.report.drill.issues.length})</h4><ul>{result.report.drill.issues.map(issue=><li key={issue.identifier}><Link to="/app/issues/$identifier" params={{identifier:issue.identifier}}>{issue.identifier} · {issue.title}</Link></li>)}</ul></div>}
   </>}
   {result.empty&&<p>No issues match the combined filters.</p>}
   {widget.kind!=='chart'&&result.href&&<a href={result.href}>Open full issue list</a>}
  </section>;})}
 </div>;
}
