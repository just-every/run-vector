import type { Hono } from 'hono'
import type { AppEnvironment } from '../../app/bindings'
import { readRequestJson } from '../../app/input'
import { administrationId } from '../administration/schema'
import { SettingsError } from '../settings/repository'
import { readTeamTypes } from './read'
import { enableTypes, updateType } from './definitions'
import { typeEnableSchema, typeUpdateSchema } from './schema'
export function addIssueTypeRoutes(app: Hono<AppEnvironment>) {
 app.put('/settings/teams/:id/issue-types',async c=>{
  if (!administrationId.safeParse(c.req.param('id')).success) return c.json({error:'invalid_request'},400)
  const body=typeEnableSchema.safeParse(await readRequestJson(c.req.raw))
  if (!body.success) return c.json({error:'invalid_request',issues:body.error.issues},400)
  try { await enableTypes(c.env.DB,c.get('operatorId'),c.req.param('id'),body.data.enabled);return c.json(await readTeamTypes(c.env.DB,c.req.param('id'))) }
  catch(error) { if(error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);throw error }
 })
 app.patch('/settings/teams/:id/issue-types/:typeId',async c=>{
  if (![c.req.param('id'),c.req.param('typeId')].every(id=>administrationId.safeParse(id).success)) return c.json({error:'invalid_request'},400)
  const body=typeUpdateSchema.safeParse(await readRequestJson(c.req.raw))
  if (!body.success) return c.json({error:'invalid_request',issues:body.error.issues},400)
  try { await updateType(c.env.DB,c.get('operatorId'),c.req.param('id'),c.req.param('typeId'),body.data);return c.json(await readTeamTypes(c.env.DB,c.req.param('id'))) }
  catch(error) { if(error instanceof SettingsError)return c.json({error:error.code,message:error.message},error.status);throw error }
 })
}
