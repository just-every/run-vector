import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { firstRunState } from './repository';

export function addFirstRunRoutes(app: Hono<AppEnvironment>) {
  app.get('/setup', async c => c.json(await firstRunState(c.env.DB,c.get('operatorId'))));
  app.post('/setup/complete', async c => {
    const input=z.object({confirmed:z.literal(true)}).strict().safeParse(await readRequestJson(c.req.raw));
    if(!input.success) return c.json({error:'invalid_request'},400);
    const actor=c.get('operatorId'), before=await firstRunState(c.env.DB,actor);
    if(!before.owner) return c.json({error:'installation_owner_required'},403);
    await c.env.DB.prepare(`UPDATE workspace_installation SET setup_completed_at=COALESCE(setup_completed_at,?),updated_at=?
      WHERE setup_operator_id=? AND EXISTS(SELECT 1 FROM operators o WHERE o.id=? AND o.removed_at IS NULL
      AND o.workspace_id=workspace_installation.workspace_id)`).bind(new Date().toISOString(),new Date().toISOString(),actor,actor).run();
    const after=await firstRunState(c.env.DB,actor);
    if(!after.owner) return c.json({error:'installation_owner_required'},403);
    return c.json({completed:after.completed});
  });
}
