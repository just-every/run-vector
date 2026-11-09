import {expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {provePopulatedUpgrade} from './populated-upgrade';
// 0038-0042 are Base operator-auth's sign-in ledgers; 0043 and 0044 are import-kit's
// retirement journal and indexed reversal fences, which replace one stream trigger.
// Bound this historical schema comparison at 0044; the helper still applies all
// newer migrations before proving data preservation, owner sign-in and archives.
// Freeze every column again at main's 0135 before applying 0136 sub-teams.
it('[BASE-ACCESS-002 DATA-011] a populated store keeps every row, index and trigger when Base sign-in ledgers, import retirement and reversal fences are added, and the owner signs in after',async()=>{await provePopulatedUpgrade('0038_identity_providers.sql',{
 added:[
  'table oa_auth_audit','table oa_auth_settings','table oa_credentials','table oa_domain_rules','table oa_identity_provider_health','table oa_identity_providers',
  'table oa_logout_events','table oa_oidc_limits','table oa_oidc_transactions','table oa_provider_session_pins','table oa_provider_sessions','table oa_setup_links','table oa_step_up_challenges',
  'index oa_oidc_transactions_expiry','index oa_provider_session_identity','index oa_step_up_session',
  'trigger oa_first_setup_provider_setting','trigger oa_native_claim_closes_provider_setup',
  'table ik_d1_erasure_journal','table ik_d1_erasure_tally','table ik_d1_retirements','index ik_d1_erasure_journal_time',
  'trigger ik_d1_erasure_journal_delete','trigger ik_d1_erasure_journal_insert','trigger ik_d1_erasure_journal_update','trigger ik_d1_retirement_delete','trigger ik_d1_retirement_insert','trigger ik_d1_retirement_update',
  'table ik_d1_reversal_fences','index ik_d1_history_source','index ik_provenance_job','index ik_provenance_source','index ik_sources_job',
 ],until:'0044_import_reversal_fence.sql',preserveAfter:'0135_automation_rules.sql',removed:[],changed:['trigger ik_d1_stream_revision_update'],signIn:'after',
},['cycles','issues','issue_comments','issue_files','evidence_revisions','operators','oa_sessions','oa_tokens','integration_tokens']);
 expect(await env.DB.prepare("SELECT count(*) n FROM teams WHERE parent_team_id IS NOT NULL OR workflow_inherited<>0 OR permissions_inherited<>0 OR hierarchy_version<>1").first<number>("n")).toBe(0);
 expect(await env.DB.prepare("SELECT count(*) n FROM workflow_statuses WHERE inherited_from IS NOT NULL").first<number>("n")).toBe(0);
},120_000);
