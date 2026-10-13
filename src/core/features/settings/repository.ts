import { reminderTimeSchema } from "./schema";
import { hasPendingOperatorFiles } from "./removal-files";
import { createUlid } from "../../shared/ids";
import { timezoneSchema } from "../bootstrap/config";

export class SettingsError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: 400 | 401 | 404 | 409,
  ) {
    super(message);
  }
}

export async function settingsActor(db: D1Database, actor: string) {
  const row = await db
    .prepare(
      `SELECT o.workspace_id,w.setup_operator_id FROM operators o
    LEFT JOIN workspace_installation w ON w.workspace_id=o.workspace_id WHERE o.id=? AND o.removed_at IS NULL`,
    )
    .bind(actor)
    .first<{ workspace_id: string; setup_operator_id: string | null }>();
  if (!row)
    throw new SettingsError(
      "unauthenticated",
      "Sign in again to manage settings.",
      401,
    );
  return row;
}

export async function readSettings(db: D1Database, actor: string) {
  const access = await settingsActor(db, actor);
  const workspace = await db
    .prepare(
      "SELECT w.id,w.name,w.timezone,w.reminder_time AS reminderTime,i.setup_operator_id AS setupOperatorId FROM workspace_settings w LEFT JOIN workspace_installation i ON i.workspace_id=w.id WHERE w.id=?",
    )
    .bind(access.workspace_id)
    .first();
  const operators = await db
    .prepare(
      `SELECT id,name,email,created_at AS createdAt FROM operators
    WHERE workspace_id=? AND removed_at IS NULL ORDER BY created_at,id`,
    )
    .bind(access.workspace_id)
    .all();
  await settingsActor(db, actor);
  return { workspace, operators: operators.results, operatorId: actor };
}

export async function updateWorkspaceTime(
  db: D1Database,
  actor: string,
  timezone: string,
  reminderTime?: string,
) {
  if (!timezoneSchema.safeParse(timezone).success)
    throw new SettingsError(
      "invalid_timezone",
      "Choose a valid IANA timezone.",
      400,
    );
  if (
    reminderTime !== undefined &&
    !reminderTimeSchema.safeParse(reminderTime).success
  )
    throw new SettingsError(
      "invalid_reminder_time",
      "Choose a 24-hour reminder time.",
      400,
    );
  const at = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE workspace_settings SET timezone=?,reminder_time=COALESCE(?,reminder_time),updated_at=?
    WHERE id=(SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL)
    RETURNING id`,
    )
    .bind(timezone, reminderTime ?? null, at, actor)
    .run<{ id: string }>();
  // Count direct workspace rows, excluding writes made by revision triggers.
  if (result.results.length !== 1)
    throw new SettingsError(
      "unauthenticated",
      "Sign in again to manage settings.",
      401,
    );
}

export async function assertRemovalAllowed(
  db: D1Database,
  actor: string,
  target: string,
) {
  const access = await settingsActor(db, actor);
  if (!access.setup_operator_id)
    throw new SettingsError(
      "setup_owner_unknown",
      "Configure the installation owner before removing operators.",
      409,
    );
  const found = await db
    .prepare(
      "SELECT id FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL",
    )
    .bind(target, access.workspace_id)
    .first();
  if (!found)
    throw new SettingsError("not_found", "Operator is unavailable.", 404);
  if (target === access.setup_operator_id && actor !== target)
    throw new SettingsError(
      "setup_owner_protected",
      "Only the setup operator can remove themselves.",
      409,
    );
  const remaining = await db
    .prepare(
      "SELECT count(*) AS count FROM operators WHERE workspace_id=? AND removed_at IS NULL AND id<>?",
    )
    .bind(access.workspace_id, target)
    .first<{ count: number }>();
  if (!remaining?.count)
    throw new SettingsError(
      "last_operator",
      "The last operator cannot be removed.",
      409,
    );
  if (await hasPendingOperatorFiles(db, target))
    throw new SettingsError(
      "operator_files_pending",
      "An upload or file removal is still settling. Finish file recovery and retry operator removal.",
      409,
    );
  return access;
}

export function removalId() {
  return createUlid(new Date());
}
