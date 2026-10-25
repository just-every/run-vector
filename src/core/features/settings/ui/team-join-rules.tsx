import {SettingsSaveForm} from "./settings-save-form";
import {administrationSchema} from "../../administration/schema";
import type {Administration} from "../../administration/schema";
import {teamAccess} from "./team-access";
import {useAdministrationAction} from "./administration-action";
import {AdministrationFeedback} from "./administration-feedback";
type Team=Administration["teams"][number];
export function TeamJoinRules({data,team,onChanged}:{data:Administration;team:Team;onChanged:()=>void}) {
 const action=useAdministrationAction(onChanged),access=teamAccess(data,team);
 if(!access.membership)return null;
 return <section aria-label={`Membership for ${team.name}`}>
  <h3>Joining this team</h3>
  <p>Public-team work remains visible to workspace Members. A request grants no membership.</p>
  <SettingsSaveForm aria-label={`Membership mode for ${team.name}`} path={`/api/settings/teams/${team.id}/membership`} schema={administrationSchema} onSaved={onChanged} confirm="Confirm membership mode" read={fields=>({mode:fields.get("mode"),requestsEnabled:fields.has("requestsEnabled")})}>
   <fieldset>
    <label htmlFor={`membership-mode-${team.id}`}>Membership mode</label>
    <select id={`membership-mode-${team.id}`} name="mode" defaultValue={team.membershipMode}>
     <option value="open">Open</option><option value="invite_only">Invite only</option>
    </select>
    <label><input type="checkbox" name="requestsEnabled" defaultChecked={team.requestsEnabled}/>Accept membership requests</label>
   </fieldset>
  </SettingsSaveForm>
  {team.joinRequests.filter(request=>request.state==="pending").map(request=><div key={request.requesterId} role="group" aria-label={`Request from ${request.name}`}>
   <p>{request.name} requested membership.</p>
   <button type="button" disabled={action.pending} onClick={()=>void action.run(`/api/settings/teams/${team.id}/requests/${request.requesterId}/decision`,"POST",{decision:"approved"})}>Approve {request.name}</button>
   <button type="button" disabled={action.pending} onClick={()=>void action.run(`/api/settings/teams/${team.id}/requests/${request.requesterId}/decision`,"POST",{decision:"declined"})}>Decline {request.name}</button>
  </div>)}
  <AdministrationFeedback action={action}/>
 </section>;
}
