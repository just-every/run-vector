import type { Context, Hono } from 'hono'
import type { z } from 'zod'
import type { AppEnvironment } from '../../app/bindings'
import { readRequestJson } from '../../app/input'
import { readAdministration } from '../administration/read'
import { administrationId } from '../administration/schema'
import { SettingsError } from '../settings/repository'
import { createField, updateField } from './definitions'
import { fieldCreateSchema, fieldUpdateSchema } from './schema'

/** A team's fields in Settings (FIELD-001). Each door answers with the refreshed
 * Settings model, like the team's other configuration doors. */
export function addCustomFieldRoutes(app: Hono<AppEnvironment>) {
  const action = <T extends z.ZodType>(schema: T, run: (c: Context<AppEnvironment>, body: z.output<T>) => Promise<unknown>) =>
    async (c: Context<AppEnvironment>) => {
      if (Object.values(c.req.param()).some(id => !administrationId.safeParse(id).success)) return c.json({ error: 'invalid_request' }, 400)
      const parsed = schema.safeParse(await readRequestJson(c.req.raw))
      if (!parsed.success) return c.json({ error: 'invalid_request', message: parsed.error.issues.map(issue => `${issue.path.join('.') || 'Input'}: ${issue.message}`).join(' '), issues: parsed.error.issues }, 400)
      try {
        await run(c, parsed.data)
        return c.json(await readAdministration(c.env.DB, c.get('operatorId')))
      } catch (error) {
        if (error instanceof SettingsError) return c.json({ error: error.code, message: error.message }, error.status)
        throw error
      }
    }
  app.post('/settings/teams/:id/custom-fields', action(fieldCreateSchema, (c, body) => createField(c.env.DB, c.get('operatorId'), c.req.param('id')!, body)))
  app.patch('/settings/teams/:id/custom-fields/:fieldId', action(fieldUpdateSchema, (c, body) =>
    updateField(c.env.DB, c.get('operatorId'), c.req.param('id')!, c.req.param('fieldId')!, body)))
}
