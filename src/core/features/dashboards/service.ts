import {createUlid} from '../../shared/ids';
import {administrationContext,commit,guard,SettingsError} from '../administration/transaction';
import {insightAuthority,readInsights} from '../insights/read';
import {buildInsights} from '../insights/build';
import {listIssues} from '../issues/list';
import {issueListQuerySchema,type IssueListQuery} from '../issues/list-schema';
import {workspaceDate} from '../issues/browse-access';
import {addDays} from '../cycle-schedule/calendar';
import {visibilityDatabase} from '../roles/visibility-database';
import {widgetSchema,type DashboardInput,type DashboardFilters,type Dashboard,type Widget} from './schema';
type Row={id:string;workspace_id:string;creator_id:string;team_id:string|null;name:string;is_shared:number;version:number};
const leader=(role:string)=>['owner','admin'].includes(role);
const visible=`(d.creator_id=? OR ?=1 OR (d.is_shared=1 AND (d.team_id IS NULL OR EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=d.team_id AND m.operator_id=?))))`;
async function record(db:D1Database,actor:string,id:string) {
 const access=await insightAuthority(db,actor);
 const row=await db.prepare(`SELECT d.* FROM dashboards d WHERE d.id=? AND d.workspace_id=? AND ${visible}`)
  .bind(id,access.workspace_id,actor,Number(leader(access.role)),actor).first<Row>();
 if(!row)throw new SettingsError('not_found','Dashboard is unavailable.',404);
 return {row,access};
}
function summary(row:Row,actor:string,role:string) {return {id:row.id,name:row.name,teamId:row.team_id,isShared:!!row.is_shared,creatorId:row.creator_id,version:row.version,canEdit:row.creator_id===actor||leader(role)};}
export async function listDashboards(db:D1Database,actor:string) {
 const access=await insightAuthority(db,actor);
 const rows=(await db.prepare(`SELECT d.* FROM dashboards d WHERE d.workspace_id=? AND ${visible} ORDER BY d.name,d.id`)
  .bind(access.workspace_id,actor,Number(leader(access.role)),actor).all<Row>()).results;
 const teams=(await db.prepare('SELECT t.id,t.name FROM teams t JOIN team_members m ON m.team_id=t.id WHERE m.operator_id=? AND t.workspace_id=? ORDER BY t.name,t.id').bind(actor,access.workspace_id).all<{id:string;name:string}>()).results;
 const remaining=await db.prepare(`SELECT count(*) n FROM dashboards d WHERE d.id IN(SELECT value FROM json_each(?)) AND d.workspace_id=? AND ${visible}`).bind(JSON.stringify(rows.map(r=>r.id)),access.workspace_id,actor,Number(leader(access.role)),actor).first<number>('n');
 await insightAuthority(db,actor);
 if(remaining!==rows.length)throw new SettingsError('conflict','Dashboard access changed. Refresh the list.',409);
 return {dashboards:rows.map(r=>summary(r,actor,access.role)),teams};
}
async function definition(db:D1Database,actor:string,id:string):Promise<Dashboard> {
 const {row,access}=await record(db,actor,id);
 const widgets=(await db.prepare('SELECT definition_json FROM dashboard_widgets WHERE dashboard_id=? ORDER BY position').bind(id).all<{definition_json:string}>()).results.map(w=>widgetSchema.parse(JSON.parse(w.definition_json)));
 return {...summary(row,actor,access.role),widgets};
}
/** Global filters intersect the saved set. Dates mean issue due dates, matching
 * the native issue-list filter and its full-list link, in every widget kind. */
