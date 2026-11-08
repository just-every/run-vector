import {browseActor,workspaceDate} from '../issues/browse-access';
import {visibilityDatabase} from '../roles/visibility-database';
import {projectFieldRevision,projectFieldVersion} from '../administration/project-fields';
import {projectPlacement,initiativePlacement} from './placement';
import type {RoadmapData,RoadmapProject} from './schema';
export async function readRoadmap(source:D1Database,actor:string,now=new Date()):Promise<RoadmapData> {
  const db=visibilityDatabase(source,actor),access=await browseActor(db,actor),today=workspaceDate(now,access.timezone);
  const rows=(await db.prepare('SELECT * FROM projects WHERE workspace_id=? AND archived_at IS NULL ORDER BY name,id').bind(access.workspace_id).all<Record<string,unknown>>()).results;
  const labels=(await db.prepare('SELECT id,name FROM labels WHERE workspace_id=? AND projects_enabled=1 ORDER BY name,id').bind(access.workspace_id).all<{id:string;name:string}>()).results;
  const projects=await Promise.all(rows.map(async row=>{
    const labelIds=(await db.prepare('SELECT label_id FROM project_labels WHERE project_id=? ORDER BY label_id').bind(row.id).all<{label_id:string}>()).results.map(l=>l.label_id);
    const milestones=(await db.prepare('SELECT id,name,target_date AS targetDate,completed FROM project_milestones WHERE project_id=? ORDER BY position,id').bind(row.id).all<{id:string;name:string;targetDate:string|null;completed:number}>()).results;
    const project={id:row.id,name:row.name,startDate:row.start_date,targetDate:row.target_date,lifecycle:row.lifecycle,priority:row.priority,labelIds,
      version:await projectFieldVersion(row,labelIds,await projectFieldRevision(db,row.id as string)),
      milestones:milestones.map(m=>({id:m.id,name:m.name,targetDate:m.targetDate,completed:!!m.completed}))} as Omit<RoadmapProject,'placement'>;
    return {...project,placement:projectPlacement(project,today)};
  }));
  // Guests retain their existing team-scoped project reads. Initiatives are
  // workspace metadata, so their existing Guest exclusion also applies here.
  const nodes=access.role==='guest'?[]:(await db.prepare('SELECT id,name,target_date AS targetDate FROM initiatives WHERE workspace_id=? ORDER BY name,id').bind(access.workspace_id).all<{id:string;name:string;targetDate:string|null}>()).results;
  const links=(await db.prepare('SELECT initiative_id AS initiativeId,project_id AS projectId FROM initiative_projects').all<{initiativeId:string;projectId:string}>()).results;
  const initiatives=nodes.map(node=>{
    const children=projects.filter(p=>links.some(link=>link.initiativeId===node.id && link.projectId===p.id));
    return {id:node.id,name:node.name,projectIds:children.map(p=>p.id),placement:initiativePlacement(children,node.targetDate,today)};
  });
  await browseActor(db,actor,access.workspace_id);
  return {today,timezone:access.timezone,canEdit:['owner','admin','member'].includes(access.role),labels,projects,initiatives};
}
