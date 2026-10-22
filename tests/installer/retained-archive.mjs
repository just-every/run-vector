import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileRecords} from '@runeditrun/rer/modules/portability/files';
import {readArchive,excludedTable} from '@runeditrun/rer/modules/portability';

// Retained synthetic backup from pr's listed-version installation: native
// issues, comments, evidence, dependency, project, cycle, label and file bytes.
// Compare its contents, rather than pinning a schema digest or version string.
export async function compareRetainedArchive(archive,env,{auditActions=[]}={}) {
 let manifest;const rows=new Map(),objects=new Map();
 for await(const record of fileRecords(archive,readArchive)) {
  if(record.kind==='manifest')manifest=record;
  if(record.kind==='part')for(const item of record.items) {
   if(item.kind==='row') {if(!rows.has(item.table))rows.set(item.table,[]);rows.get(item.table).push(item.row);}
   if(item.kind==='object') {const key=item.bucket+'/'+item.key;objects.set(key,Buffer.concat([objects.get(key)??Buffer.alloc(0),Buffer.from(item.data,'base64')]));}
  }
 }
 const quote=value=>'"'+value.replaceAll('"','""')+'"';
 for(const table of manifest.tables.filter(table=>!excludedTable(table.name,{includeTables:['oa_operators']}))) {
  const columns=table.columns.filter(column=>!column.generated&&!column.hidden).map(column=>column.name);
  let stored=(await env.DB.prepare('SELECT '+columns.map(quote).join(',')+' FROM '+quote(table.name)).all()).results;
  if(table.name==='audit_records') {
   const originalIds=new Set((rows.get(table.name)??[]).map(row=>row.id));
   const additions=stored.filter(row=>!originalIds.has(row.id));
   assert.deepEqual(additions.map(row=>row.action).sort(),[...auditActions].sort(),'only the performed archive commands append audit history');
   for(const row of additions) {
    const job=await env.DB.prepare('SELECT id,kind,phase,actor FROM rer_portability_jobs WHERE id=?').bind(row.subject_id).first();
    assert(job,'each new audit event names a real archive command');
    const completed=row.action.endsWith('.completed');
    assert.equal(row.action,`archive.${job.kind}.${completed?'completed':'started'}`);
    assert.equal(row.id,(completed?'archive-complete:':'archive:')+job.id);
    assert.equal(row.actor_operator_id,job.actor);
    assert.equal(row.subject_identifier,job.id);
    assert(Number.isFinite(Date.parse(row.created_at)));
    if(completed)assert.equal(job.phase,'complete');
   }
   stored=stored.filter(row=>originalIds.has(row.id));
  }
  const normalize=row=>JSON.stringify(columns.map(name=>row[name]&&typeof row[name]==='object'?Array.from(row[name].blob?Buffer.from(row[name].blob,'base64'):new Uint8Array(row[name])):row[name]));
  assert.deepEqual(stored.map(normalize).sort(),(rows.get(table.name)??[]).map(normalize).sort(),table.name);
 }
 for(const [key,bytes] of objects) {
  const [bucket,...path]=key.split('/'),object=await env[bucket].get(path.join('/'));
  assert(object,'Archived object restored');
  const hash=value=>createHash('sha256').update(value).digest('hex');
  assert.equal(hash(Buffer.from(await object.arrayBuffer())),hash(bytes),'Archived file bytes retained');
 }
 assert.deepEqual((await env.DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
}
