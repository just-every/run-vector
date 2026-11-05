import type {WorkerBindings} from '../../../app/bindings';
import {openSecret} from '../secrets';
import {IntegrationError} from '../errors';
import {hookIdentity} from './connection';
// Setup registers this installation door. Event ingestion remains GITLAB-001 work.
export async function receiveGitlab(env:WorkerBindings,request:Request,id:string,project:string){
 if(!/^[1-9][0-9]{0,14}$/.test(project))throw new IntegrationError(401,'gitlab_receiver_unavailable');
 const identity=hookIdentity(id,Number(project));
 const row=await env.DB.prepare(`SELECT k.encrypted FROM vector_gitlab_connections c JOIN vector_gitlab_hooks h ON h.connection_id=c.id JOIN vector_integration_secret_keys k ON k.identity=? AND k.slot='current' WHERE c.id=? AND c.revoked_at IS NULL AND h.project_id=? AND h.state='registered' AND h.generation=c.generation AND h.callback_url=? AND EXISTS(SELECT 1 FROM vector_integration_secret_keys t WHERE t.identity='gitlab-token:'||c.id AND t.slot='current')`).bind(identity,id,Number(project),env.APP_ORIGIN+'/api/integrations/gitlab/'+id+'/'+project).first<{encrypted:string}>();
 if(!row)throw new IntegrationError(401,'gitlab_receiver_unavailable');
 const actual=request.headers.get('X-Gitlab-Token')??'',expected=await openSecret(env,identity,row.encrypted);
 const digest=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [left,right]=await Promise.all([digest(actual),digest(expected)]);let mismatch=0;for(let i=0;i<left.length;i++)mismatch|=left[i]^right[i];
 if(mismatch)throw new IntegrationError(401,'gitlab_receiver_unavailable');
 throw new IntegrationError(503,'gitlab_event_processing_pending','GitLab hook registration is available; event processing is not yet implemented.');
}
