import type { D1Database } from "../../../../vendor/base/import-kit/src/d1/index";
import { storedValueSql, restoreValueSql } from "../../shared/sql/stored-value";
import type { ErasureSnapshot } from "./snapshot";
import type { ErasureOperation } from "./postcondition";

/** Compute changed SQLite values from the immutable encoded preimage, using
 * the same operations as the native writes. JSON lexemes, escapes, opaque text
 * bytes and integer arithmetic must never pass through JS value coercion. */
export async function projectedPostcondition(
  db: D1Database,
  before: ErasureSnapshot,
  operation: ErasureOperation,
): Promise<ErasureSnapshot> {
  const column = (name: string) =>
    restoreValueSql(`json_extract(r.value,'$.${name}')`);
  const project = (
    relation: string,
    replacements: Record<string, string>,
    additions = false,
  ) => {
    const fields = additions
      ? Object.keys(replacements)
      : Object.keys(before[relation][0] ?? {});
    const value =
      "json_object(" +
      fields
        .sort()
        .flatMap((name) => [
          "'" + name + "'",
          replacements[name] === undefined
            ? `json_extract(r.value,'$.${name}')`
            : storedValueSql(replacements[name]),
        ])
        .join(",") +
      ")";
    return `(SELECT json_group_array(json(value)) FROM (SELECT ${value} value FROM json_each(b.value,'$.${relation}') r))`;
  };
  const children = project("children", {
    version: `${column("version")}+1`,
    updated_at: "c.at",
  });
  const activity = project(
    "children",
    {
      id: `c.operation_id||':'||${column("id")}`,
      issue_id: column("id"),
      actor_operator_id: "c.actor",
      actor_name: "NULL",
      kind: "'issue.parent_changed'",
      previous_value_json: "json_object('parentIdentifier',c.identifier)",
      next_value_json: "json_object('parentIdentifier',NULL)",
      created_at: "c.at",
      updated_at: "c.at",
    },
    true,
  );
  const projections = {
    children,
    child_parent_activity: activity,
    integration_deliveries: project("integration_deliveries", {
      envelope: `json_set(${column("envelope")},'$.body','{}')`,
    }),
    integration_replays: project("integration_replays", {
      envelope: `json_set(${column("envelope")},'$.body','{}')`,
    }),
    integration_resolutions: project("integration_resolutions", {
      outcome: `json_set(${column("outcome")},'$.code','issue_deleted')`,
    }),
  };
  const expression =
    "json_object(" +
    Object.entries(projections)
      .flatMap(([name, sql]) => ["'" + name + "'", `json(${sql})`])
      .join(",") +
    ")";
  const result = await db
    .prepare(
      `WITH b AS (SELECT ? value),c AS (SELECT ? at,? actor,? identifier,? operation_id) SELECT ${expression} value FROM b,c`,
    )
    .bind(
      JSON.stringify(before),
      operation.at,
      operation.actor,
      operation.identifier,
      operation.operationId,
    )
    .first<{ value: string }>();
  if (!result) throw Error("IMPORT_ERASURE_NATIVE_MISSING");
  return JSON.parse(result.value) as ErasureSnapshot;
}
