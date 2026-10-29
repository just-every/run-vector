import { z } from 'zod';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { loadWorkspaceSnapshot, getMyWorkStream } from '../streams/service';
import { projectCurrent } from '../streams/projection';
import { filterItems, attentionReasons } from '../streams/ui/helpers';
import { streamItemSchema } from '../streams/ui/data';
import { myActivity } from '../my-work/activity';
import { listIssues, issueListResponse } from '../issues/list';
import { issueListQuerySchema } from '../issues/list-schema';
import { searchWorkspace, getSearchOptions } from '../search/service';
import { nativeId, identifier } from './reads.ts';
import { workspaceRead, workspaceEmpty } from './workspace-shared.ts';

const allId = z.union([z.literal('all'), nativeId]).default('all');
const streamFilters = z.object({
  teamId: allId, projectId: z.union([z.enum(['all', 'none']), nativeId]).default('all'),
  assigneeId: z.union([z.enum(['all', 'unassigned']), nativeId]).default('all'),
  priority: z.enum(['all', 'urgent', 'high', 'medium', 'low', 'none']).default('all'),
  itemType: z.enum(['all', 'intake', 'issue']).default('all'),
  attentionReason: z.enum(['all', ...attentionReasons]).default('all'),
}).strict();
const streamArgs = z.object({ filters: streamFilters.default(() => streamFilters.parse({})) }).strict();
const searchArgs = z.object({ q: z.string().trim().min(1).max(200), includeArchived: z.boolean().default(false) }).strict();

/** Use Current's native projector without its HTTP read's deferred-intake
 * maintenance side effect. Real time governs both projection and deferrals. */
async function current(db: D1Database, filters: z.infer<typeof streamFilters>) {
  const projection = projectCurrent(await loadWorkspaceSnapshot(db), new Date());
  return { ...projection, sections: Object.fromEntries(Object.entries(projection.sections)
    .map(([key, items]) => [key, filterItems(streamItemSchema.array().parse(items), filters)])) };
}

export function workspaceStreamTools(env: WorkerBindings): ToolDefinition[] {
  const currentReads = [
    ['disjoint_stream', 'Read the disjoint Current stream', 'CURR-001', null],
    ['needs_decision', 'Read reports needing a decision', 'CURR-002', 'needs-decision'],
    ['now', 'Read started and overdue work', 'CURR-003', 'now'],
    ['next', 'Read upcoming committed and due work', 'CURR-004', 'next'],
    ['recently_done', 'Read recently completed work', 'CURR-005', 'recently-done'],
    ['explainable_attention', 'Read Current inclusion and context reasons', 'CURR-006', null],
    ['ranking', 'Read Current in its native total order', 'CURR-007', null],
    ['freshness', 'Read the current native stream snapshot', 'CURR-008', null],
    ['stream_controls', 'Filter the Current stream', 'CURR-009', null],
  ] as const;
  return [
    ...currentReads.map(([name, title, clause, section]) => workspaceRead(env, {
      name: `curr.${name}`, title, scope: 'streams:read', clauses: [clause], schema: streamArgs,
      read: async (db, _p, a) => { const stream = await current(db, a.filters);
        return section ? { generatedAt: stream.generatedAt, items: stream.sections[section] } : stream; },
    })),
    ...([
      ['personal_queue', 'Read your assigned work queue', 'WORK-001'],
      ['personal_defaults', 'Read your active personal work', 'WORK-002'],
      ['cycle_context', 'Read your active cycle commitments', 'WORK-003'],
    ] as const).map(([name, title, clause]) => workspaceRead(env, {
      name: `work.${name}`, title, scope: 'work:read', clauses: [clause], schema: streamArgs,
      read: async (db, p, a) => { const stream = await getMyWorkStream(db, p.id, new Date());
        return { ...stream, sections: Object.fromEntries(Object.entries(stream.sections)
          .map(([key, items]) => [key, filterItems(streamItemSchema.array().parse(items), a.filters)])) }; },
    })),
    ...(['created', 'subscribed'] as const).map(scope => workspaceRead(env, {
      name: `work.${scope}`, title: `Read issues you ${scope === 'created' ? 'created' : 'follow'}`,
      scope: 'work:read', clauses: ['WORK-004'], schema: issueListQuerySchema,
      read: async (db, p, a) => issueListResponse(await listIssues(db, p.id, { ...a, scope })),
    })),
    workspaceRead(env, { name: 'work.activity', title: 'Read your recent changes and comments', scope: 'work:read',
      clauses: ['WORK-004'], schema: workspaceEmpty, read: (db, p) => myActivity(db, p.id) }),
    workspaceRead(env, { name: 'search.global_search', title: 'Search visible issues, projects, views and documents',
      scope: 'search:read', clauses: ['SEARCH-001'], schema: searchArgs,
      read: (db, p, a) => searchWorkspace(db, p.id, a.q, a.includeArchived) }),
    workspaceRead(env, { name: 'search.exact_identifier', title: 'Resolve an exact native issue identifier',
      scope: 'search:read', clauses: ['SEARCH-002'],
      schema: z.object({ identifier, includeArchived: z.boolean().default(false) }).strict(),
      read: async (db, p, a) => { const found = await searchWorkspace(db, p.id, a.identifier, a.includeArchived);
        return { issues: found.issues.filter(issue => issue.identifier === a.identifier) }; } }),
    workspaceRead(env, { name: 'search.index_freshness', title: 'Read the retained search index health receipt',
      scope: 'search:read', clauses: ['SEARCH-003'], schema: workspaceEmpty,
      read: async db => ({ state: await db.prepare('SELECT last_successful_index_at AS lastSuccessfulIndexAt FROM search_index_state WHERE id=1').first() }) }),
    workspaceRead(env, { name: 'search.options', title: 'Read visible search and filter choices', scope: 'search:read',
      clauses: ['SEARCH-001', 'SEARCH-004'], schema: workspaceEmpty, read: (db, p) => getSearchOptions(db, p.id) }),
  ];
}
