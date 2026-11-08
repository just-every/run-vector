import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {bindings} from './base-auth-fixture';
import {slackIntakeFixture as slack} from './slack-events-scenario';
import {dispatchWebhooks,outboundService} from '../../src/core/features/integrations/outbound';
/** One public-door scenario shares its installed fixture and observes actual provider posts. */
export async function slackThreadSafety(p:any){
 const {f,read,send,snapshot,callback,identifier,issue,root,rootTs,operatorId,nativeReply,posts}=p;
 const workspace=await env.DB.prepare('SELECT workspace_id FROM teams WHERE id=?').bind(issue.teamId).first<string>('workspace_id');
 for(const event of [callback({type:'message',user:slack.unlinked,ts:'1794124900.000006',thread_ts:rootTs,text:'No identity'}),callback({type:'app_mention',channel:slack.unmapped,ts:'1794124900.000007',text:'No binding'})]){
  const before=await snapshot();await read(await send(event),403);expect(await snapshot()).toEqual(before);
 }
 // Queued references cannot preserve a comment after it is erased.
 const erased=await nativeReply('Erased before transport',root);
 await read(await f.call('/issues/'+identifier+'/comments/'+erased.id,'DELETE'));
 const mark=posts().length;await dispatchWebhooks(bindings);expect(posts()).toHaveLength(mark);
 // Privacy is re-projected after enqueue. Private threads receive statuses,
 // never a reply body, title, actor name or resolved marker.
 await nativeReply('Private pending content',root);
 await read(await f.call('/settings/teams/'+issue.teamId+'/privacy','PUT',{isPrivate:true}));
 await read(await f.call('/settings/teams/'+issue.teamId+'/members/'+operatorId,'PUT',{role:'member'}));
 await nativeReply('Private second pending content',root);
 const current=await read(await f.call('/issues/'+identifier));
 const status=(await env.DB.prepare('SELECT id,name FROM workflow_statuses WHERE team_id=? AND id<>? AND category=\'unstarted\' LIMIT 1').bind(issue.teamId,current.status.id).first<any>())!;
 await read(await f.call('/issues/'+identifier,'PATCH',{expectedVersion:current.version,statusId:status.id}));
 await dispatchWebhooks(bindings);
 const privatePosts=posts().slice(mark);expect(privatePosts).toHaveLength(2);
 expect(privatePosts.every((c:any)=>c.body.text===identifier+' · Status: '+status.name)).toBe(true);
 expect(JSON.stringify(privatePosts)).not.toContain(issue.title);expect(JSON.stringify(privatePosts)).not.toContain('Private pending content');
 // Removing the mapped member from the private team stops both inbound and
 // already queued outbound work, while the original source remains intact.
 await nativeReply('Withdrawn member pending content',root);
 await read(await f.call('/settings/teams/'+issue.teamId+'/members/'+operatorId,'DELETE'));
 const withdrawn=await snapshot();await read(await send(callback({type:'message',ts:'1794124900.000008',thread_ts:rootTs,text:'Withdrawn'})),403);expect(await snapshot()).toEqual(withdrawn);
 const beforeWithdrawal=posts().length;await dispatchWebhooks(bindings);expect(posts()).toHaveLength(beforeWithdrawal);
 await read(await f.call('/settings/teams/'+issue.teamId+'/privacy','PUT',{isPrivate:false}));
 // Revoking a member link makes queued sends inert. Re-linking with a new epoch
 // cannot resurrect this historical mapping.
 await nativeReply('Unlinked pending content',root);
 await read(await f.call('/settings/integrations/slack/app/members/'+operatorId,'DELETE'));
 const beforeUnlink=posts().length;await dispatchWebhooks(bindings);expect(posts()).toHaveLength(beforeUnlink);
 const unlinked=await snapshot();await read(await send(callback({type:'message',ts:'1794124900.000009',thread_ts:rootTs,text:'Unlinked'})),403);expect(await snapshot()).toEqual(unlinked);
 await read(await f.call('/settings/integrations/slack/app/members','POST',{operatorId,slackTeamId:slack.team,slackUserId:slack.user}));
 await nativeReply('Historical mapping after re-link',root);await dispatchWebhooks(bindings);expect(posts()).toHaveLength(beforeUnlink);
 // The global restore hold refuses an incoming mutation without any storage
 // write and prevents all outbound effects, including a newly re-linked thread.
 await env.DB.prepare("INSERT INTO vector_restore_status(id,import_id,effects_held,reviewed_at) VALUES(1,'synthetic-vector-thread-restore',1,?)").bind(new Date().toISOString()).run();
 const held=await snapshot();const response=await send(callback({type:'app_mention',ts:'1794124900.000010',text:'Held filing'}));expect([401,403,503]).toContain(response.status);expect(await snapshot()).toEqual(held);
 const heldPosts=posts().length;await dispatchWebhooks(bindings);expect(posts()).toHaveLength(heldPosts);
 await env.DB.prepare('UPDATE vector_restore_status SET effects_held=0').run();
 expect(await env.DB.prepare('SELECT count(*) n FROM vector_slack_thread_holds').first<number>('n')).toBeGreaterThan(0);
 await env.DB.prepare('DELETE FROM vector_restore_status').run();
 expect((await outboundService(bindings,workspace!).get('not-an-event'))).toBeNull();
}
