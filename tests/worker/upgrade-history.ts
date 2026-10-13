import {env} from 'cloudflare:workers'
import {expect} from 'vitest'
import {historicalAuth,legacyCookie} from './historical-auth-fixture'
import {testCookie} from './native-fixture'
import {vectorSampleIds as ids} from '../../sample-data/vector'
/** Prior-schema history, deliberately created without the current mail runtime. */
export async function populateUpgradeHistory() {
 const now=new Date().toISOString(),owner=(await env.DB.prepare('SELECT email,workspace_id FROM operators WHERE id=?').bind(ids.sarah).first<{email:string,workspace_id:string}>())!;
 const {invite}=await historicalAuth(owner.email);await invite('pending@upgrade.test');await invite('accepted@upgrade.test',true);await legacyCookie(ids.sarah);
 const removed='01J00000000000000000000771';
 await env.DB.prepare('INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(removed,owner.workspace_id,'Removed history','removed@upgrade.test',now,now).run();
 await testCookie(env.DB,removed);
 await env.DB.prepare("UPDATE operators SET removed_at=?,name='Removed operator',email='removed-history@removed.invalid' WHERE id=?").bind(now,removed).run();
 await env.DB.prepare('INSERT INTO operator_removals VALUES(?,?,?,?,?,?)').bind('history-removal',removed,owner.workspace_id,ids.sarah,ids.sarah,now).run();
 await env.DB.prepare("INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES('history-comment',?,?,'Searchable upgrade history',?,?)").bind(ids.flw842,ids.sarah,now,now).run();
 await env.DB.prepare("INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,writer_settled,created_at,updated_at) VALUES('history-file',?,?,'history.txt','text/plain',4,'history-key','ready',1,?,?)").bind(ids.flw842,ids.sarah,now,now).run();
 for(const status of ['accepted','uncertain','pending','development']) {
  const id='history-'+status;
  await env.DB.prepare("INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,created_at,updated_at,actor_name) VALUES(?,?,?,'issue.assignee_changed',?,?,'Sarah')").bind(id,ids.flw842,ids.sarah,now,now).run();
  await env.DB.prepare('INSERT INTO notification_events VALUES(?,?)').bind(id,now).run();
  await env.DB.prepare("INSERT INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at) VALUES(?,?,?,?,?,'Sarah','[\"assignment\"]',?)").bind(id,id,ids.flw842,ids.maya,ids.sarah,now).run();
  await env.DB.prepare("INSERT INTO notification_deliveries(id,notification_id,recipient_id,actor_id,actor_name,identifier,title,app_link,status,attempts,claim_token,created_at,updated_at) VALUES(?,?,?,?,'Sarah','FLW-842','Retained title','http://127.0.0.1/app/issues/FLW-842',?,?,?, ?,?)").bind(id,id,ids.maya,ids.sarah,status,status==='pending'?0:1,status==='pending'?null:id,now,now).run();
  if(status!=='pending') await env.DB.prepare('INSERT INTO notification_delivery_attempts(id,delivery_id,number,status,started_at,settled_at) VALUES(?,?,1,?,?,?)').bind(id,id,status,now,now).run();
  if(['accepted','development'].includes(status))await env.DB.prepare("INSERT INTO notification_mail_audit VALUES(?,'notification.mail','FLW-842',?,?)").bind(id,status,now).run();
  if(status==='development')await env.DB.prepare("INSERT INTO notification_development_mail VALUES(?,'maya@vector.test','Retained title','Historical capture',?)").bind(id,now).run();
 }
 for(const table of ['evidence_revisions','intake_decisions','team_issue_sequences','team_issue_history','saved_views','list_preferences','oa_tokens','oa_sessions','operator_sessions','operator_removals','issue_comments','issue_files','notification_deliveries','notification_delivery_attempts','notification_mail_audit','local_mail_outbox','notification_development_mail','search_issues'])
  expect(await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first('n'),table).toBeGreaterThan(0);
 expect(await env.DB.prepare('SELECT count(*) n FROM oa_sessions WHERE revoked_at IS NOT NULL').first('n')).toBeGreaterThan(0);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}
export async function historySnapshot(exclude:string[]=[]) {
 const names=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results.filter(({name})=>!exclude.includes(name));
 return Promise.all(names.map(async({name})=>({name,rows:await tableSnapshot(name)})));
}

export async function tableSnapshot(name:string) {
 const columns=(await env.DB.prepare(`PRAGMA table_info("${name}")`).all<{name:string}>()).results;
 const order=columns.map(column=>`"${column.name.replaceAll('"','""')}"`).join(',');
 return (await env.DB.prepare(`SELECT * FROM "${name}" ORDER BY ${order}`).all()).results;
}
