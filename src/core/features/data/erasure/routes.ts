import type { Context, Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../../app/bindings';
import { readRequestJson } from '../../../app/input';
import { requireOperator } from '../../auth/service';
import type { ImportActor } from '../import/authority';
import { ImportError } from '../import/types';
import { erasePerson, erasureJournal, previewPersonErasure } from './service';
import { confirmationFor, erasureSubjectSchema } from './subject';

const eraseSchema = z.object({ subject: erasureSubjectSchema, confirmation: z.string().max(400) }).strict();

async function actor(c: Context<AppEnvironment>): Promise<ImportActor> {
  const admitted = await requireOperator(c.env, c.req.raw);
  if (!admitted || admitted.id !== c.get('operatorId')) throw new ImportError(401, 'unauthenticated');
  const row = await c.env.DB.prepare('SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL').bind(admitted.id).first<{ workspace_id: string }>();
  if (!row) throw new ImportError(401, 'unauthenticated');
  return { id: admitted.id, workspace: row.workspace_id, fence: admitted.fence };
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ImportError(400, 'invalid_erasure_input', 'Give the exact email and/or up to five exact display names the imports carried.');
  return result.data;
}

/** Person erasure for imported people (docs/ERASURE.md): preview, typed confirmation, receipt. */
export function addErasureRoutes(app: Hono<AppEnvironment>) {
  app.post('/data/erasure/preview', async c => {
    await actor(c);
    const subject = parse(erasureSubjectSchema, await readRequestJson(c.req.raw));
    return c.json({ ...await previewPersonErasure(c.env.DB, subject), confirmation: confirmationFor(subject) });
  });
  app.post('/data/erasure', async c => {
    const owner = await actor(c), input = parse(eraseSchema, await readRequestJson(c.req.raw));
    if (input.confirmation !== confirmationFor(input.subject)) throw new ImportError(400, 'confirmation_mismatch', `Type "${confirmationFor(input.subject)}" to confirm.`);
    return c.json(await erasePerson(c.env.DB, c.env.FILES, owner, input.subject));
  });
  app.get('/data/erasure/journal', async c => c.json({ entries: await erasureJournal(c.env.DB, await actor(c)) }));
}
