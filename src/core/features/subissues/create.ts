import { drizzle } from "drizzle-orm/d1";
import {
  mutationDatabase,
  isMutationAccessError,
} from "../auth/mutation-database";
import { requireIssueAccess } from "../issues/access";
import {
  allocateIssueSequence,
  creationGuard,
  creationError,
} from "../issues/create-guard";
import { defaultStatus, requireActiveTeam } from "../issues/repository";
import { createIssueInputSchema } from "../issues/input";
import { followStatements, finalizeEvent } from "../notifications/events";
import { createUlid } from "../../shared/ids";
import { reconcileParent, versionAdmission } from "./reconcile";

/** The child and its hierarchy are one native commit, using the same allocation,
 * eligibility and notification primitives as issue creation. */
export async function createSubissue(
  source: D1Database,
  identifier: string,
  actor: string,
  input: { expectedVersion: number; title: string },
) {
  const db = mutationDatabase(source, actor),
    parent = await requireIssueAccess(db, identifier, actor);
  if (parent.version !== input.expectedVersion) return "stale" as const;
  const parentRow = await db
    .prepare("SELECT team_id FROM issues WHERE id=?")
    .bind(parent.id)
    .first<{ team_id: string }>();
  if (!parentRow) throw new Error("Sub-issue parent is missing.");
  const orm = drizzle(db),
    team = await requireActiveTeam(orm, parentRow.team_id),
    status = await defaultStatus(orm, team.id, "backlog");
  const now = new Date(),
    at = now.toISOString(),
    id = createUlid(now),
    activityId = createUlid(now);
  const childInput = createIssueInputSchema.parse({
    title: input.title,
    teamId: team.id,
  });
  const allocation = await allocateIssueSequence(
      db,
      actor,
      team.workspaceId,
      team.id,
      at,
    ),
    childIdentifier = `${allocation.prefix}-${allocation.sequence}`;
  const event = { id: activityId, issueId: id, actor, at };
  try {
    await db.batch([
      versionAdmission(db, parent.id, input.expectedVersion),
      creationGuard(
        db,
        actor,
        team.workspaceId,
        team.id,
        status.id,
        childInput,
        "backlog",
        allocation.prefix,
      ),
      db
        .prepare(
          `SELECT CASE WHEN EXISTS(SELECT 1 FROM issues WHERE id=? AND team_id=?) THEN 1 ELSE json('subissue parent moved') END`,
        )
        .bind(parent.id, team.id),
      db
        .prepare(
          `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'none',?,?)`,
        )
        .bind(
          id,
          childIdentifier,
          allocation.prefix,
          allocation.sequence,
          team.id,
          input.title,
          status.id,
          at,
          at,
        ),
      db
        .prepare(
          `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at) VALUES(?,?,?,'issue.created',?,?,?)`,
        )
        .bind(
          activityId,
          id,
          actor,
          JSON.stringify({
            identifier: childIdentifier,
            title: input.title,
            description: "",
            teamId: team.id,
            statusId: status.id,
            parentIdentifier: identifier,
          }),
          at,
          at,
        ),
      db
        .prepare(
          `INSERT INTO issue_parents(issue_id,parent_issue_id,created_at,position) SELECT ?,?,?,COALESCE(max(position)+1,1) FROM issue_parents WHERE parent_issue_id=?`,
        )
        .bind(id, parent.id, at, parent.id),
      db
        .prepare(
          `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at) VALUES(?,?,?,'issue.subissue_created',?,?,?)`,
        )
        .bind(
          createUlid(now),
          parent.id,
          actor,
          JSON.stringify({ childIdentifier }),
          at,
          at,
        ),
      db
        .prepare(`UPDATE issues SET version=version+1,updated_at=? WHERE id=?`)
        .bind(at, parent.id),
      ...followStatements(db, event, [actor]),
      ...finalizeEvent(db, event),
      reconcileParent(db, parent.id, at),
    ]);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    if (
      (await requireIssueAccess(db, identifier, actor)).version !==
      input.expectedVersion
    )
      return "stale" as const;
    return creationError(db, team.id, error);
  }
  return "written" as const;
}
