export function issueRoutingStatement(db: D1Database, issueId: string) {
  return db.prepare(`SELECT i.triage_route_json AS value,person.name AS configuredByName FROM issues i
    LEFT JOIN operators person ON person.id=json_extract(i.triage_route_json,'$.configuredBy') AND person.removed_at IS NULL
    WHERE i.id=? AND i.triage_route_json IS NOT NULL`).bind(issueId);
}
export function issueRoutingProjection(row?: { value: string; configuredByName: string | null }) {
  return row ? { ...JSON.parse(row.value), configuredByName: row.configuredByName } : null;
}
