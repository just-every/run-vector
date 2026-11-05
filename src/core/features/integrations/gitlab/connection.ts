import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import {createUlid} from '../../../shared/ids';
import {appManager,managed} from '../slack-app/install';
import type {IntegrationOwner} from '../authority';
import {IntegrationError} from '../errors';
import {sealSecret,openSecret} from '../secrets';
import {auditStatement} from '../../audit/producer';
import {discoverProjects,gitlabOrigin} from './provider';
export {appManager,managed};
export const tokenIdentity=(id:string)=>'gitlab-token:'+id;
export const hookIdentity=(id:string,project:number)=>'gitlab-hook:'+id+':'+project;
export type Connection={id:string;origin:string;generation:number;encrypted:string};
export function connectionGuard(owner:IntegrationOwner,connection:Connection){return {sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_gitlab_connections c JOIN vector_integration_secret_keys k ON k.identity='gitlab-token:'||c.id AND k.slot='current' WHERE c.id=? AND c.workspace_id=? AND c.revoked_at IS NULL AND c.generation=? AND k.encrypted=?) THEN 1 ELSE json('GitLab connection changed') END`,params:[connection.id,owner.workspace,connection.generation,connection.encrypted]};}
export async function loadConnection(env:WorkerBindings,owner:IntegrationOwner,id:string){
 const [rows]=await managed(env,owner).batch([{sql:`SELECT c.id,c.origin,c.generation,k.encrypted FROM vector_gitlab_connections c JOIN vector_integration_secret_keys k ON k.identity='gitlab-token:'||c.id AND k.slot='current' WHERE c.id=? AND c.workspace_id=? AND c.revoked_at IS NULL`,params:[id,owner.workspace]}]);
 if(!rows.length)throw new IntegrationError(409,'gitlab_credentials_required','Re-enter the GitLab token before managing project hooks.');return rows[0] as Connection;
}
const input=z.object({origin:z.string().max(2000),token:z.string().min(1).max(2000)}).strict();
export async function saveConnection(env:WorkerBindings,request:Request,value:unknown){
 const owner=await appManager(env,request),parsed=input.safeParse(value);if(!parsed.success)throw new IntegrationError(400,'gitlab_input_invalid');
 const origin=gitlabOrigin(parsed.data.origin),token=parsed.data.token;
 const [existing]=await managed(env,owner).batch([{sql:'SELECT id,generation FROM vector_gitlab_connections WHERE workspace_id=? AND origin=?',params:[owner.workspace,origin]}]);
 let discovered;try{discovered=await discoverProjects(origin,token,()=>managed(env,owner).batch([]));}catch(error){if(error instanceof IntegrationError)throw error;throw new IntegrationError(400,'gitlab_discovery_refused','GitLab did not return a valid token and project list. No connection was changed.');}
 const at=new Date().toISOString(),id=existing.length?String(existing[0].id):createUlid(new Date(at)),generation=existing.length?Number(existing[0].generation)+1:1,encrypted=await sealSecret(env,tokenIdentity(id),token);
 await managed(env,owner).batch([
  existing.length?{sql:"SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_gitlab_connections WHERE id=? AND generation=?) THEN 1 ELSE json('GitLab connection changed') END",params:[id,existing[0].generation as number]}:{sql:"SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vector_gitlab_connections WHERE workspace_id=? AND origin=?) THEN 1 ELSE json('GitLab connection changed') END",params:[owner.workspace,origin]},
  {sql:`INSERT INTO vector_gitlab_connections(id,workspace_id,origin,generation,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,revoked_at=NULL,updated_at=excluded.updated_at`,params:[id,owner.workspace,origin,generation,at,at]},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted",params:[tokenIdentity(id),encrypted]},
  ...discovered.projects.map(project=>({sql:'INSERT INTO vector_gitlab_projects(connection_id,project_id,path,name,generation) VALUES(?,?,?,?,?) ON CONFLICT(connection_id,project_id) DO UPDATE SET path=excluded.path,name=excluded.name,generation=excluded.generation',params:[id,project.id,project.path_with_namespace,project.name,generation]})),
  auditStatement({workspace:owner.workspace,actor:owner.id,action:'integration.gitlab_credentials_saved',subject:id,at}),
 ]);
 return {id,moreProjects:discovered.more};
}
export async function connectionToken(env:WorkerBindings,connection:Connection){return openSecret(env,tokenIdentity(connection.id),connection.encrypted);}
export async function removeConnection(env:WorkerBindings,owner:IntegrationOwner,id:string){
 const at=new Date().toISOString();
 await managed(env,owner).batch([
  {sql:'UPDATE vector_gitlab_connections SET revoked_at=?,generation=generation+1,updated_at=? WHERE id=? AND workspace_id=?',params:[at,at,id,owner.workspace]},
  {sql:`DELETE FROM vector_integration_secret_keys WHERE (identity=? OR identity LIKE ?) AND EXISTS(SELECT 1 FROM vector_gitlab_connections WHERE id=? AND workspace_id=?)`,params:[tokenIdentity(id),'gitlab-hook:'+id+':%',id,owner.workspace]},
  auditStatement({workspace:owner.workspace,actor:owner.id,action:'integration.gitlab_credentials_removed',subject:id,at,condition:{sql:'EXISTS(SELECT 1 FROM vector_gitlab_connections WHERE id=? AND workspace_id=?)',params:[id,owner.workspace]}}),
 ]);return {removed:true};
}
