import { ToolRefusal, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { moveIssueTeamInputSchema } from '../team-move/input';
import { moveIssueTeamRecord } from '../team-move/repository';
import { copyIssueSchema } from '../issue-copy/schema';
import { copyIssue } from '../issue-copy/service';
import { readCopySnapshot } from '../issue-copy/snapshot';
import { bulkIssueInputSchema } from '../bulk-edit/input';
import { bulkUpdateIssues } from '../bulk-edit/repository';
import { bulkTeamInputSchema, bulkDuplicateInputSchema } from '../bulk-commands/input';
import { moveSelectedIssueTeams } from '../bulk-commands/team';
import { decideSelectedDuplicates } from '../bulk-commands/duplicate';
import { manualOrderScopeSchema, moveManualOrderSchema } from '../manual-order/schema';
import { readManualOrder, moveManualOrder } from '../manual-order/service';
import { issueInput, issueMutation, issueRead, issueDetail, written } from './issues-shared.ts';

export function vectorIssueOperations(env: WorkerBindings): ToolDefinition[] {
  return [
    issueMutation(env, { name: 'issue.moving_teams', title: 'Move an issue to another team and workflow status', clauses: ['ISSUE-012'],
      schema: issueInput(moveIssueTeamInputSchema), method: 'POST', path: '/issues/:identifier/team',
      async run(db, person, args) { written(await moveIssueTeamRecord(db, args.identifier, person.id, args.input)); return issueDetail(db, person, args.identifier); } }),
    issueMutation(env, { name: 'issue.copy_issue', title: 'Copy an issue and selected sub-issues or links', clauses: ['ISSUE-023'],
      schema: issueInput(copyIssueSchema), method: 'POST', path: '/issues/:identifier/copy',
      async classify(db, person, args) {
        await issueDetail(db, person, args.identifier);
        const snapshot = await readCopySnapshot(db, args.identifier, args.input.includeSubissues, args.input.includeLinks);
        return [{ class: 'standard', facts: { measure: snapshot.rows.length } }];
      },
      async revision(db, person, args) {
        await issueDetail(db, person, args.identifier);
        return (await readCopySnapshot(db, args.identifier, args.input.includeSubissues, args.input.includeLinks)).encoded;
      },
      run: (db, person, args) => copyIssue(db, args.identifier, person.id, args.input), uri: result => `vector://issues/${result.issue.identifier}` }),
    ...([
      ['bulk_edit', 'Edit a selection of issues atomically', ['ISSUE-006', 'VIEW-004'], '/issues/bulk', bulkIssueInputSchema, bulkUpdateIssues],
      ['bulk_move_teams', 'Move a selection of issues between teams atomically', ['ISSUE-012', 'VIEW-004'], '/issues/bulk/team', bulkTeamInputSchema, moveSelectedIssueTeams],
      ['bulk_duplicate', 'Set or undo selected duplicate decisions atomically', ['REL-003', 'REL-004', 'REL-005', 'VIEW-004'], '/issues/bulk/duplicate', bulkDuplicateInputSchema, decideSelectedDuplicates],
    ] as const).map(([name, title, clauses, path, schema, run]) => issueMutation(env, {
      name: `issue.${name}`, title, clauses: [...clauses], schema, method: 'POST', path, params: () => ({}),
      async revision(db, person, args) { return JSON.stringify(await Promise.all(args.issues.map((row: { identifier: string }) => issueDetail(db, person, row.identifier).then(issue => [issue.identifier, issue.version])))); },
      async summary(db, person, args) { return { items: await Promise.all(args.issues.map((row: { identifier: string }) => issueDetail(db, person, row.identifier).then(issue => `${issue.identifier}: ${issue.title}`))) }; },
      async classify(db, person, args) {
        const issues = await Promise.all(args.issues.map((row: { identifier: string }) => issueDetail(db, person, row.identifier)));
        const changed = new Set<string>(issues.map(issue => issue.identifier));
        if (name === 'bulk_duplicate' && args.canonicalIdentifier) {
          for (const issue of issues) for (const duplicate of issue.duplicates) changed.add(duplicate.identifier);
        }
        return [{ class: 'standard', facts: { measure: changed.size } }];
      },
      async run(db, person, args) { const result = await run(db, person.id, args); return { ...result, issues: await Promise.all(result.issues.map(row => issueDetail(db, person, row.identifier))) }; },
      uri: () => 'vector://workspace/planning',
    })),
    issueRead(env, 'issue.read_manual_order', 'Read native issue manual order revision', ['VIEW-001'], manualOrderScopeSchema,
      (db, person, args) => readManualOrder(db, person.id, args)),
    issueMutation(env, { name: 'issue.reorder', title: 'Move an issue in a team or saved view manual order', clauses: ['VIEW-001'],
      schema: moveManualOrderSchema, method: 'POST', path: '/issues/order', params: () => ({}),
      revision: async (db, person, args) => (await readManualOrder(db, person.id, args)).version,
      async run(db, person, args) { const result = await moveManualOrder(db, person.id, args); if (result.stale) throw new ToolRefusal('stale_version'); return { version: result.version }; } }),
  ];
}
