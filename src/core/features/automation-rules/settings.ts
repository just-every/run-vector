import { administrationContext, audit, commit, guard, SettingsError } from '../administration/transaction';
import { settingsActor } from '../settings/repository';
import { loadAuthority } from '../roles/authority';
import { decide } from '../roles/policy';
import { visibleTeam } from '../roles/visibility-sql';
import { createUlid } from '../../shared/ids';
import { eligibleDestination, liveRule, ownerReadsIssue } from './policy';
import type { Rule, RuleInput } from './schema';

export async function ruleAuthority(db: D1Database, actor: string, teamId: string | null) {
  const access = await settingsActor(db, actor);
  const authority = await loadAuthority(db, actor, teamId ? [teamId] : []);
  if (!authority || decide(authority, { row: teamId ? 'automation.team' : 'automation.workspace', teams: teamId ? [teamId] : [] }) !== 'allow')
    throw new SettingsError('forbidden','Your current role cannot manage these rules.',403);
  if (teamId && !await db.prepare('SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL').bind(teamId,access.workspace_id).first())
    throw new SettingsError('not_found','This team is unavailable.',404);
  return access;
}
export async function readRules(db: D1Database, actor: string, teamId: string | null) {
  const access = await ruleAuthority(db,actor,teamId);
  const rules = (await db.prepare(`SELECT r.*,
    CASE WHEN NOT EXISTS(SELECT 1 FROM main.teams hidden JOIN operators reader ON reader.id=?
      WHERE hidden.workspace_id=r.workspace_id AND (r.team_id IS NULL OR hidden.id=r.team_id) AND NOT (${visibleTeam('reader','hidden.id')}))
      THEN COALESCE((SELECT runs FROM automation_rule_usage WHERE rule_id=r.id AND month=strftime('%Y-%m','now')),0) ELSE NULL END used,
    EXISTS(SELECT 1 FROM automation_rule_restore_holds h WHERE h.rule_id=r.id) restoreHeld
    FROM automation_rules r WHERE r.workspace_id=? AND r.team_id IS ? ORDER BY r.created_at,r.id`).bind(actor,access.workspace_id,teamId).all<Rule>()).results;
  const labels = (await db.prepare('SELECT id,name FROM labels WHERE workspace_id=? ORDER BY name,id').bind(access.workspace_id).all()).results;
  const destinations = (await db.prepare(`SELECT d.id,b.channel_name AS name FROM vector_webhook_destinations d JOIN vector_channel_bindings b ON b.destination_id=d.id
    JOIN operators o ON o.id=b.created_by WHERE d.workspace_id=? AND d.enabled=1 AND d.revoked_at IS NULL AND d.kind='slack'
    AND o.role IN ('owner','admin') AND o.removed_at IS NULL AND b.suspended_reason IS NULL
    AND EXISTS(SELECT 1 FROM json_each(b.events) WHERE value='automation.rule') ORDER BY b.channel_name,d.id`).bind(access.workspace_id).all()).results;
  await ruleAuthority(db,actor,teamId);
  return { rules, labels, destinations };
}
export async function saveRule(db: D1Database, actor: string, teamId: string | null, id: string | null, input: RuleInput, expectedVersion: number) {
  const access = await ruleAuthority(db,actor,teamId), ctx = await administrationContext(db,actor);
  const previous = id ? await db.prepare('SELECT * FROM automation_rules WHERE id=? AND workspace_id=? AND team_id IS ?').bind(id,access.workspace_id,teamId).first<Rule>() : null;
  if (id && !previous) throw new SettingsError('not_found','This rule is unavailable.',404);
  if ((previous?.version ?? 0) !== expectedVersion) throw new SettingsError('stale_rule','Refresh this rule before saving.',409);
  const ruleId = id ?? createUlid(new Date(ctx.at)), owner = previous?.owner_operator_id ?? actor;
  // Validation and these guards share the committing role and session fence.
  const candidate = { ...input, label_id: input.labelId, destination_id: input.destinationId, workspace_id: access.workspace_id, owner_operator_id: owner, team_id: teamId };
  const predicate = `SELECT ? AS destination_id,? AS workspace_id,? AS owner_operator_id,? AS team_id`;
  const eligible = await db.prepare(`SELECT 1 FROM (${predicate}) r WHERE ${eligibleDestination} AND ${liveRule()}`).bind(input.destinationId,access.workspace_id,owner,teamId).first();
  if (!eligible && (!previous || input.enabled)) throw new SettingsError('rule_destination_unavailable','Choose an active Slack binding approved by an Owner or Admin; the rule owner must retain authority.',409);
  const writes = [guard(ctx.db,'EXISTS(SELECT 1 FROM labels WHERE id=? AND workspace_id=?)',input.labelId,access.workspace_id),
    ...(!previous || input.enabled ? [guard(ctx.db,`EXISTS(SELECT 1 FROM (${predicate}) r WHERE ${eligibleDestination} AND ${liveRule()})`,input.destinationId,access.workspace_id,owner,teamId)] : [])];
  if (previous) {
    writes.push(guard(ctx.db,'EXISTS(SELECT 1 FROM automation_rules WHERE id=? AND version=?)',ruleId,expectedVersion),
      ctx.db.prepare(`UPDATE automation_rules SET name=?,label_id=?,priority=?,destination_id=?,monthly_budget=?,enabled=?,version=version+1,failure=NULL,failure_notified_at=NULL,updated_at=? WHERE id=? AND version=?`)
        .bind(input.name,input.labelId,input.priority,input.destinationId,input.monthlyBudget,Number(input.enabled),ctx.at,ruleId,expectedVersion));
  } else writes.push(ctx.db.prepare(`INSERT INTO automation_rules(id,workspace_id,team_id,owner_operator_id,name,label_id,priority,destination_id,monthly_budget,enabled,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)`)
    .bind(ruleId,access.workspace_id,teamId,owner,input.name,input.labelId,input.priority,input.destinationId,input.monthlyBudget,Number(input.enabled),ctx.at,ctx.at));
  writes.push(...audit(ctx,'automation.rule.saved',ruleId,input.name,previous,candidate));
  // An explicit save may re-enable restored configuration; historical pending
  // runs stay terminal so reviewing configuration cannot resurrect old effects.
  writes.push(ctx.db.prepare("UPDATE automation_rule_runs SET state='stopped',reason='rule_changed',completed_at=? WHERE rule_id=? AND state='pending'").bind(ctx.at,ruleId),
    ctx.db.prepare('DELETE FROM automation_rule_restore_holds WHERE rule_id=?').bind(ruleId));
  await commit(ctx,writes);
  return { id: ruleId, version: expectedVersion + 1 };
}
export async function dryRun(db: D1Database, actor: string, teamId: string | null, input: RuleInput) {
  const access = await ruleAuthority(db,actor,teamId);
  const rows = (await db.prepare(`SELECT i.id,i.identifier,i.title,i.priority FROM
    (SELECT i.* FROM issues i JOIN teams t ON t.id=i.team_id WHERE t.workspace_id=? AND (? IS NULL OR i.team_id=?)
      AND i.archived_at IS NULL ORDER BY i.updated_at DESC,i.id DESC LIMIT 100) i
    JOIN teams t ON t.id=i.team_id
    JOIN issue_labels l ON l.issue_id=i.id AND l.label_id=?
    WHERE ${ownerReadsIssue.replaceAll('r.owner_operator_id','?')} ORDER BY i.updated_at DESC,i.id DESC`)
    .bind(access.workspace_id,teamId,teamId,input.labelId,actor).all<{id:string;identifier:string;title:string;priority:string}>()).results;
  await ruleAuthority(db,actor,teamId);
  return { matches: rows.map(row => ({...row, changes: row.priority === input.priority ? [] : [{field:'priority',from:row.priority,to:input.priority}], notification:{destinationId:input.destinationId}})), writes: 0, notifications: 0 };
}
export async function readRunLog(db: D1Database, actor: string, teamId: string | null, id: string) {
  const access = await ruleAuthority(db,actor,teamId);
  if (!await db.prepare('SELECT 1 FROM automation_rules WHERE id=? AND workspace_id=? AND team_id IS ?').bind(id,access.workspace_id,teamId).first()) throw new SettingsError('not_found','This rule is unavailable.',404);
  const rows = (await db.prepare(`SELECT run.*,i.identifier,i.title FROM automation_rule_runs run JOIN automation_rules r ON r.id=run.rule_id
    JOIN issues i ON i.id=run.issue_id JOIN teams t ON t.id=i.team_id
    WHERE r.id=? AND ${ownerReadsIssue.replaceAll('r.owner_operator_id','?')} ORDER BY run.created_at DESC,run.id DESC LIMIT 100`).bind(id,actor).all()).results;
  await ruleAuthority(db,actor,teamId);
  return { runs: rows };
}
