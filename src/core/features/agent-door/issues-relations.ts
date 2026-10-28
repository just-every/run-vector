import { z } from 'zod';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { dependencyInputSchema } from '../dependencies/input';
import { mutateDependencyRecord, requireDependencyPair } from '../dependencies/repository';
import { mutateRelatedRecord } from '../related/repository';
import { decideDuplicate } from '../duplicates/repository';
import { updateIssueParent } from '../parents/repository';
import { isBlocked } from '../projects';
import { loadWorkspaceSnapshot } from '../streams';
import { readSubissues } from '../subissues/projection';
import { createSubissue } from '../subissues/create';
import { reorderSubissues } from '../subissues/repository';
import { readSubissueRule, updateSubissueRule } from '../subissues/rules';
import { createSubissueSchema, reorderSubissuesSchema, updateSubissueRuleSchema } from '../subissues/schema';
import { issueInput, issueMutation, issueRead, issueDetail, issueRevision, identifier, nativeId, version, written } from './issues-shared.ts';

export function vectorIssueRelations(env: WorkerBindings): ToolDefinition[] {
  const relation = (related: boolean, operation: 'add' | 'remove') => issueMutation(env, {
    name: related ? operation === 'add' ? 'rel.related_issues' : 'rel.remove_related_issue' : operation === 'add' ? 'rel.dependencies' : 'rel.remove_dependency',
    title: `${operation === 'add' ? 'Add' : 'Remove'} ${related ? 'a related issue' : 'an issue dependency'}`,
    clauses: related ? ['REL-007'] : ['REL-001', 'REL-002'],
    schema: issueInput(dependencyInputSchema.extend({ direction: related ? z.literal('related') : z.enum(['blocks', 'blocked-by']) })),
    method: operation === 'add' ? 'POST' : 'DELETE', path: '/issues/:identifier/dependencies',
    async revision(db, person, args) {
      const pair = await requireDependencyPair(db, args.identifier, args.input.relatedIdentifier, person.id);
      return `${pair.issue.version}:${pair.relatedIssue.version}`;
    },
    classify: async () => [{ class: 'standard', facts: { measure: 2 } }],
    async run(db, person, args) {
      const mutate = related ? mutateRelatedRecord : mutateDependencyRecord;
      written(await mutate(db, args.identifier, person.id, args.input, operation));
      const [issue, relatedIssue] = await Promise.all([issueDetail(db, person, args.identifier), issueDetail(db, person, args.input.relatedIdentifier)]);
      return { issue, relatedIssue };
    },
  });
  const duplicate = (undo: boolean) => issueMutation(env, {
    name: undo ? 'rel.undo_duplicate' : 'rel.duplicate_decision', title: undo ? 'Undo a duplicate decision' : 'Mark an issue as a duplicate',
    clauses: undo ? ['REL-005'] : ['REL-003', 'REL-004'], method: 'POST', path: '/issues/:identifier/duplicate',
    schema: issueInput(z.object({ expectedVersion: version, canonicalIdentifier: undo ? z.null() : identifier }).strict()),
    async revision(db, person, args) {
      const source = await issueRevision(db, person, args);
      const target = args.input.canonicalIdentifier ? await issueRevision(db, person, { identifier: args.input.canonicalIdentifier }) : null;
      const graph = (await db.prepare(`SELECT i.identifier,i.version FROM issue_duplicates d JOIN issues i ON i.id=d.issue_id
        WHERE d.canonical_issue_id=(SELECT id FROM issues WHERE identifier=?) ORDER BY i.identifier`).bind(args.identifier).all()).results;
      return JSON.stringify([source, target, graph]);
    },
    async classify(db, person, args) {
      await issueRevision(db, person, args);
      const children = undo ? 0 : await db.prepare('SELECT count(*) n FROM issue_duplicates WHERE canonical_issue_id=(SELECT id FROM issues WHERE identifier=?)').bind(args.identifier).first<number>('n');
      return [{ class: 'standard', facts: { measure: 1 + (children ?? 0) } }];
    },
    async run(db, person, args) { written(await decideDuplicate(db, args.identifier, person.id, args.input)); return issueDetail(db, person, args.identifier); },
  });
  return [relation(false, 'add'), relation(false, 'remove'), relation(true, 'add'), relation(true, 'remove'), duplicate(false), duplicate(true),
    issueRead(env, 'rel.canonical_duplicates', 'Read canonical and duplicate issue relations', ['REL-004'], z.object({ identifier }).strict(),
      async (db, person, args) => { const issue = await issueDetail(db, person, args.identifier); return { identifier: issue.identifier, version: issue.version, canonical: issue.canonical, duplicates: issue.duplicates }; }),
    issueRead(env, 'rel.blocked_state', 'Read current issue dependencies and blocked state', ['REL-002'], z.object({ identifier }).strict(),
      async (db, person, args) => { const issue = await issueDetail(db, person, args.identifier); const snapshot = await loadWorkspaceSnapshot(db);
        return { identifier: issue.identifier, version: issue.version, blocked: isBlocked(snapshot, issue.id), dependencies: issue.dependencies }; }),
    issueMutation(env, { name: 'rel.parent_and_child', title: 'Set or remove an issue parent', clauses: ['REL-006'],
      schema: issueInput(z.object({ expectedVersion: version, parentIdentifier: identifier.nullable() }).strict()), method: 'PATCH', path: '/issues/:identifier/parent',
      async run(db, person, args) { written(await updateIssueParent(db, args.identifier, person.id, args.input)); return issueDetail(db, person, args.identifier); } }),
    issueRead(env, 'issue.sub_issue_progress', 'Read sub-issue order and completion progress', ['ISSUE-019', 'REL-006'], z.object({ identifier }).strict(),
      (db, person, args) => readSubissues(db, args.identifier, person.id)),
    ...([
      ['create_sub_issue', 'Create a sub-issue', 'POST', createSubissueSchema, createSubissue],
      ['reorder_sub_issues', 'Reorder sub-issues', 'PATCH', reorderSubissuesSchema, reorderSubissues],
    ] as const).map(([name, title, method, schema, run]) => issueMutation(env, {
      name: `issue.${name}`, title, clauses: ['ISSUE-019', 'REL-006'], schema: issueInput(schema), method, path: '/issues/:identifier/subissues',
      classify: async () => [{ class: 'standard', facts: { measure: method === 'POST' ? 2 : 1 } }],
      async run(db, person, args) { written(await run(db, args.identifier, person.id, args.input)); return readSubissues(db, args.identifier, person.id); },
    })),
    issueRead(env, 'issue.read_sub_issue_rule', 'Read the native team sub-issue rule', ['ISSUE-019'], z.object({ teamId: nativeId }).strict(),
      (db, person, args) => readSubissueRule(db, args.teamId, person.id)),
    issueMutation(env, { name: 'issue.set_sub_issue_rule', title: 'Change the native team sub-issue rule', clauses: ['ISSUE-019'],
      schema: z.object({ teamId: nativeId, input: updateSubissueRuleSchema }).strict(), method: 'PATCH', path: '/teams/:teamId/subissue-rule',
      params: args => ({ teamId: args.teamId }), revision: async (db, person, args) => (await readSubissueRule(db, args.teamId, person.id)).version,
      summary: async (db, _person, args) => ({ target: { id: args.teamId, name: (await db.prepare('SELECT name FROM teams WHERE id=?').bind(args.teamId).first<string>('name')) ?? undefined } }),
      async run(db, person, args) { written(await updateSubissueRule(db, args.teamId, person.id, args.input)); return readSubissueRule(db, args.teamId, person.id); },
      uri: (_result, args) => `vector://teams/${args.teamId}` }),
  ];
}
