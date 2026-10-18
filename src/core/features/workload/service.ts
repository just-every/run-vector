import { settingsActor, SettingsError } from "../settings/repository";
import {
  administrationContext,
  audit,
  commit,
  guard,
} from "../administration/transaction";
import { workloadSchema, type WorkloadQuery } from "./schema";

async function scopeFor(db: D1Database, actor: string, query: WorkloadQuery) {
  const { workspace_id: workspace } = await settingsActor(db, actor);
  const timezone = await db
    .prepare("SELECT timezone FROM workspace_settings WHERE id=?")
    .bind(workspace)
    .first<string>("timezone");
  if (query.cycleId) {
    const cycle = await db
      .prepare(
        "SELECT c.name,c.team_id FROM cycles c JOIN teams t ON t.id=c.team_id WHERE c.id=? AND t.workspace_id=?",
      )
      .bind(query.cycleId, workspace)
      .first<{ name: string; team_id: string }>();
    if (!cycle)
      throw new SettingsError("not_found", "Cycle is unavailable.", 404);
    return {
      workspace,
      timezone,
      key: "cycle:" + query.cycleId,
      title: cycle.name,
      where: "i.cycle_id=? AND i.team_id=?",
      values: [query.cycleId, cycle.team_id],
    };
  }
  return {
    workspace,
    timezone,
    key: `dates:${query.from}:${query.to}`,
    title: `${query.from} – ${query.to}`,
    where: "i.due_date>=? AND i.due_date<=?",
    values: [query.from!, query.to!],
  };
}
export async function readWorkload(
  db: D1Database,
  actor: string,
  query: WorkloadQuery,
) {
  const scope = await scopeFor(db, actor, query);
  const [people, capacities, issues] = await Promise.all([
    db
      .prepare(
        "SELECT id,name FROM operators WHERE workspace_id=? AND removed_at IS NULL ORDER BY name COLLATE NOCASE,id",
      )
      .bind(scope.workspace)
      .all<{ id: string; name: string }>(),
    db
      .prepare(
        "SELECT operator_id,capacity,version FROM workload_capacities WHERE workspace_id=? AND scope_key=?",
      )
      .bind(scope.workspace, scope.key)
      .all<{ operator_id: string; capacity: number | null; version: number }>(),
    db
      .prepare(
        `SELECT i.identifier,i.title,i.estimate,i.assignee_operator_id FROM issues i JOIN workflow_statuses s ON s.id=i.status_id JOIN teams t ON t.id=i.team_id WHERE t.workspace_id=? AND ${scope.where} AND s.category NOT IN ('canceled','duplicate') ORDER BY i.identifier`,
      )
      .bind(scope.workspace, ...scope.values)
      .all<{
        identifier: string;
        title: string;
        estimate: number | null;
        assignee_operator_id: string | null;
      }>(),
  ]);
  const rows = [
    ...people.results.map((person) => ({
      operatorId: person.id as string | null,
      name: person.name,
    })),
    { operatorId: null, name: "Unassigned" },
  ].map((person) => {
    const assigned = issues.results.filter(
      (issue) => issue.assignee_operator_id === person.operatorId,
    );
    const saved = capacities.results.find(
      (row) => row.operator_id === person.operatorId,
    );
    const points = assigned.reduce((n, issue) => n + (issue.estimate ?? 0), 0);
    const unestimated = assigned.filter(
      (issue) => issue.estimate === null,
    ).length;
    const capacity = saved?.capacity ?? null;
    return {
      ...person,
      points,
      issueCount: assigned.length,
      unestimated,
      capacity,
      version: saved?.version ?? 0,
      state:
        capacity !== null && points > capacity
          ? "over-capacity"
          : capacity === null || unestimated > 0
            ? "unknown"
            : "within-capacity",
      issues: assigned.map(({ identifier, title, estimate }) => ({
        identifier,
        title,
        estimate,
      })),
    };
  });
  if ((await settingsActor(db, actor)).workspace_id !== scope.workspace)
    throw new SettingsError(
      "unauthenticated",
      "Workspace changed. Sign in again.",
      401,
    );
  return workloadSchema.parse({
    operatorId: actor,
    scope: scope.key,
    title: scope.title,
    timezone: scope.timezone,
    rows,
  });
}
export async function setCapacity(
  db: D1Database,
  actor: string,
  query: WorkloadQuery,
  input: { capacity: number | null; expectedVersion: number },
) {
  const ctx = await administrationContext(db, actor);
  const scope = await scopeFor(ctx.db, actor, query);
  const previous = await ctx.db
    .prepare(
      "SELECT capacity,version FROM workload_capacities WHERE workspace_id=? AND operator_id=? AND scope_key=?",
    )
    .bind(ctx.workspace, actor, scope.key)
    .first<{ capacity: number | null; version: number }>();
  if ((previous?.version ?? 0) !== input.expectedVersion)
    throw new SettingsError(
      "stale_version",
      "Capacity changed. Reload and try again.",
      409,
    );
  await commit(ctx, [
    guard(
      ctx.db,
      "COALESCE((SELECT version FROM workload_capacities WHERE workspace_id=? AND operator_id=? AND scope_key=?),0)=?",
      ctx.workspace,
      actor,
      scope.key,
      input.expectedVersion,
    ),
    ctx.db
      .prepare(
        "INSERT INTO workload_capacities(workspace_id,operator_id,scope_key,capacity,version,updated_at) VALUES(?,?,?,?,1,?) ON CONFLICT(workspace_id,operator_id,scope_key) DO UPDATE SET capacity=excluded.capacity,version=workload_capacities.version+1,updated_at=excluded.updated_at",
      )
      .bind(ctx.workspace, actor, scope.key, input.capacity, ctx.at),
    ...audit(
      ctx,
      "workload.capacity_changed",
      actor,
      scope.key,
      previous?.capacity ?? null,
      input.capacity,
    ),
  ]);
}
