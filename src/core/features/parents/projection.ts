export type RelatedIssueBrief = {
  id: string;
  identifier: string;
  title: string;
  status: { id: string; name: string; category: string };
};
/** Keep relations separate from the stable historical snapshot projection. */
export type ParentRelationRow = {
  id: string; identifier: string; title: string; status_id: string;
  status_name: string; category: string; relation: string;
};

export function parentRelationsStatement(db: D1Database, issueId: string) {
  return db
    .prepare(
      `SELECT related.id,related.identifier,related.title,s.id status_id,s.name status_name,s.category,'parent' relation
    FROM issue_parents link JOIN issues related ON related.id=link.parent_issue_id
    JOIN workflow_statuses s ON s.id=related.status_id WHERE link.issue_id=?1
    UNION ALL
    SELECT related.id,related.identifier,related.title,s.id,s.name,s.category,'child'
    FROM issue_parents link JOIN issues related ON related.id=link.issue_id
    JOIN workflow_statuses s ON s.id=related.status_id WHERE link.parent_issue_id=?1
    ORDER BY 2`,
    )
    .bind(issueId);
}

export function parentRelationsProjection(rows: ParentRelationRow[]) {
  const brief = (row: ParentRelationRow): RelatedIssueBrief => ({
    id: row.id,
    identifier: row.identifier,
    title: row.title,
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
