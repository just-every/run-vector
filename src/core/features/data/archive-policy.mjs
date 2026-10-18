// Domain identities and history stay portable; authentication is established at the destination.
export const portabilityPolicy = {
 product: 'just-every/vector-projects',
 excludeTables: ['subissue_progress_events', 'operator_sessions', 'magic_links', 'local_mail_outbox', 'access_rate_limits', 'notification_development_mail', 'vector_restore_status', 'vector_restore_operator_grants', 'vector_restore_mail_holds', 'integration_tokens', 'vector_integration_secret_keys', 'vector_webhook_restore_holds', 'vector_integration_authority_guard', 'vector_http_bootstrap', 'vector_http_restore'],
 includeTables: ['oa_operators'],
 replaceableTables: ['search_index_state', 'issue_list_revision'],
 derivedTables: ['search_issues', 'search_projects', 'search_views'],
 secretColumns: { notification_deliveries: ['claim_token'], ik_jobs: ['lease_token'], integration_deliveries: ['claim'] },
 buckets: { FILES: {} },
 requiredConfiguration: ['FIRST_OWNER_EMAIL', 'SESSION_SECRET', 'APP_ORIGIN', 'MAIL_MODE', 'MAIL_FROM'],
};

// Older archives name the retired setup credential. Match that inventory only;
// keep the original manifest intact because both archive digests authenticate it.
export function archiveImportPolicy(manifest) {
 const names=manifest?.requiredConfiguration,current=portabilityPolicy.requiredConfiguration;
 if(Array.isArray(names)&&names.length===current.length+1&&names.includes('SETUP_TOKEN')&&
  JSON.stringify(names.filter(name=>name!=='SETUP_TOKEN'))===JSON.stringify(current)) {
  return {...portabilityPolicy,requiredConfiguration:[...names]};
 }
 return portabilityPolicy;
}
