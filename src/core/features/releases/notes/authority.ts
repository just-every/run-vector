import type {DoorRequest} from '../../roles/doors';

export async function releaseNotesTeams({db,actor,params}:DoorRequest){
 const release=await db.prepare(`SELECT r.team_id FROM releases r JOIN operators o ON o.workspace_id=r.workspace_id
 WHERE r.id=? AND o.id=? AND o.removed_at IS NULL`).bind(params.id,actor).first<{team_id:string|null}>();
 return release?.team_id?[release.team_id]:null;
}
