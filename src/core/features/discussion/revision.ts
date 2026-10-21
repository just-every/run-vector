/** Native edits (including checklist edits) append retained activity in the
 * same transaction. Counting those receipts gives existing and imported comments
 * a monotonic revision without a migration or timestamp-resolution races.
 * The caller's comment table alias must be c. */
export const commentVersionSql = `(SELECT COUNT(*) FROM issue_activity a
 WHERE a.issue_id=c.issue_id AND a.kind='comment.edited'
 AND json_extract(a.next_value_json,'$.id')=c.id)`;

export class CommentVersionError extends Error {
  readonly code = "stale_version";
  constructor() { super("The comment changed. Read it again before editing or deleting it."); }
}
