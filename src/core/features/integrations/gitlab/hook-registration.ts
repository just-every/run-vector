import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import type {IntegrationOwner} from '../authority';
import {IntegrationError} from '../errors';
import {newSigningSecret,sealSecret} from '../secrets';
import {auditStatement} from '../../audit/producer';
import {managed,loadConnection,connectionGuard,connectionToken,hookIdentity} from './connection';
import {gitlabRequest,permittedProject,GitlabResult} from './provider';
const selection=z.object({projectIds:z.array(z.number().int().positive().safe()).min(1).max(20).refine(ids=>new Set(ids).size===ids.length)}).strict();
export async function registerHooks(env:WorkerBindings,owner:IntegrationOwner,id:string,value:unknown){
 const parsed=selection.safeParse(value);if(!parsed.success)throw new IntegrationError(400,'gitlab_selection_invalid');
 const connection=await loadConnection(env,owner,id),sql=managed(env,owner),token=await connectionToken(env,connection),guard=connectionGuard(owner,connection);
 const [,current]=await sql.batch([guard,{sql:'SELECT project_id,path FROM vector_gitlab_projects WHERE connection_id=? AND generation=?',params:[id,connection.generation]}]);
 if(parsed.data.projectIds.some(project=>!current.some(row=>row.project_id===project)))throw new IntegrationError(400,'gitlab_project_unavailable');
 const outcomes=[];
 for(const projectId of parsed.data.projectIds){
  await sql.batch([guard]);
  const [prior]=await sql.batch([{sql:'SELECT state,hook_id,generation,callback_url FROM vector_gitlab_hooks WHERE connection_id=? AND project_id=?',params:[id,projectId]}]);
  const previous=prior[0],callback=env.APP_ORIGIN+'/api/integrations/gitlab/'+id+'/'+projectId;
  if(previous&&(previous.state==='registering'||previous.state==='unknown')){outcomes.push({projectId,state:previous.state});continue;}
  if(previous?.state==='registered'&&previous.generation===connection.generation&&previous.callback_url===callback){outcomes.push({projectId,state:'registered'});continue;}
  try{const remote=permittedProject((await gitlabRequest(connection.origin,token,'/projects/'+projectId)).value);if(remote.id!==projectId||remote.path_with_namespace!==current.find(row=>row.project_id===projectId)!.path)throw new GitlabResult(false);}catch{outcomes.push({projectId,state:'unavailable'});continue;}
  const secret=newSigningSecret(),encrypted=await sealSecret(env,hookIdentity(id,projectId),secret),at=new Date().toISOString();
  await sql.batch([guard,
   {sql:`INSERT INTO vector_gitlab_hooks(connection_id,project_id,state,hook_id,callback_url,generation,updated_at) VALUES(?,?,'registering',?,?,?,?) ON CONFLICT(connection_id,project_id) DO UPDATE SET state='registering',callback_url=excluded.callback_url,generation=excluded.generation,updated_at=excluded.updated_at WHERE vector_gitlab_hooks.state IN ('registered','rejected') RETURNING project_id`,params:[id,projectId,previous?.hook_id?Number(previous.hook_id):null,callback,connection.generation,at]},
   {sql:"SELECT CASE WHEN changes()=1 THEN 1 ELSE json('GitLab registration already claimed') END"},
   {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted",params:[hookIdentity(id,projectId),encrypted]},
  ]);
  // One provider write after the durable claim. An interrupted claim remains inert.
  await sql.batch([guard]);
  let state='unknown',hookId:number|null=previous?.hook_id?Number(previous.hook_id):null;
  try{
   const path='/projects/'+projectId+'/hooks'+(hookId?'/'+hookId:'');
   const result=await gitlabRequest(connection.origin,token,path,hookId?'PUT':'POST',{url:callback,token:secret,enable_ssl_verification:true,push_events:true,merge_requests_events:true,pipeline_events:true,deployment_events:true});
   const response=z.object({id:z.number().int().positive().safe(),url:z.literal(callback)}).safeParse(result.value);
   if(response.success&&(!hookId||response.data.id===hookId)){state='registered';hookId=response.data.id;}
  }catch(error){state=error instanceof GitlabResult&&!error.uncertain?'rejected':'unknown';}
  await sql.batch([guard,{sql:"UPDATE vector_gitlab_hooks SET state=?,hook_id=?,updated_at=? WHERE connection_id=? AND project_id=? AND generation=? AND state='registering'",params:[state,hookId,new Date().toISOString(),id,projectId,connection.generation]},auditStatement({workspace:owner.workspace,actor:owner.id,action:'integration.gitlab_hook_'+state,subject:id,at})]);
  outcomes.push({projectId,state});
 }
 return {outcomes};
}
