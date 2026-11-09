import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {expect,inject} from 'vitest';
import {insertHistoricalSample} from './historical-sample-fixture';
/** Upgrade a populated prior schema without manufacturing mappings or sends. */
export async function slackThreadUpgrade(){
 const db=env.ARCHIVE_TARGET_DB,migrations=inject('migrations'),boundary=migrations.findIndex(m=>m.name==='0134_slack_threads.sql');
 expect(boundary).toBeGreaterThan(0);
 await applyD1Migrations(db,migrations.slice(0,boundary));
 await insertHistoricalSample(db,new Date('2026-10-01T00:00:00Z'));
 const issue=await db.prepare('SELECT i.id,t.workspace_id FROM issues i JOIN teams t ON t.id=i.team_id LIMIT 1').first<any>();
 const actor=await db.prepare('SELECT id FROM operators WHERE workspace_id=? LIMIT 1').bind(issue.workspace_id).first<string>('id');
 await db.prepare("INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES('synthetic-vector-upgrade-root',?,?,?,'2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')").bind(issue.id,actor,'Retained prior comment').run();
 const tables=(await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' ORDER BY name").all<{name:string}>()).results;
 const before=await db.batch(tables.map(t=>db.prepare('SELECT * FROM "'+t.name+'"')));
 await applyD1Migrations(db,migrations.slice(boundary));
 const after=await db.batch(tables.map(t=>db.prepare('SELECT * FROM "'+t.name+'"')));
 // 0136 adds hierarchy columns after this fixture's 0134 boundary. Compare
 // every old value and each new default; keep the complete latest-head upgrade.
 const added:Record<string,Record<string,unknown>>={
  teams:{parent_team_id:null,workflow_inherited:0,permissions_inherited:0,hierarchy_version:1},
  workflow_statuses:{inherited_from:null},
 };
 for(let n=0;n<tables.length;n++)expect(after[n].results,tables[n].name).toEqual(before[n].results.map(row=>({...row,...added[tables[n].name]})));
 for(const table of ['vector_slack_threads','vector_slack_thread_messages','vector_slack_thread_events'])expect(await db.prepare('SELECT count(*) n FROM '+table).first<number>('n')).toBe(0);
 expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}
