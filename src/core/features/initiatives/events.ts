import type {Initiative} from './schema';
import {createUlid} from '../../shared/ids';
type InitiativeEvent={workspace:string;actor:string;id:string;name:string;at:string;event:'initiative.created'|'initiative.updated'|'initiative.projects_changed';change:string};
/** Joined to the source write batch, never published before its version fences commit. */
export function initiativeEvent(db:D1Database,input:InitiativeEvent){
 const eventId=createUlid(new Date(input.at));
 return db.prepare(`INSERT INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
 SELECT ?||':'||d.id,b.workspace_id,d.id,?,json_object('initiativeId',?,'initiativeName',?,'actorId',?,'actor',o.name,'change',?,'changeKind',?),?
 FROM vector_initiative_channel_bindings b JOIN vector_webhook_destinations d ON d.id=b.destination_id
 JOIN operators o ON o.id=? AND o.workspace_id=b.workspace_id AND o.removed_at IS NULL
 WHERE b.workspace_id=? AND b.object_id=? AND d.enabled=1 AND d.revoked_at IS NULL
 AND EXISTS(SELECT 1 FROM json_each(b.events) WHERE value=?)
 AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=0))
 ON CONFLICT(id) DO NOTHING`).bind(eventId,input.event,input.id,input.name,input.actor,input.change,input.event==='initiative.projects_changed'?'projects':'initiative',input.at,input.actor,input.workspace,input.id,input.event);
}

/** Describe changed fields without sending their free text or related object names. */
export function initiativeChange(previous:Initiative,next:Initiative){
 const fields=[['name','Name'],['description','Description'],['ownerOperatorId','Owner'],['parentId','Parent'],['targetDate','Target date']] as const;
 const changes=fields.filter(([field])=>previous[field]!==next[field]).map(([,label])=>label+' changed');
 if(previous.status!==next.status)changes.push('Status: '+previous.status+' → '+next.status);
 return 'Initiative updated'+(changes.length?' · '+changes.join('; '):'');
}
