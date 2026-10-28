import type { WorkerBindings } from '../../app/bindings';
import type { Person } from '../../../../vendor/base/agent-door/index.ts';

type Position = { projects: number; revisions: number; comments: number; audit: number };

/** Capture native activity positions before a person mutation. No record bodies
 * or credentials enter the event stream; current resource readers govern replay. */
export function personActivityPosition(db: D1Database) {
  return db.prepare(`SELECT
    COALESCE((SELECT max(rowid) FROM project_activity),0) AS projects,
    COALESCE((SELECT max(rowid) FROM document_revisions),0) AS revisions,
    COALESCE((SELECT max(rowid) FROM document_comments),0) AS comments,
    COALESCE((SELECT max(rowid) FROM audit_records),0) AS audit`).first<Position>();
}

/** Select committed native records, excluding concurrent agent-attributed work.
 * The native activity id also prevents a later request from mirroring it again. */
export async function mirrorPersonActivity(env: WorkerBindings, person: Pick<Person, 'id' | 'name'>,
  eventIds: string[], request: Request, position: Position | null) {
  const issueEvents = eventIds.length ? (await env.DB.prepare(`SELECT a.id,a.kind AS type,'vector://issues/'||i.identifier AS uri FROM issue_activity a
    JOIN issues i ON i.id=a.issue_id WHERE a.id IN(SELECT value FROM json_each(?))
    AND a.actor_operator_id=? AND NOT EXISTS(SELECT 1 FROM vector_agent_activity_attribution x WHERE x.event_id=a.id)`)
    .bind(JSON.stringify(eventIds), person.id).all<{ id: string; type: string; uri: string }>()).results : [];
  const otherEvents = position ? (await env.DB.prepare(`
    SELECT a.id,a.kind AS type,'vector://projects/'||a.project_id AS uri FROM project_activity a
      WHERE a.rowid>? AND a.actor_operator_id=? AND NOT EXISTS(SELECT 1 FROM vector_agent_project_activity_attribution x WHERE x.event_id=a.id)
    UNION ALL SELECT r.id,'document.revised','vector://documents/'||r.document_id FROM document_revisions r
      WHERE r.rowid>? AND r.author_operator_id=? AND NOT EXISTS(SELECT 1 FROM vector_agent_document_revision_attribution x WHERE x.revision_id=r.id)
    UNION ALL SELECT c.id,'document.commented','vector://documents/'||c.document_id FROM document_comments c
      WHERE c.rowid>? AND c.author_operator_id=? AND NOT EXISTS(SELECT 1 FROM vector_agent_document_comment_attribution x WHERE x.comment_id=c.id)
    UNION ALL SELECT a.id,a.action,'vector://audit/'||a.id FROM audit_records a
      WHERE a.rowid>? AND a.actor_operator_id=? AND NOT EXISTS(SELECT 1 FROM vector_agent_audit_attribution x WHERE x.audit_id=a.id)`)
    .bind(position.projects, person.id, position.revisions, person.id, position.comments, person.id, position.audit, person.id)
    .all<{ id: string; type: string; uri: string }>()).results : [];
  const rows = [...issueEvents, ...otherEvents];
  if (!rows.length) return;
  const { vectorAgentDoor } = await import('./index.server.ts');
  const { vectorPeople } = await import('./people.ts');
  const current = await vectorPeople(env).session(request);
  if (!current || current.id !== person.id) return;
  const door = vectorAgentDoor(env);
  for (const row of rows) {
    if (await env.DB.prepare("SELECT 1 FROM agent_door_events WHERE json_extract(event,'$.nativeEventId')=? LIMIT 1").bind(row.id).first()) continue;
    await door.emit({ person: current, type: row.type, uri: row.uri, data: { nativeEventId: row.id } });
  }
}
