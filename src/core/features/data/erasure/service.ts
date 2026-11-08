import { auditStatement } from '../../audit/producer';
import { readD1ErasureJournal, retireD1ImportCustody, upgradeD1ImportErasureIndex } from '../../../../../vendor/base/import-kit/src/d1/index';
import { createVectorArchive } from '../archive-service.mjs';
import { importContext, type ImportActor } from '../import/authority';
import { ImportError } from '../import/types';
import { importedStatements } from './imported';
import { personValues, relatedMatchers, type ErasureSubject } from './subject';

/** Workers' D1 prepared statements carry their text and bindings as `statement` and `params`. */
const asD1Sql = (prepared: D1PreparedStatement) => { const { statement, params } = prepared as unknown as { statement: string; params: unknown[] }; return { sql: statement, params: [...params] }; };

const activePeopleSql = `SELECT 1 FROM main.operators WHERE removed_at IS NULL AND (lower(email) IN (SELECT value FROM json_each(?)) OR lower(trim(name)) IN (SELECT value FROM json_each(?)))
    UNION ALL SELECT 1 FROM oa_operators WHERE status<>'inactive' AND (lower(email) IN (SELECT value FROM json_each(?)) OR lower(trim(display_name)) IN (SELECT value FROM json_each(?))) LIMIT 1`;

/** Active native members and invitations must be removed before personal-data erasure. */
async function refuseActive(db: D1Database, values: string[]) {
  const active = await db.prepare(activePeopleSql)
    .bind(...Array(4).fill(JSON.stringify(values))).first();
  if (active) throw new ImportError(409, 'operator_active', 'This email or name belongs to a current operator or invitation. Remove them in Settings first; removal transfers their work.');
  // Door outcomes, reviews and pending arguments can retain imported text.
  // Admission precedes capture, so an admitted agent also covers in-flight work.
  if(await db.prepare('SELECT 1 FROM agent_door_agents LIMIT 1').first())
    throw new ImportError(409,'agent_custody_unavailable','Personal-data erasure is held while agent records may retain this data. Retained agent artifacts need a reviewed redaction and execution fence before erasure can proceed.');
}

/** Base 479094f drops a job's erasure-index receipt when an erasure moves its
 * severed records' index rows, so every later erasure (issue deletion included)
 * would refuse IMPORT_ERASURE_INDEX_UPGRADE_REQUIRED. Base's public bounded
 * upgrade rebuilds those receipts from the exact plans; run it to completion. */
async function reindex(context: ReturnType<typeof importContext>) {
  for (let page = 0; page < 1000; page++) if ((await upgradeD1ImportErasureIndex(context)).complete) return;
  throw new ImportError(503, 'erasure_index_unavailable', 'Import custody could not be re-indexed; try again.');
}

/** Counts only: what Vector's own tables hold of the person. Import custody
 * reports what it erased in the receipt's journal entry. */
export async function previewPersonErasure(db: D1Database, subject: ErasureSubject) {
  const values = personValues(subject);
  await refuseActive(db, values);
  return { imported: (await importedStatements(db, values, new Date().toISOString())).counts };
}

/** One D1 batch: Vector's copies, import custody (matching records become
 * tombstones in applied and pending runs, matching originals are withdrawn, runs
 * labelled with the email are retired) and portability's redaction checkpoint,
 * so an archive made before is refused on restore when a later journal is given. */
export async function erasePerson(db: D1Database, files: R2Bucket, actor: ImportActor, subject: ErasureSubject) {
  const values = personValues(subject);
  await refuseActive(db, values);
  const at = new Date().toISOString();
  const product = await importedStatements(db, values, at);
  // Before suspension existed, native removal had already anonymized these
  // identities. Preserve that existing erase outcome after reversible removal;
  // this is not ROLE-012's separate member preview and confirmation flow.
  const matchingRemoved = `SELECT id FROM main.operators WHERE workspace_id=? AND removed_at IS NOT NULL
    AND (lower(email) IN (SELECT value FROM json_each(?)) OR lower(trim(name)) IN (SELECT value FROM json_each(?)))`;
  const matchingValues = [actor.workspace, JSON.stringify(values), JSON.stringify(values)];
  product.statements.push(
    // Native title events kept the member's name during suspension. Explicit
    // erasure restores the existing event redaction before any agent admission.
    {sql:`UPDATE agent_door_events SET event=json_set(event,'$.actor.person.name','Removed operator')
      WHERE json_extract(event,'$.type')='issue.updated' AND json_extract(event,'$.actor.kind')='person'
      AND json_extract(event,'$.actor.person.id') IN(${matchingRemoved})`,params:matchingValues},
    {sql:`UPDATE oa_operators SET email=(SELECT operator_id||'@removed.invalid' FROM vector_auth_operators WHERE auth_id=oa_operators.id),display_name='Removed operator'
      WHERE id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id IN(${matchingRemoved}))`,params:matchingValues},
    {sql:`UPDATE operators SET name='Removed operator',email=id||'@removed.invalid',suspended_at=NULL,suspended_by=NULL,updated_at=?
      WHERE id IN(${matchingRemoved})`,params:[at,...matchingValues]},
  );
  const portability = await createVectorArchive({ db, files });
  const checkpoint = [...await portability.invalidateTransfersStatements(), ...await portability.redactionStatements()].map(asD1Sql);
  const context = importContext(db, actor, 'vector-erasure', 'native-v1');
  context.originalErasurePolicy = 'withdraw-affected-artifacts';
  await reindex(context);
  try {
    const { nativeResults: _, ...journal } = await retireD1ImportCustody({ target: { kind: 'person', id: 'erased:' + values.join('\u0000') }, values: subject.email ? [subject.email] : [], related: relatedMatchers(values) },
      [{sql:`SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM agent_door_agents) AND NOT EXISTS(${activePeopleSql}) THEN 1 ELSE json('IMPORT_ATOMIC_GUARD') END`,params:Array(4).fill(JSON.stringify(values))},...product.statements, auditStatement({workspace:actor.workspace,actor:actor.id,action:'person.erased',subject:'erasure:'+crypto.randomUUID()})], context, checkpoint);
    await reindex(context);
    return { journal, imported: product.counts };
  } catch (error) {
    if (error instanceof Error && /IMPORT_ATOMIC_GUARD|IMPORT_ERASURE|ik_d1_assertions/i.test(error.message))
      throw new ImportError(409, 'erasure_conflict', 'An import changed while erasing. Nothing was erased; preview again.');
    throw error;
  }
}

export async function erasureJournal(db: D1Database, actor: ImportActor) {
  return readD1ErasureJournal(importContext(db, actor, 'vector-erasure', 'native-v1'));
}
