import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import type {closureFixture} from './cycle-closure-fixture';

/** Real native decisions/deletion preserve the new domain graph in HTTP archives. */
export async function archiveDeletionHistory(f:Awaited<ReturnType<typeof closureFixture>>) {
 const canonical=await f.create({title:'HTTP canonical'}),duplicate=await f.create({title:'HTTP duplicate'});
 expect((await f.call('/issues/'+duplicate.identifier+'/duplicate','POST',{expectedVersion:duplicate.version,canonicalIdentifier:canonical.identifier})).status).toBe(200);
 const erased=await f.create({title:'HTTP deleted before export'}),at='2026-09-02T00:00:00.000Z';
 await env.DB.batch([
  env.DB.prepare("INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,writer_settled,created_at,updated_at) VALUES('http-unsettled',?,?,'Pending source','text/plain',3,'http-unsettled','pending',0,?,?)").bind(erased.id,f.owner,at,at),
  env.DB.prepare("INSERT INTO vector_source_records(source_id,record_id,issue_id,created_at) VALUES('http-erased-source','http-erased-record',?,?)").bind(erased.id,at),
  env.DB.prepare("INSERT INTO vector_source_receipts(source_id,record_id,revision_id,payload_hash,issue_id,evidence_id,received_at) VALUES('http-erased-source','http-erased-record','http-erased-revision','http-erased-payload',?,'http-erased-evidence',?)").bind(erased.id,at),
 ]);
 const response=await f.call('/issues/'+erased.identifier,'DELETE',{expectedVersion:erased.version,confirmed:true});
 expect(response.status,await response.clone().text()).toBe(202);
 const deletionReceipt=await response.json();
 expect(await env.DB.prepare('SELECT count(*) FROM vector_webhook_erasures WHERE identifier=?').bind(erased.identifier).first<number>('count(*)')).toBeGreaterThan(0);
 for(const table of ['vector_source_records','vector_source_receipts'])expect(await env.DB.prepare('SELECT erased FROM '+table+' WHERE source_id=?').bind('http-erased-source').first<number>('erased')).toBe(1);
 return {canonical,duplicate,erased,deletionReceipt};
}
