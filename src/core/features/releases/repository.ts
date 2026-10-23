import {createUlid} from '../../shared/ids';
import {settingsActor} from '../settings/repository';
import {IntegrationError} from '../integrations/errors';
import {audit} from '../administration/transaction';
import {gitGuard} from '../integrations/github/rules';
import {releaseInput,releaseEdit,releaseScope,type Release} from './schema';
import type {z} from 'zod';
const projection='r.id,r.workspace_id AS workspaceId,r.team_id AS teamId,t.name AS teamName,r.name,r.target_date AS targetDate,r.status,r.description,r.version';
const visible="(r.team_id IS NULL OR EXISTS(SELECT 1 FROM teams visible_team WHERE visible_team.id=r.team_id))";
export async function releaseAccess(db:D1Database,actor:string){
 const access=await settingsActor(db,actor);if(access.role==='guest')throw new IntegrationError(403,'forbidden');return access;
}
export async function listReleases(db:D1Database,actor:string){
 const access=await releaseAccess(db,actor);
 return {releases:(await db.prepare(`SELECT ${projection} FROM releases r LEFT JOIN teams t ON t.id=r.team_id WHERE r.workspace_id=? AND ${visible} ORDER BY r.target_date IS NULL,r.target_date,r.name,r.id LIMIT 500`).bind(access.workspace_id).all<Release>()).results};
}
async function record(db:D1Database,actor:string,id:string){
 const access=await releaseAccess(db,actor);
 const release=await db.prepare(`SELECT ${projection} FROM releases r LEFT JOIN teams t ON t.id=r.team_id WHERE r.id=? AND r.workspace_id=? AND ${visible}`).bind(id,access.workspace_id).first<Release>();
 if(!release)throw new IntegrationError(404,'release_not_found');return release;
}
const scope=`SELECT i.id FROM issues i JOIN teams t ON t.id=i.team_id JOIN releases r ON r.id=?
 WHERE t.workspace_id=r.workspace_id AND (r.team_id IS NULL OR i.team_id=r.team_id)
 AND (EXISTS(SELECT 1 FROM release_issues s WHERE s.release_id=r.id AND s.issue_id=i.id) OR EXISTS(SELECT 1 FROM release_projects p WHERE p.release_id=r.id AND p.project_id=i.project_id))`;
