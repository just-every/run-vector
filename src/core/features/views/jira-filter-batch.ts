import { z } from 'zod';
import { issueListQuerySchema } from '../issues/list-schema';
import { JiraFilterError } from './jira-filter-parser';
import { parseViewCreate } from './jira-filter-import';
import { createView } from './service';
import { ViewError } from './repository';

const record = z.object({ id: z.union([z.string().min(1).max(200), z.number().int()]), name: z.string().trim().min(1).max(120), jql: z.string().min(1).max(1000) });
const input = z.object({
  isShared: z.boolean().default(false), layout: z.enum(['list', 'board']).default('list'), query: issueListQuerySchema.optional(),
  jiraImport: z.object({ export: z.object({ values: z.array(record).min(1).max(50), isLast: z.boolean().optional() }), mappings: z.unknown() }).strict(),
}).strict();
export function isJiraBatch(body: unknown) {
  return !!body && typeof body === 'object' && 'jiraImport' in body && !!body.jiraImport && typeof body.jiraImport === 'object' && Object.hasOwn(body.jiraImport, 'export');
}
/** An owner-produced Jira filter-search export page is a bounded set of
 * independent filters. Never save a partly translated filter or replace one. */
export async function importJiraFilterPage(db: D1Database, actor: string, body: unknown) {
  const parsed = input.parse(body), views = [], omissions: { id: string | number; name: string; terms: { term: string; reason: string }[] }[] = [];
  // Validate the shared mapping envelope even when the first filter is unmapped.
  for (const source of parsed.jiraImport.export.values) {
    try {
      const native = await parseViewCreate(db, actor, { name: source.name, isShared: parsed.isShared, layout: parsed.layout, query: parsed.query,
        jiraImport: { jql: source.jql, mappings: parsed.jiraImport.mappings } });
      views.push(await createView(db, actor, native));
    } catch (error) {
      if (error instanceof JiraFilterError) omissions.push({ id: source.id, name: source.name, terms: error.omissions });
      else if (error instanceof ViewError && [400, 409].includes(error.status)) omissions.push({ id: source.id, name: source.name, terms: [{ term: 'view', reason: error.message }] });
      else throw error;
    }
  }
  return { views, omissions, sourceContinues: parsed.jiraImport.export.isLast === false };
}
