import {administrationContext,audit,commit,guard,SettingsError} from '../administration/transaction';

/** Privacy is workspace administration, independently of content membership.
 * Only metadata is read outside the shared projection; no work is returned. */
export async function setTeamPrivacy(db:D1Database,actor:string,id:string,isPrivate:boolean) {
  const ctx=await administrationContext(db,actor);
  const team=await ctx.db.prepare('SELECT name,is_private FROM main.teams WHERE id=? AND workspace_id=?')
    .bind(id,ctx.workspace).first<{name:string;is_private:number}>();
  if(!team)throw new SettingsError('not_found','Team is unavailable.',404);
  if(team.is_private===Number(isPrivate))return;
  await commit(ctx,[
    guard(ctx.db,"EXISTS(SELECT 1 FROM operators WHERE id=? AND role IN('owner','admin') AND removed_at IS NULL)",actor),
    guard(ctx.db,'EXISTS(SELECT 1 FROM main.teams WHERE id=? AND is_private=?)',id,team.is_private),
    ctx.db.prepare('UPDATE teams SET is_private=?,updated_at=? WHERE id=?').bind(Number(isPrivate),ctx.at,id),
    ...audit(ctx,'team.privacy_changed',id,team.name,{isPrivate:!!team.is_private},{isPrivate}),
  ]);
}
