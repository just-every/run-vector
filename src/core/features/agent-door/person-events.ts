import type { WorkerBindings } from '../../app/bindings';
import type { Person } from '../../../../vendor/base/agent-door/index.ts';

/** Mirror committed person activity through the shared event vocabulary. Native
 * issue IDs and current resource readers govern later replay and subscriptions. */
export async function mirrorPersonIssueEvents(env: WorkerBindings, person: Pick<Person, 'id' | 'name'>, eventIds: string[], request: Request) {
  if (!eventIds.length) return;
  const rows = (await env.DB.prepare(`SELECT a.id,a.kind,i.identifier FROM issue_activity a
    JOIN issues i ON i.id=a.issue_id WHERE a.id IN(SELECT value FROM json_each(?))
    AND a.actor_operator_id=? ORDER BY a.created_at,a.id`).bind(JSON.stringify(eventIds), person.id)
    .all<{ id: string; kind: string; identifier: string }>()).results;
  const { vectorAgentDoor } = await import('./index.server.ts');
  const { vectorPeople } = await import('./people.ts');
  const current = await vectorPeople(env).session(request);
  if (!current || current.id !== person.id) return;
  const door = vectorAgentDoor(env);
  for (const row of rows) await door.emit({ person: current, type: row.kind,
    uri: 'vector://issues/' + row.identifier, data: { nativeEventId: row.id } });
}
