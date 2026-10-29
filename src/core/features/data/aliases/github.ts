import {aliasTargetSql} from './identity';
import {githubReferenceKind} from '../../integrations/github/input';
export async function githubAliasIssues(db:D1Database,workspace:string,refs:string[]) {
 const rows=(await db.prepare(`SELECT i.id,i.identifier,i.version,keys.value AS matchedKey FROM json_each(?) keys
  CROSS JOIN (SELECT ? AS workspace) scope JOIN issues i ON i.id=${aliasTargetSql('scope.workspace','keys.value')}
  JOIN teams t ON t.id=i.team_id AND t.workspace_id=scope.workspace`).bind(JSON.stringify(refs),workspace)
  .all<{id:string;identifier:string;version:number;matchedKey:string}>()).results;
 return [...new Set(rows.map(row=>row.id))].map(id=>({...rows.find(row=>row.id===id)!,matchedKeys:rows.filter(row=>row.id===id).map(row=>row.matchedKey)}));
}
export function aliasReferenceKind(keys:string[],...texts:(string|null|undefined)[]) {
 const kinds=keys.map(key=>githubReferenceKind(key,...texts));
 return kinds.includes('closes')?'closes':kinds.includes('contributes')?'contributes':'reference';
}

/** Re-evaluate identity and prefix activation inside the signed write batch. */
export function githubAliasGuard(db:D1Database,workspace:string,keys:string[],issue:string) {
 return db.prepare(`SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM json_each(?) keys CROSS JOIN (SELECT ? AS workspace) scope
  WHERE ${aliasTargetSql('scope.workspace','keys.value')} IS NOT ?) THEN 1 ELSE json('github alias changed') END`)
  .bind(JSON.stringify(keys),workspace,issue);
}
