import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {closureFixture} from './cycle-closure-fixture';
import {actor,bindings,invite} from './base-auth-fixture';
import {scheduled} from '../../src/core/app/scheduled';
import {archiveDeletionHistory} from './http-archive-deletion';
/** Populated source built through ordinary product doors; synthetic historic
 * file/evidence/delivery rows exercise exact preservation without provider calls. */
export async function populatedHttpSource() {
 const f=await closureFixture(),peerCookie=await invite('peer@http-archive.test',f.cookie),peer=await actor(peerCookie);
 expect((await f.call('/setup/complete','POST',{confirmed:true})).status).toBe(200);
 const configured=await f.call('/settings/integrations/destinations','POST',{name:'HTTP receiver',url:'https://receiver.example.com/events'});expect(configured.status).toBe(201);
 const webhook=(await configured.json() as {id:string}).id;
 const project=(await f.mutate('/settings/projects','POST',{name:'HTTP preserved project',leadOperatorId:f.owner})).projects[0];
 const issue=await f.create({title:'HTTP preserved history',description:'Searchable issue',statusId:f.team.statuses.find(s=>s.category==='unstarted')!.id,cycleId:f.closing.id,projectId:project.id,estimate:5,assigneeOperatorId:f.owner,dueDate:'2026-09-07'});
 const at='2026-09-02T00:00:00.000Z',closedAt='2026-09-08T00:01:00.000Z';
 await env.DB.prepare('UPDATE cycle_membership_events SET occurred_at=? WHERE identifier=?').bind(at,issue.identifier).run();
 await scheduled({scheduledTime:Date.parse(closedAt)},bindings);
 const closed=await f.detail();expect(closed.snapshot?.committed).toHaveLength(1);
 const deferred=await f.create({title:'HTTP deferred intake',assigneeOperatorId:peer,dueDate:'2026-09-07'});
 expect((await env.DB.prepare('SELECT count(*) AS n FROM due_reminders WHERE issue_id=?').bind(issue.id).first())?.n).toBe(1);
 const workspace=await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id');
 await env.DB.batch([
  env.DB.prepare('INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('http-comment',issue.id,peer,'HTTP searchable discussion',at,at),
  env.DB.prepare('INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('http-file',issue.id,f.owner,'evidence.bin','application/octet-stream',4,'http-archive-file',at,at),
  env.DB.prepare('UPDATE issues SET deferred_until=? WHERE id=?').bind(at,deferred.id),
  env.DB.prepare("INSERT INTO due_reminder_suppressions(issue_id,due_date,kind,operator_id,created_at) VALUES(?,'2026-09-07','overdue',?,?)").bind(deferred.id,peer,at),
  env.DB.prepare('INSERT INTO evidence_revisions(id,issue_id,source_name,observed_at,received_at,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('http-evidence',issue.id,'Synthetic acceptance',at,at,'HTTP evidence revision',at,at),
  env.DB.prepare("INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,is_shared,created_at,updated_at) VALUES(?,?,?,'HTTP archived view','issues',1,?,?)").bind('http-view',workspace,f.owner,at,at),
  env.DB.prepare("INSERT INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at) VALUES('http-notification','http-event',?,?,?,'Owner','[\"mention\"]',?)").bind(issue.id,peer,f.owner,at),
  env.DB.prepare("INSERT INTO notification_deliveries(id,notification_id,recipient_id,actor_id,actor_name,identifier,title,app_link,status,attempts,created_at,updated_at) VALUES('http-delivery','http-notification',?,?,'Owner',?,'HTTP history',?,'pending',0,?,?)").bind(peer,f.owner,issue.identifier,bindings.APP_ORIGIN+'/app/issues/'+issue.identifier,at,at),
 ]);
 const envelope=JSON.stringify({id:'http-webhook',tenant:workspace,destinationId:webhook,event:'issue.created',protocol:'webhook',body:JSON.stringify({identifier:issue.identifier})});
 await env.DB.prepare("INSERT INTO integration_deliveries(namespace,id,fingerprint,destination_hash,envelope,state,attempts,created_at,next_at,max_attempts,retry_delays) VALUES(?,'http-webhook','http-fingerprint','http-destination',?,'queued',0,0,0,3,'[1000,2000]')").bind(workspace,envelope).run();
 await env.DB.prepare("UPDATE issue_files SET removal_requested_at=? WHERE id='http-file'").bind(at).run();
 await env.FILES.put('http-archive-file',new Uint8Array([0,1,2,255]),{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{evidence:'http-roundtrip'}});
 const deletion=await archiveDeletionHistory(f);
 return {...f,peerCookie,peer,issue,closed,project,webhook,...deletion};
}
