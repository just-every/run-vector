import type {WorkerBindings} from '../../app/bindings';
import {settingsActor} from '../settings/repository';
import {visibleRecipient,activeRecipient} from '../notifications/events';
import {notificationContext} from '../notifications/context';
import {visibilityDatabase} from '../roles/visibility-database';
import {issueListQuerySchema} from '../issues/list-schema';
import {browseWhere} from '../issues/browse-sql';
import {workspaceDate} from '../issues/browse-access';
import {gitGuard} from '../integrations/github/rules';
import type {Subscription} from './schema';
type Predicate={sql:string;values:(string|number|null)[]};
const effects="NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1) AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)";
/** Materialize one member's new event recipients. The existing channel router,
 * mail, digest and Slack pipeline own every external effect. */
export async function processMemberSubscriptions(env:WorkerBindings,actor:string,db=env.DB){
 const access=await settingsActor(db,actor);
 const rows=(await db.prepare('SELECT id,subject_type AS subjectType,subject_id AS subjectId,start_revision AS startRevision FROM subject_subscriptions WHERE operator_id=?').bind(actor).all<Subscription>()).results;
 if(!rows.length)return 0;
 const timezone=await db.prepare('SELECT timezone FROM workspace_settings WHERE id=?').bind(access.workspace_id).first<string>('timezone');
 const predicates:Predicate[]=[],guards:D1PreparedStatement[]=[];
 for(const sub of rows){
  const own='EXISTS(SELECT 1 FROM subject_subscriptions subscription WHERE subscription.id=? AND subscription.operator_id=o.id AND subscription.start_revision<e.revision)';
  let test:Predicate;
  if(sub.subjectType==='team')test={sql:'i.team_id=?',values:[sub.subjectId]};
  else if(sub.subjectType==='project')test={sql:'i.project_id=? AND EXISTS(SELECT 1 FROM projects WHERE id=?)',values:[sub.subjectId,sub.subjectId]};
  else if(sub.subjectType==='label')test={sql:'EXISTS(SELECT 1 FROM issue_labels label WHERE label.issue_id=i.id AND label.label_id=?)',values:[sub.subjectId]};
  else if(sub.subjectType==='initiative')test={sql:`EXISTS(WITH RECURSIVE tree(id) AS (SELECT id FROM initiatives WHERE id=? AND workspace_id=? UNION ALL SELECT n.id FROM initiatives n JOIN tree parent ON n.parent_id=parent.id) SELECT 1 FROM tree JOIN initiative_projects link ON link.initiative_id=tree.id WHERE link.project_id=i.project_id) AND o.role<>'guest'`,values:[sub.subjectId,access.workspace_id]};
  else if(sub.subjectType==='view'){
   const view=await db.prepare('SELECT filters_json,sort,grouping FROM saved_views WHERE id=? AND workspace_id=? AND (owner_operator_id=? OR is_shared=1)').bind(sub.subjectId,access.workspace_id,actor).first<{filters_json:string;sort:string;grouping:string}>();
   if(!view)continue;
   const query=issueListQuerySchema.parse({...JSON.parse(view.filters_json),sort:view.sort,grouping:view.grouping});
   const {relation,values}=browseWhere(query,access.workspace_id,workspaceDate(new Date(),timezone!),actor);
   test={sql:'EXISTS(SELECT 1 '+relation+' AND i.id=e.issue_id)',values};
   guards.push(gitGuard(db,'EXISTS(SELECT 1 FROM saved_views WHERE id=? AND filters_json=? AND sort=? AND grouping=? AND (owner_operator_id=? OR is_shared=1))',sub.subjectId,view.filters_json,view.sort,view.grouping,actor));
  }
  else continue;
  predicates.push({sql:'('+own+' AND '+test.sql+')',values:[sub.id,...test.values]});
 }
 const pending=(await db.prepare(`SELECT e.event_id FROM subscription_events e JOIN issues i ON i.id=e.issue_id JOIN teams t ON t.id=i.team_id
 WHERE t.workspace_id=? AND e.revision>? AND e.revision>COALESCE((SELECT subscription_revision FROM vector_restore_status WHERE id=1),0)
 AND NOT EXISTS(SELECT 1 FROM subscription_event_receipts receipt WHERE receipt.event_id=e.event_id AND receipt.operator_id=?)
 AND ${effects} ORDER BY e.revision,e.event_id LIMIT 5`).bind(access.workspace_id,Math.min(...rows.map(r=>r.startRevision)),actor).all<{event_id:string}>()).results;
 for(const event of pending){
  const id=crypto.randomUUID().replaceAll('-','');
  await db.batch([...guards,
   db.prepare(`INSERT OR IGNORE INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at)
    SELECT ?,e.event_id,i.id,o.id,a.actor_operator_id,COALESCE((SELECT name FROM operators WHERE id=a.actor_operator_id),a.actor_name),json_array(e.kind),e.created_at
    FROM subscription_events e JOIN issue_activity a ON a.id=e.event_id JOIN issues i ON i.id=e.issue_id JOIN teams t ON t.id=i.team_id JOIN operators o ON o.id=? AND o.workspace_id=t.workspace_id
    WHERE e.event_id=? AND ${visibleRecipient} AND (a.actor_operator_id IS NULL OR a.actor_operator_id<>o.id) AND ${effects}
    AND NOT EXISTS(SELECT 1 FROM subscription_event_receipts receipt WHERE receipt.event_id=e.event_id AND receipt.operator_id=o.id)
    AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes mute WHERE mute.issue_id=i.id AND mute.operator_id=o.id)
    AND NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind=e.kind)
    AND (${predicates.map(p=>p.sql).join(' OR ')||'0'})`).bind(id,actor,event.event_id,...predicates.flatMap(p=>p.values)),
   db.prepare(`INSERT OR IGNORE INTO subscription_event_receipts(event_id,operator_id)
    SELECT e.event_id,o.id FROM subscription_events e JOIN issues i ON i.id=e.issue_id JOIN teams t ON t.id=i.team_id JOIN operators o ON o.id=? AND o.workspace_id=t.workspace_id
    WHERE e.event_id=? AND ${visibleRecipient} AND ${effects}`).bind(actor,event.event_id),
   db.prepare('INSERT OR IGNORE INTO notification_events(event_id,created_at) SELECT event_id,created_at FROM subscription_events WHERE event_id=?').bind(event.event_id)]);
  const context=notificationContext(db);context?.eventIds.add(event.event_id);context?.directEventIds.add(event.event_id);
 }
 return pending.length;
}
export async function processSubscriptionQueue(env:WorkerBindings){
 const members=(await env.DB.prepare(`SELECT DISTINCT o.id FROM subject_subscriptions s JOIN operators o ON o.id=s.operator_id
 WHERE ${activeRecipient} AND EXISTS(SELECT 1 FROM subscription_events e JOIN issues i ON i.id=e.issue_id JOIN teams t ON t.id=i.team_id WHERE t.workspace_id=o.workspace_id AND ${visibleRecipient} AND e.revision>s.start_revision
 AND e.revision>COALESCE((SELECT subscription_revision FROM vector_restore_status WHERE id=1),0)
 AND NOT EXISTS(SELECT 1 FROM subscription_event_receipts r WHERE r.event_id=e.event_id AND r.operator_id=o.id))
 ORDER BY o.id LIMIT 25`).all<{id:string}>()).results;
 for(const member of members)await processMemberSubscriptions(env,member.id,visibilityDatabase(env.DB,member.id));
}
