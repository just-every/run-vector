export type FirstRunState = {
  owner: boolean;
  completed: boolean;
  workspace: string;
  timezone: string;
  team: string;
  prefix: string;
};

export async function firstRunState(db: D1Database, operatorId: string): Promise<FirstRunState> {
  const row = await db.prepare(`SELECT i.setup_operator_id, i.setup_completed_at, w.name, w.timezone,
    (SELECT name FROM teams WHERE workspace_id=w.id ORDER BY created_at,id LIMIT 1) team,
    (SELECT identifier_prefix FROM teams WHERE workspace_id=w.id ORDER BY created_at,id LIMIT 1) prefix
    FROM operators o JOIN workspace_settings w ON w.id=o.workspace_id
    LEFT JOIN workspace_installation i ON i.workspace_id=w.id
    WHERE o.id=? AND o.removed_at IS NULL`).bind(operatorId)
    .first<{setup_operator_id:string|null;setup_completed_at:string|null;name:string;timezone:string;team:string|null;prefix:string|null}>();
  if (!row) throw Error('Workspace is unavailable');
  const owner = row.setup_operator_id === operatorId;
  return {owner, completed: !owner || row.setup_completed_at !== null, workspace:row.name,
    timezone:row.timezone, team:row.team ?? '', prefix:row.prefix ?? ''};
}