export async function readRelease(db:D1Database,actor:string,id:string){
 const release=await record(db,actor,id);
 const issues=(await db.prepare(`SELECT i.id,i.identifier,i.title,s.category,s.name AS status FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.id IN (${scope}) ORDER BY i.identifier`).bind(id).all<{id:string;identifier:string;title:string;category:string;status:string}>()).results;
 const directIssues=(await db.prepare('SELECT i.identifier FROM release_issues r JOIN issues i ON i.id=r.issue_id WHERE r.release_id=? ORDER BY i.identifier').bind(id).all<{identifier:string}>()).results.map(i=>i.identifier);
 const projects=(await db.prepare('SELECT p.id,p.name FROM release_projects r JOIN projects p ON p.id=r.project_id WHERE r.release_id=? ORDER BY p.name,p.id').bind(id).all<{id:string;name:string}>()).results;
 const blockers=(await db.prepare(`SELECT DISTINCT blocker.identifier,blocker.title,blocked.identifier AS blockedIdentifier FROM issue_dependencies d JOIN issues blocker ON blocker.id=d.blocking_issue_id JOIN issues blocked ON blocked.id=d.blocked_issue_id JOIN workflow_statuses s ON s.id=blocker.status_id WHERE d.blocked_issue_id IN (${scope}) AND s.category NOT IN ('completed','canceled','duplicate') ORDER BY blocker.identifier,blocked.identifier`).bind(id).all()).results;
 const pullRequests=(await db.prepare(`SELECT DISTINCT repository.repository,p.number,p.title,p.url,p.state FROM vector_github_issue_links l JOIN vector_github_repositories repository ON repository.id=l.repository_id JOIN vector_github_pull_requests p ON p.repository_id=l.repository_id AND p.number=l.number WHERE l.issue_id IN (${scope}) ORDER BY repository.repository,p.number`).bind(id).all()).results;
 await record(db,actor,id);
 return {...release,issues,directIssues,projects,blockers,pullRequests,total:issues.length,completed:issues.filter(i=>i.category==='completed').length};
}
export async function createRelease(db:D1Database,actor:string,input:z.infer<typeof releaseInput>){
 const access=await releaseAccess(db,actor),id=createUlid(new Date()),at=new Date().toISOString();
 if(input.teamId&&!await db.prepare('SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL').bind(input.teamId,access.workspace_id).first())throw new IntegrationError(404,'team_not_found');
 await db.batch([gitGuard(db,'? IS NULL OR EXISTS(SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL)',input.teamId,input.teamId,access.workspace_id),
 db.prepare('INSERT INTO releases(id,workspace_id,team_id,name,target_date,status,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,access.workspace_id,input.teamId,input.name,input.targetDate,input.status,input.description,at,at),
 ...audit({db,actor,workspace:access.workspace_id,at},'release.created',id,input.name,null,input)]);
 return readRelease(db,actor,id);
}
export async function editRelease(db:D1Database,actor:string,id:string,input:z.infer<typeof releaseEdit>){
 const old=await record(db,actor,id);if(old.version!==input.expectedVersion)throw new IntegrationError(409,'stale_release');
 const {expectedVersion:_,...changes}=input,next={...old,...changes},at=new Date().toISOString(),operation=createUlid(new Date());
 const writes=[gitGuard(db,'EXISTS(SELECT 1 FROM releases WHERE id=? AND workspace_id=? AND version=?)',id,old.workspaceId,old.version),
 db.prepare('UPDATE releases SET name=?,target_date=?,status=?,description=?,version=version+1,updated_at=? WHERE id=?').bind(next.name,next.targetDate,next.status,next.description,at,id),
 ...audit({db,actor,workspace:old.workspaceId,at},'release.updated',id,next.name,old,next)];
 if(next.status==='released'&&old.status!=='released')writes.push(db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at)
 SELECT ?||':'||i.id,i.id,?,o.name,'release.published',?,?,?,? FROM issues i JOIN operators o ON o.id=? WHERE i.id IN (${scope})`).bind(operation,actor,JSON.stringify({releaseId:id,status:old.status}),JSON.stringify({releaseId:id,releaseName:next.name,status:'released'}),at,at,actor,id));
 await db.batch(writes);return readRelease(db,actor,id);
}
export async function replaceReleaseScope(db:D1Database,actor:string,id:string,input:z.infer<typeof releaseScope>){
 const old=await record(db,actor,id);if(old.version!==input.expectedVersion)throw new IntegrationError(409,'stale_release');
 if(old.status==='released')throw new IntegrationError(409,'released_scope_locked','Reopen the release before changing its scope.');
 const keys=[...new Set(input.issueIdentifiers)],projects=[...new Set(input.projectIds)],at=new Date().toISOString();
 const validIssues=await db.prepare('SELECT count(*) AS n FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.identifier IN(SELECT value FROM json_each(?)) AND t.workspace_id=? AND (? IS NULL OR i.team_id=?)').bind(JSON.stringify(keys),old.workspaceId,old.teamId,old.teamId).first<number>('n');
 const validProjects=await db.prepare('SELECT count(*) AS n FROM projects WHERE id IN(SELECT value FROM json_each(?)) AND workspace_id=?').bind(JSON.stringify(projects),old.workspaceId).first<number>('n');
 if(validIssues!==keys.length||validProjects!==projects.length)throw new IntegrationError(400,'invalid_release_scope','Choose visible issues in the release team and visible workspace projects.');
 const writes=[gitGuard(db,'EXISTS(SELECT 1 FROM releases WHERE id=? AND workspace_id=? AND version=? AND status<>\'released\')',id,old.workspaceId,old.version),
 gitGuard(db,'(SELECT count(*) FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.identifier IN(SELECT value FROM json_each(?)) AND t.workspace_id=? AND (? IS NULL OR i.team_id=?))=?',JSON.stringify(keys),old.workspaceId,old.teamId,old.teamId,keys.length),
 gitGuard(db,'(SELECT count(*) FROM projects WHERE id IN(SELECT value FROM json_each(?)) AND workspace_id=?)=?',JSON.stringify(projects),old.workspaceId,projects.length),
 db.prepare('DELETE FROM release_issues WHERE release_id=?').bind(id),db.prepare('DELETE FROM release_projects WHERE release_id=?').bind(id),
 db.prepare('INSERT INTO release_issues(release_id,issue_id) SELECT ?,id FROM issues WHERE identifier IN(SELECT value FROM json_each(?))').bind(id,JSON.stringify(keys)),
 db.prepare('INSERT INTO release_projects(release_id,project_id) SELECT ?,id FROM projects WHERE id IN(SELECT value FROM json_each(?))').bind(id,JSON.stringify(projects)),
 db.prepare('UPDATE releases SET version=version+1,updated_at=? WHERE id=?').bind(at,id),
 ...audit({db,actor,workspace:old.workspaceId,at},'release.scope_changed',id,old.name,null,{issueIdentifiers:keys,projectIds:projects})];
 await db.batch(writes);return readRelease(db,actor,id);
}
export async function issueReleases(db:D1Database,actor:string,identifier:string){
 const access=await releaseAccess(db,actor);
 return {releases:(await db.prepare(`SELECT DISTINCT ${projection} FROM releases r LEFT JOIN teams t ON t.id=r.team_id JOIN issues i ON i.identifier=? AND (r.team_id IS NULL OR r.team_id=i.team_id) WHERE r.workspace_id=? AND ${visible} AND (EXISTS(SELECT 1 FROM release_issues l WHERE l.release_id=r.id AND l.issue_id=i.id) OR EXISTS(SELECT 1 FROM release_projects l WHERE l.release_id=r.id AND l.project_id=i.project_id)) ORDER BY r.name,r.id`).bind(identifier,access.workspace_id).all<Release>()).results};
}
