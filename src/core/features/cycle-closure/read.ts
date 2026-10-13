import {
  cycleSnapshotSchema,
  cycleFailureSchema,
  historicalCycleSchema,
} from "./schema";
export async function readCycleSnapshot(db: D1Database, cycleId: string) {
  const row = await db
    .prepare("SELECT body_json FROM cycle_snapshots WHERE cycle_id=?")
    .bind(cycleId)
    .first<{ body_json: string }>();
  return row ? cycleSnapshotSchema.parse(JSON.parse(row.body_json)) : null;
}
export async function readCycleFailure(db: D1Database, cycleId: string) {
  const row = await db
    .prepare(
      "SELECT identifiers_json,created_at FROM cycle_closure_failures WHERE cycle_id=?",
    )
    .bind(cycleId)
    .first<{ identifiers_json: string; created_at: string }>();
  return row
    ? cycleFailureSchema.parse({
        identifiers: JSON.parse(row.identifiers_json),
        createdAt: row.created_at,
      })
    : null;
}
export async function readProjectCycleHistory(
  db: D1Database,
  projectId: string,
) {
  const rows = (
    await db
      .prepare(
        `SELECT c.id,c.name,s.body_json FROM cycle_snapshots s JOIN cycles c ON c.id=s.cycle_id
  JOIN teams t ON t.id=c.team_id JOIN projects p ON p.workspace_id=t.workspace_id AND p.id=?
  WHERE EXISTS(SELECT 1 FROM json_each(s.body_json,'$.committed') j WHERE json_extract(j.value,'$.projectId')=p.id)
  ORDER BY s.closed_at DESC,c.id`,
      )
      .bind(projectId)
      .all<{ id: string; name: string; body_json: string }>()
  ).results;
  return rows.map((row) =>
    historicalCycleSchema.parse({
      cycleId: row.id,
      name: row.name,
      snapshot: JSON.parse(row.body_json),
    }),
  );
}
