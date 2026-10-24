import type {WorkerBindings} from '../../app/bindings';
/** Workspace webhooks have no reader identity: private work cannot leave them. */
export async function publicWebhookEvent(env:WorkerBindings,workspace:string,body:string) {
 const event=JSON.parse(body) as {identifier?:string};
 if(!event.identifier)return true;
 return !!await env.DB.prepare('SELECT 1 FROM main.issues i JOIN main.teams t ON t.id=i.team_id WHERE i.identifier=? AND t.workspace_id=? AND t.is_private=0').bind(event.identifier,workspace).first();
}
