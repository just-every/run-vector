/** Slack intake must not leave an identifier reservation on a refused source.
 * Plan the reservation with an optimistic prefix guard, then execute it in the
 * same native creation batch as the issue, source receipt and mapped root. */
export async function threadAllocation(db:D1Database,team:string,at:string){
 const current=await db.prepare(`SELECT t.identifier_prefix AS prefix,COALESCE(s.last_sequence,0) AS previous
 FROM teams t LEFT JOIN issue_prefix_sequences s ON s.workspace_id=t.workspace_id AND s.identifier_prefix=t.identifier_prefix
 WHERE t.id=? AND t.archived_at IS NULL`).bind(team).first<{prefix:string;previous:number}>();
 if(!current)throw Error('Slack intake team is unavailable');
 const sequence=current.previous+1;
 return {prefix:current.prefix,sequence,writes:[
  db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM teams t WHERE t.id=? AND t.identifier_prefix=? COLLATE BINARY
   AND COALESCE((SELECT s.last_sequence FROM issue_prefix_sequences s WHERE s.workspace_id=t.workspace_id AND s.identifier_prefix=t.identifier_prefix),0)=?) THEN 1 ELSE json('slack allocation changed') END`).bind(team,current.prefix,current.previous),
  db.prepare('INSERT INTO team_issue_sequences(team_id,last_sequence,updated_at) VALUES(?,?,?) ON CONFLICT(team_id) DO UPDATE SET last_sequence=excluded.last_sequence,updated_at=excluded.updated_at').bind(team,sequence,at),
 ]};
}
