import assert from "node:assert/strict";
import { writeRuntimeD1 } from "./runtime-d1.mjs";
// Saved-view authoring is outside the product UI. This real database fixture
// exercises label deletion of another operator's private filter predicates.
export async function insertPrivateViewFixture(runtime, label) {
  const owner = runtime.sql(
    "SELECT * FROM operators WHERE email='lead@admin-runtime.test'",
  )[0];
  const now = new Date().toISOString();
  const filters = {
    labelIds: [label.id],
    priority: ["high"],
    customPredicate: { retain: "unchanged" },
  };
  const id = "01J00000000000000000000999";
  // Written through the running Worker's own D1, never its SQLite file.
  await writeRuntimeD1(runtime.base,
    "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,is_shared,filters_json,sort,grouping,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    [
    id,
    owner.workspace_id,
    owner.id,
    "Private label cascade fixture",
    "issues",
    0,
    JSON.stringify(filters),
    "newest",
    "none",
    now,
    now,
  ]);
  assert.deepEqual(
    JSON.parse(
      runtime.sql(`SELECT filters_json FROM saved_views WHERE id='${id}'`)[0]
        .filters_json,
    ),
    filters,
  );
  return { id, filters };
}
