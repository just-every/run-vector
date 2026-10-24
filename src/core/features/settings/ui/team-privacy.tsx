import type {Administration} from '../../administration/schema';
import {useAdministrationAction} from './administration-action';
import {AdministrationFeedback} from './administration-feedback';

export function TeamPrivacy({team,onChanged}:{team:Administration['teams'][number];onChanged:()=>void}) {
  const action=useAdministrationAction(onChanged);
  return <div>
    <label>Team visibility
      <select aria-label={`Visibility of ${team.name}`} value={team.isPrivate?'private':'public'} disabled={action.pending}
        onChange={event=>void action.run(`/api/settings/teams/${team.id}/privacy`,'PUT',{isPrivate:event.target.value==='private'})}>
        <option value="public">Public</option><option value="private">Private</option>
      </select>
    </label>
    <AdministrationFeedback action={action}/>
  </div>;
}