function intersect(widget:Widget,global:DashboardFilters,scope:string|null,today:string):IssueListQuery|null {
 const query={...widget.filters,offset:0,revision:'',pageSize:50 as const};
 for(const team of [scope,global.team==='all'?null:global.team])if(team){if(query.team!=='all'&&query.team!==team)return null;query.team=team;}
 if(global.project!=='all'){if(query.project!=='all'&&query.project!==global.project)return null;query.project=global.project;}
 if(global.from||global.to){
  if(query.due==='none')return null;
  const starts=[global.from,query.due==='range'?query.dueFrom:''].filter(Boolean).sort();
  const ends=[global.to,query.due==='range'?query.dueTo:'',query.due==='overdue'?addDays(today,-1):''].filter(Boolean).sort();
  query.due='range';query.dueFrom=starts.at(-1)??'';query.dueTo=ends[0]??'';
  if(query.dueFrom&&query.dueTo&&query.dueFrom>query.dueTo)return null;
 }
 return issueListQuerySchema.parse(query);
}
export async function readDashboard(source:D1Database,actor:string,id:string,global:DashboardFilters) {
 const db=visibilityDatabase(source,actor),dashboard=await definition(db,actor,id),access=await insightAuthority(db,actor),now=new Date();
 const results=[];
 for(const [position,widget] of dashboard.widgets.entries()){
  const query=intersect(widget,global,dashboard.teamId,workspaceDate(now,access.timezone));
  const chart={...widget.chart,bucket:global.widget===position?global.bucket:''};
  const href=query?'/app/issues?'+new URLSearchParams(Object.entries(query).map(([key,value])=>[key,String(value)])):'';
  if(!query){results.push({count:0,issues:[],report:widget.kind==='chart'?buildInsights([],chart,access.timezone,now):null,href,csvHref:"",empty:true});continue;}
  if(widget.kind==='chart'){
   const report=await readInsights(db,actor,query,chart,now);results.push({count:report.total,issues:[],report,href,csvHref:"/api/insights.csv?"+new URLSearchParams(Object.entries({...query,...chart}).map(([key,value])=>[key,String(value)])),empty:false});
  }else{
   const list=await listIssues(db,actor,query,now);results.push({count:list.total,issues:widget.kind==='list'?list.issues.slice(0,25).map(i=>({identifier:i.identifier,title:i.title})):[],report:null,href,csvHref:"",empty:false});
  }
 }
 const current=await record(db,actor,id);
 if(current.row.version!==dashboard.version)throw new SettingsError('conflict','This dashboard changed. Refresh it to see the latest widgets.',409);
 return {dashboard,results};
}
export async function saveDashboard(source:D1Database,actor:string,input:DashboardInput,id?:string,version?:number) {
 const ctx=await administrationContext(source,actor),access=await insightAuthority(ctx.db,actor);
 const old=id?await definition(ctx.db,actor,id):null;
 if(old&&!old.canEdit)throw new SettingsError('forbidden','Only the creator, an Owner or an Admin can change this dashboard.',403);
 if(input.teamId&&!await ctx.db.prepare('SELECT 1 FROM teams WHERE id=? AND workspace_id=?').bind(input.teamId,ctx.workspace).first())throw new SettingsError('not_found','Team is unavailable.',404);
 if(input.isShared&&input.teamId&&!await ctx.db.prepare('SELECT 1 FROM team_members WHERE team_id=? AND operator_id=?').bind(input.teamId,actor).first())throw new SettingsError('forbidden','Join this team before sharing its dashboard.',403);
 const key=id??createUlid(new Date(ctx.at));
 await commit(ctx,[
  ...(old?[guard(ctx.db,'EXISTS(SELECT 1 FROM dashboards WHERE id=? AND workspace_id=? AND version=? AND (creator_id=? OR ?=1))',key,ctx.workspace,version!,actor,Number(leader(access.role)))]:[]),
  ...(input.teamId?[guard(ctx.db,'EXISTS(SELECT 1 FROM teams WHERE id=? AND workspace_id=?)',input.teamId,ctx.workspace)]:[]),
  ...(input.isShared&&input.teamId?[guard(ctx.db,'EXISTS(SELECT 1 FROM team_members WHERE team_id=? AND operator_id=?)',input.teamId,actor)]:[]),
  old?ctx.db.prepare('UPDATE dashboards SET name=?,team_id=?,is_shared=?,version=version+1,updated_at=? WHERE id=?').bind(input.name,input.teamId,Number(input.isShared),ctx.at,key)
   :ctx.db.prepare('INSERT INTO dashboards(id,workspace_id,creator_id,team_id,name,is_shared,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(key,ctx.workspace,actor,input.teamId,input.name,Number(input.isShared),ctx.at,ctx.at),
  ctx.db.prepare('DELETE FROM dashboard_widgets WHERE dashboard_id=?').bind(key),
  ...input.widgets.map((widget,position)=>ctx.db.prepare('INSERT INTO dashboard_widgets(dashboard_id,position,definition_json) VALUES(?,?,?)').bind(key,position,JSON.stringify({...widget,filters:{...widget.filters,offset:0,revision:''},chart:{...widget.chart,bucket:''}}))),
 ]);
 return definition(ctx.db,actor,key);
}
export async function deleteDashboard(source:D1Database,actor:string,id:string,version:number) {
 const ctx=await administrationContext(source,actor),old=await definition(ctx.db,actor,id);
 if(!old.canEdit)throw new SettingsError('forbidden','Only the creator, an Owner or an Admin can delete this dashboard.',403);
 await commit(ctx,[guard(ctx.db,'EXISTS(SELECT 1 FROM dashboards WHERE id=? AND version=?)',id,version),ctx.db.prepare('DELETE FROM dashboards WHERE id=? AND workspace_id=?').bind(id,ctx.workspace)]);
 return {deleted:true};
}
