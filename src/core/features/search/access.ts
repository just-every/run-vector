import { nativeSessionAdmission } from "../auth/projection-admission";
import type { requireOperator } from "../auth/service";

export type SearchFence = NonNullable<
  Awaited<ReturnType<typeof requireOperator>>
>["fence"];

export class SearchAccessError extends Error {
  constructor() {
    super("Sign in again to search this workspace.");
  }
}

export async function searchAdmission(
  db: D1Database,
  operatorId: string,
  fence?: SearchFence,
) {
  const actor = await db
    .prepare(
      "SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL",
    )
    .bind(operatorId)
    .first<{ workspace_id: string }>();
  if (!actor) throw new SearchAccessError();
  const session =
    fence === undefined
      ? { sql: "1", values: [] }
      : nativeSessionAdmission(fence);
  return {
    sql: `actor.id=? AND actor.workspace_id=? AND actor.removed_at IS NULL AND ${session.sql}`,
    values: [operatorId, actor.workspace_id, ...session.values],
  };
}
