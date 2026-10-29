import {createUlid} from '../../shared/ids';
import {isMutationAccessError,RestoreReservationError,AuthorityChangedError,VisibilityChangedError} from '../auth/mutation-database';
import {mergeTask} from '../description-history/tasks';
import type {ChecklistInput} from '../description-history/schema';
import {IntegrationError} from '../integrations/errors';
import {readDocument} from './repository';

export class DocumentChecklistConflict extends IntegrationError {
 constructor(readonly document:Awaited<ReturnType<typeof readDocument>>){super(409,'stale_document','The checklist item changed. Review the current document before trying again.');}
}

/** The current document, its attributed revision and the audit commit together. */
export async function tickDocumentTask(db:D1Database,actor:string,id:string,input:ChecklistInput){
 let current=await readDocument(db,actor,id);
 const base=await db.prepare('SELECT body FROM document_revisions WHERE document_id=? AND version=?')
  .bind(id,input.expectedVersion).first<{body:string}>();
 for(let attempt=0;attempt<3;attempt++){
  const body=base&&input.expectedVersion<=current.version?mergeTask(current.body,base.body,input.index,input.text,input.checked):null;
  if(body===null)throw new DocumentChecklistConflict(current);
  if(body===current.body){await db.batch([db.prepare('SELECT 1')]);return readDocument(db,actor,id);}
  const now=new Date(),at=now.toISOString(),revision=createUlid(now);
  try{
   await db.batch([
    db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM documents WHERE id=? AND version=? AND body=?) THEN 1 ELSE json('document checklist revision mismatch') END").bind(id,current.version,current.body),
    db.prepare('INSERT INTO document_revisions(id,document_id,version,title,body,author_operator_id,created_at,checklist_json) VALUES(?,?,?,?,?,?,?,?)')
     .bind(revision,id,current.version+1,current.title,body,actor,at,JSON.stringify({index:input.index,text:input.text,checked:input.checked})),
    db.prepare('UPDATE documents SET body=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(body,at,id,current.version),
    db.prepare("INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at) VALUES(?,?,'document.checklist',?,?,?,?)")
     .bind(revision,actor,id,id,at,at),
   ]);
   return readDocument(db,actor,id);
  }catch(error){
   if(isMutationAccessError(error)||error instanceof RestoreReservationError||error instanceof AuthorityChangedError||error instanceof VisibilityChangedError)throw error;
   const latest=await readDocument(db,actor,id);
   if(latest.version===current.version)throw error;
   current=latest;
  }
 }
 throw new DocumentChecklistConflict(current);
}
