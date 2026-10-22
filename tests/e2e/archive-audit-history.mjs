import assert from 'node:assert/strict';

/** Public archive commands preserve all work and prior audit history; the
 * commands themselves append exactly their own audit events. */
export function assertArchiveHistory(before, after, actions) {
 const items = records => records.filter(row => row.kind === 'part').flatMap(row => row.items);
 const audit = item => item.kind === 'row' && item.table === 'audit_records';
 const original = items(before), restored = items(after);
 assert.deepEqual(restored.filter(item => !audit(item)), original.filter(item => !audit(item)));
 const prior = original.filter(audit).map(item => item.row);
 const current = restored.filter(audit).map(item => item.row);
 assert.equal(new Set(current.map(row => row.id)).size, current.length);
 for (const row of prior) assert.deepEqual(current.find(entry => entry.id === row.id), row);
 const added = current.filter(row => !prior.some(entry => entry.id === row.id));
 assert.deepEqual(added.map(row => row.action).sort(), [...actions].sort());
 for (const row of added) {
  assert.equal(row.actor_kind, 'automation');
  assert.equal(row.actor_reference, 'automation:' + row.action);
 }
}
