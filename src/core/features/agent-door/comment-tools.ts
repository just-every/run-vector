import { z } from 'zod';
import { defineTool, ToolRefusal, type ToolContext, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import { changeComment } from '../discussion/repository';
import { moderatorSql, requireCommentChange } from '../discussion/permissions';
import { commentVersionSql } from '../discussion/revision';
import { asAgent } from './attribution';
import { nativeDatabase, nativeIssue, nativeResult, commentUri } from './native';
import { nativeInputSchema } from './schemas';

const input = z.object({
  identifier: z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/),
  itemId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
  expectedVersion: z.number().int().nonnegative(),
}).strict();

/** Resolve one persisted native comment after current role and issue admission.
 * Completed retries may inspect its tombstone, but cannot bypass current authority. */
async function admittedComment(args: Record<string, unknown>, ctx: ToolContext, completed = false) {
  const value = input.parse(args);
  const db = await nativeDatabase(ctx, 'DELETE', '/issues/:identifier/comments/:itemId', {identifier:value.identifier,itemId:value.itemId}, value);
  const issue = await nativeIssue(ctx, value.identifier);
  const comment = await db.prepare(`SELECT c.id,c.parent_comment_id AS parentId,c.resolved_at AS resolvedAt,
    c.deleted_at AS deletedAt,${commentVersionSql} AS version,1 AS itemCount,
    (c.actor_operator_id=? AND c.imported_author_name IS NULL) AS own,${moderatorSql} AS moderator
    FROM issue_comments c WHERE c.id=? AND c.issue_id=?`)
    .bind(ctx.person.id,ctx.person.id,value.itemId,issue.id)
    .first<{id:string;parentId:string|null;resolvedAt:string|null;deletedAt:string|null;version:number;itemCount:number;own:number;moderator:number}>();
  if (!comment || (!completed && comment.deletedAt !== null)) throw new ToolRefusal('not_found');
  await nativeResult(async () => requireCommentChange(comment, 'delete'));
  return { db, issue, comment, value };
}

export const commentTools: ToolDefinition[] = [defineTool({
  name: 'vector.comment.delete', title: 'Delete comment',
  description: 'Delete one currently visible native issue comment at its current revision, retaining its tombstone and replies. Native author and moderation permissions apply.',
  scope: 'comments:delete', readOnly: false, classes: ['destructive'], clauses: ['ISSUE-008','BASE-AGENT-006'],
  inputSchema: nativeInputSchema(input),
  outputSchema: {type:'object',properties:{updated:{const:true},commentId:{type:'string'},identifier:{type:'string'}},required:['updated','commentId','identifier'],additionalProperties:false},
  async classify(args,ctx,completed) {
    const {comment} = await admittedComment(args,ctx,completed !== undefined);
    // A saved effect keeps its original count; record text and caller claims
    // never participate in the classifier or authorize another deletion.
    return completed ? completed.map(item => ({...item,facts:{...item.facts}}))
      : [{class:'destructive',facts:{measure:comment.itemCount}}];
  },
  async revision(args,ctx) { return (await admittedComment(args,ctx)).comment.version; },
  async target(args,ctx) { return {kind:'comment',id:(await admittedComment(args,ctx)).comment.id}; },
  async summary(args,ctx) {
    const {issue,comment} = await admittedComment(args,ctx);
    return {target:{id:comment.id,name:issue.identifier},items:[`Delete one comment at revision ${comment.version}; retain its tombstone and replies`]};
  },
  async run(args,ctx) {
    const {db,issue,comment,value} = await admittedComment(args,ctx);
    return nativeResult(() => asAgent(ctx,async () => {
      if (!await changeComment(db,issue,comment.id,ctx.person.id,null,value.expectedVersion)) throw new ToolRefusal('not_found');
      return {result:{updated:true,commentId:comment.id,identifier:issue.identifier},resources:[{uri:commentUri(comment.id),name:`${issue.identifier} comment`}]};
    }));
  },
})];
