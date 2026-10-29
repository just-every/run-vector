import type { WorkerBindings } from '../../app/bindings';
import { IntegrationError } from '../integrations/errors';
import { openSecret } from '../integrations/secrets';
import { deliveryOwnership } from '../integrations/delivery-setup';
import { egressConfigured } from '../integrations/outbound';
import { restoredEffectsHeld } from '../data/restore-authority';
import { visibleTeam } from '../roles/visibility-sql';
import { providerDisclosure } from './catalog';
import type { ProviderRow } from './settings';
import type { features } from './schema';
/** All model features inherit this fail-closed admission. No model output is a command. */
export async function modelPreview(env:WorkerBindings,actor:string,identifier:string,feature:typeof features[number]='triage') {
  const read=async()=>{
    const issue=await env.DB.prepare(`SELECT i.identifier,i.title,i.description,i.version,i.team_id AS teamId,o.workspace_id AS workspace
      FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id
      WHERE o.id=? AND o.removed_at IS NULL AND i.identifier=? AND ${visibleTeam('o','t.id')}`).bind(actor,identifier).first<{identifier:string;title:string;description:string;version:number;teamId:string;workspace:string}>();
    if(!issue)throw new IntegrationError(404,'model_issue_unavailable');
    const global=await env.DB.prepare("SELECT enabled,provider_id FROM vector_model_policies WHERE workspace_id=? AND feature=? AND team_id=''").bind(issue.workspace,feature).first<{enabled:number;provider_id:string|null}>();
    const local=await env.DB.prepare('SELECT enabled,provider_id FROM vector_model_policies WHERE workspace_id=? AND feature=? AND team_id=?').bind(issue.workspace,feature,issue.teamId).first<{enabled:number;provider_id:string|null}>();
    if(!global?.enabled || local?.enabled===0 || await restoredEffectsHeld(env.DB))return null;
    const provider=await env.DB.prepare('SELECT * FROM vector_model_providers WHERE id=? AND workspace_id=?').bind(local?.provider_id??global.provider_id,issue.workspace).first<ProviderRow>();
    if(!provider || !providerDisclosure(provider).noTraining || !providerDisclosure(provider).termsUrl || !providerDisclosure(provider).retention)throw new IntegrationError(409,'model_terms_required');
    const key=await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot='current'").bind('model:'+provider.id).first<{encrypted:string}>();
    if(!key)throw new IntegrationError(409,'model_credential_required');
    return {issue,provider,key};
  };
  let current=await read();
  if(!current)return {enabled:false};
  const credential=await openSecret(env,'model:'+current.provider.id,current.key.encrypted);
  let transport=env.INTEGRATION_EGRESS;
  if(current.provider.kind==='anthropic' && current.provider.endpoint==='https://api.anthropic.com/v1/messages') {
    transport={async send(wire){
      const response=await fetch(wire.url,{method:'POST',headers:wire.headers,body:wire.body,redirect:'manual',signal:AbortSignal.timeout(15000)});
      return {status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()};
    }};
  } else if(!egressConfigured(env) || !transport) {
    const ownership=await deliveryOwnership(env,current.issue.workspace);
    if(!ownership)throw new IntegrationError(409,'model_egress_required','Configure outbound delivery in Settings before sending model data.');
    const {nativeEgress}=await import('../integrations/native-egress.mjs');transport=nativeEgress(ownership);
  }
  // Refresh the exact payload and all switches after asynchronous custody and transport setup.
  const checked=await read();
  if(!checked)return {enabled:false};
  if(checked.provider.id!==current.provider.id || checked.key.encrypted!==current.key.encrypted)throw new IntegrationError(409,'model_configuration_changed');
  current=checked;
  let response;
  try { response=await transport.send({url:current.provider.endpoint,headers:{'content-type':'application/json','x-api-key':credential,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:current.provider.model,max_tokens:512,messages:[{role:'user',content:JSON.stringify({feature,records:[{identifier:current.issue.identifier,title:current.issue.title,description:current.issue.description}]})}]})}); }
  catch {throw new IntegrationError(503,'model_response_unknown','The provider did not return a known response. No automatic retry was made.');}
  if(response.status<200 || response.status>=300)throw new IntegrationError(503,'model_provider_refused','The provider refused this preview. No automatic retry was made.');
  let suggestion:string;
  try {const value=JSON.parse(response.body);suggestion=value.content.filter((part:{type:string;text?:string})=>part.type==='text').map((part:{text:string})=>part.text).join('\n');if(!suggestion || suggestion.length>10000)throw Error();}
  catch {throw new IntegrationError(503,'model_invalid_response');}
  const final=await read();
  if(!final)return {enabled:false};
  if(final.provider.id!==current.provider.id || final.key.encrypted!==current.key.encrypted)throw new IntegrationError(409,'model_configuration_changed');
  if(final.issue.version!==current.issue.version || final.issue.description!==current.issue.description || final.issue.title!==current.issue.title)throw new IntegrationError(409,'model_source_changed','This issue changed while the provider was responding. Request a fresh preview.');
  return {enabled:true,suggestion,model:current.provider.model,records:[current.issue.identifier],at:new Date().toISOString()};
}
