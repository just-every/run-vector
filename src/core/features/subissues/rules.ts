import {
  mutationDatabase,
  isMutationAccessError,
} from "../auth/mutation-database";
import { IssueAccessError } from "../issues/access";
import { IssueMutationError } from "../issues/errors";
import { createUlid } from "../../shared/ids";
async function requireTeam(db: D1Database, teamId: string, actor: string) {
  const row = await db
    .prepare(
      `SELECT t.id FROM operators o JOIN teams t ON t.workspace_id=o.workspace_id WHERE o.id=? AND o.removed_at IS NULL AND t.id=?`,
    )
    .bind(actor, teamId)
    .first();
  if (!row)
    throw new IssueAccessError("not_found", "Team is unavailable.", 404);
}
export async function readSubissueRule(
  db: D1Database,
  teamId: string,
  actor: string,
) {
  await requireTeam(db, teamId, actor);
  const row = await db
    .prepare("SELECT enabled,version FROM subissue_team_rules WHERE team_id=?")
    .bind(teamId)
    .first<{ enabled: number; version: number }>();
  await requireTeam(db, teamId, actor);
  return { enabled: Boolean(row?.enabled), version: row?.version ?? 0 };
}
export async function updateSubissueRule(
  source: D1Database,
  teamId: string,
  actor: string,
  input: { enabled: boolean; expectedVersion: number },
) {
  const db = mutationDatabase(source, actor),
    current = await readSubissueRule(db, teamId, actor);
  if (current.version !== input.expectedVersion) return "stale" as const;
  if (input.enabled) {
    const count = await db
      .prepare(
        `SELECT count(DISTINCT category) n FROM workflow_statuses WHERE team_id=? AND category IN('completed','unstarted')`,
      )
      .bind(teamId)
      .first<number>("n");
    if (count !== 2)
      throw new IssueMutationError(
        "invalid_option",
        "The team needs Completed and Unstarted workflow statuses for this rule.",
      );
  }
  const at = new Date().toISOString();
  try {
    await db.batch([
      db
        .prepare(
          `SELECT CASE WHEN EXISTS(SELECT 1 FROM operators o JOIN teams t ON t.workspace_id=o.workspace_id WHERE o.id=? AND o.removed_at IS NULL AND t.id=?) AND COALESCE((SELECT version FROM subissue_team_rules WHERE team_id=?),0)=? THEN 1 ELSE json('subissue rule stale') END`,
        )
        .bind(actor, teamId, teamId, input.expectedVersion),
      db
        .prepare(
          `INSERT INTO subissue_team_rules(team_id,enabled,version,updated_at) VALUES(?,?,1,?) ON CONFLICT(team_id) DO UPDATE SET enabled=excluded.enabled,version=subissue_team_rules.version+1,updated_at=excluded.updated_at`,
        )
        .bind(teamId, Number(input.enabled), at),
      db
        .prepare(
          `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at) VALUES(?,?,'subissues.rule_changed','team',?,?,?)`,
        )
        .bind(createUlid(new Date(at)), actor, teamId, at, at),
      ...(input.enabled
        ? [
            db
              .prepare(
                `INSERT INTO subissue_progress_events(id,parent_issue_id,created_at) SELECT lower(hex(randomblob(13))),i.id,? FROM issues i WHERE i.team_id=? AND EXISTS(SELECT 1 FROM issue_parents WHERE parent_issue_id=i.id)`,
              )
              .bind(at, teamId),
          ]
        : []),
    ]);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    await requireTeam(db, teamId, actor);
    if (
      (await readSubissueRule(db, teamId, actor)).version !==
      input.expectedVersion
    )
      return "stale" as const;
    throw error;
  }
  return "written" as const;
}
