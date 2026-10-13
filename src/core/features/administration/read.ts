import { readCycleSnapshot, readCycleFailure } from "../cycle-closure/read";
import seed from "../../../../seed.json";
import { settingsActor } from "../settings/repository";
import {
  administrationSchema,
  cycleDetailSchema,
  labelTextColor,
} from "./schema";
import { calculateCycleProgress } from "../cycles/progress";
import { SettingsError } from "./transaction";

const cycleColumns =
  "c.id,c.team_id AS teamId,c.name,c.starts_at AS startsAt,c.ends_at AS endsAt,c.capacity,c.closed_at AS closedAt";
export async function readAdministration(db: D1Database, actor: string) {
  const { workspace_id: workspaceId } = await settingsActor(db, actor);
  const [workspace, teams, statuses, labels, projects, operators, cycles] =
    await Promise.all([
      db
        .prepare("SELECT id,name,timezone FROM workspace_settings WHERE id=?")
        .bind(workspaceId)
        .first(),
      db
        .prepare(
          `SELECT t.id,t.name,t.identifier_prefix AS identifierPrefix,t.archived_at AS archivedAt,
      NOT EXISTS(SELECT 1 FROM team_issue_history h WHERE h.team_id=t.id) AS prefixEditable
      FROM teams t WHERE t.workspace_id=? ORDER BY t.name,t.id`,
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT s.id,s.team_id AS teamId,s.name,s.category,s.position FROM workflow_statuses s JOIN teams t ON t.id=s.team_id WHERE t.workspace_id=? ORDER BY s.position,s.id",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT id,name,color FROM labels WHERE workspace_id=? ORDER BY name,id",
        )
        .bind(workspaceId)
        .all<{ id: string; name: string; color: string }>(),
      db
        .prepare(
          "SELECT id,name,description,lead_operator_id AS leadOperatorId,target_date AS targetDate,lifecycle,archived_at AS archivedAt FROM projects WHERE workspace_id=? ORDER BY name,id",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT id,name FROM operators WHERE workspace_id=? AND removed_at IS NULL ORDER BY name,id",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          `SELECT ${cycleColumns} FROM cycles c JOIN teams t ON t.id=c.team_id WHERE t.workspace_id=? ORDER BY c.starts_at,c.id`,
        )
        .bind(workspaceId)
        .all(),
    ]);
  if ((await settingsActor(db, actor)).workspace_id !== workspaceId)
    throw new SettingsError(
      "unauthenticated",
      "Workspace changed. Sign in again.",
      401,
    );
  return administrationSchema.parse({
    workspace,
    labelsPerIssue: seed.limits.labelsPerIssue,
    teams: teams.results.map((t) => ({
      ...t,
      prefixEditable: Boolean(t.prefixEditable),
      statuses: statuses.results.filter((s) => s.teamId === t.id),
    })),
    labels: labels.results.map((l) => ({
      ...l,
      textColor: labelTextColor(l.color),
    })),
    projects: projects.results,
    operators: operators.results,
    cycles: cycles.results,
  });
}
export async function readCycle(db: D1Database, actor: string, id: string) {
  const access = await settingsActor(db, actor);
  const cycle = await db
    .prepare(
      `SELECT ${cycleColumns},w.timezone FROM cycles c JOIN teams t ON t.id=c.team_id JOIN workspace_settings w ON w.id=t.workspace_id WHERE c.id=? AND t.workspace_id=?`,
    )
    .bind(id, access.workspace_id)
    .first<{
      id: string;
      teamId: string;
      name: string;
      startsAt: string;
      endsAt: string;
      capacity: number | null;
      closedAt: string | null;
      timezone: string;
    }>();
  if (!cycle)
    throw new SettingsError("not_found", "Cycle is unavailable.", 404);
  const issues = (
    await db
      .prepare(
        `SELECT i.id,i.identifier,i.title,i.version,i.team_id AS teamId,i.status_id AS statusId,s.category,i.estimate,i.cycle_id AS cycleId FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.cycle_id=? AND i.team_id=? ORDER BY i.identifier`,
      )
      .bind(id, cycle.teamId)
      .all<{ category: string; estimate: number | null }>()
  ).results;
  const [snapshot, failure] = await Promise.all([
    readCycleSnapshot(db, id),
    readCycleFailure(db, id),
  ]);
  if ((await settingsActor(db, actor)).workspace_id !== access.workspace_id)
    throw new SettingsError(
      "unauthenticated",
      "Workspace changed. Sign in again.",
      401,
    );
  return cycleDetailSchema.parse({
    cycle: snapshot ? { ...cycle, closedAt: snapshot.closedAt } : cycle,
    workspaceTimezone: snapshot?.timezone ?? cycle.timezone,
    snapshot,
    failure,
    issues,
    progress:
      snapshot?.progress ?? calculateCycleProgress(issues, cycle.capacity),
  });
}
