export type RelatedIssueBrief = {
  id: string;
  identifier: string;
  title: string;
  status: { id: string; name: string; category: string };
  assignee: { id: string; name: string } | null;
};
/** Keep relations separate from the stable historical snapshot projection. */
export type ParentRelationRow = {
  id: string; identifier: string; title: string; status_id: string;
  status_name: string; category: string; relation: string; position: number; assignee_id: string | null; assignee_name: string | null;
};

export function parentRelationsStatement(db: D1Database, issueId: string) {
  return db
    .prepare(
      `SELECT related.id,related.identifier,related.title,s.id status_id,s.name status_name,s.category,'parent' relation,0 position,o.id assignee_id,o.name assignee_name
    FROM issue_parents link JOIN issues related ON related.id=link.parent_issue_id
    JOIN workflow_statuses s ON s.id=related.status_id LEFT JOIN operators o ON o.id=related.assignee_operator_id WHERE link.issue_id=?1
    UNION ALL
    SELECT related.id,related.identifier,related.title,s.id,s.name,s.category,'child',link.position,o.id,o.name
    FROM issue_parents link JOIN issues related ON related.id=link.issue_id
    JOIN workflow_statuses s ON s.id=related.status_id LEFT JOIN operators o ON o.id=related.assignee_operator_id WHERE link.parent_issue_id=?1
    ORDER BY 8,2`,
    )
    .bind(issueId);
}

export function parentRelationsProjection(rows: ParentRelationRow[]) {
  const brief = (row: ParentRelationRow): RelatedIssueBrief => ({
    id: row.id,
    identifier: row.identifier,
    title: row.title,
    assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name! } : null,
    status: {
      id: row.status_id,
      name: row.status_name,
      category: row.category,
    },
  });
  const parent = rows.find((row) => row.relation === "parent");
  return {
    parent: parent ? brief(parent) : null,
    children: rows.filter((row) => row.relation === "child").map(brief),
  };
}
