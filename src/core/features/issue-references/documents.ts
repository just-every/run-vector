import { extractIssueIdentifiers } from './identifiers.server';

/** Append after the document and its revision in the guarded write batch.
 * Both the stored body and revision receipt must still match this command.
 * New backlinks require the author's current source and target visibility. */
export function documentReferenceStatements(db:D1Database,event:{documentId:string;actor:string;version:number;at:string},body:string):D1PreparedStatement[]{
 const identifiers=extractIssueIdentifiers(body);
 // Retained relationships follow the saved text even when this editor cannot
 // see their target. Only existing rows are reconciled; no hidden metadata is
 // returned or new hidden target admitted. The source and receipt stay scoped.
 const statements=[db.prepare(`UPDATE main.document_issue_references AS retained
   SET removed=CASE WHEN EXISTS(SELECT 1 FROM main.issues i WHERE i.id=retained.target_issue_id
     AND i.identifier IN(SELECT value FROM json_each(?))) THEN 0 ELSE 1 END,updated_at=?
   WHERE retained.document_id=? AND EXISTS(SELECT 1 FROM documents d
     JOIN document_revisions r ON r.document_id=d.id AND r.version=d.version
     WHERE d.id=retained.document_id AND d.version=? AND d.body=? AND r.body=d.body AND r.author_operator_id=?)`)
  .bind(JSON.stringify(identifiers),event.at,event.documentId,event.version,body,event.actor)];
 if(!identifiers.length)return statements;
 statements.push(db.prepare(`INSERT INTO document_issue_references(document_id,target_issue_id,removed,created_at,updated_at)
   SELECT d.id,i.id,0,?,? FROM documents d JOIN issues i JOIN teams t ON t.id=i.team_id AND t.workspace_id=d.workspace_id
   WHERE d.id=? AND d.version=? AND d.body=? AND i.identifier IN(SELECT value FROM json_each(?))
   AND EXISTS(SELECT 1 FROM document_revisions r WHERE r.document_id=d.id AND r.version=d.version AND r.body=d.body AND r.author_operator_id=?)
   ON CONFLICT(document_id,target_issue_id) DO UPDATE SET removed=0,updated_at=excluded.updated_at`)
  .bind(event.at,event.at,event.documentId,event.version,body,JSON.stringify(identifiers),event.actor));
 return statements;
}
