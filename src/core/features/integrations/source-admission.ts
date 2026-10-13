import type { SourceAdmission } from './source-storage';
import { IntegrationError } from './errors';
function credentialPredicate({source,keySlot,encrypted}:SourceAdmission){
 return {sql:`EXISTS(SELECT 1 FROM vector_integration_sources s JOIN vector_integration_secret_keys k ON k.identity='source:'||s.id WHERE s.id=? AND s.workspace_id=? AND s.team_id=? AND s.version=? AND s.enabled=1 AND s.revoked_at IS NULL AND k.slot=? AND k.encrypted=? AND (k.valid_until IS NULL OR k.valid_until>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))) AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=0))`,values:[source.id,source.workspace_id,source.team_id,source.version,keySlot,encrypted]};
}
export function sourcePredicate(admission:SourceAdmission){
 const credential=credentialPredicate(admission);
 return {sql:credential.sql+' AND EXISTS(SELECT 1 FROM teams t WHERE t.id=? AND t.workspace_id=? AND t.archived_at IS NULL)',values:[...credential.values,admission.source.team_id,admission.source.workspace_id]};
}
export async function requireSourceAdmission(db:D1Database,admission:SourceAdmission){
 const {sql,values}=sourcePredicate(admission);if(await db.prepare('SELECT ('+sql+') AS active').bind(...values).first<number>('active'))return;
 // A still-authorized signer can see the native archived-team conflict. A
 // revoked credential or destination restore hold always remains a denial.
 const credential=credentialPredicate(admission);
 const authorized=await db.prepare('SELECT ('+credential.sql+') AS active').bind(...credential.values).first<number>('active');
 if(authorized&&await db.prepare('SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NOT NULL').bind(admission.source.team_id,admission.source.workspace_id).first())throw new IntegrationError(409,'source_team_archived');
 throw new IntegrationError(401,'source_authority_changed');
}
