import { expect } from 'vitest';
import type { Part } from '@runeditrun/rer/modules/portability';
import type { ArchiveRecords } from './http-archive-fixture';

type AuditRow = Record<string, unknown>;
const restoredActions = ['archive.import.completed', 'auth.signed_in', 'archive.export.started'];

/** Audit history is append-only: old rows survive byte-for-byte, and every new
 * row must correspond to an explicitly expected action, including multiplicity. */
export function expectAuditRowsHistory(before: AuditRow[], after: AuditRow[], expectedActions: string[]) {
  expect(new Set(after.map(row => row.id)).size).toBe(after.length);
  const priorIds = new Set(before.map(row => row.id));
  for (const row of before) expect(after.find(current => current.id === row.id)).toEqual(row);
  const added = after.filter(row => !priorIds.has(row.id));
  expect(added.map(row => row.action).sort()).toEqual([...expectedActions].sort());
  for (const row of added) {
    expect(row.actor_kind).toBe('person');
    expect(row.actor_reference).toEqual(expect.any(String));
  }
}

export async function readAuditRows(db: D1Database): Promise<AuditRow[]> {
  return (await db.prepare('SELECT * FROM audit_records ORDER BY id').all<AuditRow>()).results;
}

/** Restoration retains every archived value. New sign-ins and exports add
 * events, so their audit-table transport ordinals can move on re-export. */
export function expectAuditArchiveHistory(before: ArchiveRecords, after: ArchiveRecords, expectedActions = restoredActions) {
  const items = (records: ArchiveRecords) => records.filter((r): r is Part => r.kind === 'part').flatMap(r => r.items);
  const original = items(before), restored = items(after);
  const audit = (item: typeof original[number]) => item.kind === 'row' && item.table === 'audit_records';
  expect(restored.filter(item => !audit(item))).toEqual(original.filter(item => !audit(item)));
  const rows = (entries: typeof original) => entries.flatMap(item => audit(item) && item.kind === 'row' ? [item.row] : []);
  expectAuditRowsHistory(rows(original), rows(restored), expectedActions);
}
