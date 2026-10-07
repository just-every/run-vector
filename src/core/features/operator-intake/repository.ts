import { drizzle } from "drizzle-orm/d1";
import { createUlid } from "../../shared/ids";
import {
  allocateSequence,
  defaultStatus,
  requireActiveTeam,
} from "../issues/repository";
import { IssueMutationError } from "../issues/errors";
import type { OperatorIntakeInput } from "./input";

/** Allocate identifiers independently so failed writes never reuse a number. The
 * issue, first evidence and creation activity commit as one guarded D1 batch. */
export async function createOperatorIntake(
  db: D1Database,
  actor: string,
  input: OperatorIntakeInput,
  now = new Date(),
) {
  const orm = drizzle(db);
  const team = await requireActiveTeam(orm, input.teamId);
  const status = await defaultStatus(orm, team.id, "intake");
  const at = now.toISOString();
  const sequence = await allocateSequence(orm, team.id, at);
  const identifier = `${team.identifierPrefix}-${sequence}`;
  const issueId = createUlid(now);
  const evidenceId = createUlid(now);
  const activityId = createUlid(now);
  const observedAt = input.observedAt
    ? new Date(input.observedAt).toISOString()
    : at;
  const summary = input.summary || input.title;
  const issue = db
    .prepare(
      `INSERT INTO issues
    (id,identifier,origin_prefix,sequence_number,team_id,title,description,status_id,priority,
     expected_outcome,customer_impact,custom_fields_json,version,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,'none',?,?,'{}',1,?,?
    FROM teams t JOIN workflow_statuses s ON s.team_id=t.id
    JOIN operators o ON o.workspace_id=t.workspace_id
    WHERE t.id=? AND t.archived_at IS NULL AND s.id=? AND s.category='intake'
    AND o.id=? AND o.removed_at IS NULL`,
    )
    .bind(
      issueId,
      identifier,
      team.identifierPrefix,
      sequence,
      team.id,
      input.title,
      input.description,
      status.id,
      input.expectedOutcome,
      input.customerImpact,
      at,
      at,
      team.id,
      status.id,
      actor,
    );
  const evidence = db
    .prepare(
      `INSERT INTO evidence_revisions
    (id,issue_id,source_name,origin_kind,actor_operator_id,observed_at,received_at,summary,
     link,measurements_json,customer_reports_json,assertions_json,created_at,updated_at)
    SELECT ?,id,'Operator report','operator',?,?,?,?,?,?,?,'{}',?,? FROM issues WHERE id=?`,
    )
    .bind(
      evidenceId,
      actor,
      observedAt,
      at,
      summary,
      input.link,
      JSON.stringify(input.measurements),
      JSON.stringify(input.customerReports),
      at,
      at,
      issueId,
    );
  const activity = db
    .prepare(
      `INSERT INTO issue_activity
    (id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
    SELECT ?,id,?,'issue.created',NULL,?,?,? FROM issues WHERE id=?`,
    )
    .bind(
      activityId,
      actor,
      JSON.stringify({
        identifier,
        title: input.title,
        teamId: team.id,
        statusId: status.id,
        evidenceRevisionId: evidenceId,
        originKind: "operator",
      }),
      at,
      at,
      issueId,
    );
  const result = await db.batch([issue, evidence, activity]);
  if (result[0].meta.changes !== 1)
    throw new IssueMutationError(
      "invalid_option",
      "The team or operator is no longer available for intake.",
    );
  return { identifier };
}

export type EvidenceMetadata = {
  id: string;
  origin_kind: "source" | "operator";
  actor_operator_id: string | null;
  actor: string | null;
  link: string | null;
  customer_reports_json: string;
};
export async function evidenceMetadata(db: D1Database, issueId: string) {
  return (
    await db
      .prepare(
        `SELECT e.id,e.origin_kind,e.actor_operator_id,o.name AS actor,e.link,e.customer_reports_json
    FROM evidence_revisions e LEFT JOIN operators o ON o.id=e.actor_operator_id WHERE e.issue_id=?`,
      )
      .bind(issueId)
      .all<EvidenceMetadata>()
  ).results;
}
