import { visibleTeam } from '../roles/visibility-sql';
import type { RegisteredSource } from '../integrations/source-storage';

// A saved rule conveys no durable role. Both its configuring person and the
// connection custodian must remain active, with current access to both teams.
const active = (alias: string) => `${alias}.removed_at IS NULL AND EXISTS(
 SELECT 1 FROM main.vector_auth_operators m JOIN main.oa_operators a ON a.id=m.auth_id
 WHERE m.operator_id=${alias}.id AND a.status='active')`;
export function scopeAuthority(actor: string | null, workspace: string, team: string | null) {
  return {
    sql: `EXISTS(SELECT 1 FROM main.operators person WHERE person.id=? AND person.workspace_id=? AND ${active('person')}
      AND (person.role IN('owner','admin') OR (? IS NOT NULL AND person.role='member' AND EXISTS(
        SELECT 1 FROM main.team_members member JOIN main.teams scope ON scope.id=member.team_id
        WHERE member.operator_id=person.id AND scope.id=? AND scope.archived_at IS NULL
          AND (member.role='owner' OR scope.settings_permission='all_members'))))
      AND (? IS NULL OR EXISTS(SELECT 1 FROM main.teams scope WHERE scope.id=? AND scope.archived_at IS NULL AND ${visibleTeam('person','scope.id')})))`,
    values: [actor, workspace, team, team, team, team],
  };
}
export function ruleAuthority(actor: string | null, workspace: string, team: string | null, sourceId: string, targetTeam: string) {
  const scope = scopeAuthority(actor, workspace, team);
  return {
    sql: `${scope.sql} AND EXISTS(SELECT 1 FROM main.vector_integration_sources source
      JOIN main.vector_error_connections connection ON connection.source_id=source.id AND connection.provider='sentry'
      JOIN main.teams origin ON origin.id=source.team_id AND origin.workspace_id=source.workspace_id
      JOIN main.teams target ON target.id=? AND target.workspace_id=source.workspace_id
      JOIN main.operators person ON person.id=? AND person.workspace_id=source.workspace_id
      JOIN main.operators custodian ON custodian.id=connection.actor_id AND custodian.workspace_id=source.workspace_id
      WHERE source.id=? AND source.workspace_id=? AND (? IS NULL OR source.team_id=?)
        AND source.enabled=1 AND source.revoked_at IS NULL AND origin.archived_at IS NULL AND target.archived_at IS NULL
        AND ${visibleTeam('person','origin.id')} AND ${visibleTeam('person','target.id')}
        AND ${active('custodian')} AND custodian.role IN('owner','admin')
        AND ${visibleTeam('custodian','origin.id')} AND ${visibleTeam('custodian','target.id')}
        AND EXISTS(SELECT 1 FROM main.workflow_statuses status WHERE status.team_id=target.id AND status.category='intake'))`,
    values: [...scope.values, targetTeam, actor, sourceId, workspace, team, team],
  };
}
export const sourceScopes = (source: RegisteredSource) => ['workspace', source.team_id];
