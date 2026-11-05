import type { Hono,Context } from 'hono'
import { z } from 'zod'
import type { AppEnvironment } from '../../app/bindings'
import { readRequestJson } from '../../app/input'
import { SettingsError } from '../settings/repository'
import { seriesInputSchema,stopInputSchema } from './schema'
import { createSeries,listSeries,readSeries,stopSeries } from './repository'

export function addRecurringIssueRoutes(app:Hono<AppEnvironment>) {
  const action=(run:(c:Context<AppEnvironment>)=>Promise<Response>)=>async(c:Context<AppEnvironment>)=>{
    try{return await run(c)}catch(e){
      if(e instanceof SettingsError)return c.json({error:e.code,message:e.message},e.status)
      if(e instanceof z.ZodError)return c.json({error:'invalid_request',issues:e.issues},400)
      throw e
    }
  }
  app.get('/recurring-issues',action(async c=>c.json(await listSeries(c.env.DB,c.get('operatorId')))))
  app.get('/recurring-issues/:id',action(async c=>c.json(await readSeries(c.env.DB,c.get('operatorId'),c.req.param('id')!))))
  app.post('/recurring-issues',action(async c=>c.json(await createSeries(c.env.DB,c.get('operatorId'),seriesInputSchema.parse(await readRequestJson(c.req.raw))),201)))
  app.patch('/recurring-issues/:id',action(async c=>c.json(await stopSeries(c.env.DB,c.get('operatorId'),c.req.param('id')!,stopInputSchema.parse(await readRequestJson(c.req.raw))))))
}
