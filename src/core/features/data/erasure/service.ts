import { readD1ErasureJournal, retireD1ImportCustody, upgradeD1ImportErasureIndex } from '../../../../../vendor/base/import-kit/src/d1/index';
import { createVectorArchive } from '../archive-service.mjs';
import { importContext, type ImportActor } from '../import/authority';
import { ImportError } from '../import/types';
import { importedStatements } from './imported';
import { personValues, relatedMatchers, type ErasureSubject } from './subject';

/** Workers' D1 prepared statements carry their text and bindings as `statement` and `params`. */
const asD1Sql = (prepared: D1PreparedStatement) => { const { statement, params } = prepared as unknown as { statement: string; params: unknown[] }; return { sql: statement, params: [...params] }; };

/** A current member is never erased by name or email: OPS-004 removal comes first.
 * Removal already replaces their email and name on the operator and sign-in rows
 * (migration 0011's removal trigger) and revokes their sessions and tokens, so an
 * erased person's values remain only where imports copied them. */
async function refuseActive(db: D1Database, values: string[]) {
  const active = await db.prepare(`SELECT 1 FROM operators WHERE removed_at IS NULL AND (lower(email) IN (SELECT value FROM json_each(?)) OR lower(trim(name)) IN (SELECT value FROM json_each(?)))
    UNION ALL SELECT 1 FROM oa_operators WHERE status<>'inactive' AND (lower(email) IN (SELECT value FROM json_each(?)) OR lower(trim(display_name)) IN (SELECT value FROM json_each(?))) LIMIT 1`)
    .bind(...Array(4).fill(JSON.stringify(values))).first();
  if (active) throw new ImportError(409, 'operator_active', 'This email or name belongs to a current operator or invitation. Remove them in Settings first; removal transfers their work.');
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
  const product = await importedStatements(db, values, new Date().toISOString());
  const portability = await createVectorArchive({ db, files });
  const checkpoint = [...await portability.invalidateTransfersStatements(), ...await portability.redactionStatements()].map(asD1Sql);
  const context = importContext(db, actor, 'vector-erasure', 'native-v1');
  context.originalErasurePolicy = 'withdraw-affected-artifacts';
  await reindex(context);
  try {
    const { nativeResults: _, ...journal } = await retireD1ImportCustody({ target: { kind: 'person', id: 'erased:' + values.join('\u0000') }, values: subject.email ? [subject.email] : [], related: relatedMatchers(values) },
      product.statements, context, checkpoint);
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
