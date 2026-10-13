import { parseConfig } from '../../../vendor/base/editor/config';
import { currentEditorOwner } from './owner-authority.server';
import { baseAuth,productOperator } from '../features/auth/base.server';
import { restoredOperatorAdmitted } from '../features/data/restore-authority';
import type { WorkerBindings } from '../app/bindings';

function configuration(env:WorkerBindings) {
  if(!env.RER_MANAGEMENT_ORIGIN&&!env.RER_INSTALLATION_ID)return null;
  return parseConfig({enabled:true,managementOrigin:env.RER_MANAGEMENT_ORIGIN,installationId:env.RER_INSTALLATION_ID});
}
export async function editorConfigResponse(env:WorkerBindings,request:Request) {
  const headers={'cache-control':'no-store, private',vary:'Cookie'};
  try {
    const session=await baseAuth(env).getSession(request);
    if(!session||session.operator.role!=='owner'||
      !(await restoredOperatorAdmitted(env.DB,session.operatorId))||
      !(await productOperator(env.DB,session.operatorId))||
      !(await currentEditorOwner(env.DB,session)))
      return Response.json({error:'owner_authorization_required'},{status:403,headers});
    if(request.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405,headers:{...headers,allow:'GET'}});
    const config=configuration(env);
    if(!config)return Response.json({error:'editor_not_configured'},{status:503,headers});
    if(!await currentEditorOwner(env.DB,session))return Response.json({error:'owner_authorization_required'},{status:403,headers});
    return Response.json({config,expiresAt:Math.min(session.expiresAt,Date.now()+30_000)},{headers});
  } catch{return Response.json({error:'editor_authorization_unavailable'},{status:503,headers});}
}

/** Retain the document's script/nonces and every unrelated directive. */
export function editorDocument(response:Response,env:WorkerBindings) {
  let origin:string|null=null;try{origin=configuration(env)?.managementOrigin??null;}catch{}
  const headers=new Headers(response.headers);
  const directives=new Map<string,string[]>();
  for(const part of (headers.get('content-security-policy')??'').split(';')) {
    const [name,...values]=part.trim().split(/\s+/);if(name)directives.set(name.toLowerCase(),values);
  }
  for(const name of ['frame-src','frame-ancestors']) {
    const values=new Set(["'self'"]);if(origin)values.add(origin);
    directives.set(name,[...values]);
  }
  if(!directives.has('object-src'))directives.set('object-src',["'none'"]);
  if(!directives.has('base-uri'))directives.set('base-uri',["'self'"]);
  headers.set('content-security-policy',[...directives].map(([name,values])=>[name,...values].join(' ')).join('; '));
  headers.set('cache-control','no-store, private');headers.append('vary','Cookie');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
