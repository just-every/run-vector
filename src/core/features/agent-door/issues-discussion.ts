import { z } from 'zod';
import { ToolRefusal, type Person, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { requireIssueAccess } from '../issues/access';
import { discussion, addComment, changeComment } from '../discussion/repository';
import { commentVersionSql } from '../discussion/revision';
import { changeResolution } from '../discussion/threads';
import { reactionInput } from '../reactions/schema';
import { readIssueReactions, changeIssueReaction } from '../reactions/service';
import { issueInput, issueMutation, issueRead, identifier, nativeId } from './issues-shared.ts';

export async function discussionView(db: D1Database, person: Person, key: string) {
  const issue = await requireIssueAccess(db, key, person.id);
  const [result, versions] = await Promise.all([discussion(db, issue.id, person.id),
    db.prepare(`SELECT c.id,${commentVersionSql} version FROM issue_comments c WHERE c.issue_id=?`).bind(issue.id).all<{ id: string; version: number }>()]);
  await requireIssueAccess(db, key, person.id);
  const byId = new Map(versions.results.map(row => [row.id, row.version]));
  return { ...result, comments: result.comments.map(row => ({ ...row, version: byId.get(String(row.id)) })) };
}
async function commentRevision(db: D1Database, person: Person, args: any) {
  const issue = await requireIssueAccess(db, args.identifier, person.id);
  const row = await db.prepare(`SELECT ${commentVersionSql} version,c.resolved_at,c.parent_comment_id FROM issue_comments c
    WHERE c.id=? AND c.issue_id=? AND c.deleted_at IS NULL`).bind(args.itemId, issue.id).first();
  if (!row) throw new ToolRefusal('not_found');
  return JSON.stringify(row);
}
export function vectorIssueDiscussion(env: WorkerBindings): ToolDefinition[] {
  const commentArgs = (input: z.ZodType) => z.object({ identifier, itemId: nativeId, input }).strict();
  return [
    issueRead(env, 'issue.read_discussion', 'Read issue discussion, files and links', ['ISSUE-008', 'ISSUE-008', 'ISSUE-009'], z.object({ identifier }).strict(),
      (db, person, args) => discussionView(db, person, args.identifier)),
    issueMutation(env, { name: 'issue.comments_and_safe_comment_removal', title: 'Add an issue comment or thread reply', clauses: ['ISSUE-008', 'ISSUE-008', 'ISSUE-013'],
      schema: issueInput(z.object({ body: z.string().trim().min(1).max(100000), parentId: nativeId.optional() }).strict()), method: 'POST', path: '/issues/:identifier/comments',
      async run(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        const id = await addComment(db, issue.id, person.id, args.input.body, args.input.parentId);
        return { id, version: 0, discussion: await discussionView(db, person, args.identifier) };
      } }),
    ...(['PATCH', 'DELETE'] as const).map(method => issueMutation(env, {
      name: method === 'PATCH' ? 'issue.edit_comment' : 'issue.remove_comment', title: method === 'PATCH' ? 'Edit an authored issue comment' : 'Permanently remove an issue comment',
      clauses: ['ISSUE-008'], schema: commentArgs(z.object({ expectedVersion: z.number().int().nonnegative(),
        ...(method === 'PATCH' ? { body: z.string().trim().min(1).max(100000) } : {}) }).strict()),
      method, path: '/issues/:identifier/comments/:itemId', params: args => ({ identifier: args.identifier, itemId: args.itemId }), revision: commentRevision,
      classes: method === 'DELETE' ? ['destructive'] : ['standard'],
      async classify(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        await commentRevision(db, person, args);
        const links = method === 'DELETE' ? await db.prepare('SELECT count(*) n FROM issue_links WHERE issue_id=? AND comment_id=? AND deleted_at IS NULL').bind(issue.id, args.itemId).first<number>('n') : 0;
        return [{ class: method === 'DELETE' ? 'destructive' : 'standard', facts: { measure: 1 + (links ?? 0) } }];
      },
      async run(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        if (!await changeComment(db, issue, args.itemId, person.id, method === 'DELETE' ? null : args.input.body, args.input.expectedVersion)) throw new ToolRefusal('not_found');
        return { updated: true, discussion: await discussionView(db, person, args.identifier) };
      },
    })),
    issueMutation(env, { name: 'issue.discussion_threads_and_resolution', title: 'Resolve or reopen an issue discussion thread', clauses: ['ISSUE-008'],
      schema: commentArgs(z.object({ resolved: z.boolean() }).strict()), method: 'POST', path: '/issues/:identifier/comments/:itemId/resolution',
      params: args => ({ identifier: args.identifier, itemId: args.itemId }), revision: commentRevision,
      async run(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        await changeResolution(db, issue, args.itemId, person.id, args.input.resolved);
        return { resolved: args.input.resolved, discussion: await discussionView(db, person, args.identifier) };
      } }),
    issueRead(env, 'issue.read_reactions', 'Read issue and comment reactions', ['ISSUE-017'], z.object({ identifier }).strict(),
      async (db, person, args) => { const issue = await requireIssueAccess(db, args.identifier, person.id); return readIssueReactions(db, issue.id, person.id); }),
    ...(['PUT', 'DELETE'] as const).map(method => issueMutation(env, {
      name: method === 'PUT' ? 'issue.reactions' : 'issue.remove_reaction', title: method === 'PUT' ? 'React to an issue or comment' : 'Remove a personal reaction',
      clauses: ['ISSUE-017'], schema: issueInput(reactionInput), method, path: '/issues/:identifier/reactions',
      async run(db, person, args) {
        const issue = await requireIssueAccess(db, args.identifier, person.id);
        if (!await changeIssueReaction(db, issue.id, person.id, args.input, method)) throw new ToolRefusal('not_found');
        return readIssueReactions(db, issue.id, person.id);
      },
    })),
  ];
}
