import {createUlid} from '../../shared/ids';
import {administrationContext,commit,guard,SettingsError} from '../administration/transaction';
import {createProject} from '../administration/projects';
import {createProjectMilestone} from '../administration/project-milestones';
import {createLabel} from '../administration/labels';
import {projectActivity} from '../administration/project-fields';
import {projectCreateSchema} from '../administration/schema';
import {createIssue} from '../issues/mutations';
import {createIssueInputSchema} from '../issues/input';
import {loadAuthority,authorityFence} from '../roles/authority';
import {decide,decisionInputs,type Question} from '../roles/policy';
import {browseActor} from '../issues/browse-access';
import {addDays} from '../cycle-schedule/calendar';
import {templateInputSchema,type TemplateInput,type Template,applySchema,captureSchema} from './schema';
import type {z} from 'zod';
type Row={id:string;workspace_id:string;team_id:string|null;name:string;description:string;cadence:string;version:number};
// Native routes supply the same visibility-scoped database as the issue list,
// with a session and authority fence outside it for mutations. Never wrap it twice.
async function access(db:D1Database,actor:string){const a=await browseActor(db,actor);if(a.role==='guest')throw new SettingsError('forbidden','Guests cannot use project templates.',403);return a;}
async function permission(db:D1Database,actor:string,teamId:string|null){
 const authority=await loadAuthority(db,actor,teamId?[teamId]:[]);
 const question:Question=teamId?{row:'cycles.schedule',teams:[teamId]}:{row:'workspace.settings'};
 if(!authority||decide(authority,question)!=='allow')throw new SettingsError('forbidden','Only workspace administrators or permitted team members manage this template.',403);
 if(teamId&&!await db.prepare('SELECT id FROM teams WHERE id=?').bind(teamId).first())throw new SettingsError('not_found','Team is unavailable.',404);
 return authorityFence(actor,authority,decisionInputs(authority,question));
}
async function editable(db:D1Database,actor:string,teamId:string|null){try{await permission(db,actor,teamId);return true;}catch(e){if(e instanceof SettingsError)return false;throw e;}}
// Team templates are conservatively visible to members of their own team only.
const visible=`(t.team_id IS NULL OR EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=t.team_id AND m.operator_id=?))`;
export async function readTemplate(source:D1Database,actor:string,id:string):Promise<Template>{
 const db=source,a=await access(db,actor);
 const row=await db.prepare(`SELECT t.* FROM project_templates t WHERE t.id=? AND t.workspace_id=? AND ${visible}`).bind(id,a.workspace_id,actor).first<Row>();
 if(!row)throw new SettingsError('not_found','Template is unavailable.',404);
 const milestones=(await db.prepare('SELECT name,description,offset_days offsetDays FROM project_template_milestones WHERE template_id=? ORDER BY position').bind(id).all<TemplateInput['milestones'][number]>()).results;
 const labels=(await db.prepare('SELECT name FROM project_template_labels WHERE template_id=? ORDER BY name').bind(id).all<{name:string}>()).results.map(l=>l.name);
 const issues=(await db.prepare('SELECT title,description,priority,offset_days offsetDays,start_offset_days startOffsetDays,milestone_position milestonePosition FROM project_template_issues WHERE template_id=? ORDER BY position').bind(id).all<TemplateInput['issues'][number]>()).results;
 await access(db,actor);
 if(!await db.prepare(`SELECT t.id FROM project_templates t WHERE t.id=? AND t.version=? AND ${visible}`).bind(id,row.version,actor).first())throw new SettingsError('conflict','Template access or content changed. Refresh.',409);
 return {...templateInputSchema.parse({name:row.name,teamId:row.team_id,description:row.description,cadence:row.cadence,milestones,labels,issues}),id,version:row.version,canEdit:await editable(db,actor,row.team_id)};
}
export async function listTemplates(source:D1Database,actor:string){
 const db=source,a=await access(db,actor);
 const rows=(await db.prepare(`SELECT t.id FROM project_templates t WHERE t.workspace_id=? AND ${visible} ORDER BY t.name,t.id`).bind(a.workspace_id,actor).all<{id:string}>()).results;
 const teams=(await db.prepare('SELECT t.id,t.name FROM teams t JOIN team_members m ON m.team_id=t.id WHERE m.operator_id=? ORDER BY t.name').bind(actor).all<{id:string;name:string}>()).results;
 return {templates:await Promise.all(rows.map(r=>readTemplate(db,actor,r.id))),teams,workspaceAllowed:['owner','admin'].includes(a.role)};
}
export async function saveTemplate(db:D1Database,actor:string,input:TemplateInput,id?:string,version?:number){
 await access(db,actor);const old=id?await readTemplate(db,actor,id):null;
 if(old&&old.teamId!==input.teamId)throw new SettingsError('invalid_request','Template scope cannot change. Save a new template instead.',400);
 const fence=await permission(db,actor,input.teamId),ctx=await administrationContext(db,actor);id??=createUlid(new Date());
 const writes=[guard(ctx.db,fence.sql,...fence.values)];
 if(old)writes.push(guard(ctx.db,'EXISTS(SELECT 1 FROM project_templates WHERE id=? AND version=?)',id,version!),ctx.db.prepare('UPDATE project_templates SET name=?,description=?,cadence=?,version=version+1,updated_at=? WHERE id=?').bind(input.name,input.description,input.cadence,ctx.at,id));
 else writes.push(ctx.db.prepare('INSERT INTO project_templates(id,workspace_id,team_id,name,description,cadence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,ctx.workspace,input.teamId,input.name,input.description,input.cadence,ctx.at,ctx.at));
 for(const table of ['project_template_milestones','project_template_labels','project_template_issues'])writes.push(ctx.db.prepare(`DELETE FROM ${table} WHERE template_id=?`).bind(id));
 input.milestones.forEach((m,i)=>writes.push(ctx.db.prepare('INSERT INTO project_template_milestones VALUES(?,?,?,?,?)').bind(id,i,m.name,m.description,m.offsetDays)));
 for(const name of new Set(input.labels))writes.push(ctx.db.prepare('INSERT INTO project_template_labels VALUES(?,?)').bind(id,name));
 input.issues.forEach((v,i)=>writes.push(ctx.db.prepare('INSERT INTO project_template_issues(template_id,position,title,description,priority,offset_days,milestone_position,start_offset_days) VALUES(?,?,?,?,?,?,?,?)').bind(id,i,v.title,v.description,v.priority,v.offsetDays,v.milestonePosition,v.startOffsetDays??null)));
 await commit(ctx,writes);return readTemplate(db,actor,id);
}
export async function deleteTemplate(db:D1Database,actor:string,id:string,version:number){
 const old=await readTemplate(db,actor,id),fence=await permission(db,actor,old.teamId),ctx=await administrationContext(db,actor);
 await commit(ctx,[guard(ctx.db,fence.sql,...fence.values),guard(ctx.db,'EXISTS(SELECT 1 FROM project_templates WHERE id=? AND version=?)',id,version),ctx.db.prepare('DELETE FROM project_templates WHERE id=?').bind(id)]);return {deleted:true};
}
export async function captureTemplate(source:D1Database,actor:string,projectId:string,input:z.infer<typeof captureSchema>){
 const db=source;await access(db,actor);await permission(db,actor,input.teamId);
 const project=await db.prepare('SELECT description FROM projects WHERE id=?').bind(projectId).first<{description:string}>();if(!project)throw new SettingsError('not_found','Project is unavailable.',404);
 const offset=(date:string|null)=>date===null?null:Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(input.referenceDate+'T00:00:00Z'))/86400000);
 const milestones=(await db.prepare('SELECT id,name,description,target_date FROM project_milestones WHERE project_id=? ORDER BY position,id').bind(projectId).all<{id:string;name:string;description:string;target_date:string|null}>()).results;
 const issues=(await db.prepare('SELECT title,description,priority,start_date,due_date,milestone_id FROM issues WHERE project_id=? ORDER BY created_at,id LIMIT 101').bind(projectId).all<{title:string;description:string;priority:string;start_date:string|null;due_date:string|null;milestone_id:string|null}>()).results;
 const labels=(await db.prepare('SELECT l.name FROM project_labels p JOIN labels l ON l.id=p.label_id WHERE p.project_id=? ORDER BY l.name').bind(projectId).all<{name:string}>()).results;
 return saveTemplate(source,actor,templateInputSchema.parse({name:input.name,teamId:input.teamId,cadence:input.cadence,description:project.description,milestones:milestones.map(m=>({name:m.name,description:m.description,offsetDays:offset(m.target_date)})),labels:labels.map(l=>l.name),issues:issues.map(i=>({title:i.title,description:i.description,priority:i.priority,offsetDays:offset(i.due_date),startOffsetDays:offset(i.start_date),milestonePosition:i.milestone_id?milestones.findIndex(m=>m.id===i.milestone_id):null}))}));
}
export async function applyTemplate(db:D1Database,actor:string,id:string,input:z.infer<typeof applySchema>){
 const template=await readTemplate(db,actor,id),a=await access(db,actor);
 if(template.version!==input.expectedVersion)throw new SettingsError('conflict','Template changed. Refresh before creating a project.',409);
 if(!await db.prepare('SELECT id FROM teams WHERE id=? AND workspace_id=?').bind(input.teamId,a.workspace_id).first())throw new SettingsError('not_found','Team is unavailable.',404);
 const date=(offset:number|null)=>offset===null?null:addDays(input.startDate,offset);
 // Validate every derived date before creating any records.
 const planned=template.issues.map(i=>createIssueInputSchema.parse({title:i.title,description:i.description,priority:i.priority,startDate:date(i.startOffsetDays??null),dueDate:date(i.offsetDays),teamId:input.teamId}));
 for(const m of template.milestones)if(m.offsetDays!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(date(m.offsetDays)!))throw new SettingsError('invalid_request','Choose a start date whose offsets fit calendar dates.',400);
 const labels:string[]=[],skippedLabels:string[]=[];
 for(const name of template.labels){const found=await db.prepare('SELECT id,projects_enabled FROM labels WHERE name=? AND workspace_id=?').bind(name,a.workspace_id).first<{id:string;projects_enabled:number}>();if(found?.projects_enabled)labels.push(found.id);else if(!found&&['owner','admin'].includes(a.role))labels.push(await createLabel(db,actor,{name,color:'#52637a',projectsEnabled:true}));else skippedLabels.push(name);}
 const ctx=await administrationContext(db,actor);
 const projectId=await createProject(db,actor,projectCreateSchema.parse({name:input.name,description:template.description,leadOperatorId:actor,startDate:input.startDate,labelIds:labels}),()=>[guard(ctx.db,'EXISTS(SELECT 1 FROM project_templates WHERE id=? AND version=?)',id,input.expectedVersion)]);
 const milestones:string[]=[],issues:string[]=[];
 try{
  for(const m of template.milestones)milestones.push(await createProjectMilestone(db,actor,projectId,{name:m.name,description:m.description,targetDate:date(m.offsetDays)}));
  for(const [position,i] of planned.entries()){const m=template.issues[position].milestonePosition;const issue=await createIssue(db,actor,{...i,projectId,milestoneId:m===null?null:milestones[m]});issues.push(issue.id);}
  await commit(ctx,[projectActivity(ctx,projectId,'project.template_applied',null,{templateId:id,templateName:template.name,cadence:template.cadence,skippedLabels})]);
 }catch(error){throw new SettingsError('incomplete_project',`Project ${projectId} was created with ${milestones.length} milestones and ${issues.length} issues before creation stopped. Open that project before trying again.`,409);}
 return {projectId,milestoneIds:milestones,issueIds:issues,skippedLabels,cadence:template.cadence};
}
