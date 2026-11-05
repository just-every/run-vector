/** Guests may learn a removed identity only from content they can already read.
 * These resource tables are scoped by the API's visibility database. */
export async function readableRemovedOperatorIds(db: D1Database, workspace: string, guest: boolean) {
  const sources = [
    ['issues', 'description', ''],
    ['issue_comments', 'body', 'AND content.deleted_at IS NULL'],
    ['issue_description_revisions', 'description', ''],
    ['documents', 'body', ''],
    ['document_comments', 'body', ''],
    ['document_revisions', 'body', ''],
  ];
  const visibleReference = sources.map(([table, column, condition]) =>
    `EXISTS(SELECT 1 FROM ${table} content WHERE instr(content.${column},'@{'||o.id||'|')>0 ${condition})`,
  ).join(' OR ');
  const rows = await db.prepare(`SELECT o.id FROM operators o WHERE o.workspace_id=? AND o.removed_at IS NOT NULL
    ${guest ? `AND (${visibleReference})` : ''} ORDER BY o.id`).bind(workspace).all<{ id: string }>();
  return rows.results.map(person => person.id);
}
