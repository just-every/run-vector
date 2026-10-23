import type {Context} from 'hono';
import type {AppEnvironment,WorkerBindings} from '../../app/bindings';
import {settingsActor,SettingsError} from '../settings/repository';
export const releaseRoleAction='Create, edit or release a release (RELEASE-001)';
const resource=(path:string)=>/^\/api\/(?:v1\/)?(?:releases(?:\/|$)|issues\/[^/]+\/releases$)/.test(path);
export async function releaseAuthority(c:Context<AppEnvironment>,actor:string,db:D1Database){
 if(!resource(c.req.path))return;
 const access=await settingsActor(db,actor);
 if(access.role==='guest')return {denied:c.json({error:'forbidden',message:'Guests cannot open or change releases.'},403)};
 return {fence:{sql:'EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND role=? AND removed_at IS NULL)',values:[actor,access.workspace_id,access.role]}};
}
export async function releasePageDenial(env:WorkerBindings,path:string,actor:string){
 if(!/^\/app\/releases(?:\/|$)/.test(path))return null;
 try{const access=await settingsActor(env.DB,actor);return access.role==='guest'?Response.json({error:'forbidden'},{status:403,headers:{'Cache-Control':'no-store'}}):null;}
 catch(error){if(error instanceof SettingsError)return Response.json({error:error.code},{status:error.status,headers:{'Cache-Control':'no-store'}});throw error;}
}
