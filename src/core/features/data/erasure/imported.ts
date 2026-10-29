import type { D1Sql, Json } from '../../../../../vendor/base/import-kit/src/d1/index';
import type { JiraReview } from '../import/jira-review';
import { scrubJson } from './subject';

export type ImportedCounts = { comments: number; reports: number; reportRows: number; outbox: number };
const ERASED_AUTHOR = 'Erased person';

/** Vector's own copies of imported values, rewritten in the same D1 batch as
 * import custody. Imported comments the person wrote lose their body and author
 * name and read as deleted; reports lose every cell that held a value and list
 * those rows as erased; development mail that names them is dropped; the search
 * index is merged so no deleted term survives in its shadow tables. */
export async function importedStatements(db: D1Database, values: string[], at: string): Promise<{ statements: D1Sql[]; counts: ImportedCounts }> {
  const list = JSON.stringify(values), wanted = new Set(values);
  const comments = (await db.prepare('SELECT count(*) AS n FROM issue_comments WHERE lower(trim(imported_author_name)) IN (SELECT value FROM json_each(?))').bind(list).first<{ n: number }>())!.n;
  const statements: D1Sql[] = [{
    sql: `UPDATE issue_comments SET body='',imported_author_name=?,deleted_at=COALESCE(deleted_at,?),updated_at=?
      WHERE lower(trim(imported_author_name)) IN (SELECT value FROM json_each(?))`,
    params: [ERASED_AUTHOR, at, at, list],
  }];
  // Alias identity cannot retain a source ID or source label that is itself
  // the erased person's exact value. Ordinary opaque issue keys remain valid.
  statements.push({sql:`DELETE FROM issue_aliases WHERE lower(trim(source_key)) IN(SELECT value FROM json_each(?))
    OR lower(replace(source,'vector-import:','')) IN(SELECT value FROM json_each(?))`,params:[list,list]});
  statements.push({sql:`DELETE FROM issue_alias_prefixes WHERE lower(prefix) IN(SELECT value FROM json_each(?))
    AND NOT EXISTS(SELECT 1 FROM issue_aliases a WHERE a.workspace_id=issue_alias_prefixes.workspace_id AND a.prefix=issue_alias_prefixes.prefix)`,params:[list]});
  let reports = 0, reportRows = 0;
  for (const row of (await db.prepare('SELECT job_id,report_json FROM vector_import_reports ORDER BY job_id').all<{ job_id: string; report_json: string }>()).results) {
    const report = JSON.parse(row.report_json) as { rows: Json[][]; erasedRows?: number[] } & Record<string, Json>;
    const erased = new Set(report.erasedRows ?? []);
    for (const cells of report.rows) if (cells.slice(2).some(cell => typeof cell === 'string' && wanted.has(cell.trim().toLowerCase()))) erased.add(Number(cells[0]));
    // Positional Jira cells also contain author tokens inside semicolon metadata.
    // Dropping the optional detailed review avoids leaving the same token in its
    // raw occurrence/value summaries after the structured author was erased.
    const jira=report.jiraReview as unknown as JiraReview|undefined;
    const jiraRows=jira?.concepts.flatMap(concept=>concept.occurrences.filter(item=>wanted.has(item.value.trim().toLowerCase())||Boolean(item.metadata&&wanted.has(item.metadata.author.trim().toLowerCase()))).map(item=>item.row))??[];
    const retained={...report};
    if(jiraRows.length){delete retained.jiraReview;for(const number of jiraRows)erased.add(number);}
    const scrubbed = scrubJson(retained as unknown as Json, wanted);
    if(jiraRows.length)scrubbed.changed=true;
    if (!scrubbed.changed) continue;
    reports++; reportRows += erased.size - (report.erasedRows?.length ?? 0);
    const next = { ...(scrubbed.value as Record<string, Json>), erasedRows: [...erased].sort((a, b) => a - b) };
    statements.push({ sql: 'UPDATE vector_import_reports SET report_json=? WHERE job_id=? AND report_json=?', params: [JSON.stringify(next), row.job_id, row.report_json] });
  }
  const mail = `EXISTS(SELECT 1 FROM json_each(?) v WHERE instr(lower(message),v.value)>0)`;
  const outbox = (await db.prepare(`SELECT count(*) AS n FROM rer_mail_development_outbox WHERE ${mail}`).bind(list).first<{ n: number }>())!.n;
  statements.push({ sql: `DELETE FROM rer_mail_development_outbox WHERE ${mail}`, params: [list] });
  for (const table of ['search_issues', 'search_projects', 'search_views']) statements.push({ sql: `INSERT INTO ${table}(${table}) VALUES('optimize')`, params: [] });
  return { statements, counts: { comments, reports, reportRows, outbox } };
}
