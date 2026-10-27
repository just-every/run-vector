import {channelBindingSource} from './subjects';
import type {channelNotPosting} from './schema';
import type {z} from 'zod';
export type ApprovalState={provider:'slack'|'discord';usable:number;slackEnabled:number|null;currentWorkspace:string|null;sourceAvailable:number};
/** Existing channel offers only current, unscoped Discord sources. */
export const sourceAvailableSql=(approval:string)=>`EXISTS(SELECT 1 FROM ${channelBindingSource} cb JOIN vector_webhook_destinations cd ON cd.id=cb.destination_id WHERE cb.workspace_id=${approval}.workspace_id AND cb.channel_name=${approval}.channel_name AND cd.kind='discord' AND cd.enabled=1 AND cd.revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM vector_initiative_scoped_bindings cs WHERE cs.destination_id=cd.id))`;
/** A retained approval is not a withdrawal: report the identity that stopped holding. */
export function approvalNotPosting(row:ApprovalState):z.infer<typeof channelNotPosting>|null{
 if(row.usable)return null;
 const code=row.provider==='discord'?'source_changed':!row.slackEnabled?'slack_disconnected':'workspace_changed';
 return {code,binderName:null,currentWorkspace:row.slackEnabled?row.currentWorkspace:null,sourceAvailable:Boolean(row.sourceAvailable)};
}
