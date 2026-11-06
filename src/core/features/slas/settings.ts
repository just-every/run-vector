import {
  administrationContext,
  ownedRow,
  audit,
  commit,
  guard,
  SettingsError,
} from "../administration/transaction";
import { settingsActor } from "../settings/repository";
import type { SlaInput } from "./schema";
export async function readSla(db: D1Database, actor: string, teamId: string) {
  const person = await settingsActor(db, actor);
  const row = await db
    .prepare(
      "SELECT w.timezone,r.body_json FROM teams t JOIN workspace_settings w ON w.id=t.workspace_id LEFT JOIN team_slas r ON r.team_id=t.id WHERE t.id=? AND t.workspace_id=? AND t.archived_at IS NULL",
    )
    .bind(teamId, person.workspace_id)
    .first<{ timezone: string; body_json: string | null }>();
  if (!row)
    throw new SettingsError("not_found", "This team is unavailable.", 404);
  return {
    timezone: row.timezone,
    rule: row.body_json ? (JSON.parse(row.body_json) as SlaInput) : null,
  };
}
export async function saveSla(
  db: D1Database,
  actor: string,
  teamId: string,
  input: SlaInput,
) {
  const ctx = await administrationContext(db, actor);
  const team = await ownedRow<{ archived_at: string | null }>(
    ctx,
    "teams",
    teamId,
  );
  if (team.archived_at)
    throw new SettingsError("team_archived", "Unarchive this team first.", 409);
  const previous = await readSla(ctx.db, actor, teamId);
  await commit(ctx, [
    guard(
      ctx.db,
      `? IS NULL OR EXISTS(SELECT 1 FROM labels WHERE id=? AND workspace_id=?)`,
      input.labelId,
      input.labelId,
      ctx.workspace,
    ),
    ctx.db
      .prepare(
        `INSERT INTO team_slas(team_id,body_json,revision,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(team_id) DO UPDATE SET body_json=excluded.body_json,revision=excluded.revision,created_at=excluded.created_at,updated_at=excluded.updated_at`,
      )
      .bind(teamId, JSON.stringify(input), crypto.randomUUID(), ctx.at, ctx.at),
    ...audit(ctx, "team.sla.updated", teamId, teamId, previous.rule, input),
  ]);
}
