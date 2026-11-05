import {appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const project=id=>({id,name:'Project '+id,path_with_namespace:'synthetic-vector/project-'+id,permissions:{project_access:{access_level:40},group_access:null}});
export async function gitlabProviderEdge(request){
 const url=new URL(request.url);if(!['gitlab.com','gitlab.example.com'].includes(url.hostname))return null;
 if(request.headers.get('PRIVATE-TOKEN')!=='synthetic-vector-18921')return new Response(null,{status:401});
 if(url.pathname==='/api/v4/personal_access_tokens/self')return Response.json({active:true,revoked:false,scopes:['api']});
 if(url.pathname==='/api/v4/projects')return Response.json([project(18931),project(18932),project(18933)]);
 const match=/^\/api\/v4\/projects\/(\d+)(?:\/hooks(?:\/(\d+))?)?$/.exec(url.pathname);
 if(!match)throw Error('Unexpected GitLab fixture endpoint');
 const id=Number(match[1]);if(request.method==='GET')return Response.json(project(id));
 const {token,...body}=await request.json();if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid GitLab signing secret');
 appendFileSync(process.env.VECTOR_CHANNEL_EDGE,JSON.stringify({method:'gitlab.hook',origin:url.origin,path:url.pathname,verb:request.method,body,secretHash:createHash('sha256').update(token).digest('hex')})+'\n');
 if(url.hostname==='gitlab.example.com'&&id===18932)return new Response(null,{status:503});
 return Response.json({id:match[2]?Number(match[2]):id+100,url:body.url});
}
