import type { SqlDatabase,SqlStatement } from '../../../../vendor/base/integrations';
import { D1SqlDatabase } from '../../../../vendor/base/integrations';
import { requireOperator } from '../auth/service';
import type { WorkerBindings } from '../../app/bindings';
import { IntegrationError } from './errors';
export type IntegrationOwner={id:string;workspace:string;fence:{sessionId:string;operatorVersion:number}};
export async function integrationOwner(env:WorkerBindings,request:Request):Promise<IntegrationOwner>{
 const owner=await requireOperator(env,request);if(!owner)throw new IntegrationError(401,'unauthenticated');
 const row=await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL').bind(owner.id).first<{workspace_id:string}>();if(!row)throw new IntegrationError(401,'unauthenticated');
 return {id:owner.id,workspace:row.workspace_id,fence:owner.fence};
}
export function ownerPredicate(owner:IntegrationOwner):SqlStatement{
 return {sql:`EXISTS(SELECT 1 FROM operators o JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id JOIN oa_sessions s ON s.operator_id=a.id WHERE o.id=? AND o.workspace_id=? AND o.removed_at IS NULL AND a.status='active' AND a.version=s.operator_version AND s.id=? AND s.operator_version=? AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=a.id)))`,params:[owner.id,owner.workspace,owner.fence.sessionId,owner.fence.operatorVersion]};
}
export function guardedSql(db:D1Database,predicate:SqlStatement):SqlDatabase {
 const native=new D1SqlDatabase(db),guard={sql:`SELECT CASE WHEN (${predicate.sql}) THEN 1 ELSE json('integration authority denied') END`,params:predicate.params};
 return {async batch(statements){try{return (await native.batch([guard,...statements,guard])).slice(1,-1);}catch{throw new IntegrationError(503,'integration_transaction_refused','Current authority or durable storage refused the operation.');}}};
}
export async function admitted(db:D1Database,predicate:SqlStatement):Promise<boolean>{
 return Boolean(await db.prepare('SELECT ('+predicate.sql+') AS admitted').bind(...(predicate.params??[])).first<number>('admitted'));
}
