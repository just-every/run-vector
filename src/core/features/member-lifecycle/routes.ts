import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { clearSessionCookie } from '../auth/service';
import { removeOperator } from '../settings/removal';
import { SettingsError } from '../settings/repository';
import { reactivateOperator } from './reactivation';
import { suspendedDirectory, suspendedProfile } from './directory';

export const assignmentChoice = z.object({ assignments: z.enum(['keep','unassign']) }).strict();
export function addMemberLifecycleRoutes(app: Hono<AppEnvironment>) {
  const handled = async <T>(operation: () => Promise<T>) => {
    try { return Response.json(await operation()); }
    catch (error) {
      if (error instanceof SettingsError) return Response.json({error:error.code,message:error.message},{status:error.status});
      throw error;
    }
  };
  app.get('/settings/operators/suspended', c => handled(() => suspendedDirectory(c.env.DB,c.get('operatorId'))));
  app.get('/settings/operators/:operatorId/suspension', c => handled(() => suspendedProfile(c.env.DB,c.get('operatorId'),c.req.param('operatorId'))));
  app.post('/settings/operators/:operatorId/suspend', async c => {
    const parsed = assignmentChoice.safeParse(await readRequestJson(c.req.raw));
    if (!parsed.success) return c.json({error:'invalid_request'},400);
    return handled(async () => {
      const result = await removeOperator(c.env.DB,c.get('operatorId'),c.req.param('operatorId'),new Date(),parsed.data.assignments);
      if (result.signedOut) c.header('Set-Cookie',clearSessionCookie(c.env,c.req.raw));
      return result;
    });
  });
  app.post('/settings/operators/:operatorId/reactivate', c => handled(() => reactivateOperator(c.env.DB,c.get('operatorId'),c.req.param('operatorId'))));
}
