import type {D1Sql} from '../../../../../vendor/base/import-kit/src/d1/index';

const holds=(alias:string)=>`EXISTS(SELECT 1 FROM json_each(?) person
 WHERE instr(lower(${alias}.body),person.value)>0 OR instr(lower(${alias}.sources_json),person.value)>0)`;
const affected=`SELECT d.release_id FROM release_note_drafts d WHERE d.erased_at IS NULL AND
 (${holds('d')} OR EXISTS(SELECT 1 FROM release_note_revisions v WHERE v.release_id=d.release_id AND ${holds('v')}))`;

/** Explicit person erasure withdraws the whole affected draft and its history.
 * Keep a terminal receipt so a delayed save or generation cannot resurrect it.
 * These statements join the native erasure and archive-redaction transaction.
 */
export async function releaseNotesErasure(db:D1Database,values:string[],at:string){
 const list=JSON.stringify(values);
 const count=(await db.prepare(`SELECT count(*) n FROM (${affected})`).bind(list,list).first<number>('n'))??0;
 const statements:D1Sql[]=[
  {sql:`UPDATE release_note_drafts SET body='',sources_json='[]',erased_at=?,updated_at=? WHERE release_id IN(${affected})`,params:[at,at,list,list]},
  {sql:`UPDATE release_note_revisions SET body='',sources_json='[]' WHERE release_id IN(SELECT release_id FROM release_note_drafts WHERE erased_at IS NOT NULL)`,params:[]},
 ];
 return {count,statements};
}
