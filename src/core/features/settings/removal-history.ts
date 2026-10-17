/** These are the operator references written by native activity producers.
 * Custom fields, extension payloads, strings and arrays are retained verbatim.
 * JSON paths deliberately target only the top-level native reference field.
 */
export function anonymizeActivityStatements(
  db: D1Database,
  target: string,
  receipt: string,
) {
  return [
    db.prepare(`UPDATE issue_description_revisions SET actor_operator_id=NULL,actor_name=NULL
      WHERE actor_operator_id=? AND EXISTS(SELECT 1 FROM operator_removals WHERE id=?)`).bind(target,receipt),
    ...(
    [
      ["issue_activity", "assigneeOperatorId"],
      ["project_activity", "leadOperatorId"],
    ] as const
  ).map(([table, field]) => {
    const matches = (column: string) =>
      `json_type(${column})='object' AND json_extract(${column},'$.${field}')=?`;
    const redact = (column: string) =>
      `CASE WHEN ${matches(column)} THEN json_set(${column},'$.${field}',NULL) ELSE ${column} END`;
    return db
      .prepare(
        `UPDATE ${table} SET
      actor_operator_id=CASE WHEN actor_operator_id=? THEN NULL ELSE actor_operator_id END,
      previous_value_json=${redact("previous_value_json")},next_value_json=${redact("next_value_json")}
      WHERE EXISTS(SELECT 1 FROM operator_removals WHERE id=?)
        AND (actor_operator_id=? OR (${matches("previous_value_json")}) OR (${matches("next_value_json")}))`,
      )
      .bind(target, target, target, receipt, target, target, target);
  }),
  ];
}
