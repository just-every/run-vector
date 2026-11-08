import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {proveViewerRoleUpgrade} from './viewer-role-upgrade';
import { it } from 'vitest';
import { provePopulatedUpgrade } from './populated-upgrade';

it('[PROJ-001 DATA-005 BASE-OPS-002] populated project and previous-head upgrades preserve records and export the extended planning inventory',async()=>{
  await proveViewerRoleUpgrade();
  await provePopulatedUpgrade('0062_project_fields.sql',{
    until:'0062_project_fields.sql',preserveAfter:'0134_slack_threads.sql',
    added:['table project_labels','index project_labels_label_idx','trigger project_dates_insert','trigger project_dates_update','trigger project_label_admission','trigger project_label_update_admission','trigger project_label_usage'],
    changed:['table projects','table labels'],removed:[],
  },['projects','labels'],undefined,async()=>{
    // Native release data written at the real previous schema has no owner
    // field. The forward migration must preserve that uncertainty and scope.
    await env.DB.prepare(`INSERT INTO releases(id,workspace_id,team_id,name,target_date,status,description,version,created_at,updated_at)
      SELECT '01K00000000000000000000926',t.workspace_id,i.team_id,'synthetic-vector-9226','2027-01-01','planned','synthetic-vector-9227',3,'2026-10-01','2026-10-01' FROM issues i JOIN teams t ON t.id=i.team_id LIMIT 1`).run();
    await env.DB.prepare(`INSERT INTO release_issues(release_id,issue_id) SELECT '01K00000000000000000000926',id FROM issues LIMIT 1`).run();
  });
  expect(await env.DB.prepare("SELECT owner_operator_id FROM releases WHERE id='01K00000000000000000000926'").first('owner_operator_id')).toBeNull();
},180000);
