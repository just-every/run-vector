import type { Hono, Context } from 'hono'
import { z } from 'zod'
import type { AppEnvironment } from '../../app/bindings'
import { readRequestJson } from '../../app/input'
import { SettingsError } from '../settings/repository'
import { formInputSchema } from './schema'
import { listForms, saveForm } from './repository'
export function addRequestFormRoutes(app: Hono<AppEnvironment>) {
  const action = (run: (c: Context<AppEnvironment>) => Promise<Response>) => async (c: Context<AppEnvironment>) => {
    try { return await run(c) } catch (e) {
      if (e instanceof SettingsError) return c.json({ error: e.code, message: e.message }, e.status)
      if (e instanceof z.ZodError) return c.json({ error: 'invalid_request', issues: e.issues }, 400)
      throw e
    }
  }
  app.get('/teams/:teamId/request-forms', action(async c => c.json(await listForms(c.env.DB, c.get('operatorId'), c.req.param('teamId')!))))
  app.post('/teams/:teamId/request-forms', action(async c => c.json(await saveForm(c.env.DB, c.get('operatorId'), c.req.param('teamId')!, formInputSchema.parse(await readRequestJson(c.req.raw))), 201)))
  app.put('/teams/:teamId/request-forms/:id', action(async c => {
    const { expectedRevision, ...input } = z.object({ expectedRevision: z.number().int().positive() }).passthrough().parse(await readRequestJson(c.req.raw))
    return c.json(await saveForm(c.env.DB, c.get('operatorId'), c.req.param('teamId')!, formInputSchema.parse(input), c.req.param('id')!, expectedRevision))
  }))
}
