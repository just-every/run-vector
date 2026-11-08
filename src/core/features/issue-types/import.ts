import type { FieldCatalogue } from '../custom-fields/validation'
export async function importFieldCatalogue(db:D1Database,workspace:string):Promise<FieldCatalogue> {
 const [definitions,options,types,requirements]=await db.batch([
  db.prepare('SELECT d.id,d.team_id,d.name,d.type FROM custom_field_definitions d JOIN teams t ON t.id=d.team_id WHERE t.workspace_id=?').bind(workspace),
  db.prepare('SELECT o.id,o.field_id,o.name FROM custom_field_options o JOIN custom_field_definitions d ON d.id=o.field_id JOIN teams t ON t.id=d.team_id WHERE t.workspace_id=?').bind(workspace),
  db.prepare('SELECT ty.id,ty.team_id,t.issue_types_enabled enabled FROM issue_types ty JOIN teams t ON t.id=ty.team_id WHERE t.workspace_id=?').bind(workspace),
  db.prepare('SELECT r.type_id,r.field_id,d.name FROM issue_type_required_fields r JOIN custom_field_definitions d ON d.id=r.field_id JOIN teams t ON t.id=d.team_id WHERE t.workspace_id=?').bind(workspace),
 ])
 return {definitions:definitions.results as FieldCatalogue['definitions'],options:options.results as FieldCatalogue['options'],types:types.results as FieldCatalogue['types'],requirements:requirements.results as FieldCatalogue['requirements']}
}
