import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import {visibilityDatabase} from '../../roles/visibility-database';
import {slackCall,slackToken} from '../channels/provider';
import {IntegrationError} from '../errors';

export const linkSharedEvent=z.object({type:z.literal('link_shared'),channel:z.string().min(1).max(100),user:z.string().min(1).max(100),message_ts:z.string().max(100),unfurl_id:z.string().min(1).max(300),source:z.string().min(1).max(100),links:z.array(z.object({domain:z.string().max(300),url:z.string().max(3000)})).max(100)});
type Preview={identifier:string;title:string;status:string;assignee:string|null;priority:string};
/** Native visibility CTEs resolve every link using the sharing person's current
 * role and memberships. A Slack installation grants no content authority. */
export async function unfurlSlackLinks(env:WorkerBindings,signer:{workspace:string;encrypted:string},team:string,event:z.infer<typeof linkSharedEvent>,key:string){
 const installation=await env.DB.prepare('SELECT slack_team_id FROM vector_slack_installations WHERE workspace_id=? AND enabled=1').bind(signer.workspace).first<string>('slack_team_id');
 if(installation!==team)throw new IntegrationError(403,'slack_workspace_mismatch');
 const linked=await env.DB.prepare("SELECT l.operator_id FROM vector_slack_member_links l JOIN operators o ON o.id=l.operator_id AND o.workspace_id=l.workspace_id AND o.removed_at IS NULL JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id AND a.status='active' WHERE l.workspace_id=? AND l.slack_team_id=? AND l.slack_user_id=?").bind(signer.workspace,team,event.user).first<{operator_id:string}>();
 const unfurls:Record<string,unknown>={};
 if(linked){
  const db=visibilityDatabase(env.DB,linked.operator_id),origin=new URL(env.APP_ORIGIN).origin;
  for(const link of event.links){
   let url:URL;try{url=new URL(link.url);}catch{continue;}
   if(url.origin!==origin||url.username||url.password)continue;
   const match=/^\/app\/(issues|projects)\/([^/]+)\/?$/.exec(url.pathname);if(!match)continue;
   let id:string;try{id=decodeURIComponent(match[2]);}catch{continue;}
   const preview=match[1]==='issues'
    ?await db.prepare('SELECT i.identifier,i.title,s.name status,o.name assignee,i.priority FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id LEFT JOIN operators o ON o.id=i.assignee_operator_id WHERE i.identifier=? AND t.archived_at IS NULL AND i.archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM issue_deletions d WHERE d.issue_id=i.id)').bind(id).first<Preview>()
    :await db.prepare('SELECT p.id identifier,p.name title,p.lifecycle status,o.name assignee,p.priority FROM projects p LEFT JOIN operators o ON o.id=p.lead_operator_id WHERE p.id=? AND p.archived_at IS NULL').bind(id).first<Preview>();
   if(!preview)continue;
   // Plain text prevents titles and people names from becoming Slack markup.
   unfurls[link.url]={blocks:[{type:'section',text:{type:'plain_text',text:[preview.identifier,preview.title,'Status: '+preview.status,(match[1]==='issues'?'Assignee: ':'Lead: ')+(preview.assignee??'Unassigned'),'Priority: '+preview.priority].join('\n')}}]};
  }
 }
 // Reserve the identifier-only receipt before any provider effect. A failed or
 // uncertain send is never replayed automatically into a duplicate disclosure.
 try{await env.DB.prepare('INSERT INTO vector_slack_event_receipts(workspace_id,event_key,identifier,received_at) VALUES(?,?,?,?)').bind(signer.workspace,key,event.unfurl_id,new Date().toISOString()).run();}catch(error){if(await env.DB.prepare('SELECT 1 FROM vector_slack_event_receipts WHERE workspace_id=? AND event_key=?').bind(signer.workspace,key).first())throw new IntegrationError(409,'slack_event_replayed');throw error;}
 if(Object.keys(unfurls).length&&!await env.DB.prepare('SELECT 1 FROM vector_restore_status WHERE effects_held=1').first())await slackCall(await slackToken(env,signer.workspace),'chat.unfurl',{unfurl_id:event.unfurl_id,source:event.source,unfurls});
 return {ok:true};
}
