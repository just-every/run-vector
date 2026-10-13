import { searchAdmission, SearchAccessError, type SearchFence } from "./access";
export { getSearchOptions } from "./options";

export const SEARCH_RESULT_LIMIT = 50;
export class SearchIndexError extends Error {
  constructor(
    readonly lastSuccessfulIndexAt: string | null,
    options: ErrorOptions,
  ) {
    super(
      "Search is unavailable because its index could not be read. Try again after the index is repaired.",
      options,
    );
  }
}
type SearchResult = {
  issues: { id: string; identifier: string; title: string }[];
  projects: { id: string; name: string }[];
  savedViews: { id: string; name: string; isShared: boolean }[];
};

// Treat every Unicode word as literal input, never as FTS syntax. Prefix matching
// supports the palette while quotes, punctuation and operators cannot alter SQL.
export function searchExpression(query: string) {
  return (query.normalize("NFC").match(/[\p{L}\p{N}\p{M}]+/gu) ?? [])
    .slice(0, 32)
    .map((word) => `"${word}"*`)
    .join(" AND ");
}
const archiveIssue = `( ?=1 OR (t.archived_at IS NULL AND (p.id IS NULL OR p.archived_at IS NULL)))`;

export async function searchWorkspace(
  db: D1Database,
  operatorId: string,
  query: string,
  includeArchived: boolean,
  fence?: SearchFence,
): Promise<SearchResult> {
  const admission = await searchAdmission(db, operatorId, fence);
  const term = query.trim().slice(0, 1000);
  // Primary lookup intentionally precedes touching any FTS table. It also applies
  // the same archive and workspace admission as full-text results.
  const exact = await db
    .prepare(
      `SELECT i.id,i.identifier,i.title, ${archiveIssue} AS visible FROM operators actor
    JOIN issues i ON i.identifier=? COLLATE NOCASE
    JOIN teams t ON t.id=i.team_id AND t.workspace_id=actor.workspace_id
    LEFT JOIN projects p ON p.id=i.project_id
    WHERE ${admission.sql}`,
    )
    .bind(Number(includeArchived), term, ...admission.values)
    .first<SearchResult["issues"][number] & { visible: number }>();
  const expression = searchExpression(term);
  if (!expression) {
    const admitted = await db
      .prepare(`SELECT actor.id FROM operators actor WHERE ${admission.sql}`)
      .bind(...admission.values)
      .first();
    if (!admitted) throw new SearchAccessError();
    return { issues: [], projects: [], savedViews: [] };
  }
  let row: { issues: string; projects: string; savedViews: string } | null;
  try {
    // One SQLite snapshot owns results AND final native/operator/workspace and
    // view-privacy admission. Only a bounded DTO crosses the D1 boundary.
    row = await db
      .prepare(
        `SELECT
      (SELECT json_group_array(json_object('id',id,'identifier',identifier,'title',title)) FROM (
        SELECT i.id,i.identifier,i.title,0 AS placement,0 AS score
        FROM issues i JOIN teams t ON t.id=i.team_id AND t.workspace_id=actor.workspace_id
        LEFT JOIN projects p ON p.id=i.project_id
        WHERE i.id=? AND i.identifier=? COLLATE NOCASE AND ${archiveIssue}
        UNION ALL
        SELECT i.id,i.identifier,i.title,1 AS placement,0 AS score FROM ik_provenance s
        JOIN issues i ON i.id=s.target_id
        JOIN teams t ON t.id=i.team_id AND t.workspace_id=actor.workspace_id
        LEFT JOIN projects p ON p.id=i.project_id
        WHERE s.destination=actor.workspace_id AND s.target_kind='issue' AND s.reversed=0
          AND (json_extract(s.record_json,'$.sourceId')=? COLLATE NOCASE OR EXISTS(SELECT 1 FROM issue_activity a WHERE a.issue_id=i.id AND a.kind='issue.imported' AND json_extract(a.next_value_json,'$.sourceKey')=? COLLATE NOCASE)) AND i.identifier<>? COLLATE NOCASE AND ${archiveIssue}
        UNION ALL
        SELECT i.id,i.identifier,i.title,2 AS placement,f.rank AS score FROM search_issues f
        JOIN issues i ON i.id=f.id
        JOIN teams t ON t.id=i.team_id AND t.workspace_id=actor.workspace_id
        LEFT JOIN projects p ON p.id=i.project_id
        WHERE search_issues MATCH ? AND i.identifier<>? COLLATE NOCASE AND ${archiveIssue}
          AND NOT EXISTS(SELECT 1 FROM ik_provenance s WHERE s.target_id=i.id AND s.target_kind='issue' AND s.reversed=0 AND (json_extract(s.record_json,'$.sourceId')=? COLLATE NOCASE OR EXISTS(SELECT 1 FROM issue_activity a WHERE a.issue_id=i.id AND a.kind='issue.imported' AND json_extract(a.next_value_json,'$.sourceKey')=? COLLATE NOCASE)))
        ORDER BY placement,score,identifier LIMIT ${SEARCH_RESULT_LIMIT}
      )) AS issues,
      (SELECT json_group_array(json_object('id',id,'name',name)) FROM (
        SELECT p.id,p.name FROM search_projects f JOIN projects p ON p.id=f.id
        WHERE search_projects MATCH ? AND p.workspace_id=actor.workspace_id
          AND (?=1 OR p.archived_at IS NULL)
        ORDER BY f.rank,p.name,p.id LIMIT ${SEARCH_RESULT_LIMIT}
      )) AS projects,
      (SELECT json_group_array(json_object('id',id,'name',name,'isShared',json(CASE WHEN is_shared=1 THEN 'true' ELSE 'false' END))) FROM (
        SELECT v.id,v.name,v.is_shared FROM search_views f JOIN saved_views v ON v.id=f.id
        WHERE search_views MATCH ? AND v.workspace_id=actor.workspace_id
          AND (v.is_shared=1 OR v.owner_operator_id=actor.id)
        ORDER BY f.rank,v.name,v.id LIMIT ${SEARCH_RESULT_LIMIT}
      )) AS savedViews
      FROM operators actor WHERE ${admission.sql}`,
      )
      .bind(
        exact?.id ?? null,
        term,
        Number(includeArchived),
        // Stable source ID and retained Jira key both resolve.
        term,
        term,
        term,
        Number(includeArchived),
        expression,
        term,
        Number(includeArchived),
        term,
        term,
        expression,
        Number(includeArchived),
        expression,
        ...admission.values,
      )
      .first<typeof row>();
  } catch (cause) {
    // Do not return the earlier primary snapshot: removal, session revocation,
    // workspace moves and archive changes can commit while FTS is being read.
    const current = await db
      .prepare(
        `SELECT (
        SELECT json_object('id',i.id,'identifier',i.identifier,'title',i.title,'visible',${archiveIssue})
        FROM issues i JOIN teams t ON t.id=i.team_id AND t.workspace_id=actor.workspace_id
        LEFT JOIN projects p ON p.id=i.project_id
        WHERE i.identifier=? COLLATE NOCASE
      ) AS issue FROM operators actor WHERE ${admission.sql}`,
      )
      .bind(Number(includeArchived), term, ...admission.values)
      .first<{ issue: string | null }>();
    if (!current) throw new SearchAccessError();
    if (current.issue) {
      const { visible, ...issue } = JSON.parse(
        current.issue,
      ) as SearchResult["issues"][number] & { visible: number };
      return { issues: visible ? [issue] : [], projects: [], savedViews: [] };
    }
    const state = await db
      .prepare(
        "SELECT last_successful_index_at FROM search_index_state WHERE id=1",
      )
      .first<{ last_successful_index_at: string }>();
    throw new SearchIndexError(state?.last_successful_index_at ?? null, {
      cause,
    });
  }
  if (!row) throw new SearchAccessError();
  return {
    issues: JSON.parse(row.issues),
    projects: JSON.parse(row.projects),
    savedViews: JSON.parse(row.savedViews),
  };
}
