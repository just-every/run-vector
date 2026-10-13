import type { D1ImportContext } from '../../../../../vendor/base/import-kit/src/d1/index';
import { nativeTargets } from './native-targets';

export type ImportActor = { id:string; workspace:string; fence:{sessionId:string;operatorVersion:number} };
export function importContext(db:D1Database,actor:ImportActor,namespace:string,mappingVersion:string,reviewedFingerprint?:string,operationKey?:string): D1ImportContext {
  return {
    destination:actor.workspace,namespace,mappingVersion,reviewedFingerprint,operationKey,
    batchSize:1000,maxBatches:1,
    storage:{database:db,targets:nativeTargets},
    authorization:{principalId:actor.id,predicate:(_action,destination)=>({
      sql:`?=? AND EXISTS(SELECT 1 FROM operators o JOIN vector_auth_operators m ON m.operator_id=o.id
        JOIN oa_operators a ON a.id=m.auth_id JOIN oa_sessions s ON s.operator_id=a.id
        WHERE o.id=? AND o.workspace_id=? AND o.removed_at IS NULL AND a.status='active'
        AND s.id=? AND s.operator_version=? AND a.version=s.operator_version AND s.revoked_at IS NULL
        AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
        AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=a.id)))`,
      params:[destination,actor.workspace,actor.id,actor.workspace,actor.fence.sessionId,actor.fence.operatorVersion],
    })},
  };
}
