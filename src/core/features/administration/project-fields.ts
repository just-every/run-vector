import { createUlid } from '../../shared/ids';
import { guard, SettingsError, type AdministrationContext } from './transaction';

export function validateProjectDates(start: string | null, target: string | null) {
  if (start !== null && target !== null && target < start)
    throw new SettingsError('invalid_project_dates', 'Target date must be on or after the start date.', 400);
}
export function projectActivity(ctx: AdministrationContext, id: string, kind: string, previous: unknown, next: unknown) {
  return ctx.db.prepare('INSERT INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(createUlid(new Date(ctx.at)), id, ctx.actor, kind, JSON.stringify(previous), JSON.stringify(next), ctx.at, ctx.at);
}
export async function readProjectLabelIds(ctx: AdministrationContext, id: string) {
  return (await ctx.db.prepare('SELECT label_id FROM project_labels WHERE project_id=? ORDER BY label_id').bind(id).all<{label_id:string}>()).results.map(l => l.label_id);
}
export function projectLabelWrites(ctx: AdministrationContext, id: string, labels: string[]) {
  return [
    ...labels.map(label => guard(ctx.db, 'EXISTS(SELECT 1 FROM labels WHERE id=? AND workspace_id=? AND projects_enabled=1)', label, ctx.workspace)),
    ctx.db.prepare('DELETE FROM project_labels WHERE project_id=?').bind(id),
    ...labels.map(label => ctx.db.prepare('INSERT INTO project_labels(project_id,label_id,created_at) VALUES(?,?,?)').bind(id, label, ctx.at)),
  ];
}
export function projectFieldActivity(ctx: AdministrationContext, id: string, previous: Record<string, unknown>, next: Record<string, unknown>) {
  return ['startDate','targetDate','priority','labelIds'].filter(key => JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
    .map(key => projectActivity(ctx, id, `project.${key}_changed`, previous[key], next[key]));
}
