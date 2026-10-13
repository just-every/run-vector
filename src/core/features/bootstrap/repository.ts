import { createUlid } from "../../shared/ids";
import {
  bootstrapConfig,
  BootstrapConfigurationError,
  type BootstrapEnvironment,
} from "./config";

const statuses = [
  ["Intake", "intake"],
  ["Backlog", "backlog"],
  ["Todo", "unstarted"],
  ["In progress", "started"],
  ["Done", "completed"],
  ["Canceled", "canceled"],
  ["Duplicate", "duplicate"],
] as const;

/** Provision only explicit installation inputs; never infer an owner from a request. */
export async function bootstrapWorkspace(
  db: D1Database,
  env: BootstrapEnvironment,
  now = new Date(),
) {
  const config = bootstrapConfig(env);
  const existing = await db
    .prepare("SELECT id FROM workspace_settings LIMIT 2")
    .all<{ id: string }>();
  if (existing.results.length) {
    if (existing.results.length !== 1)
      throw new BootstrapConfigurationError(
        "Bootstrap requires a single workspace.",
      );
    // Prior installations have no trustworthy setup-owner marker. Only explicit
    // installer configuration may associate their existing active operator.
    await db
      .prepare(
        `INSERT INTO workspace_installation(workspace_id,setup_operator_id,created_at,updated_at)
      SELECT workspace_id,id,?,? FROM operators WHERE workspace_id=? AND lower(email)=? AND removed_at IS NULL
      ON CONFLICT(workspace_id) DO NOTHING`,
      )
      .bind(
        now.toISOString(),
        now.toISOString(),
        existing.results[0].id,
        config.email,
      )
      .run();
    if (
      !(await db
        .prepare(
          "SELECT workspace_id FROM workspace_installation WHERE workspace_id=?",
        )
        .bind(existing.results[0].id)
        .first())
    ) {
      throw new BootstrapConfigurationError(
        "The configured owner must match an existing active operator.",
      );
    }
    return;
  }
  const workspaceId = createUlid(now),
    ownerId = createUlid(now),
    teamId = createUlid(now);
  const at = now.toISOString();
  const ownClaim =
    "EXISTS(SELECT 1 FROM workspace_bootstrap WHERE id=1 AND workspace_id=?)";
  await db.batch([
    db
      .prepare(
        `INSERT INTO workspace_bootstrap(id,workspace_id,created_at)
      SELECT 1,?,? WHERE NOT EXISTS(SELECT 1 FROM workspace_settings) ON CONFLICT(id) DO NOTHING`,
      )
      .bind(workspaceId, at),
    db
      .prepare(
        `INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at)
      SELECT ?,?,?,?,? WHERE ${ownClaim}`,
      )
      .bind(
        workspaceId,
        config.workspace,
        config.timezone,
        at,
        at,
        workspaceId,
      ),
    db
      .prepare(
        `INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at)
      SELECT ?,?,?,?,?,? WHERE ${ownClaim}`,
      )
      .bind(
        ownerId,
        workspaceId,
        config.name,
        config.email,
        at,
        at,
        workspaceId,
      ),
    db
      .prepare(
        `INSERT INTO workspace_installation(workspace_id,setup_operator_id,created_at,updated_at) SELECT ?,?,?,? WHERE ${ownClaim}`,
      )
      .bind(workspaceId, ownerId, at, at, workspaceId),
    db
      .prepare(
        `INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at)
      SELECT ?,?,?,?,?,? WHERE ${ownClaim}`,
      )
      .bind(
        teamId,
        workspaceId,
        config.team,
        config.prefix,
        at,
        at,
        workspaceId,
      ),
    ...statuses.map(([name, category], position) =>
      db
        .prepare(
          `INSERT INTO workflow_statuses(id,team_id,name,category,position,created_at,updated_at)
      SELECT ?,?,?,?,?,?,? WHERE ${ownClaim}`,
        )
        .bind(
          createUlid(now),
          teamId,
          name,
          category,
          position,
          at,
          at,
          workspaceId,
        ),
    ),
    db.prepare(`INSERT INTO vector_http_bootstrap(id,snapshot)
      SELECT 1,snapshot FROM vector_http_bootstrap_current WHERE ${ownClaim}
      ON CONFLICT(id) DO NOTHING`).bind(workspaceId),
  ]);
}
