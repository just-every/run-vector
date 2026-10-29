import { createAgentDoor, type Trust } from '../../../../vendor/base/agent-door/index.ts';
import { createBusinessSettings } from '../../../../vendor/base/business-settings/index.ts';
import { nativePeople } from './people';
import { readTools, issueResource } from './read-tools';
import { issueTools } from './issue-tools';
import { nativeCredentials } from './local-credentials';
import type { WorkerBindings } from '../../app/bindings';

export const capabilities=['tools','policy','pause','audit','idempotency'] as const;
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
export function businessSettings(env:WorkerBindings) {
  return createBusinessSettings({db:env.DB,trust:env.RER_BUSINESS_TRUST,business:{settings:1,values:['display_name']},
    team:{async ownerEmail(){return (await env.DB.prepare(`SELECT o.email FROM workspace_installation i JOIN operators o ON o.id=i.setup_operator_id WHERE o.removed_at IS NULL`).first<{email:string}>())?.email??null;},
      async prepare(){throw new Error('Business team reconciliation is not declared');}},
  });
}
export function vectorAgentDoor(env:WorkerBindings) {
  return createAgentDoor({seed:'vector',name:'Vector',specialist:'software delivery coordinator',db:env.DB,origin:env.APP_ORIGIN,trust:trust(env),capabilities,people:nativePeople(env),tools:[...readTools,...issueTools],resources:[issueResource],notTools,...nativeCredentials(env.DB)});
}
/** Recognized requests run before cookie-only app admission and SPA routing. */
export async function agentResponse(env:WorkerBindings,request:Request):Promise<Response|null> {
  const path=new URL(request.url).pathname;
  if(!['/mcp','/agents','/agent.json','/llms.txt','/rer-business-logo','/rer-business.css'].includes(path) && !path.startsWith('/.well-known/') && !path.startsWith('/api/rer/') && !path.startsWith('/agents/'))return null;
  try {return await businessSettings(env).handle(request) ?? await vectorAgentDoor(env).handle(request);}
  catch {return Response.json({code:'agent_door_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
