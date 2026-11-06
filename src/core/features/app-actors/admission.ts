import { sha256 } from '../../../../vendor/base/integrations/core/crypto';
import { devAdmitted } from '../../../../vendor/base/operator-auth/dev-admission.mjs';
import { visibleTeam } from '../roles/visibility-sql';
import { admitted } from '../integrations/authority';
import { IntegrationError } from '../integrations/errors';
import type { AppActor } from './identity';

/** Current installer authority is a ceiling; the credential belongs to the app. */
export function appActorPredicate(actor: AppActor) {
 const resource = actor.app.identifier;
 return { sql: `EXISTS(SELECT 1 FROM vector_app_actors a JOIN vector_app_actor_credentials c ON c.actor_id=a.id
 JOIN operators o ON o.id=a.installer_id JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators native ON native.id=m.auth_id
 WHERE a.id=? AND a.workspace_id=? AND a.installer_id=? AND a.state='active' AND o.workspace_id=a.workspace_id
 AND o.removed_at IS NULL AND native.status='active' AND o.role IN ('owner','admin','member')
 AND ${visibleTeam('o','a.team_id')}
 AND NOT EXISTS(SELECT value FROM json_each(?) WHERE value NOT IN(SELECT value FROM json_each(a.scopes)))
 ${resource ? 'AND EXISTS(SELECT 1 FROM issues i WHERE i.identifier=? AND i.team_id=a.team_id)' : ''}
 AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=native.id)))`,
 params: [actor.app.id,actor.workspace,actor.id,JSON.stringify(actor.scopes),...(resource ? [resource] : [])] };
}
export async function authorizeAppActor(db: D1Database, request: Request, resource: string): Promise<AppActor> {
 const token = request.headers.get('Authorization')?.slice(7) ?? '';
 if (!/^act_[a-f0-9]{64}$/.test(token)) throw new IntegrationError(401,'invalid_token');
 const row = await db.prepare(`SELECT a.*,c.dev_only FROM vector_app_actors a JOIN vector_app_actor_credentials c ON c.actor_id=a.id WHERE c.token_hash=?`)
 .bind(await sha256(token)).first<{id:string;workspace_id:string;installer_id:string;name:string;installer_name:string|null;team_id:string;dev_only:number}>();
 if (!row || row.dev_only && !await devAdmitted(request)) throw new IntegrationError(401,'invalid_token');
 const actor: AppActor = {id:row.installer_id,workspace:row.workspace_id,namespace:'app-agent:'+row.id,tokenId:row.id,scopes:[],app:{id:row.id,name:row.name,installerName:row.installer_name,teamId:row.team_id}};
 if (!await admitted(db,appActorPredicate(actor))) throw new IntegrationError(401,'invalid_token');
 const route = /^(GET|PATCH):\/issues\/([A-Z]{2,10}-[1-9][0-9]*)$/.exec(resource);
 if (!route) throw new IntegrationError(403,'actor_operation_refused');
 actor.scopes = route[1] === 'GET' ? ['issues:read'] : ['issues:read','issues:title:write'];
 if (!await admitted(db,appActorPredicate(actor))) throw new IntegrationError(403,'insufficient_scope');
 actor.app.identifier = route[2];
 if (!await admitted(db,appActorPredicate(actor))) throw new IntegrationError(404,'not_found');
 return actor;
}
