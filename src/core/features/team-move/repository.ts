import { followerChangeStatements, finalizeEvent } from '../notifications/events';
import { mutationDatabase } from '../auth/mutation-database';
import { activityRow } from "../issues/repository";
import { TeamMoveError } from "./errors";
import type { MoveIssueTeamInput } from "./input";

type MoveIssue = {
  id: string;
  identifier: string;
  team_id: string;
  status_id: string;
  cycle_id: string | null;
  version: number;
  workspace_id: string;
  category: string;
};

export async function requireTeamMoveIssue(
  binding: D1Database,
  identifier: string,
  actor: string,
): Promise<MoveIssue> {
  const operator = await binding
    .prepare("SELECT workspace_id,removed_at FROM operators WHERE id=?")
    .bind(actor)
    .first<{ workspace_id: string; removed_at: string | null }>();
  if (!operator || operator.removed_at !== null)
    throw new TeamMoveError(
      "unauthenticated",
      "An active native operator is required.",
      401,
    );
  const issue = await binding
    .prepare(
      `SELECT i.id,i.identifier,i.team_id,i.status_id,i.cycle_id,i.version,t.workspace_id,s.category
    FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id AND s.team_id=i.team_id
    WHERE i.identifier=? AND t.workspace_id=?`,
    )
    .bind(identifier, operator.workspace_id)
    .first<MoveIssue>();
  if (!issue)
    throw new TeamMoveError("issue_not_found", "Issue does not exist.", 404);
  return issue;
}

export async function moveIssueTeamRecord(
  binding: D1Database,
  identifier: string,
  actor: string,
  input: MoveIssueTeamInput,
  now = new Date(),
): Promise<"written" | "stale"> {
  binding = mutationDatabase(binding,actor);
  const issue = await requireTeamMoveIssue(binding, identifier, actor);
  if (issue.version !== input.expectedVersion) return "stale";
  if (input.teamId === issue.team_id && input.statusId !== issue.status_id)
    throw new TeamMoveError(
      "invalid_option",
      "Use the issue editor to change status within the current team.",
      400,
    );
  const team = await binding
    .prepare("SELECT workspace_id,archived_at FROM teams WHERE id=?")
    .bind(input.teamId)
    .first<{ workspace_id: string; archived_at: string | null }>();
  if (
    !team ||
    team.workspace_id !== issue.workspace_id ||
    team.archived_at !== null
  )
    throw new TeamMoveError(
      "invalid_option",
      "Choose an available team in this workspace.",
      400,
    );
  const status = await binding
    .prepare("SELECT team_id,category FROM workflow_statuses WHERE id=?")
    .bind(input.statusId)
    .first<{ team_id: string; category: string }>();
  if (
    !status ||
    status.team_id !== input.teamId ||
    status.category !== issue.category
  )
    throw new TeamMoveError(
      "invalid_option",
      "Choose a target status in the current category.",
      400,
    );

  const where = `issues.id=? AND issues.version=? AND issues.team_id=? AND issues.status_id=?
    AND EXISTS(SELECT 1 FROM teams source JOIN operators actor ON actor.workspace_id=source.workspace_id
      WHERE source.id=issues.team_id AND source.workspace_id=? AND actor.id=? AND actor.removed_at IS NULL)
    AND EXISTS(SELECT 1 FROM teams target WHERE target.id=? AND target.workspace_id=? AND target.archived_at IS NULL)
    AND EXISTS(SELECT 1 FROM workflow_statuses target_status WHERE target_status.id=? AND target_status.team_id=? AND target_status.category=?)
    AND EXISTS(SELECT 1 FROM workflow_statuses source_status WHERE source_status.id=issues.status_id AND source_status.team_id=issues.team_id AND source_status.category=?)`;
  const params = [
    issue.id,
    input.expectedVersion,
    issue.team_id,
    issue.status_id,
    issue.workspace_id,
    actor,
    input.teamId,
    issue.workspace_id,
    input.statusId,
    input.teamId,
    issue.category,
    issue.category,
  ];
  let rows: { id: string }[];
  if (input.teamId === issue.team_id) {
    const receipt = await binding
      .prepare(`UPDATE issues SET version=version WHERE ${where} RETURNING id`)
      .bind(...params)
      .all<{ id: string }>();
    rows = receipt.results;
  } else {
    const timestamp = now.toISOString();
    const activity = activityRow({
      issueId: issue.id,
      actorOperatorId: actor,
      kind: "issue.team_moved",
      previousValue: {
        teamId: issue.team_id,
        statusId: issue.status_id,
        cycleId: issue.cycle_id,
      },
      nextValue: {
        teamId: input.teamId,
        statusId: input.statusId,
        cycleId: null,
      },
      now: timestamp,
    });
    const event = { id: activity.id, issueId: issue.id, actor, at: timestamp };
    const followerWrites = followerChangeStatements(binding, event);
    // Eligibility and the original version guard all writes in one transaction;
    // identifiers, terminal/deferral timestamps and all graph rows are untouched.
    const receipts = await binding.batch<{ id: string }>([
      binding
        .prepare(
          `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
        SELECT ?,issues.id,?,'issue.team_moved',?,?,?,? FROM issues WHERE ${where}`,
        )
        .bind(
          activity.id,
          actor,
          activity.previousValueJson,
          activity.nextValueJson,
          timestamp,
          timestamp,
          ...params,
        ),
      ...followerWrites,
      binding
        .prepare(
          `UPDATE issues SET team_id=?,status_id=?,cycle_id=NULL,version=version+1,updated_at=? WHERE ${where} RETURNING id`,
        )
        .bind(input.teamId, input.statusId, timestamp, ...params),
      ...finalizeEvent(binding, event),
    ]);
    rows = receipts[1 + followerWrites.length].results;
  }
  // Search/history triggers contribute to total changes, not direct rows.
  if (rows.length === 1 && rows[0].id === issue.id) return "written";
  // Permission/identity is rechecked before exposing a conflict or option error.
  const current = await requireTeamMoveIssue(binding, identifier, actor);
  if (current.version !== input.expectedVersion) return "stale";
  throw new TeamMoveError(
    "invalid_option",
    "The selected team or status became unavailable. Refresh and choose again.",
    400,
  );
}
