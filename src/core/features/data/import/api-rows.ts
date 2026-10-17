import type { Json } from '../../../../../vendor/base/import-kit/src/d1/index';
import { createLinkSchema } from '../../links/schema';
import { apiIssue } from './api-file';
import { stableImportId } from './ids';
import type { ImportActor } from './authority';
import type { ImportDiagnostic,ImportInput } from './types';

export type ApiRowEffects = { comments: Record<string,Json>[]; links: Record<string,Json>[]; blocks: string[]; parent: string; duplicateOf: string };
const instant = (value: string) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
/** Turns one row's Linear API issue into imported comments (a read-only author
 * name, no operator, no mention, no notification), named HTTPS links that are
 * never fetched, and relations to issues of the same run. Relations whose other
 * issue is not in the run, and kinds Vector has no link for, are reported. */
export function apiRowEffects(payload: Record<string,Json>, sourceId: string, row: number, input: ImportInput, actor: ImportActor, effectiveAt: string, inRun: Set<string>, errors: ImportDiagnostic[], omissions: ImportDiagnostic[]): ApiRowEffects|null {
  const issue = apiIssue(payload);
  if (!issue) return null;
  const id = stableImportId(actor.workspace, input.source, sourceId, 'issue'), result: ApiRowEffects = { comments: [], links: [], blocks: [], parent: '', duplicateOf: '' };
  const outside = (field: string, identifier: string) => omissions.push({ row, field, code: 'relation_outside_run', message: `${identifier} is not in this run, so this relation is not linked. It stays in the original API file.` });
  issue.comments.forEach((comment, index) => {
    if (!comment.body.trim() || comment.body.length > 100000 || !instant(comment.createdAt)) { errors.push({ row, field: 'api comments', code: 'invalid_api_comment', message: `Comment ${index + 1} needs a body of at most 100,000 characters and an ISO createdAt with a timezone.` }); return; }
    result.comments.push({ id: stableImportId(actor.workspace, input.source, sourceId, 'comment:' + index), issue_id: id, actor_operator_id: actor.id, body: comment.body, edited_at: null, deleted_at: null, created_at: comment.createdAt, updated_at: comment.createdAt, imported_author_name: comment.author, parent_comment_id: null, resolved_at: null, resolved_by_operator_id: null });
  });
  issue.links.forEach((link, index) => {
    const parsed = createLinkSchema.safeParse({ name: link.title.trim() || link.url.slice(0, 200), url: link.url });
    if (!parsed.success) { errors.push({ row, field: 'api attachments', code: 'unsafe_link', message: `Attachment ${index + 1} is not a HTTPS link without credentials (${link.url.split(':')[0].slice(0, 20)}:). Nothing is fetched or imported for it.` }); return; }
    result.links.push({ id: stableImportId(actor.workspace, input.source, sourceId, 'link:' + index), issue_id: id, comment_id: null, actor_operator_id: actor.id, name: parsed.data.name, url: parsed.data.url, deleted_at: null, created_at: effectiveAt, updated_at: effectiveAt });
  });
  if (issue.parent) { if (inRun.has(issue.parent)) result.parent = 'source:' + issue.parent; else outside('api parent', issue.parent); }
  for (const relation of issue.relations) {
    if (relation.type === 'blocks' || relation.type === 'duplicate') {
      if (!inRun.has(relation.identifier)) { outside('api ' + relation.type, relation.identifier); continue; }
      if (relation.type === 'blocks') result.blocks.push(relation.identifier);
      else if (!result.duplicateOf) result.duplicateOf = 'source:' + relation.identifier;
    } else omissions.push({ row, field: 'api ' + relation.type, code: 'related_not_imported', message: `Vector has no "${relation.type}" link. The relation to ${relation.identifier} stays in the original API file.` });
  }
  return result;
}
