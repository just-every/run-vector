import { env } from 'cloudflare:workers'
import { it } from 'vitest'
import { provePopulatedUpgrade } from './populated-upgrade'
it('populated installations retain every prior issue and archive across the additive issue-type upgrade',async()=>{
 await provePopulatedUpgrade('0133_issue_types.sql',{
  until:'0133_issue_types.sql',removed:[],changed:['table teams','table issues'],
  added:['table issue_types','table issue_type_required_fields','index issues_type_idx','trigger issue_type_insert','trigger issue_type_update','trigger issue_type_requirement_insert','trigger issue_types_revision_update','trigger issue_types_team_revision'],
 },['issues'],async()=>{
  await env.DB.prepare('UPDATE issues SET custom_fields_json=? WHERE id=(SELECT id FROM issues ORDER BY id LIMIT 1)').bind(JSON.stringify({legacy:'synthetic-vector-kept'})).run()
 })
},180_000)
