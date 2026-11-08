/** Disabling is visible in each typed issue's activity without clearing its identity. */
export function disabledTypeHistory(db: D1Database, teamId: string, actor: string, at: string, event: string) {
 return db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
 SELECT ?||substr(i.id,11),i.id,?,'issue.types_disabled',json_object('issueTypeId',ty.id,'name',ty.name,'icon',ty.icon),
 json_object('issueTypeId',ty.id,'enabled',json('false')),?,? FROM issues i JOIN issue_types ty ON ty.id=i.issue_type_id WHERE i.team_id=?`)
 .bind(event.slice(0,10),actor,at,at,teamId)
}
