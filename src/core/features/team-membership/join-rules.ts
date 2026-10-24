import {visibleTeam,requestableTeam} from '../roles/visibility-sql';
import {administrationContext,audit,commit,guard,SettingsError,type AdministrationContext} from "../administration/transaction";
type Mode = "open" | "invite_only";
type Team = {id:string;name:string;membership_mode:Mode;requests_enabled:number;archived_at:string|null;is_private:number};
async function teamOf(ctx:AdministrationContext,id:string,request=false) {
 const team=await ctx.db.prepare(`SELECT t.id,t.name,t.membership_mode,t.requests_enabled,t.archived_at,t.is_private FROM main.teams t JOIN operators reader ON reader.id=? WHERE t.id=? AND t.workspace_id=? AND (${visibleTeam('reader','t.id')} OR reader.role='admin' OR (?=1 AND ${requestableTeam('reader','t.id')}))`).bind(ctx.actor,id,ctx.workspace,Number(request)).first<Team>();
 if(!team) throw new SettingsError("not_found","Team is unavailable.",404);
 return team;
}
export async function setMembershipMode(db:D1Database,actor:string,id:string,input:{mode:Mode;requestsEnabled:boolean}) {
 const ctx=await administrationContext(db,actor),team=await teamOf(ctx,id);
 if(team.membership_mode===input.mode&&Boolean(team.requests_enabled)===input.requestsEnabled)return;
 await commit(ctx,[
  guard(ctx.db,"EXISTS(SELECT 1 FROM teams WHERE id=? AND membership_mode=? AND requests_enabled=?)",id,team.membership_mode,team.requests_enabled),
  ctx.db.prepare("UPDATE teams SET membership_mode=?,requests_enabled=?,updated_at=? WHERE id=?").bind(input.mode,Number(input.requestsEnabled),ctx.at,id),
  ...audit(ctx,"team.membership_mode_changed",id,team.name,{mode:team.membership_mode,requestsEnabled:!!team.requests_enabled},input),
 ]);
}
export async function requestMembership(db:D1Database,actor:string,id:string) {
 const ctx=await administrationContext(db,actor),team=await teamOf(ctx,id,true);
 if(team.archived_at)throw new SettingsError("team_archived","Archived teams take no new members.",409);
 if((!team.is_private&&team.membership_mode!=="invite_only")||!team.requests_enabled)throw new SettingsError("join_request_forbidden","This team is not accepting membership requests.",403);
 if(await ctx.db.prepare("SELECT 1 FROM team_members WHERE team_id=? AND operator_id=?").bind(id,actor).first())return;
 const prior=await ctx.db.prepare("SELECT state FROM main.team_join_requests WHERE team_id=? AND requester_id=?").bind(id,actor).first<string>("state");
 if(prior==='pending')return;
 await commit(ctx,[
  guard(ctx.db,"EXISTS(SELECT 1 FROM main.teams WHERE id=? AND archived_at IS NULL AND (membership_mode='invite_only' OR is_private=1) AND requests_enabled=1)",id),
  guard(ctx.db,"(SELECT state FROM main.team_join_requests WHERE team_id=? AND requester_id=?) IS ?",id,actor,prior),
  ctx.db.prepare(`INSERT INTO team_join_requests(team_id,requester_id,state,decided_by,created_at,updated_at,decided_at) VALUES(?,?,'pending',NULL,?,?,NULL)
   ON CONFLICT(team_id,requester_id) DO UPDATE SET state='pending',decided_by=NULL,created_at=excluded.created_at,updated_at=excluded.updated_at,decided_at=NULL`).bind(id,actor,ctx.at,ctx.at),
  ...audit(ctx,"team.membership_requested",id,team.name,null,{requesterId:actor}),
 ]);
}
export async function decideMembership(db:D1Database,actor:string,id:string,requester:string,decision:"approved"|"declined") {
 const ctx=await administrationContext(db,actor),team=await teamOf(ctx,id);
 const request=await ctx.db.prepare("SELECT state FROM main.team_join_requests WHERE team_id=? AND requester_id=?").bind(id,requester).first<string>("state");
 if(!request)throw new SettingsError("not_found","Membership request is unavailable.",404);
 if(request===decision)return;
 if(request!=="pending")throw new SettingsError("join_request_decided","This request has already been decided.",409);
 const person=await ctx.db.prepare("SELECT role FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL").bind(requester,ctx.workspace).first<string>("role");
 if(!person||person==='guest')throw new SettingsError("join_request_forbidden","Only active workspace Members can join through a request.",403);
 if(decision==='approved'&&team.archived_at)throw new SettingsError("team_archived","Archived teams take no new members.",409);
 await commit(ctx,[
  guard(ctx.db,"EXISTS(SELECT 1 FROM main.team_join_requests WHERE team_id=? AND requester_id=? AND state='pending')",id,requester),
  guard(ctx.db,"EXISTS(SELECT 1 FROM operators WHERE id=? AND role=? AND removed_at IS NULL)",requester,person),
  ...(decision==='approved'?[
   guard(ctx.db,"EXISTS(SELECT 1 FROM main.teams WHERE id=? AND archived_at IS NULL)",id),
   ctx.db.prepare("INSERT OR IGNORE INTO team_members(team_id,operator_id,role,created_at,updated_at) VALUES(?,?,'member',?,?)").bind(id,requester,ctx.at,ctx.at),
   ctx.db.prepare("DELETE FROM team_departures WHERE team_id=? AND operator_id=?").bind(id,requester),
  ]:[]),
  ctx.db.prepare("UPDATE team_join_requests SET state=?,decided_by=?,decided_at=?,updated_at=? WHERE team_id=? AND requester_id=?").bind(decision,actor,ctx.at,ctx.at,id,requester),
  ...audit(ctx,"team.join_request_"+decision,id,team.name,{requesterId:requester,state:request},{requesterId:requester,state:decision}),
 ]);
}
