import {createUlid} from '../../shared/ids';
import {gitGuard} from '../integrations/github/rules';
import {mergeTask} from '../description-history/tasks';
import type {ChecklistInput} from '../description-history/schema';
import {readDocument} from './repository';

/** Read the original revision, then merge only an unchanged task. The revision,
 * activity and body share the native session and authority transaction fence. */
export async function tickDocumentTask(db:D1Database,actor:string,id:string,input:ChecklistInput){
 let current=await readDocument(db,actor,id);
 const expected=await db.prepare('SELECT body FROM document_revisions WHERE document_id=? AND version=?')
  .bind(id,input.expectedVersion).first<{body:string}>();
 for(let attempt=0;attempt<3;attempt++){
  const body=expected?mergeTask(current.body,expected.body,input.index,input.text,input.checked):null;
  if(body===null)return {written:false,document:await readDocument(db,actor,id)};
  if(body===current.body)return {written:true,document:await readDocument(db,actor,id)};
  const now=new Date(),at=now.toISOString(),revision=createUlid(now),activity=createUlid(now);
  try{
   await db.batch([
    gitGuard(db,'EXISTS(SELECT 1 FROM documents WHERE id=? AND version=? AND body=?)',id,current.version,current.body),
    db.prepare('INSERT INTO document_revisions(id,document_id,version,title,body,author_operator_id,created_at,checklist_json) VALUES(?,?,?,?,?,?,?,?)')
     .bind(revision,id,current.version+1,current.title,body,actor,at,JSON.stringify({index:input.index,text:input.text,checked:input.checked})),
    db.prepare("INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at) VALUES(?,?,'document.checklist_toggled',?,?,?,?)")
     .bind(activity,actor,id,revision,at,at),
    db.prepare('UPDATE documents SET body=?,version=version+1,updated_at=? WHERE id=? AND version=?')
     .bind(body,at,id,current.version),
   ]);
   return {written:true,document:await readDocument(db,actor,id)};
  }catch(error){
   const latest=await readDocument(db,actor,id);
   if(latest.version===current.version)throw error;
   current=latest;
  }
 }
 return {written:false,document:await readDocument(db,actor,id)};
}
