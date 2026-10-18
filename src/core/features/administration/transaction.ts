import {
  mutationDatabase,
  isMutationAccessError,
} from "../auth/mutation-database";
import { settingsActor, SettingsError } from "../settings/repository";
import { createUlid } from "../../shared/ids";

export { SettingsError };
export async function administrationContext(source: D1Database, actor: string) {
  const db = mutationDatabase(source, actor);
  const access = await settingsActor(db, actor);
  return {
    db,
    actor,
    workspace: access.workspace_id,
    at: new Date().toISOString(),
  };
}
export type AdministrationContext = Awaited<
  ReturnType<typeof administrationContext>
>;
export function guard(
  db: D1Database,
  condition: string,
  ...values: (string | number | null)[]
) {
  return db
    .prepare(
      `SELECT CASE WHEN (${condition}) THEN 1 ELSE json('administration conflict') END`,
    )
    .bind(...values);
}
export function workspaceGuard(ctx: AdministrationContext) {
  return guard(
    ctx.db,
    "EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL)",
    ctx.actor,
    ctx.workspace,
  );
}
export async function commit(
  ctx: AdministrationContext,
  writes: D1PreparedStatement[],
) {
  try {
    await ctx.db.batch([workspaceGuard(ctx), ...writes]);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    const message = String(error);
    if (/invalid_project_dates/.test(message))
      throw new SettingsError("invalid_project_dates", "Target date must be on or after the start date, and dates must be valid calendar dates.", 400);
    if (/invalid_project_label/.test(message))
      throw new SettingsError("invalid_project_label", "Choose workspace labels marked for projects.", 400);
    if (/project_label_in_use/.test(message))
      throw new SettingsError("project_label_in_use", "Remove this label from its projects before turning off project use.", 409);
    if (/team_prefix_frozen/.test(message))
      throw new SettingsError(
        "team_prefix_frozen",
        "The identifier prefix cannot change after this team has had an issue.",
        409,
      );
    if (
      /UNIQUE constraint|administration conflict|malformed JSON/.test(message)
    )
      throw new SettingsError(
        "administration_conflict",
        "This change conflicts with current records. Names and prefixes must be unique; refresh and check the selected options.",
        409,
      );
    throw error;
  }
}
export function audit(
  ctx: AdministrationContext,
  action: string,
  id: string,
  name: string,
  previous: unknown,
  next: unknown,
) {
  const auditId = createUlid(new Date(ctx.at));
  return [
    ctx.db
      .prepare(
        `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`,
      )
      .bind(auditId, ctx.actor, action, name, id, ctx.at, ctx.at),
    ctx.db
      .prepare(
        "INSERT INTO administration_audit_details(audit_id,previous_value_json,next_value_json) VALUES(?,?,?)",
      )
      .bind(auditId, JSON.stringify(previous), JSON.stringify(next)),
  ];
}
export async function ownedRow<T>(
  ctx: AdministrationContext,
  table: "teams" | "projects" | "labels",
  id: string,
) {
  const row = await ctx.db
    .prepare(`SELECT * FROM ${table} WHERE id=? AND workspace_id=?`)
    .bind(id, ctx.workspace)
    .first<T>();
  if (!row)
    throw new SettingsError(
      "not_found",
      "The selected record is unavailable.",
      404,
    );
  return row;
}
