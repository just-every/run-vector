import { z } from 'zod';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { createIssueInputSchema, acceptIssueInputSchema, deferIssueInputSchema, declineIssueInputSchema } from '../issues/input';
import { createIssue, acceptIssue, deferIssue, declineIssue } from '../issues/mutations';
import { updateIssueSchema } from '../issue-edit/routes';
import { updateIssueRecord } from '../issue-edit/repository';
import { operatorIntakeInputSchema } from '../operator-intake/input';
import { createOperatorIntake } from '../operator-intake/repository';
import { endIntakeDeferral } from '../intake-return/service';
import { getSearchOptions } from '../search/options';
import { intakeRecommendation } from '../issues/ui/intake-recommendation';
import { issueDetailSchema } from '../issues/ui/data';
import { issueInput, issueMutation, issueRead, issueDetail, identifier, version, written } from './issues-shared.ts';
import { vectorIssueRelations } from './issues-relations.ts';
import { vectorIssueDiscussion } from './issues-discussion.ts';
import { vectorIssueContent } from './issues-content.ts';
import { vectorIssueOperations } from './issues-operations.ts';
export { vectorIssueResources } from './issues-resources.ts';

export function vectorIssueTools(env: WorkerBindings): ToolDefinition[] {
  const edit = (name: string, title: string, clauses: string[], schema: z.ZodType) => issueMutation(env, {
    name, title, clauses, scope: name.startsWith('proj.') ? 'projects:write' : name.startsWith('cycle.') ? 'cycles:write' : 'issues:write',
    schema: issueInput(schema), method: 'PATCH', path: '/issues/:identifier',
    async run(db, person, args) {
      written(await updateIssueRecord(db, args.identifier, person.id, updateIssueSchema.parse(args.input)));
      return issueDetail(db, person, args.identifier);
    },
  });
  const fields = updateIssueSchema.shape;
  const oneField = (key: keyof typeof fields) => z.object({ expectedVersion: version, [key]: fields[key].nonoptional() }).strict();
  return [
    issueMutation(env, { name: 'issue.creation', title: 'Create an issue', clauses: ['ISSUE-001', 'ISSUE-002'],
      schema: createIssueInputSchema, method: 'POST', path: '/issues',
      run: (db, person, args) => createIssue(db, person.id, createIssueInputSchema.parse(args)),
      uri: result => `vector://issues/${result.identifier}` }),
    issueRead(env, 'issue.stable_identifiers', 'Read an issue by its stable identifier', ['ISSUE-002'], z.object({ identifier }).strict(),
      (db, person, args) => issueDetail(db, person, args.identifier)),
    edit('issue.concurrent_edits', 'Edit issue properties with its native version', ['ISSUE-001', 'ISSUE-006', 'ISSUE-013', 'ISSUE-025', 'ISSUE-026'], updateIssueSchema),
    edit('issue.priority', 'Change issue priority', ['ISSUE-003'], oneField('priority')),
    edit('issue.status_transitions', 'Change issue workflow status', ['ISSUE-004'], oneField('statusId')),
    edit('issue.assignment', 'Assign or unassign an issue', ['ISSUE-005'], oneField('assigneeOperatorId')),
    edit('issue.estimates', 'Change an issue estimate', ['ISSUE-011'], oneField('estimate')),
    edit('issue.labels', 'Replace issue labels', ['ISSUE-014'], oneField('labelIds')),
    edit('proj.project_membership', 'Move an issue into or out of a project', ['PROJ-003'], oneField('projectId')),
    edit('cycle.commitment', 'Commit or remove an issue from a cycle', ['CYCLE-002'], oneField('cycleId')),
    edit('issue.set_due_date', 'Set or clear an issue due date', ['ISSUE-001', 'CURR-003', 'CURR-004'], oneField('dueDate')),
    issueRead(env, 'issue.activity_history', 'Read retained issue activity and decisions', ['ISSUE-007'], z.object({ identifier }).strict(),
      async (db, person, args) => { const issue = await issueDetail(db, person, args.identifier); return { identifier: issue.identifier, version: issue.version, activity: issue.activity, decisions: issue.decisions }; }),
    issueMutation(env, { name: 'intake.intake_creation', title: 'Create an operator intake report with evidence', clauses: ['INTAKE-001', 'INTAKE-003'],
      schema: operatorIntakeInputSchema, method: 'POST', path: '/intake',
      async run(db, person, args) { const result = await createOperatorIntake(db, person.id, operatorIntakeInputSchema.parse(args)); return issueDetail(db, person, result.identifier); },
      uri: result => `vector://issues/${result.identifier}` }),
    issueRead(env, 'intake.evidence_revisions', 'Read retained intake evidence revisions', ['INTAKE-003', 'INTAKE-008'], z.object({ identifier }).strict(),
      async (db, person, args) => { const issue = await issueDetail(db, person, args.identifier); return { identifier: issue.identifier, version: issue.version, evidence: issue.evidence, decisions: issue.decisions }; }),
    issueRead(env, 'intake.inspectable_assessment', 'Read assertions and provenance retained in intake evidence', ['INTAKE-004'], z.object({ identifier }).strict(),
      async (db, person, args) => { const issue = await issueDetail(db, person, args.identifier); return { identifier: issue.identifier,
        evidence: issue.evidence.map(({ id, originKind, sourceName, actor, observedAt, assertions }) => ({ id, originKind, sourceName, actor, observedAt, assertions })) }; }),
    issueRead(env, 'intake.decision_policy', 'Read editable native intake acceptance suggestions', ['INTAKE-010'], z.object({ identifier }).strict(),
      async (db, person, args) => { const [issue, options] = await Promise.all([issueDetail(db, person, args.identifier), getSearchOptions(db, person.id)]);
        return { identifier: issue.identifier, version: issue.version,
          recommendation: intakeRecommendation(issueDetailSchema.pick({ evidence: true, team: true }).parse(issue), options) }; }),
    ...([
      ['accept', 'Accept an intake report', 'INTAKE-005', acceptIssueInputSchema, acceptIssue],
      ['defer', 'Defer an intake report', 'INTAKE-006', deferIssueInputSchema, deferIssue],
      ['decline', 'Decline an intake report', 'INTAKE-007', declineIssueInputSchema, declineIssue],
    ] as const).map(([action, title, clause, schema, run]) => issueMutation(env, {
      name: `intake.${action}`, title, clauses: [clause, 'INTAKE-010'], schema: issueInput(schema), method: 'POST', path: `/issues/:identifier/${action}`,
      async run(db, person, args) {
        const result = await run(db, person.id, args.identifier, args.input);
        written(result.outcome); return issueDetail(db, person, args.identifier);
      },
    })),
    issueMutation(env, { name: 'intake.return', title: 'End an intake deferral', clauses: ['INTAKE-006'],
      schema: issueInput(z.object({ expectedVersion: version }).strict()), method: 'POST', path: '/issues/:identifier/return',
      async run(db, person, args) { written(await endIntakeDeferral(db, args.identifier, person.id, args.input.expectedVersion)); return issueDetail(db, person, args.identifier); } }),
    ...vectorIssueRelations(env), ...vectorIssueDiscussion(env), ...vectorIssueContent(env), ...vectorIssueOperations(env),
  ];
}
