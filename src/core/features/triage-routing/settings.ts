import { administrationContext, audit, commit, guard, SettingsError } from '../administration/transaction';
import { scopeAuthority, ruleAuthority } from './authority';
import type { RoutingConfig, RoutingInput, RoutingRule } from './schema';

export async function routingConfig(db: D1Database, workspace: string, team: string | null) {
  return db.prepare('SELECT * FROM triage_routing_configs WHERE workspace_id=? AND scope_key=?')
    .bind(workspace, team ?? 'workspace').first<RoutingConfig>();
}
export async function readRouting(db: D1Database, actor: string, team: string | null) {
  const ctx = await administrationContext(db, actor);
  const scope = scopeAuthority(actor, ctx.workspace, team);
  if (!await db.prepare('SELECT (' + scope.sql + ') allowed').bind(...scope.values).first<number>('allowed'))
    throw new SettingsError('forbidden', 'Your current team permission does not allow routing settings.', 403);
  const config = await routingConfig(db, ctx.workspace, team);
  const rules: RoutingRule[] = config ? JSON.parse(config.rules_json) : [];
  // Current visibility also governs retained configuration. Do not disclose a
  // private destination after a settings manager loses its membership.
  for (const rule of rules) {
    const visible = await db.prepare(`SELECT 1 FROM vector_integration_sources source JOIN teams origin ON origin.id=source.team_id
      JOIN teams target ON target.id=? WHERE source.id=? AND source.workspace_id=?`).bind(rule.targetTeamId, rule.sourceId, ctx.workspace).first();
    if (!visible) throw new SettingsError('not_found', 'A configured source or destination is unavailable.', 404);
  }
  const sources = (await db.prepare(`SELECT source.id,source.name,source.team_id AS teamId FROM vector_integration_sources source
    JOIN vector_error_connections connection ON connection.source_id=source.id AND connection.provider='sentry'
    JOIN teams origin ON origin.id=source.team_id WHERE source.workspace_id=? AND source.enabled=1 AND source.revoked_at IS NULL
      AND origin.archived_at IS NULL AND (? IS NULL OR source.team_id=?) ORDER BY source.id`)
    .bind(ctx.workspace, team, team).all()).results;
  const teams = (await db.prepare(`SELECT id,name FROM teams WHERE workspace_id=? AND archived_at IS NULL
    AND EXISTS(SELECT 1 FROM workflow_statuses status WHERE status.team_id=teams.id AND status.category='intake') ORDER BY name,id`)
    .bind(ctx.workspace).all()).results;
  return { version: config?.version ?? 0, configuredBy: config?.configured_by ?? null, rules, sources, teams };
}
export async function saveRouting(db: D1Database, actor: string, team: string | null, input: RoutingInput) {
  const ctx = await administrationContext(db, actor), scope = scopeAuthority(actor, ctx.workspace, team);
  if (!await db.prepare('SELECT (' + scope.sql + ') allowed').bind(...scope.values).first<number>('allowed'))
    throw new SettingsError('forbidden', 'Your current team permission does not allow routing settings.', 403);
  const previous = await routingConfig(db, ctx.workspace, team);
  if ((previous?.version ?? 0) !== input.expectedVersion)
    throw new SettingsError('routing_version_conflict', 'Routing changed. Reload before saving.', 409);
  const checks = input.rules.map(rule => ruleAuthority(actor, ctx.workspace, team, rule.sourceId, rule.targetTeamId));
  for (const check of checks) if (!await db.prepare('SELECT (' + check.sql + ') allowed').bind(...check.values).first<number>('allowed'))
    throw new SettingsError('routing_destination_unavailable', 'Choose an authorized Sentry connection and visible active destination.', 409);
  const key = team ?? 'workspace';
  await commit(ctx, [
    guard(db, scope.sql, ...scope.values),
    guard(db, 'COALESCE((SELECT version FROM triage_routing_configs WHERE workspace_id=? AND scope_key=?),0)=?', ctx.workspace, key, input.expectedVersion),
    ...checks.map(check => guard(db, check.sql, ...check.values)),
    db.prepare(`INSERT INTO triage_routing_configs(workspace_id,scope_key,team_id,version,configured_by,rules_json,created_at,updated_at)
      VALUES(?,?,?,1,?,?,?,?) ON CONFLICT(workspace_id,scope_key) DO UPDATE SET version=version+1,
      configured_by=excluded.configured_by,rules_json=excluded.rules_json,updated_at=excluded.updated_at`)
      .bind(ctx.workspace, key, team, actor, JSON.stringify(input.rules), ctx.at, ctx.at),
    ...audit(ctx, 'triage.routing_configured', key, 'Triage routing', previous ? { version: previous.version, rules: JSON.parse(previous.rules_json) } : null,
      { version: input.expectedVersion + 1, rules: input.rules }),
  ]);
}
