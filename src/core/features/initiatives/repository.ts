import {createUlid} from '../../shared/ids';
import {settingsActor} from '../settings/repository';
import {IntegrationError} from '../integrations/errors';
import {audit} from '../administration/transaction';
import {gitGuard} from '../integrations/github/rules';
import type {z} from 'zod';
import {initiativeInput,initiativeEdit,initiativeProjects,type Initiative} from './schema';
const projection='n.id,n.workspace_id AS workspaceId,n.parent_id AS parentId,n.owner_operator_id AS ownerOperatorId,o.name AS ownerName,n.name,n.description,n.target_date AS targetDate,n.status,n.version';
export async function initiativeAccess(db:D1Database,actor:string){
 const access=await settingsActor(db,actor);if(access.role==='guest')throw new IntegrationError(403,'forbidden');return access;
}
export async function listInitiatives(db:D1Database,actor:string){
 const access=await initiativeAccess(db,actor);
 return {initiatives:(await db.prepare('SELECT '+projection+' FROM initiatives n JOIN operators o ON o.id=n.owner_operator_id WHERE n.workspace_id=? ORDER BY n.name,n.id').bind(access.workspace_id).all<Initiative>()).results};
}
async function record(db:D1Database,actor:string,id:string){
 const {initiatives}=await listInitiatives(db,actor),node=initiatives.find(n=>n.id===id);if(!node)throw new IntegrationError(404,'initiative_not_found');return node;
}
/** A workspace graph revision fences the whole hierarchy, including concurrent
 * edits to different nodes. No pair of otherwise-valid moves can create a cycle. */
async function graph(db:D1Database,actor:string){
 const access=await initiativeAccess(db,actor);
 const revision=await db.prepare('SELECT revision FROM initiative_graph WHERE workspace_id=?').bind(access.workspace_id).first<number>('revision')??0;
 const {initiatives}=await listInitiatives(db,actor);
 return {workspace:access.workspace_id,revision,nodes:initiatives};
}
function validateHierarchy(nodes:Initiative[],id:string,parent:string|null){
 const index=new Map(nodes.map(n=>[n.id,n])),seen=new Set([id]);let cursor=parent,ancestors=0;
 while(cursor){if(seen.has(cursor))throw new IntegrationError(400,'initiative_cycle');seen.add(cursor);const node=index.get(cursor);if(!node)throw new IntegrationError(400,'initiative_parent_not_found');ancestors++;cursor=node.parentId;}
 let height=1,level=[id],visited=new Set<string>();
 while(level.length){for(const n of level){if(visited.has(n))throw new IntegrationError(400,'initiative_cycle');visited.add(n);}const next=nodes.filter(n=>n.parentId&&level.includes(n.parentId)).map(n=>n.id);if(next.length)height++;level=next;}
 if(ancestors+height>3)throw new IntegrationError(400,'initiative_depth','Initiatives support at most three levels.');
}
const graphWrites=(db:D1Database,g:{workspace:string;revision:number})=>[
 db.prepare('INSERT OR IGNORE INTO initiative_graph(workspace_id,revision) VALUES(?,0)').bind(g.workspace),
 gitGuard(db,'EXISTS(SELECT 1 FROM initiative_graph WHERE workspace_id=? AND revision=?)',g.workspace,g.revision),
 db.prepare('UPDATE initiative_graph SET revision=revision+1 WHERE workspace_id=?').bind(g.workspace)];
