import {z} from 'zod';
import {validateDestination} from '../../../../../vendor/base/integrations';
import {IntegrationError} from '../errors';
export function gitlabOrigin(value:string){
 try{const url=validateDestination(value);if(url.pathname!=='/'||url.search||url.hash||url.port)throw Error();return url.origin;}catch{throw new IntegrationError(400,'gitlab_origin_invalid','Use the public HTTPS origin of GitLab.com or your GitLab server.');}
}
export class GitlabResult extends Error{constructor(public readonly uncertain:boolean){super('GitLab did not confirm this operation.');}}
export async function gitlabRequest(origin:string,token:string,path:string,method:'GET'|'POST'|'PUT'='GET',body?:unknown){
 if(gitlabOrigin(origin)!==origin||!/^\/(?:personal_access_tokens\/self|projects(?:\?[a-z0-9_=&]+|\/[1-9][0-9]*(?:\/hooks(?:\/[1-9][0-9]*)?)?)?)$/.test(path))throw new IntegrationError(400,'gitlab_destination_invalid');
 let response:Response;
 try{response=await fetch(origin+'/api/v4'+path,{method,headers:{'PRIVATE-TOKEN':token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{throw new GitlabResult(true);}
 if(!response.ok){await response.body?.cancel();throw new GitlabResult(response.status>=300&&response.status<400||response.status>=500);}
 try{
  const reader=response.body?.getReader();if(!reader)throw Error();let size=0,text='';const decoder=new TextDecoder();
  while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>262144){await reader.cancel();throw Error();}text+=decoder.decode(chunk.value,{stream:true});}
  return {value:JSON.parse(text+decoder.decode()) as unknown,nextPage:response.headers.get('X-Next-Page')};
 }catch{throw new GitlabResult(true);}
}
const permission=z.object({access_level:z.number()}).nullable().optional();
export const projectSchema=z.object({id:z.number().int().positive().safe(),path_with_namespace:z.string().min(1).max(500),name:z.string().min(1).max(200),permissions:z.object({project_access:permission,group_access:permission})});
export function permittedProject(value:unknown){const project=projectSchema.parse(value);if(Math.max(project.permissions.project_access?.access_level??0,project.permissions.group_access?.access_level??0)<40)throw new GitlabResult(false);return project;}
export async function discoverProjects(origin:string,token:string,authorize:()=>Promise<unknown>){
 await authorize();
 const self=await gitlabRequest(origin,token,'/personal_access_tokens/self');
 const grant=z.object({active:z.literal(true),revoked:z.literal(false),scopes:z.array(z.string())}).safeParse(self.value);
 if(!grant.success||grant.data.scopes.length!==1||grant.data.scopes[0]!=='api')throw new IntegrationError(400,'gitlab_scope_invalid','Use a group or project access token with only the api scope and Maintainer access to the selected projects.');
 await authorize();
 const result=await gitlabRequest(origin,token,'/projects?membership=true&min_access_level=40&per_page=100&order_by=id&sort=asc');
 const projects=z.array(projectSchema).max(100).parse(result.value).filter(project=>Math.max(project.permissions.project_access?.access_level??0,project.permissions.group_access?.access_level??0)>=40);
 if(new Set(projects.map(project=>project.id)).size!==projects.length)throw new GitlabResult(true);
 return {projects,more:Boolean(result.nextPage)};
}
