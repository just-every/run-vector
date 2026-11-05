import { IntegrationError } from '../integrations/errors';
import type { SourceAdmission } from '../integrations/source-storage';
import { ruleAuthority, sourceScopes } from './authority';
import type { RoutingConfig, RoutingRule } from './schema';
export async function selectSourceRouting(db: D1Database, admission: SourceAdmission) {
  const { source } = admission;
  // Only the registered Sentry adapter may enter this producer. A generic
  // signed source's caller-supplied labels never establish provider identity.
  if (admission.credentialKind !== 'error' || !await db.prepare("SELECT 1 FROM vector_error_connections WHERE source_id=? AND provider='sentry'").bind(source.id).first())
    return { teamId: source.team_id, guards: [] as D1PreparedStatement[], provenance: null };
  const configs = (await db.prepare('SELECT * FROM triage_routing_configs WHERE workspace_id=? AND scope_key IN (?,?)')
    .bind(source.workspace_id, ...sourceScopes(source)).all<RoutingConfig>()).results;
  const guards = sourceScopes(source).map(key => {
    const config = configs.find(row => row.scope_key === key);
    return db.prepare("SELECT CASE WHEN COALESCE((SELECT version FROM triage_routing_configs WHERE workspace_id=? AND scope_key=?),0)=? THEN 1 ELSE json('routing changed') END")
      .bind(source.workspace_id, key, config?.version ?? 0);
  });
  // Workspace rules precede team rules; array order is the stable first match.
  for (const scope of sourceScopes(source)) {
    const config = configs.find(row => row.scope_key === scope);
    if (!config) continue;
    const rule = (JSON.parse(config.rules_json) as RoutingRule[]).find(rule => rule.sourceId === source.id);
    if (!rule) continue;
    const authority = ruleAuthority(config.configured_by, source.workspace_id, config.team_id, source.id, rule.targetTeamId);
    if (!await db.prepare('SELECT (' + authority.sql + ') allowed').bind(...authority.values).first<number>('allowed'))
      throw new IntegrationError(409, 'routing_authority_changed');
    guards.push(db.prepare("SELECT CASE WHEN (" + authority.sql + ") THEN 1 ELSE json('routing authority changed') END").bind(...authority.values));
    return { teamId: rule.targetTeamId, guards, provenance: {
      ruleId: rule.id, ruleName: rule.name, revision: config.version, scope: config.team_id ? 'team' : 'workspace',
      configuredBy: config.configured_by, sourceId: source.id,
    } };
  }
  return { teamId: source.team_id, guards, provenance: null };
}
