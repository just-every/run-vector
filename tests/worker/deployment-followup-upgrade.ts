import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {expect,inject} from 'vitest';
import {insertHistoricalSample} from './historical-sample-fixture';
import {bindings} from './base-auth-fixture';
import {scheduled} from '../../src/core/app/scheduled';
import {createVectorArchive} from '../../src/core/features/data/archive-service.mjs';

const tables=async(db:D1Database)=>(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' ORDER BY name").all<{name:string}>()).results;
async function snapshot(db:D1Database){
 const rows=[] as {name:string;columns:string;rows:unknown[]}[];
 for(const {name} of await tables(db)){
  const columns=(await db.prepare('PRAGMA table_info("'+name+'")').all<{name:string}>()).results.map(c=>'"'+c.name+'"').join(',');
  rows.push({name,columns,rows:(await db.prepare('SELECT '+columns+' FROM "'+name+'" ORDER BY '+columns).all()).results});
 }
 return rows;
}

/** PUSH-003: cross the 0113 head with populated notification preferences,
 * channel choices and merged GitHub history. Every row survives the Inbox-kind
 * rebuild, populated follow-up tables export, and a completed restore never
 * asks about a restored merge. */
export async function proveDeploymentFollowupUpgrade(){
 const db=env.ARCHIVE_TARGET_DB,migrations=inject('migrations'),boundary=migrations.findIndex(m=>m.name==='0114_deployment_followups.sql');
 expect(boundary).toBeGreaterThan(0);
 await applyD1Migrations(db,migrations.slice(0,boundary));
 await insertHistoricalSample(db,new Date('2026-10-01T00:00:00Z'));
 const workspace=(await db.prepare('SELECT id FROM workspace_settings').first<{id:string}>())!.id;
 const owner=(await db.prepare("SELECT id FROM operators WHERE role='owner' ORDER BY id LIMIT 1").first<{id:string}>())!.id;
 const issue=(await db.prepare('SELECT id,team_id AS team FROM issues ORDER BY id LIMIT 1').first<{id:string;team:string}>())!;
 const at='2026-10-02T00:00:00.000Z',merge='ab'.repeat(20);
 await db.batch([
  db.prepare("INSERT INTO notification_type_mutes(operator_id,kind) VALUES(?,'reminder')").bind(owner),
  db.prepare("INSERT INTO notification_channel_defaults(workspace_id,kind,email_mode,slack_enabled) VALUES(?,'comment','daily',0)").bind(workspace),
  db.prepare("INSERT INTO notification_channel_overrides(operator_id,kind,email_mode,slack_enabled) VALUES(?,'mention','hourly',1)").bind(owner),
  db.prepare("INSERT INTO vector_github_repositories(id,workspace_id,repository,name,enabled,created_at,updated_at) VALUES('01K00000000000000000000020',?,'octocat/test-repo1','synthetic-vector-1920',1,?,?)").bind(workspace,at,at),
  db.prepare("INSERT INTO vector_github_pull_requests(repository_id,number,title,url,state,updated_at,received_at,merge_sha) VALUES('01K00000000000000000000020',7,'synthetic-vector-1921','https://github.com/octocat/test-repo1/pull/7','merged',?,?,?)").bind(at,at,merge),
  db.prepare("INSERT INTO vector_github_issue_links(repository_id,number,issue_id,created_at,relation) VALUES('01K00000000000000000000020',7,?,?,'closes')").bind(issue.id,at),
 ]);
 const retained=await snapshot(db);
 for(const name of ['notification_type_mutes','notification_channel_defaults','notification_channel_overrides','vector_github_pull_requests'])
  expect(retained.find(row=>row.name===name)!.rows.length,name).toBeGreaterThan(0);
 await applyD1Migrations(db,migrations.slice(boundary));
 for(const row of retained)expect((await db.prepare('SELECT '+row.columns+' FROM "'+row.name+'" ORDER BY '+row.columns).all()).results,row.name+' retained at 0113').toEqual(row.rows);
 expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
 // The rebuilt preferences now admit the new Inbox kind.
 await db.prepare("INSERT INTO notification_type_mutes(operator_id,kind) VALUES(?,'deployment_question')").bind(owner).run();
 // A team window and a waiting merge watch, as an archive from the source would carry them.
 await db.batch([
  db.prepare('INSERT INTO team_deployment_followups(team_id,window_hours,enabled_at,configured_by,version,updated_at) VALUES(?,1,?,?,1,?)').bind(issue.team,'2026-10-01T00:00:00.000Z',owner,at),
  db.prepare("INSERT INTO deployment_followup_watches(repository_id,sha,issue_id,pull_number,merged_at,recorded_at) VALUES('01K00000000000000000000020',?,?,7,?,?)").bind(merge,issue.id,at,at),
 ]);
 const archive=await createVectorArchive({db,files:env.ARCHIVE_TARGET_FILES}),id=await archive.exports.create();
 while((await archive.exports.advance(id,{maxParts:16})).phase==='building'){}
 expect((await archive.exports.status(id)).phase).toBe('complete');await archive.exports.abort(id);
 // Completing a restore restarts the enabled window: the restored merge, now
 // past its window with an active assignee, is never asked about.
 await db.batch([
  db.prepare("INSERT INTO rer_portability_jobs(id,kind,actor,phase,completed,metadata) VALUES('synthetic-vector-1922','import','synthetic-vector-1922','applying',0,'{}')"),
  db.prepare("UPDATE rer_portability_jobs SET phase='complete' WHERE id='synthetic-vector-1922'"),
  db.prepare('UPDATE issues SET assignee_operator_id=? WHERE id=?').bind(owner,issue.id),
 ]);
 expect(Date.parse((await db.prepare('SELECT enabled_at FROM team_deployment_followups WHERE team_id=?').bind(issue.team).first<string>('enabled_at'))!)).toBeGreaterThan(Date.parse(at));
 await scheduled({scheduledTime:Date.parse('2026-12-01T00:00:00.000Z')},{...bindings,DB:db});
 expect(await db.prepare('SELECT asked_at FROM deployment_followup_watches WHERE issue_id=?').bind(issue.id).first('asked_at')).toBeNull();
 expect(await db.prepare("SELECT count(*) AS n FROM issue_activity WHERE kind='deployment.followup_asked'").first<number>('n')).toBe(0);
}