async function ownerGuard(db:D1Database,workspace:string,owner:string){
 if(!await db.prepare('SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL').bind(owner,workspace).first())throw new IntegrationError(400,'initiative_owner_not_found');
 return gitGuard(db,'EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL)',owner,workspace);
}
export async function createInitiative(db:D1Database,actor:string,input:z.infer<typeof initiativeInput>){
 const g=await graph(db,actor),id=createUlid(new Date()),at=new Date().toISOString();validateHierarchy(g.nodes,id,input.parentId);
 await db.batch([...graphWrites(db,g),await ownerGuard(db,g.workspace,input.ownerOperatorId),
 db.prepare('INSERT INTO initiatives(id,workspace_id,parent_id,owner_operator_id,name,description,target_date,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,g.workspace,input.parentId,input.ownerOperatorId,input.name,input.description,input.targetDate,input.status,at,at),
 ...audit({db,actor,workspace:g.workspace,at},'initiative.created',id,input.name,null,input)]);
 return readInitiative(db,actor,id);
}
export async function editInitiative(db:D1Database,actor:string,id:string,input:z.infer<typeof initiativeEdit>){
 const g=await graph(db,actor),old=g.nodes.find(n=>n.id===id);if(!old)throw new IntegrationError(404,'initiative_not_found');if(old.version!==input.expectedVersion)throw new IntegrationError(409,'stale_initiative');
 const {expectedVersion:_,...changes}=input,next={...old,...changes},at=new Date().toISOString();validateHierarchy(g.nodes,id,next.parentId);
 await db.batch([...graphWrites(db,g),await ownerGuard(db,g.workspace,next.ownerOperatorId),gitGuard(db,'EXISTS(SELECT 1 FROM initiatives WHERE id=? AND version=?)',id,old.version),
 db.prepare('UPDATE initiatives SET parent_id=?,owner_operator_id=?,name=?,description=?,target_date=?,status=?,version=version+1,updated_at=? WHERE id=?').bind(next.parentId,next.ownerOperatorId,next.name,next.description,next.targetDate,next.status,at,id),
 ...audit({db,actor,workspace:g.workspace,at},'initiative.updated',id,next.name,old,next)]);
 return readInitiative(db,actor,id);
}
export async function replaceInitiativeProjects(db:D1Database,actor:string,id:string,input:z.infer<typeof initiativeProjects>){
 const g=await graph(db,actor),old=g.nodes.find(n=>n.id===id);if(!old)throw new IntegrationError(404,'initiative_not_found');if(old.version!==input.expectedVersion)throw new IntegrationError(409,'stale_initiative');
 const ids=[...new Set(input.projectIds)],at=new Date().toISOString(),selection='SELECT count(*) AS n FROM projects WHERE workspace_id=? AND id IN(SELECT value FROM json_each(?))';
 if(await db.prepare(selection).bind(g.workspace,JSON.stringify(ids)).first<number>('n')!==ids.length)throw new IntegrationError(400,'initiative_project_not_found');
 await db.batch([...graphWrites(db,g),gitGuard(db,'EXISTS(SELECT 1 FROM initiatives WHERE id=? AND version=?)',id,old.version),gitGuard(db,'('+selection+')=?',g.workspace,JSON.stringify(ids),ids.length),
 db.prepare('DELETE FROM initiative_projects WHERE initiative_id=?').bind(id),
 db.prepare('INSERT INTO initiative_projects(initiative_id,project_id) SELECT ?,id FROM projects WHERE workspace_id=? AND id IN(SELECT value FROM json_each(?))').bind(id,g.workspace,JSON.stringify(ids)),
 db.prepare('UPDATE initiatives SET version=version+1,updated_at=? WHERE id=?').bind(at,id),
 ...audit({db,actor,workspace:g.workspace,at},'initiative.projects_changed',id,old.name,null,{projectIds:ids})]);
 return readInitiative(db,actor,id);
}
export async function readInitiative(db:D1Database,actor:string,id:string){
 const root=await record(db,actor,id),all=(await listInitiatives(db,actor)).initiatives,nodes=[];
 let level=[root],depth=1;
 while(level.length&&depth<=3){
  for(const node of level){
   const projects=(await db.prepare('SELECT p.id,p.name,(SELECT count(*) FROM issues visible_issue WHERE visible_issue.project_id=p.id) AS issueCount FROM initiative_projects link JOIN projects p ON p.id=link.project_id WHERE link.initiative_id=? ORDER BY p.name,p.id').bind(node.id).all<{id:string;name:string;issueCount:number}>()).results;
   const enriched=await Promise.all(projects.map(async p=>({...p,teams:(await db.prepare('SELECT DISTINCT t.name FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.project_id=? ORDER BY t.name').bind(p.id).all<{name:string}>()).results.map(t=>t.name)})));
   nodes.push({...node,depth,projects:enriched});
  }
  const parents=new Set(level.map(n=>n.id));level=all.filter(n=>n.parentId&&parents.has(n.parentId));depth++;
 }
 await record(db,actor,id);return {...root,nodes};
}
