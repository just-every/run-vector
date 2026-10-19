export type CopySource = {
  id: string;
  identifier: string;
  team_id: string;
  title: string;
  description: string;
  status_id: string;
  priority: string;
  project_id: string | null;
  cycle_id: string | null;
  due_date: string | null;
  estimate: number | null;
  expected_outcome: string | null;
  customer_impact: string | null;
  custom_fields_json: string;
  version: number;
  parent_id: string | null;
  position: number;
  labels: string[];
  links: { id: string; name: string; url: string }[];
};
const fields = [
  "id",
  "identifier",
  "team_id",
  "title",
  "description",
  "status_id",
  "priority",
  "project_id",
  "cycle_id",
  "due_date",
  "estimate",
  "expected_outcome",
  "customer_impact",
  "custom_fields_json",
  "version",
];
/** The same ordered SQL snapshot is read and compared inside the final batch.
 * Links do not change issue versions, and children may be added while preparing. */
export function copySnapshotSql() {
  return `WITH RECURSIVE tree(id,depth) AS (
    SELECT id,0 FROM issues WHERE identifier=?
    UNION ALL SELECT p.issue_id,tree.depth+1 FROM issue_parents p JOIN tree ON tree.id=p.parent_issue_id WHERE ?=1
  ) SELECT json_group_array(json_object(${fields.map((key) => `'${key}',i.${key}`).join(",")},
    'parent_id',CASE WHEN tree.depth>0 THEN p.parent_issue_id ELSE NULL END,'position',COALESCE(p.position,0),
    'labels',(SELECT json_group_array(label_id) FROM (SELECT label_id FROM issue_labels WHERE issue_id=i.id ORDER BY label_id)),
    'links',(SELECT json_group_array(json_object('id',id,'name',name,'url',url)) FROM
      (SELECT id,name,url FROM issue_links WHERE issue_id=i.id AND deleted_at IS NULL AND comment_id IS NULL AND ?=1 ORDER BY id)))) snapshot
    FROM (SELECT tree.id,tree.depth FROM tree LEFT JOIN issue_parents p ON p.issue_id=tree.id ORDER BY tree.depth,p.position,tree.id) tree
    JOIN issues i ON i.id=tree.id LEFT JOIN issue_parents p ON p.issue_id=i.id`;
}
export async function readCopySnapshot(
  db: D1Database,
  identifier: string,
  children: boolean,
  links: boolean,
) {
  const values = [identifier, Number(children), Number(links)];
  const encoded = await db
    .prepare(copySnapshotSql())
    .bind(...values)
    .first<string>("snapshot");
  if (!encoded) throw new Error("Copy snapshot was not returned.");
  return { encoded, rows: JSON.parse(encoded) as CopySource[], values };
}
