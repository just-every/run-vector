import type { Hono } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
import { SettingsError } from '../settings/repository';
import { auditQuerySchema } from './schema';
import { readAudit,auditAuthority } from './repository';
import {auditStatement} from './producer';
import { auditCsv } from './csv';

export function addAuditRoutes(app: Hono<AppEnvironment>) {
  for (const path of ['/settings/audit', '/settings/audit.csv']) app.get(path, async c => {
    const query = auditQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: 'invalid_request', issues: query.error.issues }, 400);
    try {
      const data = await readAudit(c.env.DB, c.get('operatorId'), query.data);
      if (path.endsWith('.csv')) {
        const actor=c.get('operatorId'),workspace=await auditAuthority(c.env.DB,actor);
        const entry=auditStatement({workspace,actor,action:'audit.exported',subject:workspace,
          condition:{sql:"EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL AND role IN ('owner','admin'))",params:[actor,workspace]}});
        await c.env.DB.prepare(entry.sql).bind(...entry.params).run();
        await auditAuthority(c.env.DB,actor);
        return new Response(auditCsv(data.entries), { headers: {
        'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="workspace-audit.csv"',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      } });
      }
      return c.json(data);
    } catch (error) {
      if (error instanceof SettingsError) return c.json({ error: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
