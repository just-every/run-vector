import {z} from 'zod';
// Only these events are sent: issue events by the vector_channel_event trigger (0073), initiative events by initiatives/events.ts.
export const channelEvents=['triage.created','issue.created','issue.status_changed','initiative.updated','initiative.created','initiative.projects_changed'] as const;
// Historical bindings and restored archives remain readable; events Vector never sends
// are explained in Settings, but can never be selected for a new binding.
const storedChannelEvents=[...channelEvents,'project.updated','release.published','sla.warning','agent.completed'] as const;
export const channelEventLabels:Record<typeof storedChannelEvents[number],string>={'triage.created':'New triage item','issue.created':'New issue','issue.status_changed':'Status change','project.updated':'Project update','release.published':'Release','sla.warning':'SLA warning','agent.completed':'Agent completion','initiative.updated':'Initiative update','initiative.created':'Initiative created','initiative.projects_changed':'Initiative projects changed'};
type ChannelEvent=typeof channelEvents[number];
/** The events an object can post and its pre-checked choice. Initiatives post only initiative events; teams, projects and saved views only issue events. */
export function scopeEvents(scope:string):{events:readonly ChannelEvent[];checked:readonly ChannelEvent[]}{
 return scope==='initiative'?{events:['initiative.created','initiative.updated','initiative.projects_changed'],checked:['initiative.updated']}:{events:channelEvents.filter(event=>!event.startsWith('initiative.')),checked:['triage.created','issue.created','issue.status_changed']};
}
export const bindingInput=z.object({scope:z.enum(['team','project','view','initiative']),objectId:z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),provider:z.enum(['slack','discord']),channelId:z.string().regex(/^[CG][A-Z0-9]{2,30}$/).optional(),channelName:z.string().trim().min(1).max(120),webhookUrl:z.string().max(2048).optional(),events:z.array(z.enum(channelEvents)).min(1).max(channelEvents.length).refine(v=>new Set(v).size===v.length)}).strict();
const ulid=z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),slackChannel=z.string().regex(/^[CG][A-Z0-9]{2,30}$/);
export const initiativeChannelEvents=['initiative.created','initiative.updated','initiative.projects_changed'] as const;
/** An Owner or Admin names one existing destination, one initiative and the permitted audience. */
export const approvalInput=z.discriminatedUnion('provider',[
 z.object({provider:z.literal('slack'),initiativeId:ulid,channelId:slackChannel,audience:z.literal('workspace')}).strict(),
 z.object({provider:z.literal('discord'),initiativeId:ulid,destinationId:ulid,audience:z.literal('workspace')}).strict(),
]);
/** The scoped capability names an approved identity; a display name is never identity. */
export const initiativeBindingInput=z.object({provider:z.enum(['slack','discord']),channelId:z.string().regex(/^(?:[CG][A-Z0-9]{2,30}|\d{1,25})$/),channelName:z.string().trim().min(1).max(120).optional(),events:z.array(z.enum(initiativeChannelEvents)).min(1).max(initiativeChannelEvents.length).refine(v=>new Set(v).size===v.length),expectedVersion:ulid.nullable()}).strict();
export const initiativeBindingWithdrawal=z.object({expectedVersion:ulid}).strict();
const approvedDestination=z.object({provider:z.enum(['slack','discord']),channelId:z.string(),channelName:z.string()});
export const channelNotPosting=z.object({code:z.enum(['approval_withdrawn','approved_again','workspace_changed','binder_cannot_edit']),binderName:z.string().nullable(),approvedWorkspace:z.string().nullable(),currentWorkspace:z.string().nullable()});
/** Plain next steps shared by the scoped panel and the Settings read. */
export function notPostingMessage(reason:z.infer<typeof channelNotPosting>,channel:string,owner=false){
 switch(reason.code){
  case 'approved_again':return `#${channel} is approved again. ${owner?'The Member saves again to post there.':'Save to post there.'}`;
  case 'approval_withdrawn':return `The approval for #${channel} was withdrawn. An Owner or Admin can approve it again; ${owner?'the Member then saves again.':'then save to post there.'}`;
  case 'workspace_changed':return `${owner?`Its approval is for Slack workspace ${reason.approvedWorkspace}. `:''}Slack is now connected to ${reason.currentWorkspace??'another workspace'}. ${owner?'Approve a channel in the current Slack workspace; the Member then saves again.':'An Owner or Admin must approve a channel there; then save again.'}`;
  case 'binder_cannot_edit':return `${reason.binderName??'The person who saved this channel'} can no longer edit this initiative. ${owner?'Save on the initiative to post as yourself.':'Save to post as yourself.'}`;
 }
}
export const initiativeBindingState=z.object({destinations:z.array(approvedDestination),binding:approvedDestination.extend({id:z.string(),events:z.array(z.enum(channelEvents)),live:z.boolean(),notPosting:channelNotPosting.nullable()}).nullable(),version:z.string().nullable()});
export const channelConfiguration=z.object({approvals:z.array(approvedDestination.extend({id:z.string(),initiativeId:z.string(),initiativeName:z.string(),audience:z.literal('workspace'),usable:z.boolean(),notPosting:channelNotPosting.nullable()})),allowedChannels:z.array(z.object({channelId:z.string(),channelName:z.string()})),slack:z.object({connected:z.boolean(),needsAttention:z.boolean(),teamName:z.string().nullable(),signingSecret:z.boolean(),interactivityUrl:z.string()}),bindings:z.array(z.object({id:z.string(),scope:z.string(),objectId:z.string(),objectName:z.string(),provider:z.string(),channelId:z.string(),channelName:z.string(),suspendedReason:z.string().nullable(),events:z.array(z.enum(storedChannelEvents)),needsAttention:z.boolean(),scoped:z.boolean(),notPosting:channelNotPosting.nullable()})),objects:z.array(z.object({id:z.string(),name:z.string(),scope:z.enum(['team','project','view','initiative'])}))});
