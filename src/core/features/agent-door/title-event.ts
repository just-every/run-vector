import type { AgentEvent } from '../../../../vendor/base/agent-door/index.ts';
import { currentAgentActor } from './attribution';
import { issueUri } from './native';

/** Join the native title transaction, before its version changes. No record text
 * is retained: Base checks the current issue resource on every event read. */
export async function titleEventStatement(
  db: D1Database,
  change: { id: string; issueId: string; actor: string; at: string },
  where: string,
  guardValues: (string | number)[],
): Promise<D1PreparedStatement> {
  const agent = currentAgentActor();
  const person = await db.prepare('SELECT id,name FROM operators WHERE id=? AND removed_at IS NULL')
    .bind(change.actor).first<{ id: string; name: string }>();
  if (!person || (agent && agent.actor.for.id !== person.id))
    throw new Error('A title event requires its trusted native actor.');
  const event: AgentEvent = {
    id: change.id,
    type: 'issue.updated',
    uri: issueUri(change.issueId),
    actor: agent ? { kind: 'agent', ...agent.actor } : { kind: 'person', person },
    at: change.at,
  };
  return db.prepare(`INSERT INTO agent_door_events(id,uri,event)
    SELECT ?,?,? FROM issues WHERE ${where}`)
    .bind(event.id, event.uri, JSON.stringify(event), ...guardValues);
}

/** Native removal anonymizes its new retained copy in the same transaction.
 * Agent artifacts retain their existing separate custody and erasure hold. */
export function anonymizeTitleEvents(db: D1Database, person: string, removal: string) {
  return db.prepare(`UPDATE agent_door_events
    SET event=json_set(event,'$.actor.person.name','Removed operator')
    WHERE json_extract(event,'$.type')='issue.updated'
      AND json_extract(event,'$.actor.kind')='person'
      AND json_extract(event,'$.actor.person.id')=?
      AND EXISTS(SELECT 1 FROM operator_removals WHERE id=?)`)
    .bind(person, removal);
}
