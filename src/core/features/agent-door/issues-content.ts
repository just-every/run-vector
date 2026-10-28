import { z } from 'zod';
import { ToolRefusal, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { requireIssueAccess } from '../issues/access';
import { createLinkSchema, linkId } from '../links/schema';
import { addNamedLink, listNamedLinks, removeNamedLink } from '../links/repository';
import { readDescriptionHistory, restoreDescription, tickDescriptionTask } from '../description-history/repository';
import { tickCommentTask } from '../description-history/comments';
import { checklistSchema, commentChecklistSchema, descriptionRestoreSchema } from '../description-history/schema';
import { readSourceIssueReferences } from '../issue-references/repository';
import { findFile } from '../discussion/repository';
import { requestFileRemoval } from '../file-removal/service';
import { discussionView } from './issues-discussion.ts';
import { issueInput, issueMutation, issueRead, issueDetail, identifier, nativeId, written } from './issues-shared.ts';

export function vectorIssueContent(env: WorkerBindings): ToolDefinition[] {
  return [
    issueRead(env, 'issue.read_links', 'Read named issue and comment links', ['ISSUE-009'], z.object({ identifier }).strict(),
      async (db, person, args) => { const issue = await requireIssueAccess(db, args.identifier, person.id); return { links: await listNamedLinks(db, issue.id) }; }),
    issueMutation(env, { name: 'issue.attachments_and_links', title: 'Add a named HTTPS issue or comment link', clauses: ['ISSUE-009'],
      schema: issueInput(createLinkSchema), method: 'POST', path: '/issues/:identifier/links',
      async run(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        const id = await addNamedLink(db, issue, person.id, createLinkSchema.parse(args.input));
        if (!id) throw new ToolRefusal('not_found');
        return { id, links: await listNamedLinks(db, issue.id) };
      } }),
    issueMutation(env, { name: 'issue.remove_link', title: 'Permanently remove a named issue link', clauses: ['ISSUE-009'],
      schema: z.object({ identifier, linkId }).strict(), method: 'DELETE', path: '/issues/:identifier/links/:linkId',
      params: args => ({ identifier: args.identifier, linkId: args.linkId }), classes: ['destructive'],
      classify: async () => [{ class: 'destructive', facts: { measure: 1 } }],
      async revision(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        const link = (await listNamedLinks(db, issue.id)).find(row => row.id === args.linkId);
        if (!link) throw new ToolRefusal('not_found'); return JSON.stringify(link);
      },
      async run(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        if (!await removeNamedLink(db, issue, args.linkId, person.id)) throw new ToolRefusal('not_found');
        return { removed: true, links: await listNamedLinks(db, issue.id) };
      } }),
    issueRead(env, 'issue.description_history', 'Read retained issue description revisions', ['ISSUE-018'], z.object({ identifier }).strict(),
      (db, person, args) => readDescriptionHistory(db, args.identifier, person.id)),
    ...([
      ['restore_description', 'Restore a retained issue description revision', 'ISSUE-018', 'description-restore', descriptionRestoreSchema, restoreDescription],
      ['checklists', 'Tick an issue description checklist item', 'ISSUE-025', 'checklist', checklistSchema, tickDescriptionTask],
    ] as const).map(([name, title, clause, path, schema, run]) => issueMutation(env, {
      name: `issue.${name}`, title, clauses: [clause], schema: issueInput(schema), method: 'POST', path: `/issues/:identifier/${path}`,
      async run(db, person, args) { written(await run(db, args.identifier, person.id, args.input)); return issueDetail(db, person, args.identifier); },
    })),
    issueMutation(env, { name: 'issue.tick_comment_checklist', title: 'Tick an authored comment checklist item', clauses: ['ISSUE-025'],
      schema: z.object({ identifier, itemId: nativeId, input: commentChecklistSchema }).strict(), method: 'POST', path: '/issues/:identifier/comments/:itemId/checklist',
      params: args => ({ identifier: args.identifier, itemId: args.itemId }),
      async revision(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        const row = await db.prepare('SELECT body,edited_at FROM issue_comments WHERE id=? AND issue_id=? AND deleted_at IS NULL').bind(args.itemId, issue.id).first();
        if (!row) throw new ToolRefusal('not_found'); return JSON.stringify(row);
      },
      async run(db, person, args) { await tickCommentTask(db, args.identifier, args.itemId, person.id, args.input); return { updated: true, discussion: await discussionView(db, person, args.identifier) }; } }),
    issueRead(env, 'issue.issue_references_and_backlinks', 'Read visible references from issue text and comments', ['ISSUE-027'], z.object({ identifier }).strict(),
      async (db, person, args) => { const issue = await requireIssueAccess(db, args.identifier, person.id); return { references: await readSourceIssueReferences(db, person.id, issue.id) }; }),
    issueMutation(env, { name: 'issue.remove_file', title: 'Permanently remove an issue attachment', clauses: ['ISSUE-009'],
      schema: z.object({ identifier, itemId: nativeId }).strict(), method: 'DELETE', path: '/issues/:identifier/files/:itemId',
      params: args => ({ identifier: args.identifier, itemId: args.itemId }), classes: ['destructive'],
      classify: async () => [{ class: 'destructive', facts: { measure: 1 } }],
      async revision(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        const file = await findFile(db, issue.id, args.itemId);
        if (!file) throw new ToolRefusal('not_found');
        return JSON.stringify([file.id, file.state, file.deleted_at, file.removal_requested_at]);
      },
      async run(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        if (!await findFile(db, issue.id, args.itemId)) throw new ToolRefusal('not_found');
        const result = await requestFileRemoval({ ...env, DB: db }, issue, args.itemId, person.id, issue);
        if (result === 'failed') throw new ToolRefusal('file_removal_failed');
        return { removed: result === 'removed', pending: result === 'pending' };
      } }),
  ];
}
