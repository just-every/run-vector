import {env} from 'cloudflare:workers';
import {proveViewerRoleUpgrade} from './viewer-role-upgrade';
import { expect, it } from 'vitest';
import { provePopulatedUpgrade } from './populated-upgrade';
import { request } from './base-auth-fixture';
import { sampleBindings } from './sample-auth-fixture';

it('[PROJ-001 DATA-005 BASE-OPS-002] populated project and previous-head upgrades preserve records and export the extended planning inventory',async()=>{
  await proveViewerRoleUpgrade();
  const historical='01K00000000000000000000926';
  const cookie=await provePopulatedUpgrade('0062_project_fields.sql',{
    until:'0062_project_fields.sql',preserveAfter:'0095_project_templates.sql',
    added:['table project_labels','index project_labels_label_idx','trigger project_dates_insert','trigger project_dates_update','trigger project_label_admission','trigger project_label_update_admission','trigger project_label_usage'],
    changed:['table projects','table labels'],removed:[],
  },['projects','labels'],undefined,async()=>{
    // A native release written at an earlier schema has no owner field. The
    // forward migrations keep that uncertainty and the release's scope.
    await env.DB.prepare(`INSERT INTO releases(id,workspace_id,team_id,name,target_date,status,description,version,created_at,updated_at)
      SELECT ?,t.workspace_id,i.team_id,'synthetic-vector-9226','2027-01-01','planned','synthetic-vector-9227',3,'2026-10-01','2026-10-01' FROM issues i JOIN teams t ON t.id=i.team_id ORDER BY i.id LIMIT 1`).bind(historical).run();
    await env.DB.prepare('INSERT INTO release_issues(release_id,issue_id) SELECT ?,id FROM issues ORDER BY id LIMIT 1').bind(historical).run();
  });
  expect(await env.DB.prepare('SELECT owner_operator_id FROM releases WHERE id=?').bind(historical).first('owner_operator_id')).toBeNull();
  // Historical ownership is never inferred: notes stay readable and undrafted.
  const notes='/api/releases/'+historical+'/notes';
  const read=await request(notes,'GET',undefined,cookie,sampleBindings);
  expect(read.status,await read.clone().text()).toBe(200);
  expect(await read.json()).toEqual({draft:null,canEdit:false,releaseChanged:false,ownerName:null});
  const refused=await request(notes,'POST',{expectedReleaseVersion:3},cookie,sampleBindings);
  expect(refused.status).toBe(409);expect((await refused.json() as {error:string}).error).toBe('release_owner_unqualified');
  expect(await env.DB.prepare('SELECT count(*) n FROM release_note_drafts').first('n')).toBe(0);
},180000);
