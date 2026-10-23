import type {FormEvent} from "react";
import type {Administration} from "../../administration/schema";
import {teamAccess} from "./team-access";
import {useAdministrationAction} from "./administration-action";
import {AdministrationFeedback} from "./administration-feedback";
type Team=Administration["teams"][number];
export function TeamJoinRules({data,team,onChanged}:{data:Administration;team:Team;onChanged:()=>void}) {
 const action=useAdministrationAction(onChanged),access=teamAccess(data,team);
 if(!access.membership)return null;
 async function save(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const fields=new FormData(event.currentTarget);
  await action.run(`/api/settings/teams/${team.id}/membership`,"PUT",{mode:fields.get("mode"),requestsEnabled:fields.has("requestsEnabled")});
 }
 return <section aria-label={`Membership for ${team.name}`}>
  <h3>Joining this team</h3>
  <p>Public-team work remains visible to workspace Members. A request grants no membership.</p>
  <form aria-label={`Membership mode for ${team.name}`} onSubmit={save} key={team.membershipMode+String(team.requestsEnabled)}>
   <fieldset disabled={action.pending}>
    <label htmlFor={`membership-mode-${team.id}`}>Membership mode</label>
    <select id={`membership-mode-${team.id}`} name="mode" defaultValue={team.membershipMode}>
     <option value="open">Open</option><option value="invite_only">Invite only</option>
    </select>
    <label><input type="checkbox" name="requestsEnabled" defaultChecked={team.requestsEnabled}/>Accept membership requests</label>
    <button>Save membership mode</button>
   </fieldset>
  </form>
  {team.joinRequests.filter(request=>request.state==="pending").map(request=><div key={request.requesterId} role="group" aria-label={`Request from ${request.name}`}>
   <p>{request.name} requested membership.</p>
   <button type="button" disabled={action.pending} onClick={()=>void action.run(`/api/settings/teams/${team.id}/requests/${request.requesterId}/decision`,"POST",{decision:"approved"})}>Approve {request.name}</button>
   <button type="button" disabled={action.pending} onClick={()=>void action.run(`/api/settings/teams/${team.id}/requests/${request.requesterId}/decision`,"POST",{decision:"declined"})}>Decline {request.name}</button>
  </div>)}
  <AdministrationFeedback action={action}/>
 </section>;
}
