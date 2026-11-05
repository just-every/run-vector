import type {WorkerBindings} from '../../../app/bindings';
import type {IntegrationOwner} from '../authority';
import {managed} from './connection';
export async function listConnections(env:WorkerBindings,owner:IntegrationOwner){
 const [connections,projects]=await managed(env,owner).batch([
  {sql:`SELECT c.id,c.origin,c.generation,c.revoked_at AS revokedAt,NOT EXISTS(SELECT 1 FROM vector_integration_secret_keys k WHERE k.identity='gitlab-token:'||c.id AND k.slot='current') AS requiresReentry FROM vector_gitlab_connections c WHERE c.workspace_id=? ORDER BY c.created_at,c.id`,params:[owner.workspace]},
  {sql:`SELECT p.connection_id AS connectionId,p.project_id AS projectId,p.path,p.name,p.generation,h.state,h.hook_id AS hookId,h.callback_url AS callbackUrl,h.generation AS registeredGeneration,NOT EXISTS(SELECT 1 FROM vector_integration_secret_keys k WHERE k.identity='gitlab-hook:'||p.connection_id||':'||p.project_id AND k.slot='current') AS secretMissing FROM vector_gitlab_projects p JOIN vector_gitlab_connections c ON c.id=p.connection_id LEFT JOIN vector_gitlab_hooks h ON h.connection_id=p.connection_id AND h.project_id=p.project_id WHERE c.workspace_id=? ORDER BY p.path,p.project_id`,params:[owner.workspace]},
 ]);
 return {connections:connections.map(connection=>({...connection,projects:projects.filter(row=>row.connectionId===connection.id).map(row=>({...row,needsAttention:Boolean(row.state&&(row.secretMissing||row.registeredGeneration!==connection.generation||row.callbackUrl!==env.APP_ORIGIN+'/api/integrations/gitlab/'+connection.id+'/'+row.projectId))}))}))};
}
