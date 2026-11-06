import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../app/bindings';
import {readRequestJson} from '../../app/input';
import {SettingsError} from '../administration/transaction';
import {recentlyDeleted,restoreProject} from './repository';
const input=z.object({id:z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),version:z.number().int().positive()}).strict();
export function addProjectDeletionRoutes(app:Hono<AppEnvironment>,scoped=false) {
 app.get('/projects/recently-deleted',async c=>{
  try{return c.json(await recentlyDeleted(c.env.DB,c.get('operatorId')));}
  catch(error){if(error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);throw error;}
 });
 for(const undo of scoped?[false]:[false,true])app.post('/projects/'+(undo?'undo-deletion':'restore'),async c=>{
  const parsed=input.safeParse(await readRequestJson(c.req.raw));
  if(!parsed.success)return c.json({error:'invalid_request'},400);
  try{return c.json(await restoreProject(c.env.DB,c.get('operatorId'),{...parsed.data,undo}));}
  catch(error){if(error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);throw error;}
 });
}
