import type { Hono, Context } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { SettingsError } from '../settings/repository';
import { routingInput } from './schema';
import { readRouting, saveRouting } from './settings';
export function addTriageRoutingRoutes(app: Hono<AppEnvironment>) {
  for (const path of ['/settings/triage-routing', '/settings/teams/:id/triage-routing']) {
    const door = (write: boolean) => async (c: Context<AppEnvironment>) => {
      try {
        const team = c.req.param('id') ?? null;
        if (write) {
          const parsed = routingInput.safeParse(await readRequestJson(c.req.raw));
          if (!parsed.success) return c.json({ error: 'invalid_routing_rules', message: 'Choose ordered source rules and the saved version.' }, 400);
          await saveRouting(c.env.DB, c.get('operatorId'), team, parsed.data);
        }
        return c.json(await readRouting(c.env.DB, c.get('operatorId'), team));
      } catch (error) {
        if (error instanceof SettingsError) return c.json({ error: error.code, message: error.message }, error.status);
        throw error;
      }
    };
    app.get(path, door(false));
    app.put(path, door(true));
  }
}
