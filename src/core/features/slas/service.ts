import { businessMinutes } from "./calendar";
import { clockRule, matches, held, type Clock } from "./clock";
import {
  loadRotation,
  eligible as triageEligible,
} from "../triage-responsibility/rotation";
import { visibleRecipient } from "../notifications/events";

/** Compare-and-swap observation plus occurrence receipts, Inbox and channel
 * intents commit in one D1 batch. A losing concurrent tick produces no effects. */
export async function advanceSlas(env: { DB: D1Database }, now: Date) {
  const db = env.DB,
    at = now.toISOString();
  await db
    .prepare(
      `INSERT OR IGNORE INTO issue_sla_clocks(issue_id,team_id,rule_json,timezone,started_at,observed_at,elapsed_minutes,revision)
    SELECT i.id,i.team_id,r.body_json,w.timezone,max(i.updated_at,r.created_at),max(i.updated_at,r.created_at),0,lower(hex(randomblob(16)))
    FROM issues i JOIN teams t ON t.id=i.team_id JOIN workspace_settings w ON w.id=t.workspace_id JOIN team_slas r ON r.team_id=i.team_id
    JOIN workflow_statuses s ON s.id=i.status_id WHERE json_extract(r.body_json,'$.enabled')=1 AND ${matches}
    AND i.archived_at IS NULL AND t.archived_at IS NULL AND s.category NOT IN ('completed','canceled','duplicate')
    AND max(i.updated_at,r.created_at)<=? AND NOT EXISTS(SELECT 1 FROM issue_sla_restore_holds h WHERE h.issue_id=i.id) AND ${held}`,
    )
    .bind(at)
    .run();
  const clocks = (
    await db
      .prepare(
        `SELECT c.* FROM issue_sla_clocks c WHERE ${held} AND NOT EXISTS(SELECT 1 FROM issue_sla_restore_holds h WHERE h.issue_id=c.issue_id) AND (c.stopped_at IS NULL OR c.observed_at<c.stopped_at)`,
      )
      .all<Clock>()
  ).results;
  for (const clock of clocks) await observe(db, clock, at);
}
async function observe(db: D1Database, clock: Clock, at: string, retries = 2) {
  if (at < clock.observed_at) return;
  const issue = await db
    .prepare(
      `SELECT i.version,i.updated_at,i.assignee_operator_id,i.team_id,t.archived_at team_archived,i.archived_at,s.category,
    r.body_json,current.timezone current_timezone,(${matches.replaceAll("r.body_json", "c.rule_json")}) matching,
    (SELECT a.actor_operator_id FROM issue_activity a WHERE a.issue_id=i.id ORDER BY a.created_at DESC,a.id DESC LIMIT 1) actor
    FROM issues i JOIN teams t ON t.id=i.team_id JOIN workspace_settings current ON current.id=t.workspace_id
    JOIN workflow_statuses s ON s.id=i.status_id JOIN issue_sla_clocks c ON c.issue_id=i.id LEFT JOIN team_slas r ON r.team_id=COALESCE(?,i.team_id) WHERE i.id=?`,
    )
    .bind(clock.team_id, clock.issue_id)
    .first<{
      version: number;
      updated_at: string;
      assignee_operator_id: string | null;
      team_id: string;
      team_archived: string | null;
      archived_at: string | null;
      category: string;
      body_json: string | null;
      current_timezone: string;
      matching: number;
      actor: string | null;
    }>();
  if (!issue) return;
  const rule = clockRule(clock);
  const withdrawn =
    issue.team_id !== clock.team_id ||
    issue.archived_at ||
    issue.team_archived ||
    !issue.body_json ||
    !JSON.parse(issue.body_json).enabled ||
    !issue.matching;
  const terminal = ["completed", "canceled", "duplicate"].includes(
    issue.category,
  );
  const stop =
    clock.stopped_at ??
    (withdrawn || terminal
      ? issue.updated_at < at
        ? issue.updated_at
        : at
      : null);
  const end = stop && stop < at ? stop : at;
  const elapsed =
    clock.elapsed_minutes +
    businessMinutes(clock.observed_at, end, rule, clock.timezone);
  const claim = crypto.randomUUID();
  const rotation = await loadRotation(db, clock.team_id, new Date(at));
  const recipients = [
    ...new Set(
      [issue.assignee_operator_id, rotation?.recipient].filter(
        (v): v is string => Boolean(v),
      ),
    ),
  ];
  const warning =
    !stop &&
    elapsed >= rule.targetMinutes - rule.warnBeforeMinutes &&
    elapsed < rule.targetMinutes;
  const breach = elapsed >= rule.targetMinutes;
  const writes = [
    db
      .prepare(
        `UPDATE issue_sla_clocks SET observed_at=?,elapsed_minutes=?,stopped_at=?,stop_reason=?,revision=?
      WHERE issue_id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM issue_sla_restore_holds h WHERE h.issue_id=issue_sla_clocks.issue_id) AND ${held}
      AND EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN workspace_settings w ON w.id=t.workspace_id
        WHERE i.id=issue_sla_clocks.issue_id AND i.version=? AND i.updated_at=? AND i.assignee_operator_id IS ? AND i.team_id=?
        AND i.archived_at IS ? AND t.archived_at IS ? AND w.timezone=?)
      AND (SELECT body_json FROM team_slas WHERE team_id=?) IS ?`,
      )
      .bind(
        end > clock.observed_at ? end : clock.observed_at,
        elapsed,
        stop,
        clock.stop_reason ??
          (stop
            ? issue.category === "completed"
              ? "resolved"
              : "stopped"
            : null),
        claim,
        clock.issue_id,
        clock.revision,
        issue.version,
        issue.updated_at,
        issue.assignee_operator_id,
        issue.team_id,
        issue.archived_at,
        issue.team_archived,
        issue.current_timezone,
        clock.team_id,
        issue.body_json,
      ),
  ];
  for (const [kind, needed] of [
    ["warning", warning],
    ["breach", breach],
  ] as const) {
    if (!needed) continue;
    const event = claim + ":" + kind;
    writes.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO issue_sla_occurrences(issue_id,kind,event_id,created_at)
      SELECT issue_id,?,?,? FROM issue_sla_clocks WHERE issue_id=? AND revision=?`,
        )
        .bind(kind, event, at, clock.issue_id, claim),
    );
    if (kind === "breach") {
      writes.push(
        db
          .prepare(
            `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
        SELECT r.event_id,NULL,'sla.breached',i.identifier,i.id,r.created_at,r.created_at FROM issue_sla_occurrences r JOIN issues i ON i.id=r.issue_id WHERE r.event_id=?`,
          )
          .bind(event),
      );
      continue;
    }
    writes.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at)
      SELECT lower(hex(randomblob(16))),r.event_id,i.id,o.id,?,'SLA automation','["sla_warning"]',r.created_at
      FROM issue_sla_occurrences r JOIN issues i ON i.id=r.issue_id JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id
      WHERE r.event_id=? AND o.id IN(SELECT value FROM json_each(?)) AND (o.id<>? OR ? IS NULL) AND ${visibleRecipient}
      AND (o.id=i.assignee_operator_id OR (${triageEligible} AND EXISTS(SELECT 1 FROM team_triage_rotations tr WHERE tr.team_id=t.id AND tr.revision=?)))
      AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes m WHERE m.issue_id=i.id AND m.operator_id=o.id)
      AND NOT EXISTS(SELECT 1 FROM notification_type_mutes m WHERE m.operator_id=o.id AND m.kind='sla_warning')`,
        )
        .bind(
          issue.actor,
          event,
          JSON.stringify(recipients),
          issue.actor,
          issue.actor,
          rotation?.revision ?? null,
        ),
    );
    writes.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
      SELECT r.event_id||':'||d.id,t.workspace_id,d.id,'sla.warning',
      json_object('eventKind','sla.warning','issueId',i.id,'identifier',i.identifier,'actor','SLA automation','actorId',NULL,'change','Resolution SLA warning'),r.created_at
      FROM issue_sla_occurrences r JOIN issues i ON i.id=r.issue_id JOIN teams t ON t.id=i.team_id
      JOIN vector_channel_bindings b ON b.workspace_id=t.workspace_id AND b.scope='team' AND b.object_id=i.team_id
      JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.enabled=1 AND d.revoked_at IS NULL
      WHERE r.event_id=? AND EXISTS(SELECT 1 FROM json_each(b.events) WHERE value='sla.warning')`,
        )
        .bind(event),
    );
  }
  const result = await db.batch(writes);
  if (result[0].meta.changes === 0 && retries > 0) {
    const current = await db
      .prepare("SELECT * FROM issue_sla_clocks WHERE issue_id=?")
      .bind(clock.issue_id)
      .first<Clock>();
    if (
      current &&
      current.revision !== clock.revision &&
      current.observed_at < at
    )
      await observe(db, current, at, retries - 1);
  }
}
