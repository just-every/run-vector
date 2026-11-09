import { expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { provePopulatedUpgrade } from './populated-upgrade';

it('populated pre-suspension stores retain legacy removals, credentials and all history through the additive lifecycle upgrade', {timeout:120_000}, async () => {
  await provePopulatedUpgrade('0138_member_suspension.sql',{
    added:['table member_lifecycle_events','index member_lifecycle_member','index teams_parent_idx','index workflow_inherited_idx'],removed:[],
    changed:['table operators','table teams','table workflow_statuses','trigger vector_operator_auth_remove','trigger notification_channel_member_erasure','trigger subscription_operator_removed','trigger subscription_operator_suspended'],
  },['issues','issue_comments','issue_files','operators','oa_sessions'], async () => {
    await env.DB.prepare(`INSERT INTO operators(id,workspace_id,name,email,removed_at,created_at,updated_at)
      SELECT '01K00000000000000000009344',id,'Removed operator','01K00000000000000000009344'||char(64)||'removed.invalid','2026-10-01','2026-10-01','2026-10-01' FROM workspace_settings`).run();
  }, async () => {
    const legacy = await env.DB.prepare("SELECT name,removed_at,suspended_at FROM operators WHERE id='01K00000000000000000009344'").first();
    expect(legacy).toEqual({name:'Removed operator',removed_at:'2026-10-01',suspended_at:null});
    // 0139 follows the suspension boundary: every existing team stays an independent root.
    expect(await env.DB.prepare('SELECT count(*) n FROM teams WHERE parent_team_id IS NOT NULL OR workflow_inherited<>0 OR permissions_inherited<>0 OR hierarchy_version<>1').first<number>('n')).toBe(0);
    expect(await env.DB.prepare('SELECT count(*) n FROM workflow_statuses WHERE inherited_from IS NOT NULL').first<number>('n')).toBe(0);
  });
});
