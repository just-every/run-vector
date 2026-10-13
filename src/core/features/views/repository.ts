import { browseActor } from "../issues/browse-access";
import { mutationDatabase } from "../auth/mutation-database";
export class ViewError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
  }
}
export async function viewContext(source: D1Database, actor: string) {
  const db = mutationDatabase(source, actor),
    access = await browseActor(db, actor);
  return {
    db,
    actor,
    workspace: access.workspace_id,
    at: new Date().toISOString(),
  };
}
export type ViewContext = Awaited<ReturnType<typeof viewContext>>;
export async function writeViewState(
  ctx: ViewContext,
  writes: D1PreparedStatement[],
) {
  try {
    await ctx.db.batch([
      ctx.db
        .prepare(
          "SELECT CASE WHEN EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL) THEN 1 ELSE json('view workspace changed') END",
        )
        .bind(ctx.actor, ctx.workspace),
      ...writes,
    ]);
  } catch (error) {
    await browseActor(ctx.db, ctx.actor, ctx.workspace);
    if (/UNIQUE constraint/.test(String(error)))
      throw new ViewError(
        "name_conflict",
        "You already have a view with that name.",
        409,
      );
    throw error;
  }
  await browseActor(ctx.db, ctx.actor, ctx.workspace);
}
