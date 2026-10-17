import { activityRow } from "../issues/repository";
import { followerChangeStatements, finalizeEvent } from "../notifications/events";
import type { TeamSelectionRow } from "./selection";

export function planSelectedTeamMove(
  db: D1Database,
  issue: TeamSelectionRow,
  actor: string,
  teamId: string,
  statusId: string,
  at: string,
) {
  if (issue.team_id === teamId) return { writes: [], version: issue.version, changed: false };
  const activity = activityRow({
    issueId: issue.id, actorOperatorId: actor, kind: "issue.team_moved",
    previousValue: { teamId: issue.team_id, statusId: issue.status_id, cycleId: issue.cycle_id },
    nextValue: { teamId, statusId, cycleId: null }, now: at,
  });
  const event = { id: activity.id, issueId: issue.id, actor, at };
  return {
    version: issue.version + 1,
    changed: true,
    writes: [
      db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
        VALUES(?,?,?,'issue.team_moved',?,?,?,?)`).bind(
        activity.id, issue.id, actor, activity.previousValueJson, activity.nextValueJson, at, at,
      ),
      ...followerChangeStatements(db, event),
      db.prepare("UPDATE issues SET team_id=?,status_id=?,cycle_id=NULL,version=version+1,updated_at=? WHERE id=?")
        .bind(teamId, statusId, at, issue.id),
      ...finalizeEvent(db, event),
    ],
  };
}
