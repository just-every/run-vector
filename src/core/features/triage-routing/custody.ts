import { IntegrationError } from '../integrations/errors';
import type { RegisteredSource } from '../integrations/source-storage';
import { ruleAuthority } from './authority';

/** A receipt remembers placement, never a transferable receiver capability.
 * Recheck current destination access even for a captured delivery's replay. */
export async function sourceIssueCustody(db: D1Database, source: RegisteredSource, issueId: string) {
  const issue = await db.prepare(`SELECT i.team_id,i.triage_route_json,t.archived_at FROM issues i
    JOIN teams t ON t.id=i.team_id AND t.workspace_id=? WHERE i.id=?`).bind(source.workspace_id, issueId)
    .first<{ team_id: string; triage_route_json: string | null; archived_at: string | null }>();
  if (!issue) throw new IntegrationError(409, 'source_target_unavailable');
  // Legacy records retain their existing ingest policy after a native move.
  if (!issue.triage_route_json) return null;
  if (issue.archived_at) throw new IntegrationError(409, 'source_target_unavailable');
  const route = JSON.parse(issue.triage_route_json);
  if (!route || route.sourceId !== source.id) throw new IntegrationError(409, 'source_target_authority_changed');
  const authority = ruleAuthority(route.configuredBy, source.workspace_id, route.scope === 'team' ? source.team_id : null, source.id, issue.team_id);
  if (!await db.prepare('SELECT (' + authority.sql + ') allowed').bind(...authority.values).first<number>('allowed'))
    throw new IntegrationError(409, 'source_target_authority_changed');
  return db.prepare("SELECT CASE WHEN (" + authority.sql + ") AND EXISTS(SELECT 1 FROM issues WHERE id=? AND team_id=? AND triage_route_json=?) THEN 1 ELSE json('source custody changed') END")
    .bind(...authority.values, issueId, issue.team_id, issue.triage_route_json);
}
