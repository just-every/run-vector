import {
  blockerStatements,
  followerBlockingStatements,
  finalizeEvent,
} from "../notifications/events";
import { activityRow } from "../issues/repository";
import { DependencyError } from "./errors";
import type { DependencyInput } from "./input";

type DependencyIssue = { id: string; identifier: string; version: number };
export type DependencyOperation = "add" | "remove";

export async function requireDependencyPair(
  binding: D1Database,
  identifier: string,
  relatedIdentifier: string,
  actor: string,
): Promise<{ issue: DependencyIssue; relatedIssue: DependencyIssue }> {
  const operator = await binding
    .prepare("SELECT workspace_id,removed_at FROM operators WHERE id=?")
    .bind(actor)
    .first<{ workspace_id: string; removed_at: string | null }>();
  if (!operator || operator.removed_at !== null)
    throw new DependencyError(
      "unauthenticated",
      "An active native operator is required.",
      401,
    );
  const result = await binding
    .prepare(
      `SELECT i.id,i.identifier,i.version FROM issues i JOIN teams t ON t.id=i.team_id
     WHERE i.identifier IN (?,?) AND t.workspace_id=?`,
    )
    .bind(identifier, relatedIdentifier, operator.workspace_id)
    .all<DependencyIssue>();
  const issue = result.results.find((row) => row.identifier === identifier);
  const relatedIssue = result.results.find(
    (row) => row.identifier === relatedIdentifier,
  );
  if (!issue || !relatedIssue)
    throw new DependencyError(
      "issue_not_found",
      "An issue is unavailable.",
      404,
    );
  return { issue, relatedIssue };
}

// Following blocking -> blocked links from the proposed blocked endpoint must
// never reach the proposed blocker. UNION also terminates on corrupt old cycles.
const reachable = `WITH RECURSIVE reachable(id) AS (
  SELECT ? UNION SELECT d.blocked_issue_id FROM issue_dependencies d
  JOIN reachable r ON d.blocking_issue_id=r.id
)`;

async function graphConflict(
  binding: D1Database,
  blocking: string,
  blocked: string,
  operation: DependencyOperation,
): Promise<DependencyError> {
  if (operation === "remove")
    return new DependencyError(
      "dependency_not_found",
      "That directed dependency is no longer present.",
      409,
    );
  const exists = await binding
    .prepare(
      `SELECT 1 AS present FROM issue_dependencies
     WHERE (blocking_issue_id=? AND blocked_issue_id=?)
        OR (blocking_issue_id=? AND blocked_issue_id=?) LIMIT 1`,
    )
    .bind(blocking, blocked, blocked, blocking)
    .first();
  if (exists)
    return new DependencyError(
      "dependency_exists",
      "These issues already have a dependency in one direction.",
      409,
    );
  const cycle = await binding
    .prepare(
      `${reachable} SELECT 1 AS present FROM reachable WHERE id=? LIMIT 1`,
    )
    .bind(blocked, blocking)
    .first();
  if (cycle)
    return new DependencyError(
      "dependency_cycle",
      "This dependency would create a directed cycle.",
      409,
    );
  // A graph can change again after the rejected transaction; still report a
  // graph conflict rather than invent success or falsely claim a stale version.
  return new DependencyError(
    "dependency_exists",
    "The dependency graph changed. Reload both issues and try again.",
    409,
  );
}

