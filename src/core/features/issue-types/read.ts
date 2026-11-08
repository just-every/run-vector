import type { IssueType } from './schema'
export async function readTeamTypes(db: D1Database, teamId: string) {
 const [team, rows] = await Promise.all([
  db.prepare('SELECT issue_types_enabled FROM teams WHERE id=?').bind(teamId).first<{issue_types_enabled:number}>(),
  db.prepare(`SELECT ty.id,ty.team_id AS teamId,ty.name,ty.icon,ty.default_key AS defaultKey,ty.version,
   (SELECT json_group_array(field_id) FROM (SELECT field_id FROM issue_type_required_fields WHERE type_id=ty.id ORDER BY field_id)) AS requiredFields
   FROM issue_types ty JOIN teams t ON t.id=ty.team_id WHERE ty.team_id=? ORDER BY ty.position,ty.id`).bind(teamId).all<Omit<IssueType,'requiredFieldIds'> & { requiredFields:string }>(),
 ])
 return { enabled: team?.issue_types_enabled === 1, types: rows.results.map(({requiredFields,...type}) => ({...type,requiredFieldIds:JSON.parse(requiredFields) as string[]})) }
}
