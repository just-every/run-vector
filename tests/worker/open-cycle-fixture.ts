import { createUlid } from "../../src/core/shared/ids";
/** Each closure fixture owns its cycle: closed cycles cannot be reopened for cleanup. */
export async function openCycleFixture(db: D1Database, templateId: string) {
  const id = createUlid(new Date());
  await db
    .prepare(
      `INSERT INTO cycles(id,team_id,name,starts_at,ends_at,capacity,closed_at,created_at,updated_at)
  SELECT ?,team_id,name||' '||?,starts_at,ends_at,capacity,NULL,created_at,updated_at FROM cycles WHERE id=?`,
    )
    .bind(id, id, templateId)
    .run();
  return id;
}