export async function mutateDependencyRecord(
  binding: D1Database,
  identifier: string,
  actor: string,
  input: DependencyInput,
  operation: DependencyOperation,
  now = new Date(),
): Promise<"written" | "stale"> {
  const { issue, relatedIssue } = await requireDependencyPair(
    binding,
    identifier,
    input.relatedIdentifier,
    actor,
  );
  if (issue.id === relatedIssue.id)
    throw new DependencyError(
      "self_dependency",
      "An issue cannot depend on itself.",
      409,
    );
  if (
    issue.version !== input.expectedVersion ||
    relatedIssue.version !== input.relatedVersion
  )
    return "stale";
  const blocking = input.direction === "blocks" ? issue.id : relatedIssue.id;
  const blocked = input.direction === "blocks" ? relatedIssue.id : issue.id;
  const timestamp = now.toISOString();
  const relation = {
    relatedIdentifier: relatedIssue.identifier,
    direction: input.direction,
  };
  const reverse = {
    relatedIdentifier: issue.identifier,
    direction: input.direction === "blocks" ? "blocked-by" : "blocks",
  };
  const kind =
    operation === "add" ? "issue.dependency_added" : "issue.dependency_removed";
  const primary = activityRow({
    issueId: issue.id,
    actorOperatorId: actor,
    kind,
    previousValue: operation === "add" ? null : relation,
    nextValue: operation === "add" ? relation : null,
    now: timestamp,
  });
  const secondary = activityRow({
    issueId: relatedIssue.id,
    actorOperatorId: actor,
    kind,
    previousValue: operation === "add" ? null : reverse,
    nextValue: operation === "add" ? reverse : null,
    now: timestamp,
  });
  const permissions = `i.id=? AND r.id=? AND i.version=? AND r.version=?
    AND actor.id=? AND actor.removed_at IS NULL
    AND it.workspace_id=actor.workspace_id AND rt.workspace_id=actor.workspace_id`;
  const graphGuard =
    operation === "add"
      ? `NOT EXISTS(SELECT 1 FROM issue_dependencies d
         WHERE (d.blocking_issue_id=? AND d.blocked_issue_id=?)
            OR (d.blocking_issue_id=? AND d.blocked_issue_id=?))
       AND NOT EXISTS(SELECT 1 FROM reachable WHERE id=?)`
      : `EXISTS(SELECT 1 FROM issue_dependencies d WHERE d.blocking_issue_id=? AND d.blocked_issue_id=?)`;
  const guardParams = [
    issue.id,
    relatedIssue.id,
    input.expectedVersion,
    input.relatedVersion,
    actor,
    ...(operation === "add"
      ? [blocking, blocked, blocked, blocking, blocking]
      : [blocking, blocked]),
  ];
  const receipt = `EXISTS(SELECT 1 FROM issue_activity WHERE id=? AND issue_id=? AND actor_operator_id=? AND kind=?)`;
  const receiptParams = [primary.id, issue.id, actor, kind];
  // D1 batch is one transaction. Only its first INSERT checks graph/permissions/
  // versions. Its unique activity ID authorizes all subsequent writes, so adding
  // the edge or incrementing one endpoint cannot invalidate the other guard.
  const event = { id: primary.id, issueId: issue.id, actor, at: timestamp };
  const writes = await binding.batch([
    binding
      .prepare(
        `${operation === "add" ? reachable : ""}
      INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT ?,i.id,?,?,?,?,?,? FROM issues i JOIN teams it ON it.id=i.team_id
      JOIN issues r ON r.id=? JOIN teams rt ON rt.id=r.team_id JOIN operators actor ON actor.id=?
      WHERE ${permissions} AND ${graphGuard}`,
      )
      .bind(
        ...(operation === "add" ? [blocked] : []),
        primary.id,
        actor,
        kind,
        primary.previousValueJson,
        primary.nextValueJson,
        timestamp,
        timestamp,
        relatedIssue.id,
        actor,
        ...guardParams,
      ),
    ...(operation === "remove" ? blockerStatements(binding,event,blocked) : []),
    ...followerBlockingStatements(binding,event,relatedIssue.id),
    operation === "add"
      ? binding
          .prepare(
            `INSERT INTO issue_dependencies(blocked_issue_id,blocking_issue_id,created_at)
          SELECT ?,?,? WHERE ${receipt}`,
          )
          .bind(blocked, blocking, timestamp, ...receiptParams)
      : binding
          .prepare(
            `DELETE FROM issue_dependencies WHERE blocked_issue_id=? AND blocking_issue_id=? AND ${receipt}`,
          )
          .bind(blocked, blocking, ...receiptParams),
    binding
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
       SELECT ?,?,?,?,?,?,?,? WHERE ${receipt}`,
      )
      .bind(
        secondary.id,
        relatedIssue.id,
        actor,
        kind,
        secondary.previousValueJson,
        secondary.nextValueJson,
        timestamp,
        timestamp,
        ...receiptParams,
      ),
    binding
      .prepare(
        `UPDATE issues SET version=version+1,updated_at=? WHERE id=? AND ${receipt}`,
      )
      .bind(timestamp, issue.id, ...receiptParams),
    binding
      .prepare(
        `UPDATE issues SET version=version+1,updated_at=? WHERE id=? AND ${receipt}`,
      )
      .bind(timestamp, relatedIssue.id, ...receiptParams),
    ...finalizeEvent(binding,event),
  ]);
  if (writes[0].meta.changes === 1) return "written";
  const current = await requireDependencyPair(
    binding,
    identifier,
    input.relatedIdentifier,
    actor,
  );
  if (
    current.issue.version !== input.expectedVersion ||
    current.relatedIssue.version !== input.relatedVersion
  )
    return "stale";
  throw await graphConflict(binding, blocking, blocked, operation);
}
