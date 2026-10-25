import { reminderTimeSchema } from "./schema";
import { hasPendingOperatorFiles } from "./removal-files";
import { createUlid } from "../../shared/ids";
import { timezoneSchema } from "../bootstrap/config";
import { readPersonalTime } from "./personal-time";
import type { Role } from "../roles/matrix";

export class SettingsError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: 400 | 401 | 403 | 404 | 409,
  ) {
    super(message);
  }
}

export async function settingsActor(db: D1Database, actor: string) {
  const row = await db
    .prepare(
      `SELECT o.workspace_id,o.role,w.setup_operator_id FROM operators o
    LEFT JOIN workspace_installation w ON w.workspace_id=o.workspace_id WHERE o.id=? AND o.removed_at IS NULL`,
    )
    .bind(actor)
    .first<{ workspace_id: string; role: Role; setup_operator_id: string | null }>();
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
      "SELECT w.id,w.name,w.timezone,w.reminder_time AS reminderTime,w.member_invites=1 AS memberInvites,i.setup_operator_id AS setupOperatorId FROM workspace_settings w LEFT JOIN workspace_installation i ON i.workspace_id=w.id WHERE w.id=?",
    )
    .bind(access.workspace_id)
    .first<{ memberInvites: number }>();
  const operators = await db
    .prepare(
      `SELECT id,name,email,role,created_at AS createdAt,(SELECT json_group_array(team_id) FROM team_members m WHERE m.operator_id=operators.id) AS teamIdsJson FROM operators
    WHERE workspace_id=? AND removed_at IS NULL ORDER BY created_at,id`,
    )
    .bind(access.workspace_id)
    .all();
  const {
    workspaceTimezone: _timezone,
    reminderTime: _reminderTime,
    ...personalTime
  } = await readPersonalTime(db, actor);
  const current = await settingsActor(db, actor);
  return {
    workspace: workspace && { ...workspace, memberInvites: workspace.memberInvites === 1 },
    operators: operators.results.map(({ teamIdsJson,...member }) => ({...member,teamIds:JSON.parse(String(teamIdsJson))})),
    teams: (await db.prepare('SELECT id,name FROM teams WHERE workspace_id=? AND archived_at IS NULL ORDER BY name,id').bind(access.workspace_id).all()).results,
    operatorId: actor,
    role: current.role,
    personalTime,
  };
}

/** The recorded first owner can replace an untouched UTC bootstrap default once.
 * The timestamp predicate is checked in the write, preserving every later choice. */
export async function initializeWorkspaceTimezone(db: D1Database, actor: string, timezone: string) {
  await db.prepare(`UPDATE workspace_settings SET timezone=?,updated_at=?
    WHERE timezone='UTC' AND created_at=updated_at AND id IN (
      SELECT i.workspace_id FROM workspace_installation i JOIN operators o ON o.id=i.setup_operator_id
      WHERE i.setup_operator_id=? AND o.role='owner' AND o.removed_at IS NULL AND o.workspace_id=i.workspace_id
    )`).bind(timezone, new Date().toISOString(), actor).run();
}

export async function updateWorkspaceTime(
  db: D1Database,
  actor: string,
  timezone: string,
  reminderTime?: string,
  memberInvites?: boolean,
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
  const invites = memberInvites === undefined ? null : Number(memberInvites);
  const [result] = await db.batch<{ id: string }>([
    db.prepare(
      `UPDATE workspace_settings SET timezone=?,reminder_time=COALESCE(?,reminder_time),member_invites=COALESCE(?,member_invites),updated_at=?
    WHERE id=(SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL)
    RETURNING id`,
    ).bind(timezone, reminderTime ?? null, invites, at, actor),
    // Turning Member invitations off stops the links Members already sent.
    db.prepare(
      `UPDATE oa_tokens SET revoked_at=? WHERE ?=0 AND kind='invite' AND consumed_at IS NULL AND revoked_at IS NULL
    AND issuer_id IN (SELECT m.auth_id FROM vector_auth_operators m JOIN operators o ON o.id=m.operator_id
      WHERE o.role IN ('member','guest','viewer') AND o.workspace_id=(SELECT workspace_id FROM operators WHERE id=?))`,
    ).bind(Date.parse(at), invites ?? 1, actor),
  ]);
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
  const owners = await db
    .prepare(
      "SELECT count(*) AS count, sum(id=?) AS target FROM operators WHERE workspace_id=? AND removed_at IS NULL AND role='owner'",
    )
    .bind(target, access.workspace_id)
    .first<{ count: number; target: number }>();
  if (owners?.target && owners.count <= 1)
    throw new SettingsError(
      "last_owner",
      "The last Owner cannot be demoted or removed. Make another member an Owner first.",
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
