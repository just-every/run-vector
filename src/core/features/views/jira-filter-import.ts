import { z } from 'zod';
import { getSearchOptions } from '../search/options';
import { operandLabels } from '../issues/filter-operands';
import { issueListQuerySchema } from '../issues/list-schema';
import { createViewSchema } from './schema';
import { JiraFilterError, translateJiraFilter } from './jira-filter-parser';
const fields = ['priority', ...Object.keys(operandLabels)] as ['priority', ...Array<keyof typeof operandLabels>];
const mapping = z.object({ field: z.enum(fields), values: z.record(z.string().min(1).max(200), z.string().min(1).max(200)).refine(values => Object.keys(values).length <= 100).default({}) }).strict();
const input = createViewSchema.omit({ query: true }).extend({
  query: issueListQuerySchema.optional(),
  jiraImport: z.object({ jql: z.string().min(1).max(1000), mappings: z.record(z.string().min(1).max(80), mapping).refine(values => Object.keys(values).length <= 32) }).strict(),
}).strict();
/** Import one selected Jira saved filter; refusal creates no partial view. */
export async function parseViewCreate(db: D1Database, actor: string, body: unknown) {
  if (!body || typeof body !== 'object' || !Object.hasOwn(body, 'jiraImport')) return createViewSchema.parse(body);
  const parsed = input.parse(body);
  if (parsed.query?.expression) throw new JiraFilterError([{ term: 'expression', reason: 'Import Jira or provide a native expression, one at a time.' }]);
  const options = await getSearchOptions(db, actor);
  const records: Record<string, string[]> = {
    team: options.teams.map(row => row.id), status: options.statuses.map(row => row.id), assignee: options.operators.map(row => row.id),
    creator: options.operators.map(row => row.id), follower: options.operators.map(row => row.id), project: options.projects.map(row => row.id),
    cycle: options.cycles.map(row => row.id), label: options.labels.map(row => row.id), milestone: options.milestones.map(row => row.id), release: options.releases?.map(row => row.id) ?? [],
  };
  const mappings: typeof parsed.jiraImport.mappings = Object.create(null);
  for (const [source, rule] of Object.entries(parsed.jiraImport.mappings)) {
    const key = source.toLowerCase();
    if (Object.hasOwn(mappings, key)) throw new JiraFilterError([{ term: source, reason: 'Duplicate field mapping.' }]);
    for (const value of Object.values(rule.values)) {
      if (records[rule.field] && !['none', 'me'].includes(value) && !records[rule.field].includes(value)) throw new JiraFilterError([{ term: source, reason: 'A mapped native record is unavailable.' }]);
    }
    mappings[key] = rule;
  }
  const expression = translateJiraFilter(parsed.jiraImport.jql, mappings);
  return createViewSchema.parse({ name: parsed.name, isShared: parsed.isShared, layout: parsed.layout, query: { ...(parsed.query ?? {}), expression } });
}
