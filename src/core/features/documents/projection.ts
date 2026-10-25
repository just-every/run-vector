/** Part of the same scoped issue snapshot as all other retained relations. */
export function issueSpecificationStatement(db:D1Database,issueId:string){
 return db.prepare('SELECT d.id,d.title FROM issue_specifications s JOIN documents d ON d.id=s.document_id WHERE s.issue_id=?').bind(issueId);
}
export type SpecificationRow={id:string;title:string};
