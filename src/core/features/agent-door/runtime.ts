import { createAgentDoor, type Trust } from '../../../../vendor/base/agent-door/index.ts';
import { createBusinessSettings } from '../../../../vendor/base/business-settings/index.ts';
import { nativePeople } from './people';
import { readTools, issueResource, commentResource } from './read-tools';
import { issueTools } from './issue-tools';
import { nativeCredentials } from './local-credentials';
import type { WorkerBindings } from '../../app/bindings';

export const capabilities=['tools','policy','pause','audit','idempotency','resources'] as const;
export const notTools=[
  {clauses:['DATA-002','DATA-003'],reason:'import-door' as const},
  {clauses:['INTEG-001','SEC-001'],reason:'connector' as const},
  {clauses:['OWNER-CLAIM-001'],reason:'installation' as const},
];
function trust(env:WorkerBindings):Trust|null {
  const issuer=env.RER_OWNER_CLAIM_ISSUER,installationId=env.RER_OWNER_CLAIM_INSTALLATION_ID,appOrigin=env.RER_OWNER_CLAIM_APP_ORIGIN,keys=env.RER_OWNER_CLAIM_PUBLIC_KEYS;
  if(![issuer,installationId,appOrigin,keys].some(Boolean))return null;
  if(!issuer||!installationId||!appOrigin||!keys||appOrigin!==env.APP_ORIGIN)throw new Error('Incomplete agent trust');
  return {issuer,installationId,appOrigin,publicKeys:JSON.parse(keys)};
}
export async function businessSettings(env:WorkerBindings) {
  let config:import('../../../../vendor/base/business-settings/index.ts').Trust|null=null;
  if(env.RER_BUSINESS_TRUST){
    config=JSON.parse(env.RER_BUSINESS_TRUST);
    const owner=await env.DB.prepare(`SELECT o.email FROM workspace_installation i JOIN operators o ON o.id=i.setup_operator_id
      JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id WHERE o.removed_at IS NULL AND a.status='active'`).first<{email:string}>();
    if(!config)throw new Error('Business trust unavailable');
    if(owner)config={...config,email:owner.email};
  }
  return createBusinessSettings({db:env.DB,trust:config,business:{settings:1,values:['display_name']}});
}
export function vectorAgentDoor(env:WorkerBindings) {
  return createAgentDoor({seed:'vector',name:'Vector',specialist:'software delivery coordinator',db:env.DB,origin:env.APP_ORIGIN,trust:trust(env),capabilities,people:nativePeople(env),tools:[...readTools,...issueTools],resources:[issueResource,commentResource],notTools,...nativeCredentials(env.DB)});
}
/** Recognized requests run before cookie-only app admission and SPA routing. */
export async function agentResponse(env:WorkerBindings,request:Request):Promise<Response|null> {
  const path=new URL(request.url).pathname;
  if(!['/mcp','/agents','/agent.json','/llms.txt','/rer-business-logo','/rer-business.css'].includes(path) && !path.startsWith('/.well-known/') && !path.startsWith('/api/rer/') && !path.startsWith('/agents/'))return null;
  try {
    if(path==='/api/rer/business-settings' && !await env.DB.prepare(`SELECT 1 FROM workspace_installation i JOIN operators o ON o.id=i.setup_operator_id
      JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id WHERE o.removed_at IS NULL AND a.status='active'`).first())return Response.json({code:'native_owner_required'},{status:403});
    return await (await businessSettings(env)).handle(request) ?? await vectorAgentDoor(env).handle(request);}
  catch {return Response.json({code:'agent_door_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
